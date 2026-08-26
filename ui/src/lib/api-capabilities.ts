import { jsonFetch } from "./api-core";

export type Ima2Capabilities = {
  limits?: {
    maxRefCount?: number;
    maxGeneratedImages?: number;
  };
  defaults?: {
    /** Display only — the client never re-sends an untouched value, so the
     *  server keeps resolving these from config for absent fields. */
    nai?: {
      sampler?: string;
      noiseSchedule?: string;
      steps?: number;
      scale?: number;
    };
  };
};

export function getCapabilities(): Promise<Ima2Capabilities> {
  return jsonFetch<Ima2Capabilities>("/api/capabilities");
}
