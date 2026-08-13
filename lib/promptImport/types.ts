import type { RouteRuntimeContext } from "../runtimeContext.js";

export type PromptImportCtx = RouteRuntimeContext;

export interface PromptImportLimits {
  maxFileBytesForPreview: number;
  maxPromptCandidatesPerFile: number;
  maxPromptCandidatesPerImport: number;
  fetchTimeoutMs: number;
  maxCandidateChars: number;
  minCandidateChars: number;
  maxSourceCharsScanned: number;
  maxRepoIndexFiles?: number | undefined;
  searchLimit?: number | undefined;
  ttlMs?: number | undefined;
  maxFolderFiles?: number | undefined;
  maxFolderPreviewFiles?: number | undefined;
}

export interface PromptCandidateSource {
  kind: string;
  owner?: string | undefined;
  repo?: string | undefined;
  ref?: string | undefined;
  path?: string | undefined;
  htmlUrl?: string | undefined;
  sourceId?: string | undefined;
  filename?: string | undefined;
}

export interface PromptCandidateScoreHints {
  modelHints?: string[] | undefined;
  generationSurfaceHints?: string[] | undefined;
  taskHints?: string[] | undefined;
  sizeHints?: string[] | undefined;
  qualityHints?: string[] | undefined;
  warnings?: string[] | undefined;
}

export interface PromptCandidate {
  id: string;
  candidateId?: string | undefined;
  name: string;
  text: string;
  textPreview: string;
  tags: string[];
  warnings: string[];
  source: PromptCandidateSource;
  sourceFileId?: string | undefined;
  headingPath: string | null;
  ordinal: number;
  promptHash: string;
  scoreHints: PromptCandidateScoreHints;
}

export interface CuratedSourceLike {
  id: string;
  repo: string;
  owner?: string | undefined;
  name?: string | undefined;
  displayName?: string | undefined;
  defaultRef: string;
  allowedPaths: string[];
  extensions: string[];
  sourceType?: string | undefined;
  licenseSpdx: string;
  requiresAttribution?: boolean | undefined;
  trustTier: string;
  lastVerifiedAt?: string | null | undefined;
  notes?: string | undefined;
  searchSeeds?: string[] | undefined;
  defaultSearch?: boolean | undefined;
}

export interface GitHubFileSource {
  kind?: string | undefined;
  owner?: string | undefined;
  repo?: string | undefined;
  ref?: string | undefined;
  path?: string | undefined;
  extension?: string | undefined;
  htmlUrl?: string | undefined;
  rawUrl: string;
  tags?: string[] | undefined;
}

export interface DiscoveryRepo {
  full_name?: string | undefined;
  description?: string | null | undefined;
  topics?: string[] | undefined;
  pushed_at?: string | null | undefined;
  stargazers_count?: number | undefined;
  forks_count?: number | undefined;
  open_issues_count?: number | undefined;
  updated_at?: string | null | undefined;
  license?: { spdx_id?: string | null } | null | undefined;
  archived?: boolean | undefined;
  disabled?: boolean | undefined;
  fork?: boolean | undefined;
  default_branch?: string | null | undefined;
  html_url?: string | null | undefined;
  language?: string | null | undefined;
}
