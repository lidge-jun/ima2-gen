export type FileDigest = { path: string; bytes: number; sha256: string };
export type UiBuildOptions = {
  mode: "production"; sourcemap: boolean; devUi: boolean;
  nodeMode: boolean; cardNews: boolean; agentMode: boolean;
};
export type UiBuildReceipt = {
  schemaVersion: 1; headSha: string | null; sourceInputDigest: string;
  buildOptions: UiBuildOptions; outputs: FileDigest[];
};
export type UiSourceSnapshot = {
  headSha: string | null; sourceInputDigest: string; buildOptions: UiBuildOptions;
};
export type UiBuildTransaction = { nonce: string; source: UiSourceSnapshot };
export function sourceInputDigest(files: FileDigest[], options: UiBuildOptions): string;
export function inventoryUiSourceInputs(repoRoot: string): Promise<FileDigest[]>;
export function readUiSourceSnapshot(repoRoot: string): Promise<UiSourceSnapshot>;
export function inventoryUiOutputs(distDir: string): Promise<FileDigest[]>;
export function parseUiBuildReceipt(value: unknown): UiBuildReceipt;
export function assertUiReceiptBinding(receipt: UiBuildReceipt, current: UiSourceSnapshot,
  outputs: FileDigest[], requireGitHead: boolean): "git-and-source" | "source-digest";
export function beginUiBuild(repoRoot: string): Promise<UiBuildTransaction>;
export function finishUiBuild(repoRoot: string, transaction: UiBuildTransaction): Promise<UiBuildReceipt>;
export function abortUiBuild(repoRoot: string, transaction: UiBuildTransaction): Promise<void>;
export function verifyUiBuildReceipt(options: {
  repoRoot: string; distDir: string; requireGitHead: boolean;
}): Promise<{ receipt: UiBuildReceipt; binding: "git-and-source" | "source-digest" }>;
