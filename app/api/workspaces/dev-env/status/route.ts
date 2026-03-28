import { auth } from "@/auth";
import { getDevEnvVersion, getDevEnvConfig, checkDevEnvUpdate } from "@/lib/dev-env";
import { NextResponse } from "next/server";

export const GET = auth(async (req) => {
  if (!req.auth || !req.auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number((req.auth.user as any).id);

  const [config, version, updateInfo] = await Promise.all([
    getDevEnvConfig(userId),
    getDevEnvVersion(userId),
    checkDevEnvUpdate(userId)
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
