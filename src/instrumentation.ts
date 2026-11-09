export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build") {
    (await import("./lib/env")).assertProductionConfig();
    const { startScheduler } = await import("./lib/scheduler");
    await startScheduler();
  }
}
