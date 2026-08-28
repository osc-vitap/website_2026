import * as THREE from 'three';

let cachedTexture: THREE.CanvasTexture | null = null;

export const getArmchairTexture = () => {
  if (cachedTexture) return cachedTexture;
  
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 1.5; // Slightly thinner for elegance
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  ctx.scale(128 / 24, 128 / 24);
  
  const path = new Path2D("M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3M3 11v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v2H7v-2a2 2 0 0 0-4 0ZM5 18v2M19 18v2");
  ctx.stroke(path);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 16;
  cachedTexture = texture;
  return texture;
};
