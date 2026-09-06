import { mock } from "node:test";

export class SettlementTimeout extends Error {}

export function bounded<T>(work: Promise<T>, timeoutMs = 5000): Promise<T> {
  if (timeoutMs <= 0 || timeoutMs > 15_000) throw new Error("Fixture timeout must be within 1..15000ms");
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new SettlementTimeout(`Fixture settlement timed out after ${timeoutMs}ms`)), timeoutMs);
    work.then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
  });
}

export class PromiseTracker {
  readonly pending = new Set<Promise<unknown>>();
  readonly failures: unknown[] = [];
  track<T>(work: Promise<T>): Promise<T> {
    this.pending.add(work);
    // Observe without replacing the promise or swallowing its caller-visible rejection.
    void work.then(() => this.pending.delete(work), (error) => {
      this.pending.delete(work);
      this.failures.push(error);
    });
    return work;
  }
  async drain(timeoutMs = 5000): Promise<void> {
    const untilEmpty = async () => {
      while (this.pending.size) await Promise.allSettled([...this.pending]);
    };
    await bounded(untilEmpty(), timeoutMs);
    if (this.failures.length) throw new AggregateError(this.failures.splice(0), "Tracked fixture work rejected");
  }
}

const writes = new PromiseTracker();
export const track = <T>(work: Promise<T>): Promise<T> => writes.track(work);
export const drain = (timeoutMs?: number): Promise<void> => writes.drain(timeoutMs);

export type WriterKind = "request-log" | "thumbnail";
// Internal harness regression control; not part of the surface-worker API.
let beforeWrite: ((kind: WriterKind, args: readonly unknown[]) => Promise<void>) | undefined;
export function observeBeforeWrite(observer?: typeof beforeWrite): void { beforeWrite = observer; }

function invoke<T>(kind: WriterKind, args: readonly unknown[], real: () => Promise<T>): Promise<T> {
  return track(beforeWrite ? beforeWrite(kind, args).then(real) : real());
}

export async function installTrackedWrites(): Promise<() => void> {
  const log = await import("../lib/generationRequestLog.ts");
  const thumb = await import("../lib/imageThumb.ts");
  const logMock = mock.module(new URL("../lib/generationRequestLog.ts", import.meta.url).href, {
    namedExports: { ...log, appendGenerationRequestLog: (...args: Parameters<typeof log.appendGenerationRequestLog>) =>
      invoke("request-log", args, () => log.appendGenerationRequestLog(...args)) },
  });
  try {
    const thumbMock = mock.module(new URL("../lib/imageThumb.ts", import.meta.url).href, {
    namedExports: { ...thumb, generateImageThumbnailFromBuffer: (...args: Parameters<typeof thumb.generateImageThumbnailFromBuffer>) =>
      invoke("thumbnail", args, () => thumb.generateImageThumbnailFromBuffer(...args)) },
    });
    return () => { logMock.restore(); thumbMock.restore(); observeBeforeWrite(); };
  } catch (error) { logMock.restore(); throw error; }
}
