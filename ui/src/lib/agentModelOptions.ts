type AgentLlmProvider = "oauth" | "api" | "grok" | "agy";

export type AgentLlmModelOption = {
  value: string;
  shortLabel: string;
  fullLabel: string;
  provider: AgentLlmProvider;
};

export const AGENT_LLM_MODEL_OPTIONS: AgentLlmModelOption[] = [
  { value: "gpt-5.6-luna", shortLabel: "5.6l", fullLabel: "GPT-5.6 Luna", provider: "oauth" },
  { value: "gpt-5.6-terra", shortLabel: "5.6t", fullLabel: "GPT-5.6 Terra", provider: "oauth" },
  { value: "gpt-5.6-sol", shortLabel: "5.6s", fullLabel: "GPT-5.6 Sol", provider: "oauth" },
  { value: "gpt-5.5", shortLabel: "5.5", fullLabel: "GPT-5.5", provider: "oauth" },
  { value: "gpt-5.4", shortLabel: "5.4", fullLabel: "GPT-5.4", provider: "oauth" },
  { value: "gpt-5.4-mini", shortLabel: "5.4m", fullLabel: "GPT-5.4 mini", provider: "oauth" },
  { value: "grok-4.5", shortLabel: "4.5", fullLabel: "Grok 4.5", provider: "grok" },
  { value: "grok-4.3", shortLabel: "4.3", fullLabel: "Grok 4.3", provider: "grok" },
];

export function getAgentLlmModelOption(settings: { model: string; provider: AgentLlmProvider }): AgentLlmModelOption {
  return AGENT_LLM_MODEL_OPTIONS.find((option) => option.value === settings.model)
    ?? AGENT_LLM_MODEL_OPTIONS.find((option) => option.provider === settings.provider)
    ?? AGENT_LLM_MODEL_OPTIONS[0];
}
