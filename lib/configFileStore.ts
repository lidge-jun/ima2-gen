import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

let configMutationQueue: Promise<void> = Promise.resolve();

function serializeConfigMutation<T>(mutation: () => Promise<T>): Promise<T> {
  const result = configMutationQueue.then(mutation, mutation);
  configMutationQueue = result.then(() => undefined, () => undefined);
  return result;
}

async function writeConfigAtomic(cfgPath: string, data: unknown): Promise<void> {
  const tmp = `${cfgPath}.${process.pid}.${randomBytes(8).toString("hex")}.tmp`;
  try {
    await mkdir(dirname(cfgPath), { recursive: true, mode: 0o700 });
    await writeFile(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
    await rename(tmp, cfgPath);
  } catch (error) {
    throw error;
  }
}

export async function updateConfigFileAtomic(
  cfgPath: string,
  mutate: (config: Record<string, unknown>) => void,
): Promise<void> {
  try {
    await serializeConfigMutation(async () => {
      let existing: Record<string, unknown> = {};
      try {
        existing = JSON.parse(await readFile(cfgPath, "utf8")) as Record<string, unknown>;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "ENOENT") {
          throw Object.assign(new Error(`config file unreadable: ${cfgPath}`), {
            code: "CONFIG_UNREADABLE",
            cause: error,
          });
        }
      }
      mutate(existing);
      await writeConfigAtomic(cfgPath, existing);
    });
  } catch (error) {
    throw error;
  }
}
