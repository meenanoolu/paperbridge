import type { RasterImage } from "../types";

/** Larger frames are downscaled before decoding. Decode time grows with pixel count. */
export const MAX_DECODE_SIDE = 1600;

function fitSize(w: number, h: number, maxSide: number): [number, number] {
  const s = Math.min(1, maxSide / Math.max(w, h));
  return [Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s))];
}

function drawToRaster(
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  maxSide: number,
  canvas?: HTMLCanvasElement,
): RasterImage {
  const [w, h] = fitSize(srcW, srcH, maxSide);
  const c = canvas ?? document.createElement("canvas");
  if (c.width !== w) c.width = w;
  if (c.height !== h) c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D context is not available");
  ctx.drawImage(source, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  return { width: w, height: h, data };
}

/** Load an image URL (e.g. a bundled sample PNG) and return its pixels. */
export async function rasterFromUrl(url: string, maxSide = MAX_DECODE_SIDE): Promise<RasterImage> {
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  await img.decode();
  return drawToRaster(img, img.naturalWidth, img.naturalHeight, maxSide);
}

/** Decode a user-uploaded photo. Honours EXIF orientation where the browser supports it. */
export async function rasterFromFile(file: Blob, maxSide = MAX_DECODE_SIDE): Promise<RasterImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    return drawToRaster(bitmap, bitmap.width, bitmap.height, maxSide);
  } finally {
    bitmap.close();
  }
}

/** Grab the current video frame. Pass a reusable canvas to avoid allocations per frame. */
export function rasterFromVideo(video: HTMLVideoElement, canvas: HTMLCanvasElement, maxSide = 1280): RasterImage {
  return drawToRaster(video, video.videoWidth, video.videoHeight, maxSide, canvas);
}

/** Encode a raster as a PNG data URL, used to show the captured webcam frame after a scan. */
export function rasterToDataUrl(img: RasterImage): string {
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  ctx.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  return c.toDataURL("image/jpeg", 0.85);
}
