import assert from "node:assert/strict";
import { ReadableStream, type ReadableStreamDefaultController, type ReadableStreamDefaultReader } from "node:stream/web";

export interface VideoStreamOptions {
  headers?: Record<string, string>;
  status?: number;
  holdOpen?: boolean;
  failAfterChunks?: Error;
  cancelBehavior?: "resolve" | "reject" | "pending";
}

export interface VideoStreamStats {
  pulls: number;
  bytesEnqueued: number;
  sourceCancelCalls: number;
  readerCancelCalls: number;
  releaseLockCalls: number;
  readCalls: number;
  pendingReads: number;
  cancelReason: unknown;
  copiedChunks: Uint8Array[];
  readonly arrayBufferCalls: number;
}

/** Deliberately tiny container signature, not a decodable movie. */
export function fakeMp4Bytes(): Buffer {
  return Buffer.from([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0]);
}

/** Never consumes/rebuilds the response; the ledger survives DUT error mapping. */
export function forbidArtifactArrayBuffer(response: Response, violations: unknown[]) {
  let calls = 0;
  Object.defineProperty(response, "arrayBuffer", { configurable: true, value() {
    calls++;
    const error = new Error("Artifact response.arrayBuffer is forbidden");
    violations.push(error);
    return Promise.reject(error);
  } });
  return { response, get arrayBufferCalls() { return calls; },
    assertUnused() { assert.equal(calls, 0, "artifact arrayBuffer was called"); } };
}

function observeReader(reader: ReadableStreamDefaultReader<Uint8Array>, stats: VideoStreamStats) {
  const read = reader.read.bind(reader);
  const cancel = reader.cancel.bind(reader);
  const release = reader.releaseLock.bind(reader);
  reader.read = () => {
    stats.readCalls++;
    stats.pendingReads++;
    try {
      const work = read();
      void work.then(() => { stats.pendingReads--; }, () => { stats.pendingReads--; });
      return work;
    } catch (error) { stats.pendingReads--; throw error; }
  };
  reader.cancel = (reason?: unknown) => { stats.readerCancelCalls++; return cancel(reason); };
  reader.releaseLock = () => { stats.releaseLockCalls++; release(); };
  return reader;
}

function streamState(chunks: readonly Uint8Array[], options: VideoStreamOptions, stats: VideoStreamStats) {
  let controller: ReadableStreamDefaultController<Uint8Array>;
  let index = 0;
  let ended = false;
  let pendingCancel = false;
  let releaseCancel = () => {};
  let notifyWaiting = () => {};
  const waiting = new Promise<void>((resolve) => { notifyWaiting = resolve; });
  const body = new ReadableStream<Uint8Array>({
    start(value) { controller = value; },
    pull(value) {
      stats.pulls++;
      if (index < chunks.length) {
        const chunk = chunks[index++];
        stats.bytesEnqueued += chunk.byteLength;
        value.enqueue(chunk);
      } else if (options.failAfterChunks) { ended = true; value.error(options.failAfterChunks); }
      else if (options.holdOpen) notifyWaiting();
      else { ended = true; value.close(); }
    },
    cancel(reason) {
      ended = true;
      stats.sourceCancelCalls++;
      stats.cancelReason = reason;
      if (options.cancelBehavior === "reject") return Promise.reject(new Error("synthetic cancel rejection"));
      if (options.cancelBehavior === "pending") {
        pendingCancel = true;
        return new Promise<void>((resolve) => { releaseCancel = () => { pendingCancel = false; resolve(); }; });
      }
    },
  }, { highWaterMark: 0 });
  return { body, waiting,
    close() { if (!ended) { ended = true; controller.close(); } },
    error(reason: unknown) { if (!ended) { ended = true; controller.error(reason); } },
    releaseCancel() { releaseCancel(); },
    assertDrained() { assert.equal(pendingCancel, false, "pending source cancel"); },
  };
}

export function makeVideoStreamFixture(chunks: readonly Uint8Array[], options: VideoStreamOptions = {}) {
  const violations: unknown[] = [];
  let artifact: ReturnType<typeof forbidArtifactArrayBuffer>;
  const stats: VideoStreamStats = {
    pulls: 0, bytesEnqueued: 0, sourceCancelCalls: 0, readerCancelCalls: 0,
    releaseLockCalls: 0, readCalls: 0, pendingReads: 0, cancelReason: undefined, copiedChunks: [],
    get arrayBufferCalls() { return artifact.arrayBufferCalls; },
  };
  const state = streamState(chunks, options, stats);
  const getReader = state.body.getReader.bind(state.body);
  Object.defineProperty(state.body, "getReader", { configurable: true,
    value: () => observeReader(getReader(), stats),
  });
  const response = new Response(state.body, { headers: options.headers, status: options.status });
  artifact = forbidArtifactArrayBuffer(response, violations);
  return { ...state, response, stats,
    assertDrained() {
      state.assertDrained();
      assert.equal(state.body.locked, false, "stream reader lock leaked");
      assert.equal(stats.pendingReads, 0, "unsettled reader.read");
      artifact.assertUnused();
      assert.deepEqual(violations, []);
    },
  };
}
