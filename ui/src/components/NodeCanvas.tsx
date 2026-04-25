import { useCallback, useMemo, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
  ReactFlowProvider,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type OnConnectEnd,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useAppStore, type GraphNode, type GraphEdge } from "../store/useAppStore";
import { ImageNode } from "./ImageNode";
import { NodeBatchBar } from "./NodeBatchBar";
import { useI18n } from "../i18n";

function NodeCanvasInner() {
  const { t } = useI18n();
  const nodes = useAppStore((s) => s.graphNodes);
  const edges = useAppStore((s) => s.graphEdges);
  const setGraphNodes = useAppStore((s) => s.setGraphNodes);
  const setGraphEdges = useAppStore((s) => s.setGraphEdges);
  const disconnectEdges = useAppStore((s) => s.disconnectEdges);
  const addRootNode = useAppStore((s) => s.addRootNode);
  const addChildNodeAt = useAppStore((s) => s.addChildNodeAt);
  const connectNodes = useAppStore((s) => s.connectNodes);
  const deleteNodes = useAppStore((s) => s.deleteNodes);
  const nodeSelectionMode = useAppStore((s) => s.nodeSelectionMode);
  const selectNodeGraph = useAppStore((s) => s.selectNodeGraph);
  const sessionLoading = useAppStore((s) => s.sessionLoading);
  const resolvedTheme = useAppStore((s) => s.resolvedTheme);

  const { screenToFlowPosition } = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const nodeTypes = useMemo(() => ({ imageNode: ImageNode }), []);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setGraphNodes(applyNodeChanges(changes, nodes) as GraphNode[]),
    [nodes, setGraphNodes],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const removedEdgeIds = changes
        .filter((change) => change.type === "remove")
        .map((change) => change.id);
      if (removedEdgeIds.length > 0) {
        if (nodeSelectionMode) return;
        disconnectEdges(removedEdgeIds);
        return;
      }
      setGraphEdges(applyEdgeChanges(changes, edges) as GraphEdge[]);
    },
    [disconnectEdges, edges, nodeSelectionMode, setGraphEdges],
  );

  const onConnect = useCallback(
    (params: Connection) => {
      if (params.source && params.target) connectNodes(params.source, params.target);
    },
    [connectNodes],
  );

  const onConnectEnd: OnConnectEnd = useCallback(
    (event, connectionState) => {
      if (connectionState.isValid) return;
      const fromNodeId = connectionState.fromNode?.id;
      if (!fromNodeId) return;
      const clientX =
        "touches" in event ? event.changedTouches[0].clientX : (event as MouseEvent).clientX;
      const clientY =
        "touches" in event ? event.changedTouches[0].clientY : (event as MouseEvent).clientY;
      const pos = screenToFlowPosition({ x: clientX, y: clientY });
      addChildNodeAt(fromNodeId, pos);
    },
    [addChildNodeAt, screenToFlowPosition],
  );

  const onNodesDelete = useCallback(
    (deleted: GraphNode[]) => deleteNodes(deleted.map((n) => n.id)),
    [deleteNodes],
  );
  const onNodeClick: NodeMouseHandler<GraphNode> = useCallback(
    (event, node) => {
      if (!nodeSelectionMode) return;
      event.preventDefault();
      selectNodeGraph(node.id, event.metaKey || event.ctrlKey);
    },
    [nodeSelectionMode, selectNodeGraph],
  );

  return (
    <main className="node-canvas" ref={wrapperRef}>
      {sessionLoading && <div className="node-canvas__loading">{t("nodeCanvas.loading")}</div>}
      {nodes.length === 0 ? (
        <button type="button" className="node-canvas__plus" onClick={() => addRootNode()}>
          {t("nodeCanvas.addFirst")}
        </button>
      ) : (
        <>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onConnectEnd={onConnectEnd}
            onNodesDelete={onNodesDelete}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            connectionRadius={32}
            selectionOnDrag={nodeSelectionMode}
            multiSelectionKeyCode={nodeSelectionMode ? null : undefined}
            panOnDrag={nodeSelectionMode ? [2] : true}
            fitView
            deleteKeyCode={nodeSelectionMode ? null : ["Delete", "Backspace"]}
            proOptions={{ hideAttribution: true }}
          >
            <NodeBatchBar />
            <Background gap={24} color={resolvedTheme === "light" ? "#d9dee6" : "#2a2a2a"} />
            <Controls className="node-canvas__controls" />
            <MiniMap
              pannable
              zoomable
              maskColor={
                resolvedTheme === "light" ? "rgba(246, 247, 251, 0.72)" : "rgba(10, 10, 10, 0.7)"
              }
              nodeColor={resolvedTheme === "light" ? "#1f2430" : "#f0f0f0"}
              nodeStrokeColor={resolvedTheme === "light" ? "#ffffff" : "#1a1a1a"}
              style={{
                background: resolvedTheme === "light" ? "#ffffff" : "#141414",
                border: `1px solid ${resolvedTheme === "light" ? "#d9dee6" : "#2a2a2a"}`,
              }}
            />
          </ReactFlow>
          <button
            type="button"
            className="node-canvas__add-root"
            onClick={() => addRootNode()}
            title={t("nodeCanvas.addRootTitle")}
          >
            +
          </button>
          <div className="node-canvas__hint">
            {t("nodeCanvas.hint")}
          </div>
        </>
      )}
    </main>
  );
}

export function NodeCanvas() {
  return (
    <ReactFlowProvider>
      <NodeCanvasInner />
    </ReactFlowProvider>
  );
}
