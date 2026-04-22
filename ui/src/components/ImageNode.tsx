import { memo, useCallback } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useAppStore, type ImageNodeData, type GraphNode } from "../store/useAppStore";

function ImageNodeImpl({ id, data, selected }: NodeProps<GraphNode>) {
  const d = data as ImageNodeData;
  const updateNodePrompt = useAppStore((s) => s.updateNodePrompt);
  const generateNode = useAppStore((s) => s.generateNode);
  const addChildNode = useAppStore((s) => s.addChildNode);
  const deleteNode = useAppStore((s) => s.deleteNode);

  const onPromptChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => updateNodePrompt(id, e.target.value),
    [id, updateNodePrompt],
  );

  const onGenerate = useCallback(() => {
    void generateNode(id);
  }, [id, generateNode]);

  const onBranch = useCallback(() => {
    if (d.status !== "ready") return;
    addChildNode(id);
  }, [id, d.status, addChildNode]);

  const onDelete = useCallback(() => deleteNode(id), [id, deleteNode]);

  const statusLabel = {
    empty: "empty",
    pending: "generating…",
    ready: `ready · ${d.elapsed ?? "?"}s${d.webSearchCalls ? ` · ws×${d.webSearchCalls}` : ""}`,
    error: `error: ${d.error ?? "unknown"}`,
  }[d.status];

  return (
    <div className={`image-node image-node--${d.status}${selected ? " image-node--selected" : ""}`}>
      {d.parentServerNodeId ? (
        <Handle type="target" position={Position.Left} className="image-node__handle" />
      ) : null}
      <div className="image-node__preview">
        {d.imageUrl ? (
          <img src={d.imageUrl} alt="node" />
        ) : d.status === "pending" ? (
          <div className="image-node__skeleton">⏳</div>
        ) : (
          <div className="image-node__placeholder">no image</div>
        )}
      </div>
      <textarea
        className="image-node__prompt nodrag"
        value={d.prompt}
        onChange={onPromptChange}
        onKeyDown={(e) => e.stopPropagation()}
        placeholder={d.parentServerNodeId ? "Edit prompt…" : "Prompt…"}
        rows={2}
        disabled={d.status === "pending"}
      />
      <div className="image-node__footer">
        <span className="image-node__status">{statusLabel}</span>
        <div className="image-node__actions nodrag">
          <button type="button" onClick={onGenerate} disabled={d.status === "pending"}>
            {d.status === "ready" ? "Regenerate" : "Generate"}
          </button>
          {d.status === "ready" ? (
            <button type="button" onClick={onBranch}>+ Child</button>
          ) : null}
          <button type="button" onClick={onDelete} className="image-node__del" title="Delete">✕</button>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="image-node__handle image-node__handle--source" />
    </div>
  );
}

export const ImageNode = memo(ImageNodeImpl);
