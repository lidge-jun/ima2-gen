import { useEffect, useState } from "react";
import { getBilling } from "../lib/api";
import type { BillingResponse } from "../types";

export function useBilling(): { data: BillingResponse | null; error: boolean } {
  const [data, setData] = useState<BillingResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getBilling()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, error };
}
