import { getOutfitCatalog } from "@/components/player/outfitAtlas";
import { DEFAULT_OUTFIT_IDS } from "@/lib/resolveOutfit";

export const OUTFIT_SLOT_ORDER = ["hair", "face", "shirt", "pants", "shoes", "handItem"] as const;
export type OutfitSlot = typeof OUTFIT_SLOT_ORDER[number];

export type OutfitSlotsArray =
  | [string, string, string, string, string]
  | [string, string, string, string, string, string];

export const DEFAULT_OUTFIT: OutfitSlotsArray = [
  DEFAULT_OUTFIT_IDS.hair,
  DEFAULT_OUTFIT_IDS.face,
  DEFAULT_OUTFIT_IDS.shirt,
  DEFAULT_OUTFIT_IDS.pants,
  DEFAULT_OUTFIT_IDS.shoes,
  DEFAULT_OUTFIT_IDS.handItem,
];

export type OutfitOption = { id: string; label: string };
export type OutfitOptionsMap = Record<OutfitSlot, OutfitOption[]>;

const toLabel = (id: string) =>
  id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function buildOptionsFromAtlas(): OutfitOptionsMap {
  const cat = getOutfitCatalog();
  return {
    hair: cat.hair.map(id => ({ id, label: toLabel(id) })),
    face: cat.face.map(id => ({ id, label: toLabel(id) })),
    shirt: cat.shirts.map(s => ({ id: s.id, label: toLabel(s.id) })),
    pants: cat.pants.map(id => ({ id, label: toLabel(id) })),
    shoes: cat.shoes.map(id => ({ id, label: toLabel(id) })),
    handItem: cat.handItem.map(id => ({ id, label: toLabel(id) })),
  };
}

export const OUTFIT_OPTIONS: OutfitOptionsMap = {
  hair: [], face: [], shirt: [], pants: [], shoes: [], handItem: [],
};

(function init() {
  const built = buildOptionsFromAtlas();
  for (const k of OUTFIT_SLOT_ORDER) {
    OUTFIT_OPTIONS[k] = built[k];
  }
})();

export function refreshOutfitOptions() {
  const built = buildOptionsFromAtlas();
  for (const k of OUTFIT_SLOT_ORDER) {
    OUTFIT_OPTIONS[k] = built[k];
  }
}

export function normalizeSlots(slots: string[] | null | undefined): OutfitSlotsArray {
  const FALLBACK = DEFAULT_OUTFIT.slice(0, 6) as OutfitSlotsArray;

  if (!Array.isArray(slots) || slots.length === 0) return FALLBACK;

  const arr = slots.slice(0, 6).map(s => String(s ?? ""));
  const looksBinary = arr.every(s => s === "0" || s === "1");

  if (looksBinary) {
    const [h = "0", f = "0", sh = "0", p = "0", s = "0", hi = "0"] = arr as string[];
    return [
      h === "1" ? DEFAULT_OUTFIT_IDS.hair : "",
      f === "1" ? DEFAULT_OUTFIT_IDS.face : "",
      sh === "1" ? DEFAULT_OUTFIT_IDS.shirt : "",
      p === "1" ? DEFAULT_OUTFIT_IDS.pants : "",
      s === "1" ? DEFAULT_OUTFIT_IDS.shoes : "",
      hi === "1" ? DEFAULT_OUTFIT_IDS.handItem : "",
    ] as OutfitSlotsArray;
  }

  const pad = (i: number) => (arr[i] ?? "");
  return [pad(0), pad(1), pad(2), pad(3), pad(4), pad(5)] as OutfitSlotsArray;
}
