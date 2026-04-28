import { useCallback, useState } from "react";
import {
  listPromptImportFolderFiles,
  previewPromptImportFolderFiles,
  type PromptGitHubFolderFile,
  type PromptImportCandidate,
} from "../lib/api";
import { useI18n } from "../i18n";

type PromptImportFolderSectionProps = {
  input: string;
  disabled?: boolean;
  onCandidates: (candidates: PromptImportCandidate[]) => void;
  onError: (message: string | null) => void;
};

export function PromptImportFolderSection({
  input,
  disabled = false,
  onCandidates,
  onError,
}: PromptImportFolderSectionProps) {
  const { t } = useI18n();
  const [files, setFiles] = useState<PromptGitHubFolderFile[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

  const listFolder = useCallback(async () => {
    if (!input.trim()) return;
    setBusy(true);
    setWarnings([]);
    onError(null);
    try {
      const result = await listPromptImportFolderFiles({
        source: { kind: "github-folder", input: input.trim() },
      });
      setFiles(result.files);
      setSelectedPaths(new Set(result.files.slice(0, 5).map((file) => file.path)));
      setWarnings(result.warnings);
      if (result.files.length === 0) onError(t("promptLibrary.folderFilesEmpty"));
    } catch (err) {
      setFiles([]);
      setSelectedPaths(new Set());
      onError(err instanceof Error ? err.message : t("promptLibrary.folderUnsupported"));
    } finally {
      setBusy(false);
    }
  }, [input, onError, t]);

  const previewSelected = useCallback(async () => {
    const paths = [...selectedPaths];
    if (paths.length === 0) {
      onError(t("promptLibrary.folderNoSelection"));
      return;
    }
    setBusy(true);
    setWarnings([]);
    onError(null);
    try {
      const result = await previewPromptImportFolderFiles({
        source: { kind: "github-folder", input: input.trim() },
        paths,
      });
      setWarnings(result.warnings);
      onCandidates(result.candidates);
    } catch (err) {
      onError(err instanceof Error ? err.message : t("promptLibrary.importFailed"));
    } finally {
      setBusy(false);
    }
  }, [input, onCandidates, onError, selectedPaths, t]);

  return (
    <div className="prompt-import-dialog__folder">
      <div className="prompt-import-dialog__section-title">
        <strong>{t("promptLibrary.folderFiles")}</strong>
        <span>{t("promptLibrary.folderBrowseHint")}</span>
      </div>
      <div className="prompt-import-dialog__folder-actions">
        <button type="button" onClick={() => void listFolder()} disabled={disabled || busy || !input.trim()}>
          {busy ? t("common.loading") : t("promptLibrary.folderBrowse")}
        </button>
        <button type="button" onClick={() => void previewSelected()} disabled={disabled || busy || selectedPaths.size === 0}>
          {t("promptLibrary.folderPreviewSelected")}
        </button>
        <span>{t("promptLibrary.folderSelectedCount", { count: selectedPaths.size })}</span>
      </div>
      {files.length > 0 ? (
        <div className="prompt-import-dialog__folder-list">
          {files.map((file) => (
            <label key={file.path} className="prompt-import-dialog__folder-file">
              <input
                type="checkbox"
                checked={selectedPaths.has(file.path)}
                onChange={(event) => {
                  setSelectedPaths((prev) => {
                    const next = new Set(prev);
                    if (event.target.checked) next.add(file.path);
                    else next.delete(file.path);
                    return next;
                  });
                }}
              />
              <span>
                <strong>{file.name}</strong>
                <small>{file.path}</small>
              </span>
              <em>{Math.ceil(file.sizeBytes / 1024)} KB</em>
            </label>
          ))}
        </div>
      ) : null}
      {warnings.length > 0 ? (
        <div className="prompt-import-dialog__folder-warning">
          {warnings.slice(0, 3).join(" · ")}
        </div>
      ) : null}
    </div>
  );
}
