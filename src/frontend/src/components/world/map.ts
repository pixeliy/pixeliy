// components/world/map.ts
// ======================================================
// World map: floor / wall / object / top + MERGED SHADOW
// - 1 shadow canvas gabungan (top > object > wall)
// - Tidak ada stacking shadow di tile yang sama
// - Per-ID bisa matikan shadow: { shadow:false } saat fromAtlas()
// ======================================================

export const TILE = 32;
export const MAP_COLS = 25;
export const MAP_ROWS = 25;

// === Shadow constants
const SHADOW_ALPHA = 0.25;
const SHADOW_OX = -4;
const SHADOW_OY = 0;

export type WorldMap = {
    tile: number;
    cols: number;
    rows: number;
    width: number;
    height: number;
    floor: HTMLCanvasElement;
    wall: HTMLCanvasElement;
    object: HTMLCanvasElement;
    over: HTMLCanvasElement;
    shadow: HTMLCanvasElement; // ← gabungan
};

/** ====== REGISTRY: direct image tiles (legacy) ====== */
const TILE_IMAGES: Record<number, string> = {
    1: "/assets/floor/floor_1.png",
};

/** ====== REGISTRY: atlas definition(s) ======
 * Ubah cols/rows kalau ukuran sheet berubah.
 */
type AtlasDef = {
    src: string;
    tileW: number;
    tileH: number;
    cols: number;
    rows: number;
};
const ATLASES: Record<string, AtlasDef> = {
    wall: { src: "/assets/wall/wall.png", tileW: TILE, tileH: TILE, cols: 8, rows: 8 },
    object: { src: "/assets/object/object.png", tileW: TILE, tileH: TILE, cols: 8, rows: 8 },
};

/** ====== REGISTRY: atlas slices per ID ======
 * id → (atlasName, cx, cy, solid?, shadow?)
 */
type AtlasSlice = { atlas: string; cx: number; cy: number; solid: boolean; shadow: boolean };
const TILE_ATLAS_SLICES: Record<number, AtlasSlice> = {};

/** API: daftar tile dari atlas apa pun */
export function fromAtlas(
    atlasName: string,
    cx: number,
    cy: number,
    id: number,
    opts?: { solid?: boolean; shadow?: boolean }
): number {
    const def = ATLASES[atlasName];
    if (!def) throw new Error(`Atlas '${atlasName}' belum didefinisikan`);
    if (cx < 0 || cy < 0 || cx >= def.cols || cy >= def.rows) {
        console.warn(`fromAtlas(${atlasName}, ${cx}, ${cy}, id=${id}): posisi di luar grid ${def.cols}x${def.rows}`);
    }
    TILE_ATLAS_SLICES[id] = {
        atlas: atlasName,
        cx,
        cy,
        solid: opts?.solid !== false,
        shadow: opts?.shadow !== false, // default: ikut nimbulin bayangan
    };
    return id;
}

/** API ringkas */
export const fromWallAtlas = (cx: number, cy: number, id: number, opts?: { solid?: boolean; shadow?: boolean }) =>
    fromAtlas("wall", cx, cy, id, opts);

export const fromObjectAtlas = (cx: number, cy: number, id: number, opts?: { solid?: boolean; shadow?: boolean }) =>
    fromAtlas("object", cx, cy, id, opts);

// === FLOOR (penuhi lantai)
export const floorLayout: number[][] = Array.from({ length: MAP_ROWS }, () =>
    Array.from({ length: MAP_COLS }, () => 1)
);

// === shorthand id
const __ = 0;
const U_ = fromWallAtlas(0, 0, 5);
const lU = fromWallAtlas(1, 0, 6);
const rU = fromWallAtlas(2, 0, 7);
const Ul = fromWallAtlas(1, 1, 8, { solid: false });
const Ur = fromWallAtlas(2, 1, 9, { solid: false });
const Ut = fromWallAtlas(0, 1, 10);
const A_ = fromWallAtlas(0, 2, 11, { solid: false });
const rA = fromWallAtlas(1, 2, 12);
const lA = fromWallAtlas(2, 2, 13);
const Al = fromWallAtlas(1, 3, 14);
const Ar = fromWallAtlas(2, 3, 15);
const W_ = fromWallAtlas(0, 4, 16);
const rW = fromWallAtlas(2, 4, 17);
const lW = fromWallAtlas(1, 4, 18);
const Du = fromWallAtlas(0, 5, 19, { solid: false, shadow: true });
const Dd = fromWallAtlas(0, 6, 20);
const uD = fromWallAtlas(1, 5, 21, { solid: false, shadow: true });
const dD = fromWallAtlas(1, 6, 22, { solid: false, shadow: true });

export const DOOR_CLOSED_ID = Dd;
export const DOOR_OPEN_ID = dD;
export const TOP_DOOR_CLOSED_ID = Du;
export const TOP_DOOR_OPEN_ID = uD;

// === WALL ===
const wallLayoutManual: number[][] = [
    [Ul, A_, A_, A_, A_, A_, A_, A_, A_, A_, A_, A_, A_, A_, A_, A_, A_, Ut, A_, A_, A_, A_, A_, A_, Ur],
    [U_, W_, W_, W_, W_, W_, W_, W_, W_, W_, W_, W_, W_, W_, W_, W_, W_, U_, W_, W_, W_, W_, W_, W_, U_],
    [U_, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, U_, __, __, __, __, __, __, U_],
    [U_, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, U_, __, __, __, __, __, __, U_],
    [U_, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, U_, __, __, __, __, __, __, U_],
    [U_, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, U_, __, __, __, __, __, __, U_],
    [U_, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, U_, __, __, __, __, __, __, U_],
    [U_, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, U_, __, __, __, __, __, __, U_],
    [U_, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, U_, __, __, __, __, __, __, U_],
    [U_, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, U_, __, __, __, __, __, __, U_],
    [lU, A_, __, A_, A_, A_, A_, A_, A_, A_, A_, A_, A_, A_, A_, A_, A_, Ar, __, __, __, __, __, __, U_],
    [U_, W_, Dd, W_, W_, W_, W_, W_, W_, W_, W_, W_, W_, W_, W_, W_, W_, rW, __, __, __, __, __, __, U_],
    [U_, __, __, __, __, __, __, __, __, __, __, __, __, __, __,  __,__, __, __, __, __, __, __, __, U_],
    [U_, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __,  __,__, __, __, __, __, __, __, U_],
    [U_, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __,  __,__, __, __, __, __, __, U_],
    [lU, A_, A_, A_, A_, __, A_, Ur, __, __, __, __, __, __, __, __, __, Ul, A_, __, A_, A_, A_, A_, rU],
    [U_, W_, W_, W_, W_, dD, W_, U_, __, __, __, __, __, __, __, __, __, U_, W_, dD, W_, W_, W_, W_, U_],
    [U_, __, __, __, __, __, __, U_, __, __, __, __, __, __, __, __, __, U_, __, __, __, __, __, __, U_],
    [U_, __, __, __, __, __, __, U_, __, __, __, __, __, __, __, __, __, U_, __, __, __, __, __, __, U_],
    [U_, __, __, __, __, __, __, U_, __, __, __, __, __, __, __, __, __, U_, __, __, __, __, __, __, U_],
    [U_, __, __, __, __, __, __, U_, __, __, __, __, __, __, __, __, __, U_, __, __, __, __, __, __, U_],
    [lU, A_, A_, A_, A_, A_, A_, Ar, __, __, __, __, __, __, __, __, __, Al, A_, A_, A_, A_, A_, A_, rU],
    [U_, W_, W_, W_, W_, W_, W_, rW, __, __, __, __, __, __, __, __, __, lW, W_, W_, W_, W_, W_, W_, U_],
    [U_, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, U_],
    [U_, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, U_],
];

// === OBJECTS ===
const objectLayoutManual: number[][] = Array.from({ length: MAP_ROWS }, () =>
    Array.from({ length: MAP_COLS }, () => 0)
);

const POT = fromObjectAtlas(0, 0, 101, { solid: false });
const SEATu = fromObjectAtlas(0, 1, 102, { solid: false });
const SEATd = fromObjectAtlas(0, 2, 103, { solid: false });
const TABLElu = fromObjectAtlas(1, 0, 104, { solid: false });
const TABLEmu = fromObjectAtlas(2, 0, 105, { solid: false });
const TABLEru = fromObjectAtlas(3, 0, 106, { solid: false });
const TABLEl_ = fromObjectAtlas(1, 1, 107, { solid: false });
const TABLEm_ = fromObjectAtlas(2, 1, 108, { solid: false });
const TABLEr_ = fromObjectAtlas(3, 1, 109, { solid: false });
const TABLEld = fromObjectAtlas(1, 2, 110, { solid: false });
const TABLEmd = fromObjectAtlas(2, 2, 111, { solid: false });
const TABLErd = fromObjectAtlas(3, 2, 112, { solid: false });
const shelflu = fromObjectAtlas(4, 0, 113, { solid: false });
const shelfmu = fromObjectAtlas(5, 0, 114, { solid: false });
const shelfru = fromObjectAtlas(6, 0, 115, { solid: false });
const shelfld = fromObjectAtlas(4, 1, 116, { solid: false });
const shelfmd = fromObjectAtlas(5, 1, 117, { solid: false });
const shelfrd = fromObjectAtlas(6, 1, 118, { solid: false });

objectLayoutManual[2][1] = POT;
objectLayoutManual[2][16] = POT;

objectLayoutManual[1][2] = shelflu;
objectLayoutManual[1][3] = shelfmu;
objectLayoutManual[1][4] = shelfmu;
objectLayoutManual[1][5] = shelfmu;
objectLayoutManual[1][6] = shelfmu;
objectLayoutManual[1][7] = shelfmu;
objectLayoutManual[1][8] = shelfru;
objectLayoutManual[1][9] = shelflu;
objectLayoutManual[1][10] = shelfmu;
objectLayoutManual[1][11] = shelfmu;
objectLayoutManual[1][12] = shelfmu;
objectLayoutManual[1][13] = shelfmu;
objectLayoutManual[1][14] = shelfmu;
objectLayoutManual[1][15] = shelfru;

objectLayoutManual[2][2] = shelfld;
objectLayoutManual[2][3] = shelfmd;
objectLayoutManual[2][4] = shelfmd;
objectLayoutManual[2][5] = shelfmd;
objectLayoutManual[2][6] = shelfmd;
objectLayoutManual[2][7] = shelfmd;
objectLayoutManual[2][8] = shelfrd;
objectLayoutManual[2][9] = shelfld;
objectLayoutManual[2][10] = shelfmd;
objectLayoutManual[2][11] = shelfmd;
objectLayoutManual[2][12] = shelfmd;
objectLayoutManual[2][13] = shelfmd;
objectLayoutManual[2][14] = shelfmd;
objectLayoutManual[2][15] = shelfrd;

objectLayoutManual[5][5] = TABLElu;
objectLayoutManual[5][6] = TABLEmu;
objectLayoutManual[5][7] = TABLEmu;
objectLayoutManual[5][8] = TABLEmu;
objectLayoutManual[5][9] = TABLEmu;
objectLayoutManual[5][10] = TABLEmu;
objectLayoutManual[5][11] = TABLEru;

objectLayoutManual[6][5] = TABLEl_;
objectLayoutManual[6][6] = TABLEm_;
objectLayoutManual[6][7] = TABLEm_;
objectLayoutManual[6][8] = TABLEm_;
objectLayoutManual[6][9] = TABLEm_;
objectLayoutManual[6][10] = TABLEm_;
objectLayoutManual[6][11] = TABLEr_;

objectLayoutManual[7][5] = TABLEld;
objectLayoutManual[7][6] = TABLEmd;
objectLayoutManual[7][7] = TABLEmd;
objectLayoutManual[7][8] = TABLEmd;
objectLayoutManual[7][9] = TABLEmd;
objectLayoutManual[7][10] = TABLEmd;
objectLayoutManual[7][11] = TABLErd;

objectLayoutManual[4][5] = SEATu;
objectLayoutManual[4][6] = SEATu;
objectLayoutManual[4][7] = SEATu;
objectLayoutManual[4][8] = SEATu;
objectLayoutManual[4][9] = SEATu;
objectLayoutManual[4][10] = SEATu;
objectLayoutManual[4][11] = SEATu;
objectLayoutManual[8][5] = SEATd;
objectLayoutManual[8][6] = SEATd;
objectLayoutManual[8][7] = SEATd;
objectLayoutManual[8][8] = SEATd;
objectLayoutManual[8][9] = SEATd;
objectLayoutManual[8][10] = SEATd;
objectLayoutManual[8][11] = SEATd;

// === TOP/OVERLAY ===
const topLayoutManual: number[][] = [
    [__, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __],
    [__, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __],
    [__, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __],
    [__, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __],
    [__, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __],
    [__, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __],
    [__, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __],
    [__, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __],
    [__, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __],
    [__, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __],
    [lU, A_, Du, A_, A_, A_, A_, A_, A_, A_, A_, A_, A_, A_, A_, A_, A_, Ar, __, __, __, __, __, __, __],
    [__, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __],
    [__, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __],
    [__, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __],
    [__, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __],
    [lU, A_, A_, A_, A_, uD, A_, Ur, __, __, __, __, __, __, __, __, __, Ul, A_, uD, A_, A_, A_, A_, rU],
    [__, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __],
    [__, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __],
    [__, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __],
    [__, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __],
    [__, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __],
    [lU, A_, A_, A_, A_, A_, A_, Ar, __, __, __, __, __, __, __, __, __, Al, A_, A_, A_, A_, A_, A_, rU],
    [__, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __],
    [__, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __],
    [__, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __],
];

// === AUDIO ===
function makeAudioLayout(): number[][] {
    const g = Array.from({ length: MAP_ROWS }, () =>
        Array.from({ length: MAP_COLS }, () => 0)
    );

    // helper isi persegi panjang (inklusif) dengan nilai val
    const fillRect = (c0: number, c1: number, r0: number, r1: number, val: number) => {
        const cc0 = Math.max(0, Math.min(c0, c1));
        const cc1 = Math.min(MAP_COLS - 1, Math.max(c0, c1));
        const rr0 = Math.max(0, Math.min(r0, r1));
        const rr1 = Math.min(MAP_ROWS - 1, Math.max(r0, r1));
        for (let r = rr0; r <= rr1; r++) {
            for (let c = cc0; c <= cc1; c++) {
                g[r][c] = val;
            }
        }
    };

    fillRect(1, 16, 2, 10, 1);
    fillRect(1, 6, 17, 21, 2);
    fillRect(18, 23, 17, 21, 3);

    return g;
}
const audioLayoutManual = makeAudioLayout();

// Normalizer aman (pad/truncate)
function normalizeGrid(src: number[][], rows: number, cols: number, fill = 0): number[][] {
    const out: number[][] = [];
    for (let r = 0; r < rows; r++) {
        const row = src[r] ?? [];
        const newRow = new Array<number>(cols);
        for (let c = 0; c < cols; c++) newRow[c] = row[c] ?? fill;
        out.push(newRow);
    }
    return out;
}

export const wallLayout: number[][] = normalizeGrid(wallLayoutManual, MAP_ROWS, MAP_COLS, 0);
export const audioLayout: number[][] = normalizeGrid(audioLayoutManual, MAP_ROWS, MAP_COLS, 0);
export const objectLayout: number[][] = normalizeGrid(objectLayoutManual, MAP_ROWS, MAP_COLS, 0);
export const topLayout: number[][] = normalizeGrid(topLayoutManual, MAP_ROWS, MAP_COLS, 0);

// ====== COLLISION ======
const BASE_SOLID_IDS = new Set([2, 3, 4]); // legacy solids
const EPS = 1e-3;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function isSolidId(id: number): boolean {
    if (BASE_SOLID_IDS.has(id)) return true;
    const slice = TILE_ATLAS_SLICES[id];
    return !!(slice && slice.solid !== false);
}

/** Solid tile; out-of-bounds = solid */
export function isSolidTile(col: number, row: number): boolean {
    if (row < 0 || row >= MAP_ROWS || col < 0 || col >= MAP_COLS) return true;
    const id = wallLayout[row]?.[col] ?? 0;
    return isSolidId(id);
}

/** Audio rule pada tile (col,row). */
export type AudioRule =
    | { kind: "default" }
    | { kind: "room"; zoneId: number }
    | { kind: "radius"; radius: number };

export function audioRuleAt(col: number, row: number): AudioRule {
    if (row < 0 || row >= MAP_ROWS || col < 0 || col >= MAP_COLS) return { kind: "default" };
    const v = (audioLayout[row]?.[col] ?? 0) | 0;
    if (v > 0) return { kind: "room", zoneId: v };
    if (v < 0) return { kind: "radius", radius: Math.max(0, -v) };
    return { kind: "default" };
}

/** Konversi AABB px → tile bounds (dengan EPS agar sampling stabil) */
function aabbToTileBounds(x: number, y: number, w: number, h: number) {
    const left = Math.floor((x + EPS) / TILE);
    const right = Math.floor((x + w - EPS) / TILE);
    const top = Math.floor((y + EPS) / TILE);
    const bottom = Math.floor((y + h - EPS) / TILE);
    return {
        left: clamp(left, 0, MAP_COLS - 1),
        right: clamp(right, 0, MAP_COLS - 1),
        top: clamp(top, 0, MAP_ROWS - 1),
        bottom: clamp(bottom, 0, MAP_ROWS - 1),
    };
}

/** Resolve move per-sumbu dengan epsilon (menghindari "blink" di solid) */
export function resolveMove(
    x: number, y: number, w: number, h: number, dx: number, dy: number
): { x: number; y: number } {
    let nx = x, ny = y;

    // X
    if (dx !== 0) {
        const tx = nx + dx;
        const { top, bottom } = aabbToTileBounds(tx, ny, w, h);
        if (dx > 0) {
            const rightCol = Math.floor((tx + w - EPS) / TILE);
            for (let r = top; r <= bottom; r++) {
                if (isSolidTile(rightCol, r)) {
                    nx = rightCol * TILE - w - EPS;
                    dx = 0; break;
                }
            }
        } else {
            const leftCol = Math.floor((tx + EPS) / TILE);
            for (let r = top; r <= bottom; r++) {
                if (isSolidTile(leftCol, r)) {
                    nx = (leftCol + 1) * TILE + EPS;
                    dx = 0; break;
                }
            }
        }
        if (dx !== 0) nx = tx;
    }

    // Y
    if (dy !== 0) {
        const ty = ny + dy;
        const { left, right } = aabbToTileBounds(nx, ty, w, h);
        if (dy > 0) {
            const bottomRow = Math.floor((ty + h - EPS) / TILE);
            for (let c = left; c <= right; c++) {
                if (isSolidTile(c, bottomRow)) {
                    ny = bottomRow * TILE - h - EPS;
                    dy = 0; break;
                }
            }
        } else {
            const topRow = Math.floor((ty + EPS) / TILE);
            for (let c = left; c <= right; c++) {
                if (isSolidTile(c, topRow)) {
                    ny = (topRow + 1) * TILE + EPS;
                    dy = 0; break;
                }
            }
        }
        if (dy !== 0) ny = ty;
    }

    // Clamp dunia
    const maxX = MAP_COLS * TILE - w - EPS;
    const maxY = MAP_ROWS * TILE - h - EPS;
    nx = clamp(nx, EPS, maxX);
    ny = clamp(ny, EPS, maxY);

    return { x: nx, y: ny };
}

// ====== IMAGE LOADING & LAYER RENDER ======
function loadImageSafe(src: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

/** Kumpulkan aset yang diperlukan dari layout (image langsung & atlas). */
async function loadAssetsForLayouts(
    layouts: number[][][]
): Promise<{
    imagesById: Record<number, HTMLImageElement | null>;
    atlasImgs: Record<string, HTMLImageElement | null>;
}> {
    const ids = new Set<number>();
    for (const layer of layouts) {
        for (let r = 0; r < layer.length; r++) {
            for (let c = 0; c < layer[r].length; c++) {
                const id = layer[r][c] | 0;
                if (id > 0) ids.add(id);
            }
        }
    }

    // direct images by ID
    const imagesById: Record<number, HTMLImageElement | null> = {};
    await Promise.all(
        Array.from(ids).map(async (id) => {
            const src = TILE_IMAGES[id];
            if (src) imagesById[id] = await loadImageSafe(src);
        })
    );

    // atlas images by name (hanya yang dipakai)
    const neededAtlas = new Set<string>();
    ids.forEach((id) => {
        const sl = TILE_ATLAS_SLICES[id];
        if (sl) neededAtlas.add(sl.atlas);
    });

    const atlasImgs: Record<string, HTMLImageElement | null> = {};
    await Promise.all(
        Array.from(neededAtlas).map(async (name) => {
            const def = ATLASES[name];
            atlasImgs[name] = def ? await loadImageSafe(def.src) : null;
        })
    );

    return { imagesById, atlasImgs };
}

/** ====== LAYER DRAW ====== */
function makeLayerCanvas(
    layout: number[][],
    imagesById: Record<number, HTMLImageElement | null>,
    atlasImgs: Record<string, HTMLImageElement | null>,
    tile: number,
    cols: number,
    rows: number
): HTMLCanvasElement {
    const cvs = document.createElement("canvas");
    cvs.width = cols * tile;
    cvs.height = rows * tile;
    const ctx = cvs.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;

    for (let r = 0; r < rows; r++) {
        const row = layout[r] || [];
        for (let c = 0; c < cols; c++) {
            const id = (row[c] | 0) as number;
            if (id <= 0) continue;

            const destX = c * tile;
            const destY = r * tile;

            // 1) direct image?
            const img = imagesById[id];
            if (img) {
                ctx.drawImage(img, 0, 0, tile, tile, destX, destY, tile, tile);
                continue;
            }

            // 2) atlas slice
            const slice = TILE_ATLAS_SLICES[id];
            if (slice) {
                const atlasImg = atlasImgs[slice.atlas];
                const def = ATLASES[slice.atlas];
                if (atlasImg && def) {
                    const sx = slice.cx * def.tileW;
                    const sy = slice.cy * def.tileH;
                    ctx.drawImage(atlasImg, sx, sy, def.tileW, def.tileH, destX, destY, tile, tile);
                    continue;
                }
            }

            // 3) fallback debug
            ctx.fillStyle = "rgba(148,163,184,0.6)";
            ctx.fillRect(destX, destY, tile, tile);
            ctx.strokeStyle = "rgba(15,23,42,0.4)";
            ctx.lineWidth = 1;
            ctx.strokeRect(destX + 0.5, destY + 0.5, tile - 1, tile - 1);
        }
    }
    return cvs;
}

/** ====== MERGED SHADOW (top > object > wall; no stacking) ====== */
type ShadowLayer = { layout: number[][]; onlySolid?: boolean };

function makeMergedShadowCanvas(
    layers: ShadowLayer[], // urutan = prioritas (index 0 paling atas)
    imagesById: Record<number, HTMLImageElement | null>,
    atlasImgs: Record<string, HTMLImageElement | null>,
    tile: number,
    cols: number,
    rows: number
): HTMLCanvasElement {
    const cvs = document.createElement("canvas");
    cvs.width = cols * tile;
    cvs.height = rows * tile;
    const ctx = cvs.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;

    // offscreen 1-tile untuk bikin siluet
    const off = document.createElement("canvas");
    off.width = tile;
    off.height = tile;
    const sctx = off.getContext("2d")!;
    sctx.imageSmoothingEnabled = false;

    const drawSilhouette = (
        img: HTMLImageElement,
        sx: number, sy: number, sw: number, sh: number,
        dx: number, dy: number
    ) => {
        sctx.setTransform(1, 0, 0, 1, 0, 0);
        sctx.globalAlpha = 1;
        sctx.globalCompositeOperation = "source-over";
        sctx.clearRect(0, 0, tile, tile);
        sctx.drawImage(img, sx, sy, sw, sh, 0, 0, tile, tile);

        sctx.globalCompositeOperation = "source-in";
        sctx.globalAlpha = SHADOW_ALPHA;
        sctx.fillStyle = "#000";
        sctx.fillRect(0, 0, tile, tile);

        ctx.drawImage(off, dx + SHADOW_OX, dy + SHADOW_OY);
    };

    const shouldCast = (id: number, onlySolid: boolean | undefined): boolean => {
        if (id <= 0) return false;

        const slice = TILE_ATLAS_SLICES[id];

        if (onlySolid) {
            if (isSolidId(id)) return true;
            if (slice && slice.shadow === true) return true;
            return false;
        }

        if (slice && slice.shadow === false) return false;

        return true;
    };


    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            // pilih 1 caster per (c,r) sesuai prioritas
            let chosenId = 0;
            let chosenLayer: ShadowLayer | null = null;

            for (let i = 0; i < layers.length; i++) {
                const L = layers[i];
                const id = (L.layout[r]?.[c] | 0) as number;
                if (shouldCast(id, L.onlySolid)) {
                    chosenId = id;
                    chosenLayer = L;
                    break; // ambil yang paling atas, berhenti
                }
            }

            if (!chosenId || !chosenLayer) continue;

            const destX = c * tile;
            const destY = r * tile;

            // 1) direct image?
            const img = imagesById[chosenId];
            if (img) {
                drawSilhouette(img, 0, 0, tile, tile, destX, destY);
                continue;
            }

            // 2) atlas slice?
            const sl = TILE_ATLAS_SLICES[chosenId];
            if (sl) {
                const atlasImg = atlasImgs[sl.atlas];
                const def = ATLASES[sl.atlas];
                if (atlasImg && def) {
                    const sx = sl.cx * def.tileW;
                    const sy = sl.cy * def.tileH;
                    drawSilhouette(atlasImg, sx, sy, def.tileW, def.tileH, destX, destY);
                    continue;
                }
            }

            // 3) fallback kotak
            ctx.globalAlpha = SHADOW_ALPHA;
            ctx.fillStyle = "#000";
            ctx.fillRect(destX + SHADOW_OX, destY + SHADOW_OY, tile, tile);
            ctx.globalAlpha = 1;
        }
    }

    return cvs;
}

/** Render offscreen canvas (floor/wall/object/top + merged shadow). */
export async function loadWorldMap(): Promise<WorldMap> {
    const tile = TILE;
    const cols = MAP_COLS;
    const rows = MAP_ROWS;

    const { imagesById, atlasImgs } = await loadAssetsForLayouts([
        floorLayout, wallLayout, objectLayout, topLayout
    ]);

    const floor = makeLayerCanvas(floorLayout, imagesById, atlasImgs, tile, cols, rows);
    const wall = makeLayerCanvas(wallLayout, imagesById, atlasImgs, tile, cols, rows);
    const object = makeLayerCanvas(objectLayout, imagesById, atlasImgs, tile, cols, rows);
    const over = makeLayerCanvas(topLayout, imagesById, atlasImgs, tile, cols, rows);

    // PRIORITAS SHADOW: top > object > wall
    const shadow = makeMergedShadowCanvas(
        [
            { layout: topLayout, onlySolid: false }, // overlay non-solid tetap boleh cast
            { layout: objectLayout, onlySolid: false }, // objek biasanya non-solid
            { layout: wallLayout, onlySolid: true }, // wall: hanya yang solid cast
        ],
        imagesById, atlasImgs, tile, cols, rows
    );

    return {
        tile,
        cols,
        rows,
        width: cols * tile,
        height: rows * tile,
        floor,
        wall,
        object,
        over,
        shadow,
    };
}
