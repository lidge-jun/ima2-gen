import { useEffect, useState, useCallback } from "react";

interface KeyStatusEntry {
  configured: boolean;
  source: string;
  valid: boolean;
  maskedKey: string | null;
}

export type KeyStatus = Record<"openai" | "xai" | "gemini" | "vertex", KeyStatusEntry> & {
  geminiAuthMode?: "apikey" | "vertex";
  openaiBaseUrl?: {
    value: string;
    defaultValue: string;
    custom: boolean;
  };
};

export function useKeyStatus() {
  const [data, setData] = useState<KeyStatus | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/keys/status");
      const json: KeyStatus = await res.json();
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      await fetchStatus();
      if (!cancelled) {
        timer = setInterval(fetchStatus, 30_000);
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [fetchStatus]);

  return { data, error, mutate: fetchStatus };
}
