import { useAppStore } from "../store/useAppStore";
import { useOAuthStatus } from "../hooks/useOAuthStatus";
import { OptionGroup } from "./OptionGroup";
import type { Provider } from "../types";

const items = [
  {
    value: "oauth" as const,
    label: "OAuth",
    sub: "free / codex login",
    color: "var(--green)",
  },
  {
    value: "api" as const,
    label: "API Key",
    sub: "paid / .env",
  },
];

export function ProviderSelect() {
  const provider = useAppStore((s) => s.provider);
  const setProvider = useAppStore((s) => s.setProvider);
  const oauth = useOAuthStatus();

  let statusNode: React.ReactNode = "";
  let statusColor = "var(--text-dim)";
  if (oauth?.status === "ready") {
    statusNode = "gpt-image-2 ready";
    statusColor = "var(--green)";
  } else if (oauth?.status === "auth_required") {
    statusNode = (
      <>
        Run <code style={{ color: "var(--accent)" }}>codex login</code> first
      </>
    );
    statusColor = "var(--amber)";
  } else if (oauth?.status === "starting") {
    statusNode = "OAuth proxy starting...";
  }

  return (
    <>
      <OptionGroup<Provider>
        title="Provider"
        items={items}
        value={provider}
        onChange={setProvider}
      />
      {statusNode ? (
        <div className="oauth-status" style={{ color: statusColor }}>
          {statusNode}
        </div>
      ) : null}
    </>
  );
}
