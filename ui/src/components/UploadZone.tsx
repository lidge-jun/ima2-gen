import { useRef, useState } from "react";
import { useAppStore } from "../store/useAppStore";

export function UploadZone() {
  const mode = useAppStore((s) => s.mode);
  const sourceImageDataUrl = useAppStore((s) => s.sourceImageDataUrl);
  const currentImage = useAppStore((s) => s.currentImage);
  const setSourceFromFile = useAppStore((s) => s.setSourceFromFile);
  const clearSource = useAppStore((s) => s.clearSource);
  const useResultAsSource = useAppStore((s) => s.useResultAsSource);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragover, setDragover] = useState(false);

  if (mode !== "i2i") return null;

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragover(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      void setSourceFromFile(file);
    }
  };

  const dropCls = [
    "drop-area",
    dragover ? "dragover" : "",
    sourceImageDataUrl ? "has-image" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="upload-zone visible">
      <div className="section-title">Source Image</div>
      <div
        className={dropCls}
        onClick={() => {
          if (!sourceImageDataUrl) fileRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragover(true);
        }}
        onDragLeave={() => setDragover(false)}
        onDrop={onDrop}
      >
        {sourceImageDataUrl ? (
          <>
            <img src={sourceImageDataUrl} alt="source" />
            <button
              type="button"
              className="remove-btn"
              onClick={(e) => {
                e.stopPropagation();
                clearSource();
              }}
            >
              ×
            </button>
          </>
        ) : (
          <>Drop image here or click to upload</>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void setSourceFromFile(f);
            e.target.value = "";
          }}
        />
      </div>
      <button
        type="button"
        className="use-result-btn"
        disabled={!currentImage}
        onClick={useResultAsSource}
      >
        Use current result as source
      </button>
    </div>
  );
}
