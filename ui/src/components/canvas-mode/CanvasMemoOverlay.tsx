import type { PointerEvent } from "react";
import type { CanvasMemo } from "../../types/canvas";

interface CanvasMemoOverlayProps {
  memos: CanvasMemo[];
  activeMemoId: string | null;
  onUpdate: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onFocus: (id: string) => void;
  onCommit?: () => void;
}

function stopMemoPointer(event: PointerEvent<HTMLTextAreaElement>): void {
  event.stopPropagation();
}

export function CanvasMemoOverlay({
  memos,
  activeMemoId,
  onUpdate,
  onDelete,
  onFocus,
  onCommit,
}: CanvasMemoOverlayProps) {
  return (
    <div className="canvas-memo-overlay">
      {memos.map((memo) => (
        <textarea
          key={memo.id}
          className={`canvas-memo${activeMemoId === memo.id ? " canvas-memo--active" : ""}`}
          value={memo.text}
          style={{ left: `${memo.x * 100}%`, top: `${memo.y * 100}%` }}
          autoFocus={activeMemoId === memo.id}
          onFocus={() => onFocus(memo.id)}
          onPointerDown={stopMemoPointer}
          onPointerMove={stopMemoPointer}
          onPointerUp={stopMemoPointer}
          onPointerCancel={stopMemoPointer}
          onChange={(event) => onUpdate(memo.id, event.currentTarget.value)}
          onBlur={() => {
            onCommit?.();
            if (memo.text.trim() === "") onDelete(memo.id);
          }}
          aria-label="Canvas memo"
        />
      ))}
    </div>
  );
}
