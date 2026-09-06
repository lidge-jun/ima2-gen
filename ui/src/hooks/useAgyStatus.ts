import { fetchApi } from "../lib/api-core";
import { useEffect, useState } from "react";
import { getLanAuthEpoch, isLanSessionLocked } from "../lib/lanSession";

export interface AgyStatus {
  installed: boolean;
}

// Antigravity CLI (`agy`) install detection. Login state is NOT detectable
// (agy has no status command), so this only reports whether the binary exists.
export function useAgyStatus(): AgyStatus | null {
  const [status, setStatus] = useState<AgyStatus | null>(null);

  useEffect(() => {
    if (isLanSessionLocked()) return;
    const epoch = getLanAuthEpoch();
    let cancelled = false;

    const load = async (): Promise<void> => {
      try {
        const res = await fetchApi("/api/agy/status");
        if (cancelled) return;
        const data: AgyStatus = await res.json();
        if (cancelled || isLanSessionLocked() || epoch !== getLanAuthEpoch()) return;
        setStatus(data);
      } catch {
        if (!cancelled && !isLanSessionLocked() && epoch === getLanAuthEpoch()) setStatus({ installed: false });
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
