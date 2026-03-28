import { auth } from "@/auth";
import { getDevEnvVersion, getDevEnvConfig, checkDevEnvUpdate } from "@/lib/dev-env";
import { apiError, apiSuccess } from "@/lib/api-response";

export const GET = auth(async (req) => {
  if (!req.auth || !req.auth.user) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  const userId = Number((req.auth.user as { id: string }).id);

  const [config, version, updateInfo] = await Promise.all([
    getDevEnvConfig(userId),
    getDevEnvVersion(userId),
    checkDevEnvUpdate(userId)
  ]);

  return apiSuccess({
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
