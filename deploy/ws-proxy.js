/**
 * Lightweight workspace reverse proxy.
 * Routes requests to the correct GSD instance based on auth token.
 * Features:
 * - Auto-relaunches workspace if GSD has stopped
 * - Translates old tokens to new tokens seamlessly (user never notices restart)
 * - Handles EventSource _token query param
 */
const http = require("http");
const { createClient } = require("@libsql/client");
const { createDecipheriv, scryptSync } = require("crypto");
const { resolve } = require("path");

const PORT = process.env.WS_PROXY_PORT || 3001;
const PORTAL_PORT = process.env.PORT || 3000;
const runtimeRoot = process.env.RUNTIME_ROOT_DIR || "/app/.runtime";
const dbRelative = process.env.SQLITE_DB_PATH || "data/portal.db";
const DB_PATH = resolve(runtimeRoot, dbRelative);
const AUTH_SECRET = process.env.AUTH_SECRET || "";
const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:29000";
const SALT = "gsd-portal-token-encryption";

const db = createClient({ url: `file:${DB_PATH}` });

let decryptKey;
try { decryptKey = scryptSync(AUTH_SECRET, SALT, 32); }
catch { console.error("[ws-proxy] AUTH_SECRET not set"); }

function decrypt(encrypted) {
  const [ivHex, authTagHex, ciphertext] = encrypted.split(":");
  if (!ivHex || !authTagHex || !ciphertext) return null;
  try {
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = createDecipheriv("aes-256-gcm", decryptKey, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(ciphertext, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch { return null; }
}

// ── Token memory ──
// Maps ANY token ever seen → userId, so old tokens still resolve after restart
const knownTokens = new Map(); // token → userId

// Maps client IP → last known token (for requests without Authorization header)
const clientTokens = new Map(); // ip → token

// Short-lived cache for resolved data
const resolveCache = new Map(); // token → { data, time }
const CACHE_TTL = 5000;

/**
 * Get the current valid token and port for a userId.
 */
async function getCurrentSession(userId) {
  try {
    const userResult = await db.execute({ sql: "SELECT username FROM users WHERE id = ?", args: [userId] });
    const username = userResult.rows[0]?.username || "unknown";

    const sessions = await db.execute({ sql: "SELECT access_token FROM workspace_sessions WHERE user_id = ?", args: [userId] });
    const currentToken = sessions.rows.length > 0 ? decrypt(sessions.rows[0].access_token) : null;

    const instances = await db.execute({
      sql: "SELECT port FROM workspace_instances WHERE user_id = ? AND status = 'RUNNING' LIMIT 1",
      args: [userId]
    });
    const port = instances.rows.length > 0 ? instances.rows[0].port : null;

    return { userId, username, port, currentToken };
  } catch (e) {
    console.error("[ws-proxy] DB error:", e.message);
    return null;
  }
}

/**
 * Resolve a bearer token → { userId, username, port, currentToken }
 * Works with BOTH current and old tokens.
 */
async function resolveByToken(bearerToken) {
  if (!bearerToken) return null;

  // Check short-lived cache
  const cached = resolveCache.get(bearerToken);
  if (cached && Date.now() - cached.time < CACHE_TTL) return cached.data;

  // 1. Check if this is a known old token → get userId directly
  const knownUserId = knownTokens.get(bearerToken);
  if (knownUserId) {
    const session = await getCurrentSession(knownUserId);
    if (session) {
      resolveCache.set(bearerToken, { data: session, time: Date.now() });
      return session;
    }
  }

  // 2. Try matching against current DB sessions
  try {
    const sessions = await db.execute("SELECT user_id, access_token FROM workspace_sessions");
    for (const row of sessions.rows) {
      const decrypted = decrypt(row.access_token);
      if (decrypted === bearerToken) {
        // Remember this token → userId mapping
        knownTokens.set(bearerToken, row.user_id);

        const session = await getCurrentSession(row.user_id);
        if (session) {
          resolveCache.set(bearerToken, { data: session, time: Date.now() });
          return session;
        }
      }
    }
  } catch (e) {
    console.error("[ws-proxy] DB error:", e.message);
  }

  return null;
}

async function getAnyRunningPort() {
  try {
    const r = await db.execute("SELECT port FROM workspace_instances WHERE status = 'RUNNING' LIMIT 1");
    return r.rows.length > 0 ? r.rows[0].port : null;
  } catch { return null; }
}

/**
 * Trigger workspace relaunch via Portal API.
 */
async function relaunchWorkspace(userId, username) {
  console.log(`[ws-proxy] Auto-relaunching workspace for ${username}`);
  try {
    const result = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: "127.0.0.1", port: PORTAL_PORT,
        path: "/api/workspaces/launch", method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-User-Id": String(userId),
          "X-Internal-Username": username
        }
      }, res => {
        let body = "";
        res.on("data", d => body += d);
        res.on("end", () => {
          try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
          catch { resolve({ status: res.statusCode, data: body }); }
        });
      });
      req.on("error", reject);
      req.end("{}");
    });

    if (result.status >= 200 && result.status < 300) {
      console.log(`[ws-proxy] Workspace relaunched for ${username}, port: ${result.data?.port}`);
      resolveCache.clear();
      return true;
    }
    console.error(`[ws-proxy] Relaunch failed:`, result.data);
    return false;
  } catch (e) {
    console.error(`[ws-proxy] Relaunch error:`, e.message);
    return false;
  }
}

// ── HTTP Server ──
const server = http.createServer(async (req, res) => {
  // Extract token from Authorization header or _token query param
  const authHeader = req.headers.authorization || "";
  let bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!bearerToken && req.url) {
    try {
      const url = new URL(req.url, "http://localhost");
      const queryToken = url.searchParams.get("_token");
      if (queryToken) bearerToken = queryToken;
    } catch {}
  }

  // Resolve user and workspace
  let resolved = await resolveByToken(bearerToken);
  let targetPort = resolved?.port || null;

  // Workspace stopped but user is known → auto-relaunch
  if (resolved && !targetPort) {
    const ok = await relaunchWorkspace(resolved.userId, resolved.username);
    if (ok) {
      // Wait briefly for GSD to start, then re-resolve
      await new Promise(r => setTimeout(r, 2000));
      resolved = await getCurrentSession(resolved.userId);
      targetPort = resolved?.port || null;
    }
  }

  // Fallback: serve static from any running GSD
  if (!targetPort) targetPort = await getAnyRunningPort();

  if (!targetPort) {
    if (req.headers.accept?.includes("text/html")) {
      res.writeHead(200, { "Content-Type": "text/html" });
      return res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>No Workspace</title>
<style>body{background:#0a0a0a;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}a{color:#38bdf8}</style></head>
<body><div style="text-align:center"><h2>No running workspace</h2><p><a href="${APP_BASE_URL}/workspace">Launch from Portal</a></p></div></body></html>`);
    }
    res.writeHead(503, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "No running workspace" }));
  }

  // ── Proxy with token translation ──
  // If the user's current token differs from what the browser sent, swap it
  const proxyHeaders = { ...req.headers, host: `127.0.0.1:${targetPort}` };
  if (resolved?.currentToken && resolved.currentToken !== bearerToken) {
    proxyHeaders.authorization = `Bearer ${resolved.currentToken}`;
  } else if (bearerToken) {
    proxyHeaders.authorization = `Bearer ${bearerToken}`;
  }

  const proxyReq = http.request(
    { hostname: "127.0.0.1", port: targetPort, path: req.url, method: req.method, headers: proxyHeaders },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );

  proxyReq.on("error", async () => {
    // GSD might have just died — try auto-relaunch
    if (resolved) {
      resolveCache.clear();
      const ok = await relaunchWorkspace(resolved.userId, resolved.username);
      if (ok && req.headers.accept?.includes("text/html")) {
        await new Promise(r => setTimeout(r, 2000));
        const newSession = await getCurrentSession(resolved.userId);
        if (newSession?.port) {
          // Serve a page that refreshes with same URL (token in hash preserved)
          res.writeHead(200, { "Content-Type": "text/html" });
          return res.end(`<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{background:#0a0a0a;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.s{animation:spin 1s linear infinite;width:32px;height:32px;border:3px solid #333;border-top-color:#fff;border-radius:50%;margin:0 auto 16px}
@keyframes spin{to{transform:rotate(360deg)}}</style></head>
<body><div style="text-align:center"><div class="s"></div><p>Reconnecting...</p></div>
<script>setTimeout(()=>location.reload(),1500)</script></body></html>`);
        }
      }
    }
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Failed to reach workspace" }));
  });

  req.pipe(proxyReq);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[ws-proxy] Workspace proxy listening on port ${PORT}`);
});
