import type { Line, PatchSample, Point } from '../types';

export const PATCH_SIZE = 280;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function createCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function samplePatch(image: HTMLImageElement, center: Point, size = PATCH_SIZE): PatchSample | null {
  const availableWidth = image.naturalWidth || image.width;
  const availableHeight = image.naturalHeight || image.height;
  if (availableWidth === 0 || availableHeight === 0) return null;

  const sampleSize = Math.min(size, availableWidth, availableHeight);
  const half = sampleSize / 2;
  const startX = clamp(Math.round(center.x - half), 0, Math.max(0, availableWidth - sampleSize));
  const startY = clamp(Math.round(center.y - half), 0, Math.max(0, availableHeight - sampleSize));

  const canvas = createCanvas(sampleSize, sampleSize);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(image, startX, startY, sampleSize, sampleSize, 0, 0, sampleSize, sampleSize);
  const data = ctx.getImageData(0, 0, sampleSize, sampleSize);

  return {
    data,
    origin: { x: startX, y: startY },
    relativeCenter: { x: center.x - startX, y: center.y - startY },
    size: sampleSize,
  };
}

export function rotatePatch(
  sample: PatchSample,
  angleDeg: number,
  image: HTMLImageElement,
): ImageData {
  const destCanvas = createCanvas(sample.size, sample.size);
  const ctx = destCanvas.getContext('2d');
  if (!ctx) return sample.data;

  const angleRad = (angleDeg * Math.PI) / 180;
  ctx.save();
  ctx.translate(sample.relativeCenter.x, sample.relativeCenter.y);
  ctx.rotate(angleRad);
  ctx.translate(-sample.relativeCenter.x, -sample.relativeCenter.y);
  ctx.drawImage(image, -sample.origin.x, -sample.origin.y);
  ctx.restore();
  return ctx.getImageData(0, 0, sample.size, sample.size);
}

export function reflectPatch(sample: PatchSample, line: Line, image: HTMLImageElement): ImageData {
  const destCanvas = createCanvas(sample.size, sample.size);
  const ctx = destCanvas.getContext('2d');
  if (!ctx) return sample.data;

  const relativeLine = {
    x1: line.x1 - sample.origin.x,
    y1: line.y1 - sample.origin.y,
    x2: line.x2 - sample.origin.x,
    y2: line.y2 - sample.origin.y,
  };

  const angle = Math.atan2(relativeLine.y2 - relativeLine.y1, relativeLine.x2 - relativeLine.x1);
  ctx.save();
  ctx.translate(relativeLine.x1, relativeLine.y1);
  ctx.rotate(angle);
  ctx.scale(1, -1);
  ctx.rotate(-angle);
  ctx.translate(-relativeLine.x1, -relativeLine.y1);
  ctx.drawImage(image, -sample.origin.x, -sample.origin.y);
  ctx.restore();
  return ctx.getImageData(0, 0, sample.size, sample.size);
}

export function glidePatch(
  sample: PatchSample,
  line: Line,
  distance: number,
  image: HTMLImageElement,
): ImageData {
  const destCanvas = createCanvas(sample.size, sample.size);
  const ctx = destCanvas.getContext('2d');
  if (!ctx) return sample.data;

  const relativeLine = {
    x1: line.x1 - sample.origin.x,
    y1: line.y1 - sample.origin.y,
    x2: line.x2 - sample.origin.x,
    y2: line.y2 - sample.origin.y,
  };

  const angle = Math.atan2(relativeLine.y2 - relativeLine.y1, relativeLine.x2 - relativeLine.x1);
  ctx.save();
  ctx.translate(relativeLine.x1, relativeLine.y1);
  ctx.rotate(angle);
  ctx.scale(1, -1);
  ctx.translate(distance, 0);
  ctx.rotate(-angle);
  ctx.translate(-relativeLine.x1, -relativeLine.y1);
  ctx.drawImage(image, -sample.origin.x, -sample.origin.y);
  ctx.restore();
  return ctx.getImageData(0, 0, sample.size, sample.size);
}
