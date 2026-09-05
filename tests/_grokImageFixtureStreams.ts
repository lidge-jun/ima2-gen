import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";
import type { RequestOptions } from "node:http";
import type { LookupFunction } from "node:net";
import type { ImageFixtureRequest } from "./_grokImageTransportFixture.ts";

export interface FixtureAddress { address: string; family: 4 | 6 }
interface StreamHooks {
  track(work: Promise<unknown>): void;
  failure(error: unknown): void;
}
interface RequestFixture extends StreamHooks {
  call: ImageFixtureRequest;
  options: RequestOptions;
  addresses: readonly FixtureAddress[];
  respond(): Response | Promise<Response>;
}

function invokeLookup(lookup: LookupFunction, hostname: string, family: number, all: boolean) {
  return new Promise<{ error: Error | null; address: unknown; family: unknown }>((resolve, reject) => {
    try {
      lookup(hostname, { family, all }, (error, address, resultFamily) => {
        resolve({ error, address, family: resultFamily });
      });
    } catch (error) { reject(error); }
  });
}

/** Exercise the DUT's lookup, including the no-matching-family path; never resolve a host here. */
async function assertPinnedLookup(fixture: RequestFixture): Promise<void> {
  const lookup = fixture.options.lookup;
  assert.equal(typeof lookup, "function", "Pinned GET requires a custom lookup (no native fallback)");
  const hostname = new URL(fixture.call.url).hostname.replace(/^\[|\]$/g, "");
  for (const family of [0, 4, 6]) {
    const expected = fixture.addresses.filter((address) => !family || address.family === family);
    for (const all of [false, true]) {
      const result = await invokeLookup(lookup!, hostname, family, all);
      if (!expected.length) {
        assert.ok(result.error, "Lookup must reject an unavailable address family");
      } else {
        assert.equal(result.error, null);
        if (all) assert.deepEqual(result.address, expected, "Lookup all must return only pinned addresses");
        else {
          assert.equal(result.address, expected[0]!.address);
          assert.equal(result.family, expected[0]!.family);
        }
      }
    }
  }
}

export class FixtureIncomingMessage extends Readable {
  readonly statusCode: number;
  readonly headers: Record<string, string>;
  private reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  private reading = false;
  private complete = false;
  private readonly hooks: StreamHooks;

  constructor(response: Response, hooks: StreamHooks) {
    super({ highWaterMark: 1 });
    this.statusCode = response.status;
    this.headers = {};
    response.headers.forEach((value, name) => { this.headers[name] = value; });
    this.reader = response.body?.getReader();
    this.hooks = hooks;
    this.on("error", (error) => hooks.failure(error));
  }

  override _read(): void {
    if (this.reading || this.complete || this.destroyed) return;
    this.reading = true;
    this.hooks.track(this.pump());
  }

  private async pump(): Promise<void> {
    try {
      const next = this.reader ? await this.reader.read() : { done: true, value: undefined };
      this.reading = false;
      if (this.destroyed) return;
      if (next.done) { this.complete = true; this.push(null); }
      else this.push(Buffer.from(next.value!));
    } catch (error) {
      this.reading = false;
      this.hooks.failure(error);
      this.destroy(error instanceof Error ? error : new Error(String(error)));
    }
  }

  override _destroy(error: Error | null, callback: (error?: Error | null) => void): void {
    const cancel = async () => {
      try { if (!this.complete) await this.reader?.cancel(error ?? undefined); }
      catch (failure) { this.hooks.failure(failure); }
      finally { this.reader?.releaseLock(); callback(error); }
    };
    this.hooks.track(cancel());
  }
}

export class FixtureClientRequest extends Writable {
  private readonly fixture: RequestFixture;
  private incoming: FixtureIncomingMessage | undefined;
  private readonly onAbort: () => void;

  constructor(fixture: RequestFixture) {
    super({ autoDestroy: false });
    this.fixture = fixture;
    this.onAbort = () => this.destroy(fixture.call.signal?.reason);
    this.on("error", (error) => fixture.failure(error));
    fixture.call.signal?.addEventListener("abort", this.onAbort, { once: true });
    this.once("close", () => fixture.call.signal?.removeEventListener("abort", this.onAbort));
    fixture.track(new Promise<void>((resolve) => this.once("close", resolve)));
  }

  override _write(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    const error = chunk.length ? new Error("Artifact GET must not carry a request body") : undefined;
    if (error) this.fixture.failure(error);
    callback(error);
  }

  override _final(callback: (error?: Error | null) => void): void {
    this.fixture.track(this.open());
    callback();
  }

  private async open(): Promise<void> {
    try {
      this.fixture.call.signal?.throwIfAborted();
      await assertPinnedLookup(this.fixture);
      if (this.destroyed) return;
      const response = await this.fixture.respond();
      const incoming = new FixtureIncomingMessage(response, this.fixture);
      this.incoming = incoming;
      this.fixture.track(new Promise<void>((resolve) => incoming.once("close", resolve)));
      incoming.once("close", () => this.destroy());
      if (this.destroyed) incoming.destroy();
      else this.emit("response", incoming);
    } catch (error) {
      this.fixture.failure(error);
      this.destroy(error instanceof Error ? error : new Error(String(error)));
    }
  }

  override _destroy(error: Error | null, callback: (error?: Error | null) => void): void {
    this.incoming?.destroy(error ?? undefined);
    callback(error);
  }
}
