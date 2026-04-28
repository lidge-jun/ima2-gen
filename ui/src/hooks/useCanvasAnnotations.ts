import { useCallback, useMemo, useReducer } from "react";
import type {
  AnnotationSnapshot,
  BoundingBox,
  CanvasAnnotationStyle,
  CanvasEraserMode,
  CanvasMemo,
  CanvasTool,
  DrawingPath,
  EraserStroke,
  HexColor,
  NormalizedPoint,
  SavedCanvasAnnotations,
  SelectionBox,
} from "../types/canvas";
import { erasePathsByStroke } from "../lib/canvas/eraser";
import { objectKeyMatches, parseCanvasObjectKey, type CanvasObjectKey } from "../lib/canvas/objectKeys";

type AnnotationTool = CanvasTool;

const CANVAS_STYLE_STORAGE_KEY = "ima2.canvas.annotationStyle.v1";

export const CANVAS_STYLE_COLORS: HexColor[] = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#38bdf8",
  "#6366f1",
  "#a855f7",
  "#111827",
  "#ffffff",
];

export const CANVAS_STROKE_WIDTHS: number[] = [2, 3, 5, 8];

const DEFAULT_CANVAS_STYLE: CanvasAnnotationStyle = {
  color: "#ef4444",
  strokeWidth: 3,
};

function loadCanvasStyle(): CanvasAnnotationStyle {
  if (typeof window === "undefined") return DEFAULT_CANVAS_STYLE;
  try {
    const raw = window.localStorage.getItem(CANVAS_STYLE_STORAGE_KEY);
    if (!raw) return DEFAULT_CANVAS_STYLE;
    const parsed = JSON.parse(raw) as Partial<CanvasAnnotationStyle>;
    const color = typeof parsed.color === "string" && CANVAS_STYLE_COLORS.includes(parsed.color as HexColor)
      ? (parsed.color as HexColor)
      : DEFAULT_CANVAS_STYLE.color;
    const strokeWidth = typeof parsed.strokeWidth === "number" && CANVAS_STROKE_WIDTHS.includes(parsed.strokeWidth)
      ? parsed.strokeWidth
      : DEFAULT_CANVAS_STYLE.strokeWidth;
    return { color, strokeWidth };
  } catch {
    return DEFAULT_CANVAS_STYLE;
  }
}

function persistCanvasStyle(style: CanvasAnnotationStyle): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CANVAS_STYLE_STORAGE_KEY, JSON.stringify(style));
  } catch {
    /* ignore quota / unavailable */
  }
}

interface State extends AnnotationSnapshot {
  activeTool: AnnotationTool;
  toolColor: HexColor;
  strokeWidth: number;
  activeMemoId: string | null;
  activePath: DrawingPath | null;
  activeBox: SelectionBox | null;
  eraserMode: CanvasEraserMode;
  activeEraserStroke: EraserStroke | null;
  eraserBaseline: AnnotationSnapshot | null;
  selectionBox: SelectionBox | null;
  selectedIds: CanvasObjectKey[];
  past: AnnotationSnapshot[];
  future: AnnotationSnapshot[];
  memoBaseline: AnnotationSnapshot | null;
  moveBaseline: AnnotationSnapshot | null;
  isDirty: boolean;
}

type Action =
  | { type: "SET_TOOL"; tool: AnnotationTool }
  | { type: "SET_ERASER_MODE"; mode: CanvasEraserMode }
  | { type: "SET_STYLE"; style: CanvasAnnotationStyle }
  | { type: "START_PATH"; point: NormalizedPoint }
  | { type: "ADD_POINT"; point: NormalizedPoint }
  | { type: "END_PATH" }
  | { type: "START_BOX"; point: NormalizedPoint }
  | { type: "UPDATE_BOX"; point: NormalizedPoint }
  | { type: "END_BOX" }
  | { type: "CREATE_MEMO"; point: NormalizedPoint }
  | { type: "UPDATE_MEMO"; id: string; text: string }
  | { type: "COMMIT_MEMO_EDIT" }
  | { type: "DELETE_MEMO"; id: string }
  | { type: "FOCUS_MEMO"; id: string | null }
  | { type: "CLEAR" }
  | { type: "LOAD"; payload: SavedCanvasAnnotations }
  | { type: "MARK_SAVED" }
  | { type: "RESET_LOCAL" }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "SELECT_ONE"; id: CanvasObjectKey }
  | { type: "TOGGLE_SELECTED"; id: CanvasObjectKey }
  | { type: "CLEAR_SELECTION" }
  | { type: "DELETE_SELECTED" }
  | { type: "MOVE_SELECTED"; delta: NormalizedPoint }
  | { type: "START_SELECTED_MOVE" }
  | { type: "COMMIT_SELECTED_MOVE" }
  | { type: "START_SELECTION_BOX"; point: NormalizedPoint }
  | { type: "UPDATE_SELECTION_BOX"; point: NormalizedPoint }
  | { type: "END_SELECTION_BOX"; ids: CanvasObjectKey[] }
  | { type: "ERASE_OBJECT"; id: CanvasObjectKey }
  | { type: "START_ERASER_STROKE"; point: NormalizedPoint }
  | { type: "UPDATE_ERASER_STROKE"; point: NormalizedPoint }
  | { type: "END_ERASER_STROKE" };

const HISTORY_LIMIT = 50;

const persistedStyle = loadCanvasStyle();

const initialState: State = {
  activeTool: "pan",
  toolColor: persistedStyle.color,
  strokeWidth: persistedStyle.strokeWidth,
  paths: [],
  boxes: [],
  memos: [],
  activeMemoId: null,
  activePath: null,
  activeBox: null,
  eraserMode: "object",
  activeEraserStroke: null,
  eraserBaseline: null,
  selectionBox: null,
  selectedIds: [],
  past: [],
  future: [],
  memoBaseline: null,
  moveBaseline: null,
  isDirty: false,
};

function snapshot(state: AnnotationSnapshot): AnnotationSnapshot {
  return {
    paths: state.paths,
    boxes: state.boxes,
    memos: state.memos,
  };
}

function withHistory(state: State): State {
  return {
    ...state,
    past: [...state.past.slice(-(HISTORY_LIMIT - 1)), snapshot(state)],
    future: [],
  };
}

function pushSnapshot(state: State, previous: AnnotationSnapshot): State {
  return {
    ...state,
    past: [...state.past.slice(-(HISTORY_LIMIT - 1)), previous],
    future: [],
  };
}

function snapshotsEqual(a: AnnotationSnapshot, b: AnnotationSnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function restoreSnapshot(state: State, next: AnnotationSnapshot): State {
  return {
    ...state,
    ...next,
    activeMemoId: null,
    activePath: null,
    activeBox: null,
    selectionBox: null,
    selectedIds: [],
    isDirty: true,
  };
}

function createBox(activeBox: SelectionBox, color: string, strokeWidth: number): BoundingBox | null {
  const { start, current } = activeBox;
  const x = Math.min(start.x, current.x);
  const y = Math.min(start.y, current.y);
  const width = Math.abs(current.x - start.x);
  const height = Math.abs(current.y - start.y);
  if (width < 0.01 || height < 0.01) return null;
  return { id: crypto.randomUUID(), x, y, width, height, color, strokeWidth };
}

function moveBox(box: BoundingBox, delta: NormalizedPoint): BoundingBox {
  return {
    ...box,
    x: Math.min(1 - box.width, Math.max(0, box.x + delta.x)),
    y: Math.min(1 - box.height, Math.max(0, box.y + delta.y)),
  };
}

function movePoint(point: NormalizedPoint, delta: NormalizedPoint): NormalizedPoint {
  return {
    x: Math.min(1, Math.max(0, point.x + delta.x)),
    y: Math.min(1, Math.max(0, point.y + delta.y)),
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_TOOL":
      return { ...state, activeTool: action.tool };
    case "SET_ERASER_MODE":
      return { ...state, eraserMode: action.mode };
    case "SET_STYLE":
      return {
        ...state,
        toolColor: action.style.color,
        strokeWidth: action.style.strokeWidth,
      };
    case "START_PATH":
      return {
        ...state,
        isDirty: true,
        activePath: {
          id: crypto.randomUUID(),
          tool: state.activeTool as "pen" | "arrow",
          points: [action.point],
          color: state.toolColor,
          strokeWidth: state.strokeWidth,
        },
      };
    case "ADD_POINT":
      return state.activePath
        ? { ...state, activePath: { ...state.activePath, points: [...state.activePath.points, action.point] } }
        : state;
    case "END_PATH":
      if (!state.activePath || state.activePath.points.length < 2) return { ...state, activePath: null };
      return { ...withHistory(state), isDirty: true, paths: [...state.paths, state.activePath], activePath: null };
    case "START_BOX":
      return { ...state, isDirty: true, activeBox: { start: action.point, current: action.point } };
    case "UPDATE_BOX":
      return state.activeBox ? { ...state, activeBox: { ...state.activeBox, current: action.point } } : state;
    case "END_BOX": {
      if (!state.activeBox) return state;
      const box = createBox(state.activeBox, state.toolColor, state.strokeWidth);
      if (!box) return { ...state, activeBox: null };
      return { ...withHistory(state), isDirty: true, boxes: [...state.boxes, box], activeBox: null };
    }
    case "CREATE_MEMO": {
      const id = crypto.randomUUID();
      const memo: CanvasMemo = { id, x: action.point.x, y: action.point.y, text: "", color: state.toolColor };
      return { ...withHistory(state), isDirty: true, memos: [...state.memos, memo], activeMemoId: id };
    }
    case "UPDATE_MEMO":
      return {
        ...state,
        isDirty: true,
        memos: state.memos.map((memo) => memo.id === action.id ? { ...memo, text: action.text } : memo),
      };
    case "COMMIT_MEMO_EDIT":
      if (!state.memoBaseline) return { ...state, activeMemoId: null };
      return snapshotsEqual(state.memoBaseline, snapshot(state))
        ? { ...state, memoBaseline: null, activeMemoId: null }
        : { ...pushSnapshot(state, state.memoBaseline), memoBaseline: null, activeMemoId: null, isDirty: true };
    case "DELETE_MEMO":
      return {
        ...withHistory(state),
        isDirty: true,
        memos: state.memos.filter((memo) => memo.id !== action.id),
        activeMemoId: state.activeMemoId === action.id ? null : state.activeMemoId,
        selectedIds: state.selectedIds.filter((id) => !objectKeyMatches(id, "memo", action.id)),
      };
    case "FOCUS_MEMO":
      return {
        ...state,
        activeMemoId: action.id,
        memoBaseline: action.id && state.activeMemoId !== action.id && !state.memoBaseline
          ? snapshot(state)
          : state.memoBaseline,
      };
    case "CLEAR":
      return {
        ...withHistory(state),
        isDirty: true,
        paths: [],
        boxes: [],
        memos: [],
        activeMemoId: null,
        activePath: null,
        activeBox: null,
        selectionBox: null,
        selectedIds: [],
      };
    case "LOAD":
      return {
        ...initialState,
        activeTool: state.activeTool,
        eraserMode: state.eraserMode,
        toolColor: state.toolColor,
        strokeWidth: state.strokeWidth,
        ...action.payload,
      };
    case "MARK_SAVED":
      return { ...state, isDirty: false };
    case "RESET_LOCAL":
      return {
        ...initialState,
        activeTool: state.activeTool,
        eraserMode: state.eraserMode,
        toolColor: state.toolColor,
        strokeWidth: state.strokeWidth,
      };
    case "UNDO": {
      const previous = state.past.at(-1);
      if (!previous) return state;
      return {
        ...restoreSnapshot(state, previous),
        past: state.past.slice(0, -1),
        future: [snapshot(state), ...state.future],
      };
    }
    case "REDO": {
      const next = state.future[0];
      if (!next) return state;
      return {
        ...restoreSnapshot(state, next),
        past: [...state.past.slice(-(HISTORY_LIMIT - 1)), snapshot(state)],
        future: state.future.slice(1),
      };
    }
    case "SELECT_ONE":
      return { ...state, selectedIds: [action.id], selectionBox: null };
    case "TOGGLE_SELECTED":
      return {
        ...state,
        selectedIds: state.selectedIds.includes(action.id)
          ? state.selectedIds.filter((id) => id !== action.id)
          : [...state.selectedIds, action.id],
        selectionBox: null,
      };
    case "CLEAR_SELECTION":
      return { ...state, selectedIds: [], selectionBox: null };
    case "DELETE_SELECTED":
      if (state.selectedIds.length === 0) return state;
      return {
        ...withHistory(state),
        isDirty: true,
        paths: state.paths.filter((path) => !state.selectedIds.some((id) => objectKeyMatches(id, "path", path.id))),
        boxes: state.boxes.filter((box) => !state.selectedIds.some((id) => objectKeyMatches(id, "box", box.id))),
        memos: state.memos.filter((memo) => !state.selectedIds.some((id) => objectKeyMatches(id, "memo", memo.id))),
        selectedIds: [],
      };
    case "MOVE_SELECTED":
      if (state.selectedIds.length === 0) return state;
      return {
        ...state,
        isDirty: true,
        paths: state.paths.map((path) =>
          state.selectedIds.some((id) => objectKeyMatches(id, "path", path.id))
            ? { ...path, points: path.points.map((point) => movePoint(point, action.delta)) }
            : path,
        ),
        boxes: state.boxes.map((box) =>
          state.selectedIds.some((id) => objectKeyMatches(id, "box", box.id)) ? moveBox(box, action.delta) : box,
        ),
        memos: state.memos.map((memo) =>
          state.selectedIds.some((id) => objectKeyMatches(id, "memo", memo.id))
            ? { ...memo, x: movePoint(memo, action.delta).x, y: movePoint(memo, action.delta).y }
            : memo,
        ),
      };
    case "START_SELECTED_MOVE":
      return { ...state, moveBaseline: snapshot(state) };
    case "COMMIT_SELECTED_MOVE":
      return state.moveBaseline
        ? { ...pushSnapshot(state, state.moveBaseline), moveBaseline: null, isDirty: true }
        : state;
    case "START_SELECTION_BOX":
      return { ...state, selectionBox: { start: action.point, current: action.point }, selectedIds: [] };
    case "UPDATE_SELECTION_BOX":
      return state.selectionBox ? { ...state, selectionBox: { ...state.selectionBox, current: action.point } } : state;
    case "END_SELECTION_BOX":
      return { ...state, selectionBox: null, selectedIds: action.ids };
    case "ERASE_OBJECT": {
      const parsed = parseCanvasObjectKey(action.id);
      if (!parsed) return state;
      const exists = parsed.kind === "path"
        ? state.paths.some((path) => path.id === parsed.id)
        : parsed.kind === "box"
          ? state.boxes.some((box) => box.id === parsed.id)
          : state.memos.some((memo) => memo.id === parsed.id);
      if (!exists) return state;
      return {
        ...withHistory(state),
        isDirty: true,
        paths: parsed.kind === "path" ? state.paths.filter((path) => path.id !== parsed.id) : state.paths,
        boxes: parsed.kind === "box" ? state.boxes.filter((box) => box.id !== parsed.id) : state.boxes,
        memos: parsed.kind === "memo" ? state.memos.filter((memo) => memo.id !== parsed.id) : state.memos,
        selectedIds: state.selectedIds.filter((id) => id !== action.id),
      };
    }
    case "START_ERASER_STROKE":
      return {
        ...state,
        activeEraserStroke: { points: [action.point], radius: 0.018 },
        eraserBaseline: snapshot(state),
      };
    case "UPDATE_ERASER_STROKE":
      return state.activeEraserStroke
        ? {
            ...state,
            activeEraserStroke: {
              ...state.activeEraserStroke,
              points: [...state.activeEraserStroke.points, action.point],
            },
          }
        : state;
    case "END_ERASER_STROKE": {
      if (!state.activeEraserStroke || !state.eraserBaseline) {
        return { ...state, activeEraserStroke: null, eraserBaseline: null };
      }
      const result = erasePathsByStroke({
        paths: state.paths,
        points: state.activeEraserStroke.points,
        radius: state.activeEraserStroke.radius,
      });
      if (!result.changed) {
        return { ...state, activeEraserStroke: null, eraserBaseline: null };
      }
      return {
        ...pushSnapshot(state, state.eraserBaseline),
        paths: result.paths,
        activeEraserStroke: null,
        eraserBaseline: null,
        selectedIds: [],
        isDirty: true,
      };
    }
    default:
      return state;
  }
}

export function useCanvasAnnotations() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const hasAnnotations = useMemo(
    () => state.paths.length > 0 || state.boxes.length > 0 || state.memos.length > 0,
    [state.paths.length, state.boxes.length, state.memos.length],
  );
  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  const setTool = useCallback((tool: AnnotationTool) => dispatch({ type: "SET_TOOL", tool }), []);
  const setStyle = useCallback((style: CanvasAnnotationStyle) => {
    persistCanvasStyle(style);
    dispatch({ type: "SET_STYLE", style });
  }, []);
  const clear = useCallback(() => dispatch({ type: "CLEAR" }), []);
  const load = useCallback((payload: SavedCanvasAnnotations) => dispatch({ type: "LOAD", payload }), []);
  const markSaved = useCallback(() => dispatch({ type: "MARK_SAVED" }), []);
  const resetLocal = useCallback(() => dispatch({ type: "RESET_LOCAL" }), []);
  const undo = useCallback(() => dispatch({ type: "UNDO" }), []);
  const redo = useCallback(() => dispatch({ type: "REDO" }), []);
  const commitMemoEdit = useCallback(() => dispatch({ type: "COMMIT_MEMO_EDIT" }), []);
  const startSelectedMove = useCallback(() => dispatch({ type: "START_SELECTED_MOVE" }), []);
  const commitSelectedMove = useCallback(() => dispatch({ type: "COMMIT_SELECTED_MOVE" }), []);

  const startDrawing = useCallback((point: NormalizedPoint) => {
    if (state.activeTool === "pen" || state.activeTool === "arrow") dispatch({ type: "START_PATH", point });
    else if (state.activeTool === "box") dispatch({ type: "START_BOX", point });
  }, [state.activeTool]);
  const moveDrawing = useCallback((point: NormalizedPoint) => {
    if (state.activePath) dispatch({ type: "ADD_POINT", point });
    else if (state.activeBox) dispatch({ type: "UPDATE_BOX", point });
  }, [state.activePath, state.activeBox]);
  const endDrawing = useCallback(() => {
    if (state.activePath) dispatch({ type: "END_PATH" });
    else if (state.activeBox) dispatch({ type: "END_BOX" });
  }, [state.activePath, state.activeBox]);
  const createMemo = useCallback((point: NormalizedPoint) => dispatch({ type: "CREATE_MEMO", point }), []);
  const updateMemo = useCallback((id: string, text: string) => dispatch({ type: "UPDATE_MEMO", id, text }), []);
  const deleteMemo = useCallback((id: string) => dispatch({ type: "DELETE_MEMO", id }), []);
  const focusMemo = useCallback((id: string | null) => dispatch({ type: "FOCUS_MEMO", id }), []);
  const setEraserMode = useCallback((mode: CanvasEraserMode) => dispatch({ type: "SET_ERASER_MODE", mode }), []);
  const selectOne = useCallback((id: CanvasObjectKey) => dispatch({ type: "SELECT_ONE", id }), []);
  const toggleSelected = useCallback((id: CanvasObjectKey) => dispatch({ type: "TOGGLE_SELECTED", id }), []);
  const clearSelection = useCallback(() => dispatch({ type: "CLEAR_SELECTION" }), []);
  const deleteSelected = useCallback(() => dispatch({ type: "DELETE_SELECTED" }), []);
  const moveSelected = useCallback((delta: NormalizedPoint) => dispatch({ type: "MOVE_SELECTED", delta }), []);
  const startSelectionBox = useCallback((point: NormalizedPoint) => dispatch({ type: "START_SELECTION_BOX", point }), []);
  const updateSelectionBox = useCallback((point: NormalizedPoint) => dispatch({ type: "UPDATE_SELECTION_BOX", point }), []);
  const endSelectionBox = useCallback((ids: CanvasObjectKey[]) => dispatch({ type: "END_SELECTION_BOX", ids }), []);
  const eraseObjectAtPoint = useCallback((id: CanvasObjectKey) => dispatch({ type: "ERASE_OBJECT", id }), []);
  const startEraserStroke = useCallback((point: NormalizedPoint) => dispatch({ type: "START_ERASER_STROKE", point }), []);
  const updateEraserStroke = useCallback((point: NormalizedPoint) => dispatch({ type: "UPDATE_ERASER_STROKE", point }), []);
  const endEraserStroke = useCallback(() => dispatch({ type: "END_ERASER_STROKE" }), []);
  const toPayload = useCallback((): SavedCanvasAnnotations => ({
    paths: state.paths,
    boxes: state.boxes,
    memos: state.memos,
  }), [state.paths, state.boxes, state.memos]);

  return {
    ...state,
    canUndo,
    canRedo,
    hasAnnotations,
    setTool,
    setStyle,
    setEraserMode,
    startDrawing,
    moveDrawing,
    endDrawing,
    createMemo,
    updateMemo,
    commitMemoEdit,
    deleteMemo,
    focusMemo,
    clear,
    load,
    toPayload,
    markSaved,
    resetLocal,
    undo,
    redo,
    selectOne,
    toggleSelected,
    clearSelection,
    deleteSelected,
    moveSelected,
    startSelectedMove,
    commitSelectedMove,
    startSelectionBox,
    updateSelectionBox,
    endSelectionBox,
    eraseObjectAtPoint,
    startEraserStroke,
    updateEraserStroke,
    endEraserStroke,
  };
}
