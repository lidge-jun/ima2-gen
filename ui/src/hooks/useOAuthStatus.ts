import { useEffect, useState } from "react";
import { getOAuthStatus } from "../lib/api";
import type { OAuthStatus } from "../types";

export function useOAuthStatus(): OAuthStatus | null {
  const [status, setStatus] = useState<OAuthStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async (): Promise<void> => {
      try {
        const data = await getOAuthStatus();
        if (cancelled) return;
        setStatus(data);
        if (data.status === "starting") {
          timer = setTimeout(poll, 3000);
        }
      } catch {
        if (!cancelled) setStatus(null);
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return status;
}
