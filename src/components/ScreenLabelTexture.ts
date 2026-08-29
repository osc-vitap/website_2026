import * as THREE from 'three';

let cachedTexture: THREE.CanvasTexture | null = null;

const LABEL = 'SCREEN';
const FONT_SIZE = 220;
const TRACKING = 48;
const FAMILY = 'Objectivity';
const WEIGHT = 400;

const fontFor = (family: string) =>
  `${WEIGHT} ${FONT_SIZE}px '${family}', 'SF Pro Display', -apple-system, 'Helvetica Neue', Arial, sans-serif`;

/* The canvas is cut to the width of the word, so mapping it onto the
   screen fills the screen instead of leaving empty margins */
const paint = (
  canvas: HTMLCanvasElement,
  family: string,
) => {
  const letters = LABEL.split('');

  const probe = document
    .createElement('canvas')
    .getContext('2d');

  if (!probe) return;

  probe.font = fontFor(family);

  const widths = letters.map(
    (letter) => probe.measureText(letter).width,
  );

  const total =
    widths.reduce((sum, width) => sum + width, 0) +
    TRACKING * (letters.length - 1);

  canvas.width = Math.ceil(total) + 8;
  canvas.height = Math.ceil(FONT_SIZE * 1.16);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = fontFor(family);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#000000';

  let x = 4;

  letters.forEach((letter, index) => {
    ctx.fillText(letter, x, canvas.height / 2);
    x += widths[index] + TRACKING;
  });
};

export const getScreenLabelTexture = () => {
  if (cachedTexture) return cachedTexture;

  const canvas = document.createElement('canvas');

  paint(canvas, FAMILY);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;

  /* A canvas can only use a face the document has already fetched, so
     the word is painted again once Objectivity has arrived */
  if (document.fonts?.load) {
    document.fonts
      .load(fontFor(FAMILY))
      .then(() => {
        paint(canvas, FAMILY);
        texture.needsUpdate = true;
      })
      .catch(() => undefined);
  }

  cachedTexture = texture;
  return texture;
};
