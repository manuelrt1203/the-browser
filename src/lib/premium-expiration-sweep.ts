export type SweepCheckpoint = { cursor: string; failed: number };
type Batch = { cursor: string; processed: number; failed: number };
/** Checkpoint after every batch: repeated scheduler calls resume a large scan. */
export async function runExpirationSweep(deps: {
  load: () => Promise<SweepCheckpoint>;
  save: (state: SweepCheckpoint) => Promise<void>;
  batch: (cursor: string) => Promise<Batch>;
  now?: () => number;
  budgetMs?: number;
}) {
  const now = deps.now ?? Date.now, deadline = now() + (deps.budgetMs ?? 45_000);
  const checkpoint = await deps.load();
  if (!/^\d+$/.test(checkpoint.cursor) || !Number.isSafeInteger(checkpoint.failed) || checkpoint.failed < 0) throw new Error("Checkpoint invalide");
  let cursor = checkpoint.cursor, failed = checkpoint.failed, processed = 0;
  for (let batches = 0; batches < 100; batches++) {
    const result = await deps.batch(cursor);
    if (!/^\d+$/.test(result.cursor) || !Number.isSafeInteger(result.processed) || result.processed < 0 ||
        !Number.isSafeInteger(result.failed) || result.failed < 0 || result.failed > result.processed) throw new Error("Lot invalide");
    cursor = result.cursor; processed += result.processed; failed += result.failed;
    const complete = cursor === "0";
    await deps.save({ cursor, failed: complete ? 0 : failed });
    if (complete || now() >= deadline) return { complete, cursor, processed, failed };
  }
  return { complete: false, cursor, processed, failed };
}
