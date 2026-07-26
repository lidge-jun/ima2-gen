import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_COMPARISON_CELLS,
  buildComparisonCells,
  countComparisonCells,
  isComparisonError,
  varyingAxes,
} from "../lib/comparisonMatrix.js";
import { createComparisonRunner } from "../lib/comparisonRunner.js";

// WP9 / issue #80 (devlog/_plan/260726_zero-backlog-frontend-qa/090_comparison_matrix.md).

function cellsOf(axes: Parameters<typeof buildComparisonCells>[0]) {
  const result = buildComparisonCells(axes);
  assert.ok(!isComparisonError(result), `expected cells, got ${JSON.stringify(result)}`);
  return result.cells;
}

test("the cartesian product is complete and deterministic", () => {
  const axes = { model: ["m1", "m2"], quality: ["low", "high"] };
  const first = cellsOf(axes);
  assert.equal(first.length, 4);
  // Same selection must always yield the same grid, or comparison is meaningless.
  assert.deepEqual(first, cellsOf(axes));
  assert.deepEqual(
    first.map((c) => `${c.model}/${c.quality}`),
    ["m1/low", "m1/high", "m2/low", "m2/high"],
  );
});

test("a selection over the cap is refused, not silently truncated", () => {
  // Generating the first nine would leave the user comparing an arbitrary subset.
  const result = buildComparisonCells({
    model: ["a", "b", "c"],
    quality: ["l", "m", "h"],
    size: ["1k", "2k"],
  });
  assert.ok(isComparisonError(result));
  assert.equal(result.code, "COMPARISON_CELL_LIMIT");
  assert.equal(result.wouldBe, 18, "the user needs the real number to trim the axes");
});

test("exactly the cap is allowed", () => {
  assert.equal(cellsOf({ model: ["a", "b", "c"], quality: ["l", "m", "h"] }).length, MAX_COMPARISON_CELLS);
});

test("an empty selection is an error, not an empty grid", () => {
  const result = buildComparisonCells({});
  assert.ok(isComparisonError(result));
  assert.equal(result.code, "COMPARISON_EMPTY");
  assert.equal(countComparisonCells({}), 0);
});

test("only axes with more than one value are worth labelling", () => {
  assert.deepEqual(varyingAxes({ model: ["a"], quality: ["l", "h"] }), ["quality"]);
});

test("one failing cell does not take the others down", async () => {
  // ACTIVATION: drive the partial-failure branch through the injected generator.
  const runner = createComparisonRunner<{ model?: string }, string>({
    buildPayload: (cell) => ({ model: cell.model }),
    generateOne: async (payload) => {
      if (payload.model === "boom") {
        throw Object.assign(new Error("provider 500"), { code: "PROVIDER_ERROR" });
      }
      return `ok:${payload.model}`;
    },
  });

  const states = await runner.run(cellsOf({ model: ["a", "boom", "c"] }));
  assert.equal(states.filter((s) => s.status === "done").length, 2);
  const failed = states.find((s) => s.status === "error");
  assert.equal(failed?.error?.code, "PROVIDER_ERROR", "the failure branch must actually fire");
  assert.deepEqual(
    states.filter((s) => s.status === "done").map((s) => s.result),
    ["ok:a", "ok:c"],
  );
});

test("retrying one cell re-runs only that cell", async () => {
  let calls = 0;
  const runner = createComparisonRunner<{ model?: string }, string>({
    buildPayload: (cell) => ({ model: cell.model }),
    generateOne: async (payload) => {
      calls += 1;
      if (payload.model === "flaky" && calls <= 3) throw new Error("temporary");
      return `ok:${payload.model}`;
    },
  });

  const states = await runner.run(cellsOf({ model: ["a", "flaky", "c"] }));
  const before = calls;
  const failed = states.find((s) => s.status === "error");
  assert.ok(failed, "expected a failed cell to retry");

  const retried = await runner.retry(failed);
  assert.equal(calls - before, 1, "retry must not re-run the whole grid");
  assert.equal(retried.status, "done");
});

test("generation is bounded rather than firing every cell at once", async () => {
  // Nine parallel requests saturate browser connections and trip provider rate limits.
  let inFlight = 0;
  let peak = 0;
  const runner = createComparisonRunner<unknown, string>({
    concurrency: 2,
    buildPayload: () => ({}),
    generateOne: async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return "ok";
    },
  });
  await runner.run(cellsOf({ model: ["a", "b", "c"], quality: ["l", "h"] }));
  assert.ok(peak <= 2, `expected at most 2 concurrent, saw ${peak}`);
});

test("cancelling the matrix leaves finished cells intact", async () => {
  const runner = createComparisonRunner<{ model?: string }, string>({
    concurrency: 1,
    buildPayload: (cell) => ({ model: cell.model }),
    generateOne: async (payload, { signal }) => {
      if (payload.model === "b") {
        runner.cancelAll();
        await new Promise((resolve) => setTimeout(resolve, 5));
        if (signal.aborted) throw Object.assign(new Error("aborted"), { code: "ABORTED" });
      }
      return `ok:${payload.model}`;
    },
  });
  const states = await runner.run(cellsOf({ model: ["a", "b"] }));
  assert.equal(states[0].status, "done", "a completed cell must keep its result");
  assert.equal(states[0].result, "ok:a");
  assert.equal(states[1].status, "cancelled");
});
