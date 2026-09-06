import { lstat, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
export type OwnedAppRecord = {
  home: string; appOrigin: string | null; stubOrigin: string;
  closeResources(): Promise<void>; exited(): boolean;
  verificationReported(): boolean; verify(): void;
};
type Home = { path: string; dev: number; ino: number };
const homes = new Map<string, Home>();
const apps = new Set<OwnedAppRecord>();
const ownershipError = () => new Error("E2E_HOME_OWNERSHIP");

async function identity(path: string): Promise<Home> {
  const metadata = await lstat(path);
  if (!metadata.isDirectory() || metadata.isSymbolicLink() || await realpath(path) !== path) throw ownershipError();
  return { path, dev: metadata.dev, ino: metadata.ino };
}
export async function issueAppHome(): Promise<string> {
  const path = await realpath(await mkdtemp(join(tmpdir(), "ima2-e2e-")));
  homes.set(path, await identity(path)); return path;
}
export async function requireAppHome(path: string): Promise<void> {
  const issued = homes.get(path);
  if (!issued) throw ownershipError();
  const current = await identity(path);
  if (issued.dev !== current.dev || issued.ino !== current.ino) throw ownershipError();
}
function ownedOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.origin === origin && ["http:", "https:"].includes(url.protocol)
      && ["127.0.0.1", "localhost"].includes(url.hostname)
      && Boolean(url.port) && url.port !== "3333" && !url.username && !url.password;
  } catch { return false; }
}
export async function registerOwnedApp(record: OwnedAppRecord): Promise<void> {
  await requireAppHome(record.home);
  if (!ownedOrigin(record.stubOrigin) || (record.appOrigin !== null && !ownedOrigin(record.appOrigin))) throw ownershipError();
  apps.add(record);
}
export function isOwnedBrowserOrigin(origin: string): boolean {
  if (!ownedOrigin(origin)) return false;
  return [...apps].some((app) => !app.exited() && (app.appOrigin === origin || app.stubOrigin === origin));
}
export function hasUnexitedOwnedApps(): boolean { return [...apps].some((app) => !app.exited()); }

export async function disposeOwnedApps(): Promise<void> {
  const errors: unknown[] = [];
  for (const app of apps) {
    try { await app.closeResources(); }
    catch (error) { errors.push(error); }
    if (!app.exited()) errors.push(new Error("E2E_CHILD_EXIT_UNPROVEN"));
    if (!app.verificationReported()) {
      try { app.verify(); } catch (error) { errors.push(error); }
    }
  }
  for (const [path] of homes) {
    if ([...apps].some((app) => app.home === path && !app.exited())) continue;
    try {
      await requireAppHome(path);
      await rm(path, { recursive: true, force: false });
      homes.delete(path);
    } catch (error) { errors.push(error); }
  }
  for (const app of apps) if (app.exited() && !homes.has(app.home)) apps.delete(app);
  if (errors.length) throw new AggregateError(errors, "E2E_OWNED_CLEANUP");
}
