interface AlphaCacheEntry {
  src: string;
  width: number;
  height: number;
  result: boolean;
}

const alphaCache = new WeakMap<HTMLImageElement, AlphaCacheEntry>();

export function imageUsesAlpha(image: HTMLImageElement): boolean {
  if (!image.complete || !image.naturalWidth || !image.naturalHeight) return false;
  const cached = alphaCache.get(image);
  if (
    cached &&
    cached.src === image.currentSrc &&
    cached.width === image.naturalWidth &&
    cached.height === image.naturalHeight
  ) {
    return cached.result;
  }

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
      if (data[i] < 250) {
        alphaCache.set(image, {
          src: image.currentSrc,
          width: image.naturalWidth,
          height: image.naturalHeight,
          result: true,
        });
        return true;
      }
    }
    alphaCache.set(image, {
      src: image.currentSrc,
      width: image.naturalWidth,
      height: image.naturalHeight,
      result: false,
    });
    return false;
  } catch {
    return false;
  }
}
