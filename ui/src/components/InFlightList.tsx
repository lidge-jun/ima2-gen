import { useAppStore } from "../store/useAppStore";

function truncate(s: string, max = 28) {
  const t = s.trim().replace(/\s+/g, " ");
  return t.length > max ? t.slice(0, max) + "…" : t;
}

const PHASE_LABEL: Record<string, string> = {
  queued: "queued",
  streaming: "streaming",
  decoding: "finalizing",
};

export function InFlightList() {
  const inFlight = useAppStore((s) => s.inFlight);
  if (inFlight.length === 0) return null;

  return (
    <ul className="in-flight-list">
      {inFlight.map((f) => {
        const phaseLabel = f.phase ? PHASE_LABEL[f.phase] ?? f.phase : "queued";
        return (
          <li key={f.id} className="in-flight-item" data-phase={f.phase ?? "queued"}>
            <span className="in-flight-prompt">{truncate(f.prompt)}</span>
            <span className="in-flight-phase">{phaseLabel}</span>
            <span className="in-flight-spinner" aria-hidden="true" />
          </li>
        );
      })}
    </ul>
  );
}
