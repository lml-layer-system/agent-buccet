import { runMetaLoopWorkerPass } from "../lib/lml/meta-loop-worker.ts";

const intervalMs = Number(process.env.LML_META_LOOP_INTERVAL_MS ?? "4000");

async function main(): Promise<void> {
  await runMetaLoopWorkerPass();
  setInterval(() => {
    void runMetaLoopWorkerPass().catch((error) => {
      console.error("[meta-loop-worker] pass failed:", error instanceof Error ? error.message : error);
    });
  }, intervalMs);
}

main().catch((error) => {
  console.error("[meta-loop-worker] failed to start:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
