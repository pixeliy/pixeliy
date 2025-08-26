export const TILE = 32;
export const MAP_COLS = 25;
export const MAP_ROWS = 25;

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
    shadow: HTMLCanvasElement;
};

const TILE_IMAGES: Record<number, string> = {
};

type AtlasDef = {
    src: string;
    tileW: number;
    tileH: number;
    cols: number;
    rows: number;
};

const ATLASES: Record<string, AtlasDef> = {
    floor: { src: "/assets/floor/floor.png", tileW: TILE, tileH: TILE, cols: 8, rows: 8 },
    wall: { src: "/assets/wall/wall.png", tileW: TILE, tileH: TILE, cols: 8, rows: 8 },
    object: { src: "/assets/object/object.png", tileW: TILE, tileH: TILE, cols: 8, rows: 8 },
};

type AtlasSlice = { atlas: string; cx: number; cy: number; solid: boolean; shadow: boolean };
const TILE_ATLAS_SLICES: Record<number, AtlasSlice> = {};

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
        shadow: opts?.shadow !== false,
    };
    return id;
}

export const fromFloorAtlas = (
    cx: number, cy: number, id: number, opts?: { solid?: boolean; shadow?: boolean }
) => fromAtlas("floor", cx, cy, id, { solid: false, shadow: false, ...(opts ?? {}) });

export const fromWallAtlas = (cx: number, cy: number, id: number, opts?: { solid?: boolean; shadow?: boolean }) =>
    fromAtlas("wall", cx, cy, id, opts);

export const fromObjectAtlas = (cx: number, cy: number, id: number, opts?: { solid?: boolean; shadow?: boolean }) =>
    fromAtlas("object", cx, cy, id, opts);

const __ = 0;
const F1 = fromFloorAtlas(0, 0, 1);
const F2 = fromFloorAtlas(1, 0, 2);
const F3 = fromFloorAtlas(2, 0, 3);
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
const Ll = fromObjectAtlas(4, 7, 23, { solid: false, shadow: true });
const Lr = fromObjectAtlas(5, 7, 24, { solid: false, shadow: true });

export const DOOR_CLOSED_ID = Dd;
export const DOOR_OPEN_ID = dD;
export const TOP_DOOR_CLOSED_ID = Du;
export const TOP_DOOR_OPEN_ID = uD;

// === FLOOR ===
const floorLayoutManual: number[][] = [
    [F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1],
    [F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1],
    [F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F2, F2, F2, F2, F2, F2, F2, F1],
    [F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F2, F2, F2, F2, F2, F2, F2, F1],
    [F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F2, F2, F2, F2, F2, F2, F2, F1],
    [F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F2, F2, F2, F2, F2, F2, F2, F1],
    [F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F2, F2, F2, F2, F2, F2, F2, F1],
    [F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F2, F2, F2, F2, F2, F2, F2, F1],
    [F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F2, F2, F2, F2, F2, F2, F2, F1],
    [F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F2, F2, F2, F2, F2, F2, F2, F1],
    [F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F2, F2, F2, F2, F2, F2, F2, F1],
    [F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F3, F3, F3, F3, F3, F3, F3, F1],
    [F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1],
    [F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1],
    [F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1],
    [F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1],
    [F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1],
    [F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1],
    [F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1],
    [F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1],
    [F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1],
    [F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1],
    [F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1],
    [F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1],
    [F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1, F1],
];

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
    [U_, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, U_],
    [U_, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, U_],
    [U_, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, U_],
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
const TABLElu = fromObjectAtlas(1, 0, 104, { solid: true });
const TABLEmu = fromObjectAtlas(2, 0, 105, { solid: true });
const TABLEru = fromObjectAtlas(3, 0, 106, { solid: true });
const TABLEl_ = fromObjectAtlas(1, 1, 107, { solid: true });
const TABLEm_ = fromObjectAtlas(2, 1, 108, { solid: true });
const TABLEr_ = fromObjectAtlas(3, 1, 109, { solid: true });
const TABLEld = fromObjectAtlas(1, 2, 110, { solid: true });
const TABLEmd = fromObjectAtlas(2, 2, 111, { solid: true });
const TABLErd = fromObjectAtlas(3, 2, 112, { solid: true });
const shelflu = fromObjectAtlas(4, 0, 113, { solid: false });
const shelfmu = fromObjectAtlas(5, 0, 114, { solid: false });
const shelfru = fromObjectAtlas(6, 0, 115, { solid: false });
const shelfld = fromObjectAtlas(4, 1, 116, { solid: false });
const shelfmd = fromObjectAtlas(5, 1, 117, { solid: false });
const shelfrd = fromObjectAtlas(6, 1, 118, { solid: false });
const TABLE = fromObjectAtlas(0, 3, 119, { solid: true });
const SEATl = fromObjectAtlas(0, 4, 120, { solid: false });
const SEATr = fromObjectAtlas(0, 5, 121, { solid: false });
const SEATlu_ = fromObjectAtlas(1, 4, 122, { solid: false });
const SEATmu_ = fromObjectAtlas(2, 4, 123, { solid: false });
const SEATru_ = fromObjectAtlas(3, 4, 124, { solid: false });
const SEATld_ = fromObjectAtlas(1, 5, 125, { solid: false });
const SEATmd_ = fromObjectAtlas(2, 5, 126, { solid: false });
const SEATrd_ = fromObjectAtlas(3, 5, 127, { solid: false });
const PAINTBlu = fromObjectAtlas(0, 6, 128, { solid: false });
const PAINTBru = fromObjectAtlas(1, 6, 129, { solid: false });
const PAINTBld = fromObjectAtlas(0, 7, 130, { solid: false });
const PAINTBrd = fromObjectAtlas(1, 7, 131, { solid: false });
const SEATPlu_ = fromObjectAtlas(5, 2, 132, { solid: false });
const SEATPmu_ = fromObjectAtlas(6, 2, 133, { solid: false });
const SEATPru_ = fromObjectAtlas(7, 2, 134, { solid: false });
const SEATPld_ = fromObjectAtlas(5, 3, 135, { solid: false });
const SEATPmd_ = fromObjectAtlas(6, 3, 136, { solid: false });
const SEATPrd_ = fromObjectAtlas(7, 3, 137, { solid: false });
const PAINTPlu = fromObjectAtlas(2, 6, 138, { solid: false });
const PAINTPru = fromObjectAtlas(3, 6, 139, { solid: false });
const PAINTPld = fromObjectAtlas(2, 7, 140, { solid: false });
const PAINTPrd = fromObjectAtlas(3, 7, 141, { solid: false });
const CLOCKPu = fromObjectAtlas(7, 4, 142, { solid: true });
const CLOCKPd = fromObjectAtlas(7, 5, 143, { solid: true });
const POTP = fromObjectAtlas(7, 1, 144, { solid: false });
const TABLEl = fromObjectAtlas(4, 6, 145, { solid: true });
const TABLEm = fromObjectAtlas(5, 6, 146, { solid: true });
const TABLEr = fromObjectAtlas(6, 6, 147, { solid: true });
const SEATP_lu = fromObjectAtlas(5, 4, 148, { solid: false });
const SEATP_lm = fromObjectAtlas(5, 4.4, 149, { solid: false });
const SEATP_ld = fromObjectAtlas(5, 5, 150, { solid: false });
const SEATP_ru = fromObjectAtlas(6, 4, 151, { solid: false });
const SEATP_rm = fromObjectAtlas(6, 4.4, 152, { solid: false });
const SEATP_rd = fromObjectAtlas(6, 5, 153, { solid: false });
const SEATP_l = fromObjectAtlas(4, 4, 154, { solid: false });
const SEATP_r = fromObjectAtlas(4, 5, 155, { solid: false });
const DESK = fromObjectAtlas(7, 6, 156, { solid: true });

objectLayoutManual[2][1] = POT;
objectLayoutManual[2][16] = POT;
objectLayoutManual[2][23] = POTP;

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
objectLayoutManual[5][11] = TABLEmu;
objectLayoutManual[5][12] = TABLEru;

objectLayoutManual[6][5] = TABLEl_;
objectLayoutManual[6][6] = TABLEm_;
objectLayoutManual[6][7] = TABLEm_;
objectLayoutManual[6][8] = TABLEm_;
objectLayoutManual[6][9] = TABLEm_;
objectLayoutManual[6][10] = TABLEm_;
objectLayoutManual[6][11] = TABLEm_;
objectLayoutManual[6][12] = TABLEr_;

objectLayoutManual[7][5] = TABLEld;
objectLayoutManual[7][6] = TABLEmd;
objectLayoutManual[7][7] = TABLEmd;
objectLayoutManual[7][8] = TABLEmd;
objectLayoutManual[7][9] = TABLEmd;
objectLayoutManual[7][10] = TABLEmd;
objectLayoutManual[7][11] = TABLEmd;
objectLayoutManual[7][12] = TABLErd;

objectLayoutManual[4][5] = SEATu;
objectLayoutManual[4][6] = SEATu;
objectLayoutManual[4][7] = SEATu;
objectLayoutManual[4][8] = SEATu;
objectLayoutManual[4][9] = SEATu;
objectLayoutManual[4][10] = SEATu;
objectLayoutManual[4][11] = SEATu;
objectLayoutManual[4][12] = SEATu;
objectLayoutManual[8][5] = SEATd;
objectLayoutManual[8][6] = SEATd;
objectLayoutManual[8][7] = SEATd;
objectLayoutManual[8][8] = SEATd;
objectLayoutManual[8][9] = SEATd;
objectLayoutManual[8][10] = SEATd;
objectLayoutManual[8][11] = SEATd;
objectLayoutManual[8][12] = SEATd;

objectLayoutManual[17][9] = SEATl;
objectLayoutManual[16][10] = SEATu;
objectLayoutManual[17][10] = TABLE;
objectLayoutManual[17][11] = SEATr;
objectLayoutManual[18][10] = SEATd;

objectLayoutManual[17][13] = SEATl;
objectLayoutManual[16][14] = SEATu;
objectLayoutManual[17][14] = TABLE;
objectLayoutManual[17][15] = SEATr;
objectLayoutManual[18][14] = SEATd;

objectLayoutManual[21][9] = SEATl;
objectLayoutManual[20][10] = SEATu;
objectLayoutManual[21][10] = TABLE;
objectLayoutManual[21][11] = SEATr;
objectLayoutManual[22][10] = SEATd;

objectLayoutManual[21][13] = SEATl;
objectLayoutManual[20][14] = SEATu;
objectLayoutManual[21][14] = TABLE;
objectLayoutManual[21][15] = SEATr;
objectLayoutManual[22][14] = SEATd;

objectLayoutManual[4][19] = SEATPlu_;
objectLayoutManual[4][20] = SEATPmu_;
objectLayoutManual[4][21] = SEATPmu_;
objectLayoutManual[4][22] = SEATPru_;

objectLayoutManual[6][20] = TABLEl;
objectLayoutManual[6][21] = TABLEr;

objectLayoutManual[5][18] = SEATP_lu;
objectLayoutManual[6][18] = SEATP_lm;
objectLayoutManual[7][18] = SEATP_ld;

objectLayoutManual[5][23] = SEATP_ru;
objectLayoutManual[6][23] = SEATP_rm;
objectLayoutManual[7][23] = SEATP_rd;

objectLayoutManual[8][19] = SEATPld_;
objectLayoutManual[8][20] = SEATPmd_;
objectLayoutManual[8][21] = SEATPmd_;
objectLayoutManual[8][22] = SEATPrd_;

objectLayoutManual[0][20] = PAINTPlu;
objectLayoutManual[0][21] = PAINTPru;
objectLayoutManual[1][20] = PAINTPld;
objectLayoutManual[1][21] = PAINTPrd;

objectLayoutManual[1][18] = CLOCKPu;
objectLayoutManual[2][18] = CLOCKPd;

objectLayoutManual[2][20] = DESK;
objectLayoutManual[2][21] = DESK;

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
    [lU, A_, Du, A_, A_, A_, A_, A_, A_, A_, A_, A_, A_, A_, A_, A_, A_, Ar, Ll, Lr, Ll, Lr, Ll, Lr, __],
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
    fillRect(18, 23, 2, 11, 4);

    return g;
}
const audioLayoutManual = makeAudioLayout();

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

export const floorLayout: number[][] = normalizeGrid(floorLayoutManual, MAP_ROWS, MAP_COLS, F1);
export const wallLayout: number[][] = normalizeGrid(wallLayoutManual, MAP_ROWS, MAP_COLS, 0);
export const audioLayout: number[][] = normalizeGrid(audioLayoutManual, MAP_ROWS, MAP_COLS, 0);
export const objectLayout: number[][] = normalizeGrid(objectLayoutManual, MAP_ROWS, MAP_COLS, 0);
export const topLayout: number[][] = normalizeGrid(topLayoutManual, MAP_ROWS, MAP_COLS, 0);

const SOLID_TILE_LAYERS: number[][][] = [wallLayout, objectLayout];

// ====== COLLISION ======
const BASE_SOLID_IDS = new Set([4]);
const EPS = 1e-3;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function isSolidId(id: number): boolean {
    if (BASE_SOLID_IDS.has(id)) return true;
    const slice = TILE_ATLAS_SLICES[id];
    return !!(slice && slice.solid !== false);
}

export function isSolidTile(col: number, row: number): boolean {
    if (row < 0 || row >= MAP_ROWS || col < 0 || col >= MAP_COLS) return true;

    for (const L of SOLID_TILE_LAYERS) {
        const id = L[row]?.[col] ?? 0;
        if (isSolidId(id)) return true;
    }
    return false;
}

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

    const imagesById: Record<number, HTMLImageElement | null> = {};
    await Promise.all(
        Array.from(ids).map(async (id) => {
            const src = TILE_IMAGES[id];
            if (src) imagesById[id] = await loadImageSafe(src);
        })
    );

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

            const img = imagesById[id];
            if (img) {
                ctx.drawImage(img, 0, 0, tile, tile, destX, destY, tile, tile);
                continue;
            }

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

            ctx.fillStyle = "rgba(148,163,184,0.6)";
            ctx.fillRect(destX, destY, tile, tile);
            ctx.strokeStyle = "rgba(15,23,42,0.4)";
            ctx.lineWidth = 1;
            ctx.strokeRect(destX + 0.5, destY + 0.5, tile - 1, tile - 1);
        }
    }
    return cvs;
}

/** ====== MERGED SHADOW ====== */
type ShadowLayer = { layout: number[][]; onlySolid?: boolean };

function makeMergedShadowCanvas(
    layers: ShadowLayer[],
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
            let chosenId = 0;
            let chosenLayer: ShadowLayer | null = null;

            for (let i = 0; i < layers.length; i++) {
                const L = layers[i];
                const id = (L.layout[r]?.[c] | 0) as number;
                if (shouldCast(id, L.onlySolid)) {
                    chosenId = id;
                    chosenLayer = L;
                    break;
                }
            }

            if (!chosenId || !chosenLayer) continue;

            const destX = c * tile;
            const destY = r * tile;

            const img = imagesById[chosenId];
            if (img) {
                drawSilhouette(img, 0, 0, tile, tile, destX, destY);
                continue;
            }

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

            ctx.globalAlpha = SHADOW_ALPHA;
            ctx.fillStyle = "#000";
            ctx.fillRect(destX + SHADOW_OX, destY + SHADOW_OY, tile, tile);
            ctx.globalAlpha = 1;
        }
    }

    return cvs;
}

/** Render offscreen canvas */
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
    const shadow = makeMergedShadowCanvas(
        [
            { layout: topLayout, onlySolid: false },
            { layout: objectLayout, onlySolid: false },
            { layout: wallLayout, onlySolid: true },
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
