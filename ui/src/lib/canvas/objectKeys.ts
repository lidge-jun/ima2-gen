import type { BoundingBox, CanvasMemo, DrawingPath } from "../../types/canvas";

export type CanvasObjectKind = "path" | "box" | "memo";
export type CanvasObjectKey = `${CanvasObjectKind}:${string}`;

export interface CanvasObjectRef {
  kind: CanvasObjectKind;
  id: string;
}

export function makeCanvasObjectKey(kind: CanvasObjectKind, id: string): CanvasObjectKey {
  return `${kind}:${id}`;
}

export function parseCanvasObjectKey(key: string): CanvasObjectRef | null {
  const index = key.indexOf(":");
  if (index <= 0) return null;

  const kind = key.slice(0, index);
  const id = key.slice(index + 1);
  if (!id) return null;
  if (kind !== "path" && kind !== "box" && kind !== "memo") return null;

  return { kind, id };
}

export function keyForPath(path: DrawingPath): CanvasObjectKey {
  return makeCanvasObjectKey("path", path.id);
}

export function keyForBox(box: BoundingBox): CanvasObjectKey {
  return makeCanvasObjectKey("box", box.id);
}

export function keyForMemo(memo: CanvasMemo): CanvasObjectKey {
  return makeCanvasObjectKey("memo", memo.id);
}

export function objectKeyMatches(key: string, kind: CanvasObjectKind, id: string): boolean {
  const parsed = parseCanvasObjectKey(key);
  return parsed?.kind === kind && parsed.id === id;
}
