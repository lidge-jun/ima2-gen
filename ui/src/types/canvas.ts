export type CanvasTool = "pan" | "pen" | "box" | "arrow" | "memo";

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

export interface CanvasViewport {
  zoom: number;
  panX: number;
  panY: number;
}
