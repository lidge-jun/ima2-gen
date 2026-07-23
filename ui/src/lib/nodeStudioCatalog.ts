import type { NodeCommandDescriptor } from "../components/node-canvas/NodeCommandPalette";
import type { CompatibilityResult } from "./nodeCompatibility";

export const NODE_STUDIO_COMMANDS: readonly NodeCommandDescriptor[] = [
  {
    type: "image-generate",
    label: "Image generation",
    description: "Add an image node to the workflow.",
    category: "generate",
    keywords: ["image", "generate", "prompt"],
    inputPorts: [{ id: "image-input", type: "image" }],
    outputPorts: [{ id: "image-output", type: "image" }],
    createData: () => ({}),
  },
];

export function compatibilityReasonMessage(
  reason: CompatibilityResult["reason"] | "UNKNOWN_PORT",
): string {
  switch (reason) {
    case "SAME_DIRECTION": return "Connect an output port to an input port.";
    case "TYPE_MISMATCH": return "Those port types are not compatible.";
    case "CARDINALITY": return "That input already has a connection.";
    case "SELF_EDGE": return "A node cannot connect to itself.";
    case "DUPLICATE_EDGE": return "That connection already exists.";
    case "CYCLE": return "That connection would create a loop.";
    default: return "This port is not available for connections.";
  }
}
