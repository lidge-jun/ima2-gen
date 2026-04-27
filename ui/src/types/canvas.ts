export type CanvasTool = "pan" | "pen" | "box" | "arrow" | "memo";

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface CanvasViewport {
  zoom: number;
  panX: number;
  panY: number;
}
