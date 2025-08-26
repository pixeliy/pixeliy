import type { OutfitParts } from "./sprite";

const SIZE = 32;
const SET_ATLAS_SRC = "/assets/set/set.png";

const ATLAS = { tileW: SIZE, tileH: SIZE, cols: 8, rows: 8 };

let atlasImg: HTMLImageElement | null = null;
const sliceCache = new Map<string, HTMLCanvasElement>();

function cacheKey(cx: number, cy: number) { return `${cx},${cy}`; }

function drawSliceToCanvas(img: HTMLImageElement, cx: number, cy: number): HTMLCanvasElement {
  const key = cacheKey(cx, cy);
  const cached = sliceCache.get(key);
  if (cached) return cached;

  const sx = cx * ATLAS.tileW;
  const sy = cy * ATLAS.tileH;

  const cv = document.createElement("canvas");
  cv.width = SIZE;
  cv.height = SIZE;
  const ctx = cv.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, sx, sy, ATLAS.tileW, ATLAS.tileH, 0, 0, SIZE, SIZE);

  sliceCache.set(key, cv);
  return cv;
}

async function loadAtlas(): Promise<HTMLImageElement> {
  if (atlasImg) return atlasImg;
  atlasImg = await new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${SET_ATLAS_SRC}`));
    img.src = SET_ATLAS_SRC;
  });
  return atlasImg!;
}

// ===== Registry =====
type Coord = { cx: number; cy: number };
type HairEntry = Coord & { offsetY?: number };
type FaceEntry = Coord;
type ShirtEntry = { body: Coord; sleeves?: { back: Coord; front: Coord } };
type PantsEntry = Coord;
type ShoesEntry = { left: Coord; right: Coord };
type HandItemExtra = { cx: number; cy: number; ox?: number; oy?: number };
type HandItemEntry = { base: Coord; extras: HandItemExtra[] };

const REG = {
  hair: {} as Record<string, HairEntry>,
  face: {} as Record<string, FaceEntry>,
  shirt: {} as Record<string, ShirtEntry>,
  pants: {} as Record<string, PantsEntry>,
  shoes: {} as Record<string, ShoesEntry>,
  handItem: {} as Record<string, HandItemEntry>,
};

// Public registration API
export function registerHair(id: string, cx: number, cy: number, opts?: { offsetY?: number }) {
  REG.hair[id] = { cx, cy, offsetY: opts?.offsetY };
}
export function registerFace(id: string, cx: number, cy: number) {
  REG.face[id] = { cx, cy };
}
export function registerShirt(id: string, body: Coord, sleeves?: { back: Coord; front: Coord }) {
  REG.shirt[id] = { body, sleeves };
}
export function registerPants(id: string, cx: number, cy: number) {
  REG.pants[id] = { cx, cy };
}
export function registerShoes(id: string, left: Coord, right: Coord) {
  REG.shoes[id] = { left, right };
}
/**
 * Register a hand item. `extras` are optional extra tiles that will be drawn
 * with the same rotation/pivot as the base. Default offset for each extra is (+32, 0).
 */
export function registerHandItem(id: string, cx: number, cy: number, extras?: HandItemExtra[]) {
  REG.handItem[id] = {
    base: { cx, cy },
    extras: (extras ?? []).map(e => ({
      cx: e.cx, cy: e.cy, ox: e.ox ?? SIZE, oy: e.oy ?? 0,
    })),
  };
}

// Selection and library types
export type OutfitSelection = {
  hair?: string;
  face?: string;
  shirt?: { id: string; sleeves?: boolean };
  pants?: string;
  shoes?: string;
  handItem?: string;
};

export type OutfitLibrary = {
  buildParts(sel: OutfitSelection | undefined | null): OutfitParts | undefined;
};

// Build library
export async function loadOutfitLibrary(): Promise<OutfitLibrary> {
  const img = await loadAtlas();
  const slice = (cx: number, cy: number) => drawSliceToCanvas(img, cx, cy);

  const buildParts = (sel?: OutfitSelection | null): OutfitParts | undefined => {
    if (!sel) return undefined;

    const out: OutfitParts = {};

    if (sel.hair && REG.hair[sel.hair]) {
      const H = REG.hair[sel.hair];
      out.hair = slice(H.cx, H.cy);
      out.hair_oy = H.offsetY ?? -16;
    }

    if (sel.face && REG.face[sel.face]) {
      const F = REG.face[sel.face];
      out.face = slice(F.cx, F.cy);
    }

    if (sel.shirt && REG.shirt[sel.shirt.id]) {
      const S = REG.shirt[sel.shirt.id];
      out.shirt = slice(S.body.cx, S.body.cy);
      if (sel.shirt.sleeves && S.sleeves) {
        out.sleeve_back = slice(S.sleeves.back.cx, S.sleeves.back.cy);
        out.sleeve_front = slice(S.sleeves.front.cx, S.sleeves.front.cy);
      }
    }

    if (sel.pants && REG.pants[sel.pants]) {
      const P = REG.pants[sel.pants];
      out.pants = slice(P.cx, P.cy);
    }

    if (sel.shoes && REG.shoes[sel.shoes]) {
      const Sh = REG.shoes[sel.shoes];
      out.shoe_l = slice(Sh.left.cx, Sh.left.cy);
      out.shoe_r = slice(Sh.right.cx, Sh.right.cy);
    }

    if (sel.handItem && REG.handItem[sel.handItem]) {
      const H = REG.handItem[sel.handItem];
      out.hand_item = slice(H.base.cx, H.base.cy);
      if (H.extras.length) {
        out.hand_item_extras = H.extras.map(e => ({
          img: slice(e.cx, e.cy),
          ox: e.ox ?? SIZE,
          oy: e.oy ?? 0,
        }));
      }
    }

    return out;
  };

  return { buildParts };
}

// Catalog for UI options
export type OutfitCatalog = {
  hair: string[];
  face: string[];
  shirts: Array<{ id: string; hasSleeves: boolean }>;
  pants: string[];
  shoes: string[];
  handItem: string[];
};

export function getOutfitCatalog(): OutfitCatalog {
  const hair = Object.keys(REG.hair);
  const face = Object.keys(REG.face);
  const shirts = Object.keys(REG.shirt).map(id => ({
    id, hasSleeves: !!REG.shirt[id].sleeves,
  }));
  const pants = Object.keys(REG.pants);
  const shoes = Object.keys(REG.shoes);
  const handItem = Object.keys(REG.handItem);
  return { hair, face, shirts, pants, shoes, handItem };
}

// Registrations
registerHair("none", 7, 7);
registerHair("kenny's_hair", 0, 0, { offsetY: -16 });
registerHair("upper_hair", 1, 0);
registerHair("anime_hair", 2, 0);
registerHair("fanny_hair", 3, 0);

registerFace("none", 7, 7);
registerFace("glasses", 0, 1);
registerFace("golden_glasses", 1, 1);

registerShirt("none", { cx: 7, cy: 7 });
registerShirt("hoodie", { cx: 0, cy: 2 }, { back: { cx: 1, cy: 5 }, front: { cx: 0, cy: 5 } });
registerShirt("golden_shirt", { cx: 1, cy: 2 });

registerPants("none", 7, 7);
registerPants("black_short", 0, 3);
registerPants("black_pants", 1, 3);
registerPants("dress", 2, 3);

registerShoes("none", { cx: 7, cy: 7 }, { cx: 7, cy: 7 });
registerShoes("blue_sneakers", { cx: 0, cy: 4 }, { cx: 1, cy: 4 });
registerShoes("yellow_sneakers", { cx: 2, cy: 4 }, { cx: 3, cy: 4 });

registerHandItem("none", 7, 7);
registerHandItem("key", 0, 6);
registerHandItem("lolipop", 1, 6);
registerHandItem("sword", 0, 7, [{ cx: 1, cy: 7, ox: 32, oy: 0 }]);
