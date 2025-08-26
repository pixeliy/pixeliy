import type { OutfitLibrary, OutfitSelection } from "@/components/player/outfitAtlas";
import type { OutfitParts } from "@/components/player/sprite";

export type OutfitSlotsArray =
  | [string, string, string, string, string]
  | [string, string, string, string, string, string];

export const DEFAULT_OUTFIT_IDS = {
  hair: "none",
  face: "none",
  shirt: "none",
  pants: "none",
  shoes: "none",
  handItem: "none",
  sleeves: true,
};

export type OutfitIds = Partial<{
  hair: string;
  face: string;
  shirt: string;
  pants: string;
  shoes: string;
  handItem: string;
  sleeves: boolean;
}>;

export function buildActiveOutfit(
  lib: OutfitLibrary | null,
  slots: OutfitSlotsArray,
  ids?: OutfitIds
): OutfitParts | undefined {
  if (!lib) return undefined;
  const pick = { ...DEFAULT_OUTFIT_IDS, ...(ids || {}) };

  const arr = slots.slice(0, 6).map(s => String(s ?? ""));
  const looksBinary = arr.every(s => s === "0" || s === "1");

  let sel: OutfitSelection;

  if (looksBinary) {
    const has = (i: number) => arr[i] === "1";
    sel = {
      hair: has(0) ? pick.hair : undefined,
      face: has(1) ? pick.face : undefined,
      shirt: has(2) ? { id: pick.shirt, sleeves: !!pick.sleeves } : undefined,
      pants: has(3) ? pick.pants : undefined,
      shoes: has(4) ? pick.shoes : undefined,
      handItem: (arr.length >= 6 && arr[5] === "1") ? pick.handItem : undefined,
    };
  } else {
    const [hair, face, shirt, pants, shoes, handItem] = arr;
    sel = {
      hair: hair || undefined,
      face: face || undefined,
      shirt: shirt ? { id: shirt, sleeves: !!pick.sleeves } : undefined,
      pants: pants || undefined,
      shoes: shoes || undefined,
      handItem: handItem || undefined,
    };
  }

  return lib.buildParts(sel);
}
