export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler, stopScheduler } = await import("@/lib/scheduler");
    const { stopAllWorkspaces } = await import("@/lib/orchestrator");
    startScheduler();

    process.on("SIGTERM", async () => {
      stopScheduler();
      await stopAllWorkspaces();
      process.exit(0);
    });
    process.on("SIGINT", async () => {
      stopScheduler();
      await stopAllWorkspaces();
      process.exit(0);
    });
  }
}
