import { hostname, platform, release } from "node:os";
import { listProviders } from "../../lib/providers/registry.js";
import type { ProviderDoctorLine } from "./doctor-providers.js";
import { buildDoctorReport, type DoctorReport } from "./doctor-report.js";

const SECRET_PATTERN = /(sk-|xai-|apikey-|Bearer\s+[A-Za-z0-9._-]+|-----BEGIN)/i;

export type DoctorBundle = {
  version: string;
  node: string;
  platform: string;
  hostnameHash: string;
  lanes: Array<{ lane: string; kind: string; text: string }>;
} & Pick<DoctorReport, "schemaVersion" | "checks" | "summary">;

function hashHostname(value: string): string {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return `h${(hash >>> 0).toString(16)}`;
}

export function buildDoctorBundle(input: {
  version: string;
  providerLines: readonly ProviderDoctorLine[];
  report?: DoctorReport;
}): DoctorBundle {
  const report = input.report ?? buildDoctorReport({ version: input.version, mode: "standard", lines: input.providerLines });
  const providers = buildDoctorReport({ version: input.version, mode: "standard", lines: input.providerLines });
  return {
    schemaVersion: report.schemaVersion, checks: report.checks, summary: report.summary,
    version: input.version,
    node: process.version,
    platform: `${platform()} ${release()}`,
    hostnameHash: hashHostname(hostname()),
    lanes: providers.checks.filter((line) => line.lane).map((line) => ({
      lane: line.lane!,
      kind: line.kind,
      text: line.message,
    })),
  };
}

export function bundleContainsSecrets(bundle: DoctorBundle): boolean {
  return JSON.stringify(bundle).search(SECRET_PATTERN) >= 0;
}

export function expectedLaneIds(): string[] {
  return listProviders().map((provider) => provider.id);
}
