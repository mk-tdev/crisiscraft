import { CanvasTexture, SRGBColorSpace } from "three";

const cache = new Map<string, CanvasTexture>();

/** Small painted sign texture (white text on a coloured board), cached per label. */
export function signTexture(text: string, background: string, color = "#ffffff", width = 512, height = 128) {
  const key = `${text}|${background}|${color}|${width}x${height}`;
  const existing = cache.get(key);
  if (existing) return existing;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = color;
  ctx.font = `700 ${Math.round(height * 0.46)}px Inter, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, width / 2, height / 2 + 2);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  cache.set(key, texture);
  return texture;
}

/** Diagonal hazard stripes for barriers and closure boards. */
export function stripeTexture() {
  const key = "stripes";
  const existing = cache.get(key);
  if (existing) return existing;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#f4f1ea";
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = "#e5484d";
  for (let x = -64; x < 320; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 64);
    ctx.lineTo(x + 32, 64);
    ctx.lineTo(x + 64, 0);
    ctx.lineTo(x + 32, 0);
    ctx.fill();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  cache.set(key, texture);
  return texture;
}

/** Chevron strip that scrolls along a proposed route. */
export function chevronTexture() {
  const key = "chevrons";
  const existing = cache.get(key);
  if (existing) return existing;
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 64, 64);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(14, 46);
  ctx.lineTo(32, 20);
  ctx.lineTo(50, 46);
  ctx.stroke();
  const texture = new CanvasTexture(canvas);
  cache.set(key, texture);
  return texture;
}
