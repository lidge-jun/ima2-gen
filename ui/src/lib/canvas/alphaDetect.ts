export function imageUsesAlpha(image: HTMLImageElement): boolean {
  if (!image.complete || !image.naturalWidth || !image.naturalHeight) return false;
  const sampleSize = 64;
  const w = Math.min(sampleSize, image.naturalWidth);
  const h = Math.min(sampleSize, image.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;
  try {
    ctx.drawImage(image, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 250) return true;
    }
    return false;
  } catch {
    return false;
  }
}
