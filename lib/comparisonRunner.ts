import type { ComparisonCell } from "./comparisonMatrix.js";

export type ComparisonCellStatus = "pending" | "running" | "done" | "error" | "cancelled";

export type ComparisonCellState<TResult> = {
  cell: ComparisonCell;
  status: ComparisonCellStatus;
  result?: TResult;
  error?: { code: string; message: string };
};

export type GenerateOne<TPayload, TResult> = (
  payload: TPayload,
  options: { signal: AbortSignal },
) => Promise<TResult>;

export type ComparisonRunnerDeps<TPayload, TResult> = {
  /**
   * The single-generation call. Production passes the same transport the normal generate
   * path uses; tests pass a stub that fails a chosen cell, which is how partial-failure
   * behaviour is provable without spending real generations.
   */
  generateOne: GenerateOne<TPayload, TResult>;
  buildPayload: (cell: ComparisonCell) => TPayload;
  /** Bounded so nine cells cannot saturate browser connections or trip provider limits. */
  concurrency?: number;
  onCellChange?: (state: ComparisonCellState<TResult>) => void;
};

const DEFAULT_CONCURRENCY = 3;

function toCellError(error: unknown): { code: string; message: string } {
  const code = (error as { code?: string })?.code;
  const message = error instanceof Error ? error.message : String(error);
  return { code: code ?? "COMPARISON_CELL_FAILED", message };
}

/**
 * Runs one generation per cell.
 *
 * Failures are isolated per cell: `Promise.all` would discard every sibling result on the
 * first rejection, throwing away generations the user already paid for. Cancellation is
 * two-level — the whole matrix or a single cell — and already-finished cells keep their
 * results.
 */
export function createComparisonRunner<TPayload, TResult>(
  deps: ComparisonRunnerDeps<TPayload, TResult>,
) {
  const limit = Math.max(1, deps.concurrency ?? DEFAULT_CONCURRENCY);
  const controllers = new Map<number, AbortController>();

  async function runCells(
    cells: ComparisonCell[],
    states: Map<number, ComparisonCellState<TResult>>,
  ): Promise<void> {
    const queue = [...cells];
    const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
      for (;;) {
        const cell = queue.shift();
        if (!cell) return;
        const state = states.get(cell.index)!;
        if (state.status === "cancelled") continue;

        const controller = new AbortController();
        controllers.set(cell.index, controller);
        state.status = "running";
        deps.onCellChange?.({ ...state });

        try {
          state.result = await deps.generateOne(deps.buildPayload(cell), { signal: controller.signal });
          state.status = "done";
        } catch (error) {
          state.status = controller.signal.aborted ? "cancelled" : "error";
          state.error = toCellError(error);
        } finally {
          controllers.delete(cell.index);
          deps.onCellChange?.({ ...state });
        }
      }
    });
    await Promise.all(workers);
  }

  return {
    async run(cells: ComparisonCell[]): Promise<Array<ComparisonCellState<TResult>>> {
      const states = new Map<number, ComparisonCellState<TResult>>(
        cells.map((cell) => [cell.index, { cell, status: "pending" as const }]),
      );
      await runCells(cells, states);
      return cells.map((cell) => states.get(cell.index)!);
    },

    /** Retry exactly one cell; the rest of the grid is untouched. */
    async retry(
      state: ComparisonCellState<TResult>,
    ): Promise<ComparisonCellState<TResult>> {
      const states = new Map([[state.cell.index, { cell: state.cell, status: "pending" as const }]]);
      await runCells([state.cell], states);
      return states.get(state.cell.index)!;
    },

    cancelCell(index: number): void {
      controllers.get(index)?.abort();
    },

    cancelAll(): void {
      for (const controller of controllers.values()) controller.abort();
    },
  };
}
