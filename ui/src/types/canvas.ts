export type CanvasTool = "pan" | "pen" | "box" | "arrow" | "memo" | "eraser";

export type CanvasEraserMode = "object" | "brush";

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface DrawingPath {
  id: string;
  tool: "pen" | "arrow";
  points: NormalizedPoint[];
  color: string;
  strokeWidth: number;
}

export interface BoundingBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  strokeWidth: number;
}

export interface CanvasMemo {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
}

export interface AnnotationSnapshot {
  paths: DrawingPath[];
  boxes: BoundingBox[];
  memos: CanvasMemo[];
}

export interface SelectionBox {
  start: NormalizedPoint;
  current: NormalizedPoint;
}

export interface EraserStroke {
  points: NormalizedPoint[];
  radius: number;
}

export interface SavedCanvasAnnotations {
  paths: DrawingPath[];
  boxes: BoundingBox[];
  memos: CanvasMemo[];
}

export interface CanvasViewport {
  zoom: number;
  panX: number;
  panY: number;
}

export type HexColor = `#${string}`;

export interface CanvasAnnotationStyle {
  color: HexColor;
  strokeWidth: number;
}
