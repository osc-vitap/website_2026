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

  /* A quiet base under the whole chair, so the gaps between its parts
     read as soft shadow instead of hard black lines */
  ctx.fillStyle = shade(ctx, 26, 212, 0.3, 0.24);
  roundedRect(ctx, 16, 26, 224, 186, 34);
  ctx.fill();

  /* The seat faces the stage, so the back rest is at the top of the
     canvas and the arm rests sit beside the lower cushion */
  ctx.fillStyle = shade(ctx, 108, 206, 0.62, 0.54);
  roundedRect(ctx, 16, 108, 30, 98, 15);
  ctx.fill();
  roundedRect(ctx, 210, 108, 30, 98, 15);
  ctx.fill();

  ctx.fillStyle = shade(ctx, 30, 110, 0.88, 1);
  roundedRect(ctx, 32, 30, 192, 80, 32);
  ctx.fill();

  ctx.fillStyle = shade(ctx, 122, 204, 0.92, 0.78);
  roundedRect(ctx, 48, 122, 160, 82, 28);
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
