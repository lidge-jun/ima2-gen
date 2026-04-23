import { memo, useCallback } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useAppStore, type ImageNodeData, type GraphNode } from "../store/useAppStore";

function ImageNodeImpl({ id, data, selected }: NodeProps<GraphNode>) {
  const d = data as ImageNodeData;
  const updateNodePrompt = useAppStore((s) => s.updateNodePrompt);
  const generateNode = useAppStore((s) => s.generateNode);
  const addChildNode = useAppStore((s) => s.addChildNode);
  const duplicateBranchRoot = useAppStore((s) => s.duplicateBranchRoot);
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

  const onDuplicateBranch = useCallback(() => {
    duplicateBranchRoot(id);
  }, [id, duplicateBranchRoot]);

  const onDelete = useCallback(() => deleteNode(id), [id, deleteNode]);

  const isBusy = d.status === "pending" || d.status === "reconciling";
  const statusLabel = {
    empty: "비어 있음",
    pending: "생성 중",
    reconciling: `동기화 중${d.pendingPhase ? ` · ${d.pendingPhase}` : ""}`,
    ready: `완료 · ${d.elapsed ?? "?"}s${d.webSearchCalls ? ` · 검색 ${d.webSearchCalls}` : ""}`,
    stale: `오래된 상태${d.error ? `: ${d.error}` : ""}`,
    "asset-missing": `에셋 누락${d.error ? `: ${d.error}` : ""}`,
    error: `오류: ${d.error ?? "알 수 없음"}`,
  }[d.status];

  return (
    <div className={`image-node image-node--${d.status}${selected ? " image-node--selected" : ""}`}>
      {d.parentServerNodeId ? (
        <Handle type="target" position={Position.Left} className="image-node__handle" />
      ) : null}
      <div className="image-node__preview">
        {d.imageUrl && d.status !== "asset-missing" ? (
          <img src={d.imageUrl} alt="노드 이미지" />
        ) : isBusy ? (
          <div className="image-node__skeleton" />
        ) : d.status === "asset-missing" ? (
          <div className="image-node__placeholder">에셋 없음</div>
        ) : d.status === "stale" ? (
          <div className="image-node__placeholder">상태 오래됨</div>
        ) : (
          <div className="image-node__placeholder">이미지 없음</div>
        )}
      </div>
      <textarea
        className="image-node__prompt nodrag"
        value={d.prompt}
        onChange={onPromptChange}
        onKeyDown={(e) => e.stopPropagation()}
        placeholder={d.parentServerNodeId ? "수정 프롬프트..." : "프롬프트..."}
        rows={2}
        disabled={isBusy}
      />
      <div className="image-node__footer">
        <span className="image-node__status">{statusLabel}</span>
        <div className="image-node__actions nodrag">
          <button type="button" onClick={onGenerate} disabled={isBusy}>
            {d.status === "ready" ? "다시 생성" : "생성"}
          </button>
          {d.status === "ready" ? (
            <>
              <button type="button" onClick={onBranch}>자식 추가</button>
              <button
                type="button"
                onClick={onDuplicateBranch}
                title="새 브랜치 루트로 복제"
              >
                브랜치 복제
              </button>
            </>
          ) : null}
          <button type="button" onClick={onDelete} className="image-node__del" title="삭제">×</button>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="image-node__handle image-node__handle--source" />
    </div>
  );
}

export const ImageNode = memo(ImageNodeImpl);
