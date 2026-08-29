import * as THREE from 'three';

let cachedTexture: THREE.CanvasTexture | null = null;

const SIZE = 256;

/* The map is multiplied by the seat colour, so this canvas only carries
   the shape and its shading, never a colour */
const roundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  const r = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
};

const shade = (
  ctx: CanvasRenderingContext2D,
  top: number,
  bottom: number,
  from: number,
  to: number,
) => {
  const gradient = ctx.createLinearGradient(0, top, 0, bottom);
  const step = (value: number) => {
    const level = Math.round(value * 255);
    return `rgb(${level}, ${level}, ${level})`;
  };

  gradient.addColorStop(0, step(from));
  gradient.addColorStop(1, step(to));

  return gradient;
};

export const getArmchairTexture = () => {
  if (cachedTexture) return cachedTexture;

  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  /* The seat faces the stage, so the back rest is at the top of the
     canvas and the arm rests sit beside the lower cushion */
  ctx.fillStyle = shade(ctx, 116, 210, 0.52, 0.36);
  roundedRect(ctx, 12, 116, 36, 96, 16);
  ctx.fill();
  roundedRect(ctx, 208, 116, 36, 96, 16);
  ctx.fill();

  ctx.fillStyle = shade(ctx, 22, 116, 0.72, 1);
  roundedRect(ctx, 28, 22, 200, 94, 30);
  ctx.fill();

  /* A brighter lip along the top of the back rest, so the seat reads as
     a solid object and not a flat tile */
  ctx.fillStyle = shade(ctx, 22, 40, 1, 0.82);
  roundedRect(ctx, 40, 22, 176, 20, 10);
  ctx.fill();

  ctx.fillStyle = shade(ctx, 126, 216, 0.96, 0.66);
  roundedRect(ctx, 44, 126, 168, 90, 26);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;

  cachedTexture = texture;
  return texture;
};
