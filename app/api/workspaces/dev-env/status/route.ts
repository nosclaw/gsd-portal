import { auth } from "@/auth";
import { resolve } from "node:path";
import { appEnv } from "@/lib/env";
import { getDevEnvVersion, getDevEnvConfig, checkDevEnvUpdate } from "@/lib/dev-env";
import { NextResponse } from "next/server";

export const GET = auth(async (req) => {
  if (!req.auth || !req.auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = req.auth.user as any;
  const userId = Number(user.id);
  const workspaceDir = resolve(appEnv.workspaceRootDir, user.username);

  const [config, version, updateInfo] = await Promise.all([
    getDevEnvConfig(userId),
    getDevEnvVersion(userId),
    checkDevEnvUpdate(userId, workspaceDir)
  ]);

  return NextResponse.json({
    configured: !!config,
    repo: config?.repoUrl ?? null,
    branch: config?.branch ?? null,
    installed: !!version,
    currentCommit: version?.commit ?? null,
    installedAt: version?.installedAt ?? null,
    updatedAt: version?.updatedAt ?? null,
    updateAvailable: updateInfo?.updateAvailable ?? false,
    latestCommit: updateInfo?.latestCommit ?? null
  });
});
