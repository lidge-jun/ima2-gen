/**
 * Prompt-locked comparison matrix (issue #80).
 *
 * The cap is a cost guard, not a layout preference: every cell is a paid generation, so
 * an accidental 4x4x4 selection would fire 64 of them. Confirmed at 9 in the 2026-06-21
 * interview (devlog/_plan/_future/260529_issue80-batch-comparison-matrix/02_decisions.md).
 */
export const MAX_COMPARISON_CELLS = 9;

/** Axis order is fixed so the same selection always produces the same grid. */
export const COMPARISON_AXES = ["model", "reasoningEffort", "quality", "size"] as const;

export type ComparisonAxis = (typeof COMPARISON_AXES)[number];

export type ComparisonAxes = Partial<Record<ComparisonAxis, string[]>>;

export type ComparisonCell = {
  index: number;
} & Partial<Record<ComparisonAxis, string>>;

export type ComparisonCellsResult =
  | { cells: ComparisonCell[] }
  | { error: string; code: "COMPARISON_CELL_LIMIT" | "COMPARISON_EMPTY"; wouldBe: number };

export function isComparisonError(
  result: ComparisonCellsResult,
): result is Extract<ComparisonCellsResult, { error: string }> {
  return "error" in result;
}

function selectedAxes(axes: ComparisonAxes): Array<[ComparisonAxis, string[]]> {
  return COMPARISON_AXES
    .map((axis) => [axis, axes[axis]?.filter(Boolean) ?? []] as [ComparisonAxis, string[]])
    .filter(([, values]) => values.length > 0);
}

/** How many generations a selection would cost, before deciding whether to allow it. */
export function countComparisonCells(axes: ComparisonAxes): number {
  const selected = selectedAxes(axes);
  if (selected.length === 0) return 0;
  return selected.reduce((total, [, values]) => total * values.length, 1);
}

/**
 * Expand the selected axes into concrete cells.
 *
 * Over the cap this returns an error instead of truncating: quietly generating the first
 * nine would leave the user comparing an arbitrary subset without knowing which
 * combinations were dropped.
 */
export function buildComparisonCells(axes: ComparisonAxes): ComparisonCellsResult {
  const selected = selectedAxes(axes);
  const total = countComparisonCells(axes);

  if (total === 0) {
    return { error: "select at least one option", code: "COMPARISON_EMPTY", wouldBe: 0 };
  }
  if (total > MAX_COMPARISON_CELLS) {
    return {
      error: `this selection would generate ${total} images (limit ${MAX_COMPARISON_CELLS})`,
      code: "COMPARISON_CELL_LIMIT",
      wouldBe: total,
    };
  }

  let combos: Array<Partial<Record<ComparisonAxis, string>>> = [{}];
  for (const [axis, values] of selected) {
    combos = combos.flatMap((combo) => values.map((value) => ({ ...combo, [axis]: value })));
  }
  return { cells: combos.map((combo, index) => ({ index, ...combo })) };
}

/** Axes that vary across the grid — the ones worth labelling on each cell. */
export function varyingAxes(axes: ComparisonAxes): ComparisonAxis[] {
  return selectedAxes(axes).filter(([, values]) => values.length > 1).map(([axis]) => axis);
}
