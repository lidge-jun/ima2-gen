import assert from "node:assert/strict";
import { test } from "node:test";
import childProcess from "node:child_process";
import { promisify } from "node:util";
import { syncBuiltinESMExports } from "node:module";
import { isolateExecution } from "./_executionRouteIsolation.ts";
import { executionTestProcess } from "./_executionTestProcess.ts";

if (executionTestProcess(import.meta.url)) {
  for (const method of ["exec", "execFile"] as const) test(`${method} direct and custom-promisified paths stay denied`, async (t) => {
    const descriptor = Object.getOwnPropertyDescriptor(childProcess, method)!;
    const fetchBefore = globalThis.fetch;
    const envBefore = process.env.IMA2_CONFIG_DIR;
    let directReached = 0, customReached = 0;
    const sentinel = () => { directReached++; };
    const custom = async () => { customReached++; return { stdout: "synthetic", stderr: "" }; };
    Object.defineProperty(sentinel, promisify.custom, { value: custom });
    Object.defineProperty(childProcess, method, { ...descriptor, value: sentinel });
    syncBuiltinESMExports();
    let isolation: Awaited<ReturnType<typeof isolateExecution>> | undefined;
    try {
      isolation = await isolateExecution();
      assert.throws(() => Reflect.apply(childProcess[method], childProcess, ["never-native"]), /Provider process launch forbidden/);
      const asynchronous = promisify(childProcess[method]) as (...args: unknown[]) => Promise<unknown>;
      await assert.rejects(asynchronous("never-native"), /Provider process launch forbidden/);
      assert.equal(directReached, 0); assert.equal(customReached, 0);
      assert.equal(Reflect.get(childProcess[method], promisify.custom), undefined);
    } finally {
      try {
        if (isolation) await assert.rejects(isolation.close(), /Isolation violations/);
        assert.equal(childProcess[method], sentinel);
        assert.equal(Reflect.get(sentinel, promisify.custom), custom);
      } finally {
        Object.defineProperty(childProcess, method, descriptor); syncBuiltinESMExports();
      }
      t.diagnostic(JSON.stringify({ directReached, customReached, realProcessCalls: 0 }));
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(childProcess, method), descriptor);
    assert.equal(globalThis.fetch, fetchBefore); assert.equal(process.env.IMA2_CONFIG_DIR, envBefore);
  });
}
