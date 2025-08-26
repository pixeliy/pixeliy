export type SpriteParts = {
  arm_back: CanvasImageSource;
  foot_l: CanvasImageSource;
  foot_r: CanvasImageSource;
  torso: CanvasImageSource;
  head: CanvasImageSource;
  eyes: CanvasImageSource;
  arm_front: CanvasImageSource;
  mouth_smile: CanvasImageSource;
  mouth_talk_1: CanvasImageSource;
  mouth_talk_2: CanvasImageSource;
};

export type OutfitParts = {
  shirt?: CanvasImageSource;
  sleeve_back?: CanvasImageSource;
  sleeve_front?: CanvasImageSource;
  hair?: CanvasImageSource;
  hair_oy?: number;
  face?: CanvasImageSource;
  pants?: CanvasImageSource;
  shoe_l?: CanvasImageSource;
  shoe_r?: CanvasImageSource;
  hand_item?: CanvasImageSource;
  hand_item_extras?: Array<{ img: CanvasImageSource; ox: number; oy: number }>;
};

export type DrawOverrides = { armFrontRot?: number; armBackRot?: number };

const SIZE = 32;
const BASE = "/assets/base/";

const DEFAULT_HAIR_OFFSET_Y = -16;

// Shadow
const SHADOW_ALPHA = 0.25;
const SHADOW_OX = -4;
const SHADOW_OY = 0;
const TOP_PAD = 16;
const OFF_W = SIZE * 2;
const OFF_H = SIZE + TOP_PAD;

const FILES: Array<keyof SpriteParts> = [
  "arm_back",
  "foot_l",
  "foot_r",
  "torso",
  "head",
  "eyes",
  "arm_front",
  "mouth_smile",
  "mouth_talk_1",
  "mouth_talk_2",
];

const SRC: Record<keyof SpriteParts, string> = {
  arm_back: BASE + "arm_back.png",
  foot_l: BASE + "foot_l.png",
  foot_r: BASE + "foot_r.png",
  torso: BASE + "torso.png",
  head: BASE + "head.png",
  eyes: BASE + "eyes.png",
  arm_front: BASE + "arm_front.png",
  mouth_smile: BASE + "smile.png",
  mouth_talk_1: BASE + "talk_1.png",
  mouth_talk_2: BASE + "talk_2.png",
};

let cachedParts: SpriteParts | null = null;
let loading: Promise<SpriteParts> | null = null;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

export async function loadSpriteParts(): Promise<SpriteParts> {
  if (cachedParts) return cachedParts;
  if (loading) return loading;

  loading = (async () => {
    const entries = await Promise.all(
      FILES.map(async (k) => [k, await loadImage(SRC[k])] as const)
    );
    const parts = Object.fromEntries(entries) as SpriteParts;
    cachedParts = parts;
    return parts;
  })();

  try { return await loading; }
  finally { loading = null; }
}

// ===== Animation & draw =====
export type AnimSample = { phase: number; amp: number };
export type FaceState = { speaking: boolean; talkBlink: boolean };

/**
 * Draw a 32×32 player at (sx, sy) with scale z.
 */
export function drawPlayerSprite(
  ctx: CanvasRenderingContext2D,
  parts: SpriteParts,
  sx: number,
  sy: number,
  z: number,
  anim: AnimSample,
  flipX = false,
  outfit?: OutfitParts,
  face?: FaceState,
  overrides?: DrawOverrides
) {
  const FOOT_BOB = 2;
  const MAX_ARM = (45 * Math.PI) / 180;

  const base = Math.sin(anim.phase) * MAX_ARM * anim.amp;

  const angFront = overrides?.armFrontRot ?? base;
  const angBack = overrides?.armBackRot ?? -base;

  const half = (v: number) => Math.max(0, Math.sin(v));
  const footLOffsetY = -FOOT_BOB * anim.amp * half(anim.phase);
  const footROffsetY = -FOOT_BOB * anim.amp * half(anim.phase + Math.PI);

  const PIV_FRONT = { x: 10, y: 19 };
  const PIV_BACK = { x: 22, y: 19 };

  const speaking = !!face?.speaking;
  const talkBlink = !!face?.talkBlink;

  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(z, z);
  ctx.imageSmoothingEnabled = false;

  if (flipX) { ctx.translate(SIZE, 0); ctx.scale(-1, 1); }

  const drawLayer = (
    img?: CanvasImageSource,
    ox = 0, oy = 0,
    rot = 0,
    pivot?: { x: number; y: number }
  ) => {
    if (!img) return;
    ctx.save();
    if (rot !== 0 && pivot) {
      ctx.translate(pivot.x, pivot.y);
      ctx.rotate(rot);
      ctx.translate(-pivot.x, -pivot.y);
    }
    ctx.drawImage(img, Math.round(ox), Math.round(oy), SIZE, SIZE);
    ctx.restore();
  };

  // Back → front
  drawLayer(parts.arm_back, 0, 0, angBack, PIV_BACK);
  drawLayer(outfit?.sleeve_back, 0, 0, angBack, PIV_BACK);
  drawLayer(parts.torso);

  drawLayer(parts.foot_l, 0, footLOffsetY);
  drawLayer(outfit?.shoe_l, 0, footLOffsetY);
  drawLayer(parts.foot_r, 0, footROffsetY);
  drawLayer(outfit?.shoe_r, 0, footROffsetY);

  drawLayer(outfit?.pants);
  drawLayer(outfit?.shirt);

  drawLayer(parts.head);
  drawLayer(parts.eyes);
  if (!speaking) {
    drawLayer(parts.mouth_smile);
  } else {
    drawLayer(parts.mouth_talk_1);
    if (talkBlink) drawLayer(parts.mouth_talk_2);
  }
  drawLayer(outfit?.face);
  drawLayer(outfit?.hair, 0, outfit?.hair_oy ?? DEFAULT_HAIR_OFFSET_Y);

  drawLayer(outfit?.hand_item, 0, 0, angFront, PIV_FRONT);
  outfit?.hand_item_extras?.forEach(p => drawLayer(p.img, p.ox, p.oy, angFront, PIV_FRONT));
  drawLayer(parts.arm_front, 0, 0, angFront, PIV_FRONT);
  drawLayer(outfit?.sleeve_front, 0, 0, angFront, PIV_FRONT);

  ctx.restore();
}

/**
 * Draw a silhouette shadow of the sprite (25% black).
 * Flip is applied in the offscreen render to avoid double flips.
 */
export function drawPlayerShadow(
  ctx: CanvasRenderingContext2D,
  parts: SpriteParts,
  sx: number,
  sy: number,
  z: number,
  anim: AnimSample,
  flipX = false,
  outfit?: OutfitParts,
  face?: FaceState,
  overrides?: DrawOverrides
) {
  if (typeof document === "undefined") return;

  const off = document.createElement("canvas");
  off.width = OFF_W;
  off.height = OFF_H;
  const sctx = off.getContext("2d");
  if (!sctx) return;
  sctx.imageSmoothingEnabled = false;

  drawPlayerSprite(sctx, parts, 0, TOP_PAD, 1, anim, flipX, outfit, face, overrides);

  sctx.globalCompositeOperation = "source-in";
  sctx.globalAlpha = SHADOW_ALPHA;
  sctx.fillStyle = "#000";
  sctx.fillRect(0, 0, OFF_W, OFF_H);
  sctx.globalAlpha = 1;
  sctx.globalCompositeOperation = "source-over";

  ctx.save();
  ctx.translate(sx + SHADOW_OX * z, sy + SHADOW_OY * z);
  ctx.scale(z, z);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(off, 0, -TOP_PAD);
  ctx.restore();
}

// Re-export types so consumers can import from this file
export type { OutfitLibrary, OutfitSelection } from "./outfitAtlas";
export { loadOutfitLibrary } from "./outfitAtlas";

// Backward-compat alias
export const loadOutfitParts = () =>
  import("./outfitAtlas").then(m => m.loadOutfitLibrary());
