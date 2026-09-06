import { fetchApi } from "./api-core";
export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Fetch a same-origin URL and return it as a data URL (element refs into
 * generation requests). Lives here so store files stay free of raw
 * FileReader plumbing (node-child-refs-payload contract). */
export async function fetchAsDataUrl(url: string): Promise<string> {
  const response = await fetchApi(url);
  if (!response.ok) throw new Error(`reference fetch failed: ${response.status}`);
  const blob = await response.blob();
  return readFileAsDataURL(new File([blob], "reference.png", { type: blob.type || "image/png" }));
}

export function dataUrlToBase64(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

export function compressImage(dataUrl: string, maxW = 256): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = img.width * scale;
      c.height = img.height * scale;
      const ctx = c.getContext("2d");
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", 0.6));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
