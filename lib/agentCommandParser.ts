import type { AgentSlashCommand, AgentSlashCommandName } from "./agentTypes.js";
import { config } from "../config.js";

const MAX_AGENT_VARIANT_COUNT = Math.max(1, Math.trunc(Number(config.limits.maxGeneratedImages) || 24));
const MAX_AGENT_PARALLELISM = Math.max(1, Math.trunc(Number(config.limits.maxParallel) || 24));

const COMMAND_ALIASES: Record<string, AgentSlashCommandName> = {
  ask: "question",
  q: "question",
  question: "question",
  help: "help",
  h: "help",
  variants: "variants",
  variant: "variants",
  v: "variants",
  n: "variants",
  generate: "generate",
  gen: "generate",
  g: "generate",
  parallel: "parallelism",
  parallelism: "parallelism",
  p: "parallelism",
};

export function parseAgentSlashCommand(input: string): AgentSlashCommand | null {
  const raw = input.trim();
  if (!raw.startsWith("/")) return null;

  const match = /^\/([a-z][\w-]*)(?:\s+([\s\S]*))?$/i.exec(raw);
  if (!match) return null;

  const captured = match[1];
  if (!captured) return null;
  const rawName = captured.toLowerCase();
  const name = COMMAND_ALIASES[rawName];
  if (!name) return null;

  const rest = (match[2] ?? "").trim();
  const countCommands: AgentSlashCommandName[] = ["variants", "generate", "parallelism"];
  const parsed = countCommands.includes(name) ? parseLeadingCount(rest, name) : { prompt: rest };
  return {
    name,
    rawName,
    raw,
    prompt: parsed.prompt,
    ...(parsed.value ? { value: parsed.value } : {}),
  };
}

export function formatAgentSlashHelp(): string {
  return [
    "Available Agent commands:",
    "/question <topic> - ask a planning question without generating images.",
    `/variants <1-${MAX_AGENT_VARIANT_COUNT}> <prompt> - force that many image variants.`,
    `/generate <1-${MAX_AGENT_VARIANT_COUNT}> <prompt> - generate a bounded fanout from one request.`,
    `/parallelism <1-${MAX_AGENT_PARALLELISM}> <prompt> - cap concurrent tool calls for this turn.`,
  ].join("\n");
}

export function formatAgentQuestionReply(prompt: string): string {
  const topic = prompt.trim();
  if (!topic) {
    return "What would you like to clarify before generating images?";
  }
  return topic;
}

function parseLeadingCount(value: string, name: AgentSlashCommandName): { value?: number; prompt: string } {
  const match = /^(\d+)(?:\s+([\s\S]*))?$/.exec(value);
  if (!match) return { prompt: value };
  const max = name === "parallelism" ? MAX_AGENT_PARALLELISM : MAX_AGENT_VARIANT_COUNT;
  return {
    value: Math.max(1, Math.min(max, Number(match[1]))),
    prompt: (match[2] ?? "").trim(),
  };
}
