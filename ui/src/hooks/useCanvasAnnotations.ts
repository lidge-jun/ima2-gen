import { useCallback, useMemo, useReducer } from "react";
import type { CanvasTool, DrawingPath, BoundingBox, NormalizedPoint } from "../types/canvas";

type AnnotationTool = Exclude<CanvasTool, "memo">;

interface State {
  activeTool: AnnotationTool;
  toolColor: string;
  strokeWidth: number;
  paths: DrawingPath[];
  boxes: BoundingBox[];
  activePath: DrawingPath | null;
  activeBox: { start: NormalizedPoint; current: NormalizedPoint } | null;
}

type Action =
  | { type: "SET_TOOL"; tool: AnnotationTool }
  | { type: "START_PATH"; point: NormalizedPoint }
  | { type: "ADD_POINT"; point: NormalizedPoint }
  | { type: "END_PATH" }
  | { type: "START_BOX"; point: NormalizedPoint }
  | { type: "UPDATE_BOX"; point: NormalizedPoint }
  | { type: "END_BOX" }
  | { type: "CLEAR" };

const initialState: State = {
  activeTool: "pan",
  toolColor: "#ef4444",
  strokeWidth: 3,
  paths: [],
  boxes: [],
  activePath: null,
  activeBox: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_TOOL":
      return { ...state, activeTool: action.tool };
    case "START_PATH":
      return {
        ...state,
        activePath: {
          id: crypto.randomUUID(),
          tool: state.activeTool as "pen" | "arrow",
          points: [action.point],
          color: state.toolColor,
          strokeWidth: state.strokeWidth,
        },
      };
    case "ADD_POINT":
      if (!state.activePath) return state;
      return {
        ...state,
        activePath: {
          ...state.activePath,
          points: [...state.activePath.points, action.point],
        },
      };
    case "END_PATH":
      if (!state.activePath || state.activePath.points.length < 2) {
        return { ...state, activePath: null };
      }
      return {
        ...state,
        paths: [...state.paths, state.activePath],
        activePath: null,
      };
    case "START_BOX":
      return { ...state, activeBox: { start: action.point, current: action.point } };
    case "UPDATE_BOX":
      if (!state.activeBox) return state;
      return { ...state, activeBox: { ...state.activeBox, current: action.point } };
    case "END_BOX": {
      if (!state.activeBox) return state;
      const { start, current } = state.activeBox;
      const x = Math.min(start.x, current.x);
      const y = Math.min(start.y, current.y);
      const width = Math.abs(current.x - start.x);
      const height = Math.abs(current.y - start.y);
      if (width < 0.01 || height < 0.01) return { ...state, activeBox: null };
      return {
        ...state,
        boxes: [
          ...state.boxes,
          {
            id: crypto.randomUUID(),
            x,
            y,
            width,
            height,
            color: state.toolColor,
            strokeWidth: state.strokeWidth,
          },
        ],
        activeBox: null,
      };
    }
    case "CLEAR":
      return { ...state, paths: [], boxes: [], activePath: null, activeBox: null };
    default:
      return state;
  }
}

export function useCanvasAnnotations() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const hasAnnotations = useMemo(
    () => state.paths.length > 0 || state.boxes.length > 0,
    [state.paths.length, state.boxes.length],
  );

  const setTool = useCallback((tool: AnnotationTool) => {
    dispatch({ type: "SET_TOOL", tool });
  }, []);

  const startDrawing = useCallback((point: NormalizedPoint) => {
    if (state.activeTool === "pen" || state.activeTool === "arrow") {
      dispatch({ type: "START_PATH", point });
    } else if (state.activeTool === "box") {
      dispatch({ type: "START_BOX", point });
    }
  }, [state.activeTool]);

  const moveDrawing = useCallback((point: NormalizedPoint) => {
    if (state.activePath) {
      dispatch({ type: "ADD_POINT", point });
    } else if (state.activeBox) {
      dispatch({ type: "UPDATE_BOX", point });
    }
  }, [state.activePath, state.activeBox]);

  const endDrawing = useCallback(() => {
    if (state.activePath) {
      dispatch({ type: "END_PATH" });
    } else if (state.activeBox) {
      dispatch({ type: "END_BOX" });
    }
  }, [state.activePath, state.activeBox]);

  const clear = useCallback(() => {
    dispatch({ type: "CLEAR" });
  }, []);

  return {
    ...state,
    hasAnnotations,
    setTool,
    startDrawing,
    moveDrawing,
    endDrawing,
    clear,
  };
}
