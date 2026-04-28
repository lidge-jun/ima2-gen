import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { commitPromptImport, previewPromptImport, type PromptImportCandidate } from "../lib/api";
import { useI18n } from "../i18n";
import { useAppStore } from "../store/useAppStore";

type PromptImportDialogProps = {
  open: boolean;
  onClose: () => void;
  onImported: () => Promise<void>;
};

const SUPPORTED_FILE_RE = /\.(txt|md|markdown)$/i;

export function PromptImportDialog({ open, onClose, onImported }: PromptImportDialogProps) {
  const { t } = useI18n();
  const showToast = useAppStore((s) => s.showToast);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [githubInput, setGithubInput] = useState("");
  const [candidates, setCandidates] = useState<PromptImportCandidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    window.setTimeout(() => dialogRef.current?.focus(), 0);
    return () => previousFocusRef.current?.focus();
  }, [open]);

  const addPreviewCandidates = useCallback((next: PromptImportCandidate[]) => {
    setCandidates((prev) => {
      const known = new Set(prev.map((candidate) => candidate.id));
      const merged = [...prev];
      for (const candidate of next) {
        if (!known.has(candidate.id)) merged.push(candidate);
      }
      setSelected(new Set(merged.map((candidate) => candidate.id)));
      return merged;
    });
  }, []);

  const previewFiles = useCallback(
    async (files: File[]) => {
      const supported = files.filter((file) => SUPPORTED_FILE_RE.test(file.name));
      if (supported.length === 0) {
        setError(t("promptLibrary.importNoValidFiles"));
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const previews = [];
        for (const file of supported) {
          previews.push(await previewPromptImport({
            source: { kind: "local", filename: file.name, text: await file.text() },
          }));
        }
        addPreviewCandidates(previews.flatMap((preview) => preview.candidates));
      } catch (err) {
        setError(err instanceof Error ? err.message : t("promptLibrary.importFailed"));
      } finally {
        setBusy(false);
      }
    },
    [addPreviewCandidates, t],
  );

  const previewGithub = useCallback(async () => {
    if (!githubInput.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const preview = await previewPromptImport({
        source: { kind: "github", input: githubInput.trim() },
      });
      addPreviewCandidates(preview.candidates);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("promptLibrary.importFailed"));
    } finally {
      setBusy(false);
    }
  }, [addPreviewCandidates, githubInput, t]);

  const commitSelected = useCallback(async () => {
    const picked = candidates.filter((candidate) => selected.has(candidate.id));
    if (picked.length === 0) {
      setError(t("promptLibrary.importSelectAtLeastOne"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await commitPromptImport({ candidates: picked });
      await onImported();
      showToast(t("promptLibrary.imported", { count: result.promptsImported }));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("promptLibrary.importFailed"));
    } finally {
      setBusy(false);
    }
  }, [candidates, onClose, onImported, selected, showToast, t]);

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      if (files.length > 0) void previewFiles(files);
      event.target.value = "";
    },
    [previewFiles],
  );

  const handleDrop = useCallback(
    (event: DragEvent | globalThis.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setDragActive(false);
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (files.length > 0) void previewFiles(files);
    },
    [previewFiles],
  );

  useEffect(() => {
    if (!open) return;
    const onDragOver = (event: globalThis.DragEvent) => {
      event.preventDefault();
      setDragActive(true);
    };
    const onDragLeave = (event: globalThis.DragEvent) => {
      if (event.relatedTarget === null) setDragActive(false);
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", handleDrop as EventListener);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", handleDrop as EventListener);
    };
  }, [handleDrop, open]);

  if (!open) return null;

  return (
    <div className="prompt-import-dialog" role="presentation">
      <div className="prompt-import-dialog__backdrop" onClick={onClose} />
      <div
        ref={dialogRef}
        className="prompt-import-dialog__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-import-title"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
      >
        <div className="prompt-import-dialog__header">
          <h3 id="prompt-import-title">{t("promptLibrary.importTitle")}</h3>
          <button type="button" onClick={onClose} aria-label={t("common.close")}>×</button>
        </div>

        <div
          className={`prompt-import-dialog__dropzone${dragActive ? " active" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          <strong>{t("promptLibrary.importDropTitle")}</strong>
          <span>{t("promptLibrary.importDropHint")}</span>
          <button type="button" onClick={() => fileInputRef.current?.click()}>
            {t("promptLibrary.importChooseFiles")}
          </button>
          <input
            ref={fileInputRef}
            className="prompt-library-panel__file-input"
            type="file"
            accept=".txt,.md,.markdown,text/plain,text/markdown"
            multiple
            onChange={handleFileChange}
          />
        </div>

        <div className="prompt-import-dialog__github">
          <label htmlFor="prompt-import-github">{t("promptLibrary.importGithubLabel")}</label>
          <div>
            <input
              id="prompt-import-github"
              type="text"
              value={githubInput}
              onChange={(event) => setGithubInput(event.target.value)}
              placeholder="owner/repo:path/to/prompts.md"
            />
            <button type="button" onClick={() => void previewGithub()} disabled={busy || !githubInput.trim()}>
              {t("promptLibrary.importPreview")}
            </button>
          </div>
        </div>

        {error ? <div className="prompt-import-dialog__error" role="alert">{error}</div> : null}

        <div className="prompt-import-dialog__preview" aria-live="polite">
          {candidates.length === 0 ? (
            <div className="prompt-import-dialog__empty">{t("promptLibrary.importPreviewEmpty")}</div>
          ) : (
            candidates.map((candidate) => (
              <label key={candidate.id} className="prompt-import-dialog__candidate">
                <input
                  type="checkbox"
                  checked={selected.has(candidate.id)}
                  onChange={(event) => {
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (event.target.checked) next.add(candidate.id);
                      else next.delete(candidate.id);
                      return next;
                    });
                  }}
                />
                <span>
                  <strong>{candidate.name}</strong>
                  <small>{candidate.text.slice(0, 180)}</small>
                  {candidate.tags.length > 0 ? <em>{candidate.tags.join(" · ")}</em> : null}
                </span>
              </label>
            ))
          )}
        </div>

        <div className="prompt-import-dialog__footer">
          <button type="button" onClick={onClose}>{t("common.cancel")}</button>
          <button type="button" onClick={() => void commitSelected()} disabled={busy || selected.size === 0}>
            {busy ? t("common.loading") : t("promptLibrary.importCommit")}
          </button>
        </div>
      </div>
    </div>
  );
}
