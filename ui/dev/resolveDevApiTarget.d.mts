export function resolveDevApiTarget(options?: {
  env?: Record<string, string | undefined>;
  fallback?: string;
}): { url: string; source: "env" | "server.json" | "default" };
