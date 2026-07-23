import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canConnectPorts } from "../ui/src/lib/nodeCompatibility.ts";
import { createBranchGraph } from "../ui/src/lib/nodeBranching.ts";

const port = (nodeId: string, type: string, direction: "input" | "output") => ({ nodeId, handleId: `${nodeId}-${direction}`, type, direction }) as any;
const emptyGraph = { nodes: [], edges: [] } as any;
const branchGraph = () => ({ nodes: [
  { id: "prompt", position: { x: 0, y: 0 }, data: {} },
  { id: "generator", position: { x: 240, y: 0 }, data: { status: "done", clientId: "generator" } },
  { id: "result", position: { x: 480, y: 0 }, data: { status: "done", clientId: "result" } },
], edges: [{ id: "input", source: "prompt", target: "generator" }, { id: "output", source: "generator", target: "result" }] }) as any;
const variants = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `v${index}`, label: `Variant ${index}`, provider: index ? "gemini" : "gpt", settingsPatch: {} }));
const branch = (count: number) => createBranchGraph({ graph: branchGraph(), sourceNodeId: "prompt", variants: variants(count), axis: "horizontal" });

describe("node palette compatibility contracts", () => {
  it("NC-04 allows prompt to prompt", () => assert.deepEqual(canConnectPorts(port("a", "prompt", "output"), port("b", "prompt", "input"), emptyGraph), { allowed: true }));
  it("NC-05 rejects image to video", () => assert.equal(canConnectPorts(port("a", "image", "output"), port("b", "video", "input"), emptyGraph).reason, "TYPE_MISMATCH"));
  it("NC-06 allows video to any-media", () => assert.equal(canConnectPorts(port("a", "video", "output"), port("b", "any-media", "input"), emptyGraph).allowed, true));
  it("NC-07 rejects same-direction ports", () => assert.equal(canConnectPorts(port("a", "prompt", "output"), port("b", "prompt", "output"), emptyGraph).reason, "SAME_DIRECTION"));
  it("NC-08 rejects self edges", () => assert.equal(canConnectPorts(port("same", "prompt", "output"), port("same", "prompt", "input"), emptyGraph).reason, "SELF_EDGE"));
  it("NC-09 rejects duplicate edges", () => assert.equal(canConnectPorts(port("a", "prompt", "output"), port("b", "prompt", "input"), { ...emptyGraph, edges: [{ source: "a", target: "b", sourceHandle: "a-output", targetHandle: "b-input" }] }).reason, "DUPLICATE_EDGE"));
  it("NC-10 rejects a second connection to an occupied input", () => assert.equal(canConnectPorts(port("a", "prompt", "output"), port("b", "prompt", "input"), { ...emptyGraph, edges: [{ source: "other", target: "b", targetHandle: "b-input" }] }).reason, "CARDINALITY"));
  it("NC-11 rejects a connection that would close a cycle", () => assert.equal(canConnectPorts(port("c", "image", "output"), port("a", "image", "input"), { ...emptyGraph, edges: [{ source: "a", target: "b" }, { source: "b", target: "c" }] }).reason, "CYCLE"));
  it("NC-12 allows a connection between unrelated nodes in the same graph", () => assert.equal(canConnectPorts(port("c", "image", "output"), port("d", "image", "input"), { ...emptyGraph, edges: [{ source: "a", target: "b" }, { source: "b", target: "c" }] }).allowed, true));
});

describe("node branching contracts", () => {
  it("NB-01 creates two branches", () => assert.equal(branch(2).createdNodeIds.length, 4));
  it("NB-02 creates four branches", () => assert.equal(branch(4).createdNodeIds.length, 8));
  it("NB-03 rejects one variant", () => assert.deepEqual(branch(1), { nodes: [], edges: [], createdNodeIds: [], createdEdgeIds: [] }));
  it("NB-04 rejects five variants", () => assert.deepEqual(branch(5), { nodes: [], edges: [], createdNodeIds: [], createdEdgeIds: [] }));
  it("NB-05 preserves the shared prompt input for provider comparison", () => {
    const result = branch(2);
    assert.equal(result.edges.filter((edge) => edge.source === "prompt").length, 2);
  });
  it("NB-07 clones existing result nodes for every branch", () => assert.equal(branch(2).nodes.filter((node) => node.id.startsWith("result-branch")).length, 2));
  it("NB-08 offsets branch placement to avoid collisions", () => assert.notEqual(branch(2).nodes[0].position.y, branch(2).nodes[2].position.y));
  it("NB-09 preserves unrecognized variant patch fields", () => {
    const result = createBranchGraph({ graph: branchGraph(), sourceNodeId: "prompt", variants: [{ ...variants(2)[0], settingsPatch: { impossible: true } }, variants(2)[1]], axis: "horizontal" } as any);
    assert.equal(result.createdNodeIds.length, 4);
    assert.equal((result.nodes[0].data as any).impossible, true);
  });
});
