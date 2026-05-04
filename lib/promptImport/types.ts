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
  maxRepoIndexFiles?: number;
  searchLimit?: number;
  ttlMs?: number;
  maxFolderFiles?: number;
  maxFolderPreviewFiles?: number;
}

export interface PromptCandidateSource {
  kind: string;
  owner?: string;
  repo?: string;
  ref?: string;
  path?: string;
  htmlUrl?: string;
  sourceId?: string;
  filename?: string;
}

export interface PromptCandidateScoreHints {
  modelHints?: string[];
  generationSurfaceHints?: string[];
  taskHints?: string[];
  sizeHints?: string[];
  qualityHints?: string[];
  warnings?: string[];
}

export interface PromptCandidate {
  id: string;
  candidateId?: string;
  name: string;
  text: string;
  textPreview: string;
  tags: string[];
  warnings: string[];
  source: PromptCandidateSource;
  sourceFileId?: string;
  headingPath: string | null;
  ordinal: number;
  promptHash: string;
  scoreHints: PromptCandidateScoreHints;
}

export interface CuratedSourceLike {
  id: string;
  repo: string;
  owner?: string;
  name?: string;
  displayName?: string;
  defaultRef: string;
  allowedPaths: string[];
  extensions: string[];
  sourceType?: string;
  licenseSpdx: string;
  requiresAttribution?: boolean;
  trustTier: string;
  lastVerifiedAt?: string | null;
  notes?: string;
  searchSeeds?: string[];
  defaultSearch?: boolean;
}

export interface GitHubFileSource {
  kind?: string;
  owner?: string;
  repo?: string;
  ref?: string;
  path?: string;
  extension?: string;
  htmlUrl?: string;
  rawUrl: string;
  tags?: string[];
}

export interface DiscoveryRepo {
  full_name?: string;
  description?: string | null;
  topics?: string[];
  pushed_at?: string | null;
  stargazers_count?: number;
  forks_count?: number;
  open_issues_count?: number;
  updated_at?: string | null;
  license?: { spdx_id?: string | null } | null;
  archived?: boolean;
  disabled?: boolean;
  fork?: boolean;
  default_branch?: string | null;
  html_url?: string | null;
  language?: string | null;
}
