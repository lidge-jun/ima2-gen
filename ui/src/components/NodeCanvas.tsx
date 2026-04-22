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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useAppStore, type GraphNode, type GraphEdge } from "../store/useAppStore";
import { ImageNode } from "./ImageNode";

function NodeCanvasInner() {
  const nodes = useAppStore((s) => s.graphNodes);
  const edges = useAppStore((s) => s.graphEdges);
  const setGraphNodes = useAppStore((s) => s.setGraphNodes);
  const setGraphEdges = useAppStore((s) => s.setGraphEdges);
  const addRootNode = useAppStore((s) => s.addRootNode);
  const addChildNodeAt = useAppStore((s) => s.addChildNodeAt);
  const connectNodes = useAppStore((s) => s.connectNodes);
  const deleteNodes = useAppStore((s) => s.deleteNodes);

  const { screenToFlowPosition } = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const nodeTypes = useMemo(() => ({ imageNode: ImageNode }), []);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setGraphNodes(applyNodeChanges(changes, nodes) as GraphNode[]),
    [nodes, setGraphNodes],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) =>
      setGraphEdges(applyEdgeChanges(changes, edges) as GraphEdge[]),
    [edges, setGraphEdges],
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

  return (
    <main className="node-canvas" ref={wrapperRef}>
      {nodes.length === 0 ? (
        <button type="button" className="node-canvas__plus" onClick={() => addRootNode()}>
          + Add first node
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
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode={["Delete", "Backspace"]}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={24} color="#2a2a2a" />
            <Controls className="node-canvas__controls" />
            <MiniMap
              pannable
              zoomable
              maskColor="rgba(10, 10, 10, 0.7)"
              nodeColor="#4a9eff"
              nodeStrokeColor="#1a1a1a"
              style={{ background: "#141414", border: "1px solid #2a2a2a" }}
            />
          </ReactFlow>
          <button
            type="button"
            className="node-canvas__add-root"
            onClick={() => addRootNode()}
            title="Add root node"
          >
            +
          </button>
          <div className="node-canvas__hint">
            Drag from ▶ to empty space to branch · Delete/⌫ to remove
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
