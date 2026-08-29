import * as THREE from 'three';

let cachedTexture: THREE.CanvasTexture | null = null;

const WIDTH = 2048;
const HEIGHT = 256;
const LABEL = 'SCREEN';
const TRACKING = 40;

/* Drawn wide, because the label is stretched across the screen where
   the steep view squashes it back down */
export const getScreenLabelTexture = () => {
  if (cachedTexture) return cachedTexture;

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.font =
    "700 150px 'Objectivity', 'SF Pro Display', -apple-system, 'Helvetica Neue', Arial, sans-serif";
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#000000';

  const letters = LABEL.split('');

  const total =
    letters.reduce(
      (sum, letter) => sum + ctx.measureText(letter).width,
      0,
    ) +
    TRACKING * (letters.length - 1);

  let x = (WIDTH - total) / 2;

  letters.forEach((letter) => {
    ctx.fillText(letter, x, HEIGHT / 2);
    x += ctx.measureText(letter).width + TRACKING;
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;

  cachedTexture = texture;
  return texture;
};
