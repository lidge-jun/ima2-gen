import { hostname, platform, release } from "node:os";
import { listProviders } from "../../lib/providers/registry.js";
import type { ProviderDoctorLine } from "./doctor-providers.js";

const SECRET_PATTERN = /(sk-|xai-|apikey-|Bearer\s+[A-Za-z0-9._-]+|-----BEGIN)/i;

export type DoctorBundle = {
  version: string;
  node: string;
  platform: string;
  hostnameHash: string;
  lanes: Array<{ lane: string; kind: string; text: string }>;
};

function hashHostname(value: string): string {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return `h${(hash >>> 0).toString(16)}`;
}

export function buildDoctorBundle(input: {
  version: string;
  providerLines: readonly ProviderDoctorLine[];
}): DoctorBundle {
  return {
    version: input.version,
    node: process.version,
    platform: `${platform()} ${release()}`,
    hostnameHash: hashHostname(hostname()),
    lanes: input.providerLines.map((line) => ({
      lane: line.lane,
      kind: line.kind,
      text: SECRET_PATTERN.test(line.text) ? "[redacted]" : line.text,
    })),
  };
}

export function bundleContainsSecrets(bundle: DoctorBundle): boolean {
  return JSON.stringify(bundle).search(SECRET_PATTERN) >= 0;
}

export function expectedLaneIds(): string[] {
  return listProviders().map((provider) => provider.id);
}
