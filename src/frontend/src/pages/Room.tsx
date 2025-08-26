"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Peer, { DataConnection, MediaConnection } from "peerjs";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Principal } from "@dfinity/principal";
import { canisterService } from "../services/canisterService";
import { useAuth } from "../contexts/AuthContext";
import { useRoom } from "../hooks/useRoom";
import {
    MessageSquare as IconChat,
    Users as IconUsers,
    Mic as IconMicOn,
    MicOff as IconMicOff,
    ChevronDown as IconChevronDown,
    ChevronUp as IconChevronUp,
    Plus as IconZoomIn,
    Minus as IconZoomOut,
    UserPen as IconOutfit,
    LogOut as IconLeave,
    Settings as IconSettings,
    Copy as IconCopy,
} from "lucide-react";
import {
    loadSpriteParts,
    loadOutfitParts,
    drawPlayerSprite,
    drawPlayerShadow,
    type SpriteParts,
    type OutfitParts,
    type AnimSample,
    type FaceState,
    type OutfitLibrary,
} from "../components/player/sprite";
import {
    DEFAULT_OUTFIT,
    normalizeSlots,
    OUTFIT_OPTIONS,
    OUTFIT_SLOT_ORDER,
    type OutfitSlotsArray,
} from "../constants/outfit";
import { buildActiveOutfit } from "../lib/resolveOutfit";
import {
    TILE,
    MAP_COLS,
    MAP_ROWS,
    loadWorldMap,
    type WorldMap,
    resolveMove,
    isSolidTile,
    audioRuleAt,
    wallLayout,
    topLayout,
    DOOR_OPEN_ID,
    DOOR_CLOSED_ID,
    TOP_DOOR_OPEN_ID,
    TOP_DOOR_CLOSED_ID,
} from "../components/world/map";
import PixelReveal from "@/components/pixel-reveal";

/** ===== TURN  ===== */
const TURN_HOST = import.meta.env.VITE_TURN_HOST as string | undefined;
const TURN_PORT = import.meta.env.VITE_TURN_PORT as string | undefined;
const TURNS_PORT = import.meta.env.VITE_TURNS_PORT as string | undefined;
const TURN_USER = import.meta.env.VITE_TURN_USERNAME as string | undefined;
const TURN_CRED = import.meta.env.VITE_TURN_CREDENTIAL as string | undefined;

const rtcConfig: RTCConfiguration = {
    iceServers: [
        { urls: [`turn:${TURN_HOST}:${TURN_PORT}?transport=udp`], username: TURN_USER!, credential: TURN_CRED },
        { urls: [`turn:${TURN_HOST}:${TURN_PORT}?transport=tcp`], username: TURN_USER!, credential: TURN_CRED },
        { urls: [`turns:${TURN_HOST}:${TURNS_PORT}?transport=tcp`], username: TURN_USER!, credential: TURN_CRED },

    ],
    iceTransportPolicy: "relay",
    bundlePolicy: "balanced",
};

/** utils */
const pretty = (id: string) => (id.length > 14 ? id.slice(0, 6) + "..." + id.slice(-6) : id);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const principalToText = (p: any) => {
    try { if (p && typeof p.toText === "function") return p.toText(); if (typeof p === "string") return p; } catch { }
    return String(p);
};

const formatBadge = (n: number) => (n > 99 ? "99+" : String(n));
const idSafe = (s: string) => String(s).replace(/[^a-zA-Z0-9_-]/g, "");

const peerIdForPrincipal = (roomId: string, principalText: string) =>
    `${idSafe(roomId)}-${idSafe(principalText)}`;

const principalFromPeerId = (roomId: string, peerId: string) => {
    const prefix = `${idSafe(roomId)}-`;
    return peerId.startsWith(prefix) ? peerId.slice(prefix.length) : peerId;
};

/** detect touch / coarse pointer */
const isTouchLike = () => {
    if (typeof window === "undefined") return false;
    return (
        "ontouchstart" in window ||
        (navigator?.maxTouchPoints ?? 0) > 0 ||
        !!window.matchMedia?.("(pointer: coarse)")?.matches
    );
};

/** ===== WORLD / PLAYER ===== */
const CANVAS_W = MAP_COLS * TILE;
const CANVAS_H = MAP_ROWS * TILE;

// sprite size & movement hitbox (AABB)
const PLAYER = 32;
const SPEED = 120;

// hitbox offset
const HITBOX_LEFT = 6;
const HITBOX_RIGHT = 6;
const HITBOX_TOP = 2;
const HITBOX_BOTTOM = 0;
const HITBOX_W = PLAYER - HITBOX_LEFT - HITBOX_RIGHT;
const HITBOX_H = PLAYER - HITBOX_TOP - HITBOX_BOTTOM;

const DEFAULT_AUDIO_RADIUS_TILES = 2;

/** UI tokens */
const LABEL_FONT = "600 12px ui-monospace, SFMono-Regular, Menlo, monospace";
const LABEL_STROKE = "rgba(0,0,0,0.72)";

/** Smooth camera/zoom config */
const ZOOM_MAX = 4;
const ZOOM_STEP = 1.2;
const ZOOM_LERP = 10;
const WHEEL_SENS = 0.0015;

/** tile center from AABB (px) */
const centerTileOf = (xPx: number, yPx: number) => {
    const cx = xPx + HITBOX_LEFT + HITBOX_W / 2;
    const cy = yPx + HITBOX_TOP + HITBOX_H / 2;
    return { col: Math.floor(cx / TILE), row: Math.floor(cy / TILE) };
};

/** find a safe spawn tile */
const SPAWN_COL_MIN = 8, SPAWN_COL_MAX = 16;
const SPAWN_ROW_MIN = 15, SPAWN_ROW_MAX = 22;
const randInt = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;

const pickSpawnTile = () => {
    for (let i = 0; i < 60; i++) {
        const col = randInt(SPAWN_COL_MIN, SPAWN_COL_MAX);
        const row = randInt(SPAWN_ROW_MIN, SPAWN_ROW_MAX);
        if (!isSolidTile(col, row)) return { col, row };
    }
    for (let r = SPAWN_ROW_MIN; r <= SPAWN_ROW_MAX; r++) {
        for (let c = SPAWN_COL_MIN; c <= SPAWN_COL_MAX; c++) {
            if (!isSolidTile(c, r)) return { col: c, row: r };
        }
    }
    return { col: 12, row: 18 };
};

const tileSpawnPx = () => {
    const { col, row } = pickSpawnTile();
    return {
        x: col * TILE + Math.floor((TILE - PLAYER) / 2),
        y: row * TILE + Math.floor((TILE - PLAYER) / 2),
    };
};

/** ===== Proximity set (BFS skips solid tiles) ===== */
const computeAudibleTiles = (cx: number, cy: number, radius: number) => {
    const tiles = new Set<string>();
    const seen: boolean[][] = Array.from({ length: MAP_ROWS }, () => Array(MAP_COLS).fill(false));
    const q: Array<{ x: number; y: number }> = [];

    const push = (x: number, y: number) => {
        if (x < 0 || y < 0 || x >= MAP_COLS || y >= MAP_ROWS) return;
        if (seen[y][x]) return;
        const dCheb = Math.max(Math.abs(x - cx), Math.abs(y - cy));
        if (dCheb > radius) return;
        seen[y][x] = true;

        if (isSolidTile(x, y)) return;
        const rule = audioRuleAt(x, y);
        if (rule.kind === "room") return;

        tiles.add(`${x},${y}`);
        q.push({ x, y });
    };

    push(cx, cy);

    while (q.length) {
        const { x, y } = q.shift()!;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (!dx && !dy) continue;
                const nx = x + dx, ny = y + dy;

                if (dx !== 0 && dy !== 0) {
                    const blockA = isSolidTile(x + dx, y);
                    const blockB = isSolidTile(x, y + dy);
                    if (blockA && blockB) continue;
                }
                push(nx, ny);
            }
        }
    }

    return tiles;
};

/** ===== DOOR - state & helpers ===== */
const DOOR_SFX_RADIUS_TILES = 1;

const isDoorId = (id: number) => (id === DOOR_OPEN_ID || id === DOOR_CLOSED_ID);
const doorKey = (c: number, r: number) => `${c},${r}`;

/** ===== Player outfit/anim/speaking ===== */
type PlayerPos = { x: number; y: number };
type PosMsg = { t: "pos"; x: number; y: number; moving?: boolean; face?: 1 | -1 };
type MetaMsg = { t: "meta"; label?: string; outfit?: OutfitSlotsArray };
type SpinMsg = { t: "spin"; dur?: number };

const BUBBLE_FONT = "13px ui-monospace, SFMono-Regular, Menlo, monospace";
const BUBBLE_MAX_W = 240;
const BUBBLE_LINE_H = 16;

const BUBBLE_MIN_MS = 5000;
const BUBBLE_MAX_MS = 15000;
const BUBBLE_BASE_MS = 5000;
const BUBBLE_PER_CHAR_MS = 50;
const BUBBLE_PER_NEWLINE_MS = 250;

/** DC message union */
type Msg =
    | { t: "hello"; peerId: string; principal: string }
    | { t: "bye"; peerId: string }
    | PosMsg
    | { t: "chat"; text: string; ts?: number; from?: string }
    | { t: "media-refresh"; why?: "mic-on" | "mic-off" | "device" | "manual" }
    | { t: "door"; col: number; row: number; open: boolean; silent?: boolean }
    | { t: "door-sync-req" }
    | MetaMsg
    | SpinMsg;

const normalizeUsername = (s: string) =>
    s.replace(/[^\w.-]+/g, "_").trim().slice(0, 24);

const prettyId = (s: string) =>
    s.length > 16 ? `${s.slice(0, 6)}...${s.slice(-6)}` : s;

const HEAD_BOX = { x: 6, y: 2, w: 20, h: 20 };

/** ===== Main component ===== */
const Room: React.FC = () => {
    const { id: rawRoomParam } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const roomId = (rawRoomParam || "").trim().toLowerCase();

    // auth + backend
    const { isAuthenticated, principalId, isLoading: authLoading, user } = useAuth() as any;
    const { getRoom, joinRoom, leaveRoom } = useRoom();

    // logs
    const [logs, setLogs] = useState<string[]>([]);
    const log = (s: string) => setLogs((p) => [...p, `[${new Date().toLocaleTimeString()}] ${s}`].slice(-300));

    // Connections
    const peerRef = useRef<Peer | null>(null);
    const creatingRef = useRef(false);
    const closingRef = useRef(false);

    // datachannels
    const connsRef = useRef<Map<string, DataConnection>>(new Map());
    const chatConnsRef = useRef<Map<string, DataConnection>>(new Map());
    const mediaConnsRef = useRef<Map<string, MediaConnection>>(new Map());

    /** roster RTC:
     *  - key: peerId
     *  - val: principal text
     */
    const rosterRef = useRef<Map<string, string>>(new Map());
    const joinedRef = useRef(false);

    // peer handlers
    const handlersRef = useRef<{
        onConnection?: (conn: DataConnection) => void;
        onDisconnected?: () => void;
        onClose?: () => void;
        onError?: (e: any) => void;
        onCall?: (call: MediaConnection) => void;
    }>({});

    // Mobile joystick toggle
    const [useJoystick, setUseJoystick] = useState(false);
    useEffect(() => {
        const update = () => setUseJoystick(isTouchLike());
        update();
        const mql = window.matchMedia?.("(pointer: coarse)");
        mql?.addEventListener?.("change", update);
        return () => mql?.removeEventListener?.("change", update);
    }, []);

    // World state
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const worldRef = useRef<WorldMap | null>(null);
    const zoomActualRef = useRef(2);
    const zoomTargetRef = useRef(2);
    const lastPointerRef = useRef({ x: 0, y: 0 });

    const setZoomTarget = (z: number) => {
        const dpr = window.devicePixelRatio || 1;
        const viewW = (canvasRef.current?.width || Math.floor(window.innerWidth * dpr)) / dpr;

        const minZoomByWorldX = Math.max(viewW / CANVAS_W, 0.1);
        const maxZoom = ZOOM_MAX;

        zoomTargetRef.current = clamp(z, minZoomByWorldX, maxZoom);
    };

    const requestZoomIn = () => setZoomTarget(zoomTargetRef.current * ZOOM_STEP);
    const requestZoomOut = () => setZoomTarget(zoomTargetRef.current / ZOOM_STEP);

    // player pos
    const meRef = useRef<PlayerPos>(tileSpawnPx());
    const othersRef = useRef<Record<string, PlayerPos>>({});
    const keysRef = useRef({ up: false, left: false, down: false, right: false });
    const lastRef = useRef(performance.now());
    const sendAccRef = useRef(0);
    const rafRef = useRef(0);

    // overlay canvas for audio mask
    const overlayCvsRef = useRef<HTMLCanvasElement | null>(null);
    const overlayCtxRef = useRef<CanvasRenderingContext2D | null>(null);

    /* ===== Player assets states ===== */
    const partsRef = useRef<SpriteParts | null>(null);
    const outfitLibRef = useRef<OutfitLibrary | null>(null);
    const playerOutfitSlotsRef = useRef<Record<string, OutfitSlotsArray>>({});
    const playerOutfitPartsRef = useRef<Record<string, OutfitParts | undefined>>({});
    const outfitVersion = useRef(0);

    const faceDirRef = useRef<Record<string, 1 | -1>>({});
    const remoteMovingRef = useRef<Record<string, boolean>>({});
    const lastPosAtRef = useRef<Record<string, number>>({});

    // Spin gesture
    type ArmSpin = { start: number; dur: number };
    const ARM_SPIN_MS = 250;
    const armSpinRef = useRef<Record<string, ArmSpin | undefined>>({});

    const triggerArmSpin = (pid: string, dur = ARM_SPIN_MS) => {
        armSpinRef.current[pid] = { start: performance.now(), dur };
    };
    const getArmSpinOverride = (pid: string, _flipX: boolean, nowMs: number) => {
        const s = armSpinRef.current[pid];
        if (!s) return undefined;
        const t = (nowMs - s.start) / s.dur;
        if (t >= 1) { delete armSpinRef.current[pid]; return undefined; }
        const angle = t * Math.PI * 2;
        return { armFrontRot: angle } as any;
    };

    // label/name
    const labelCacheRef = useRef<Record<string, string>>({});
    const usernameCacheRef = useRef<Record<string, string>>({});
    const [labelsVersion, setLabelsVersion] = useState(0);

    const usernameFor = (peerId: string) => {
        if (peerId === myPeerId) {
            const uname = String(user?.username || "").trim();
            return uname ? normalizeUsername(uname) : "";
        }
        return usernameCacheRef.current[peerId] || "";
    };

    const displayNameFor = (peerId: string) => {
        if (peerId === myPeerId) return myLabelRef.current || prettyId(myPeerId);
        return labelCacheRef.current[peerId] || prettyId(peerId);
    };

    const isProfileReady = (peerId: string) => {
        if (peerId === myPeerId) return true;

        const labelOk = !!(labelCacheRef.current[peerId]?.trim());
        const unameOk = !!(usernameCacheRef.current[peerId]?.trim());
        return labelOk && unameOk;
    };

    const resolveRemoteProfile = async (remotePeerId: string) => {
        try {
            const principalTxt = principalFromPeerId(roomId, remotePeerId);
            const u: any = await canisterService.getUserByPrincipal(Principal.fromText(principalTxt));

            const rawName = String(u?.name || u?.username || "").trim();
            const label = rawName.replace(/\s+/g, " ").slice(0, 24);
            if (label) labelCacheRef.current[remotePeerId] = label;

            const uname = String(u?.username || "").trim();
            if (uname) usernameCacheRef.current[remotePeerId] = normalizeUsername(uname);

            setLabelsVersion(v => v + 1);
            refreshRtcUI();
        } catch { }
    };

    const myDisplayName = useMemo(() => {
        const raw = String(user?.name || user?.username || "").trim();
        return raw.replace(/\s+/g, " ").slice(0, 24);
    }, [user?.name, user?.username]);

    const myLabelRef = useRef("");
    useEffect(() => {
        myLabelRef.current = myDisplayName;
    }, [myDisplayName]);

    const nameReady = !!myDisplayName;

    useEffect(() => {
        broadcastLabel();
    }, [user?.name, user?.username]);

    /* ===== RIGHT SIDEBAR state ===== */
    const [showSidebar, setShowSidebar] = useState(false);
    const [participantsReady, setParticipantsReady] = useState<string[]>([]);
    const [inviteCopied, setInviteCopied] = useState(false);

    // Copy link to clipboard
    const onInviteClick = async () => {
        try {
            const url = `${window.location.origin}/room/${encodeURIComponent(roomId)}`;
            await navigator.clipboard.writeText(url);
            setInviteCopied(true);
            setTimeout(() => setInviteCopied(false), 1500);
        } catch { }
    };

    /* ===== CHAT state ===== */
    const [showChat, setShowChat] = useState(false);
    const [chatInput, setChatInput] = useState("");
    const [chatLog, setChatLog] = useState<
        { id: string; fromPeerId: string; label: string; text: string; ts: number; self: boolean }[]
    >([]);
    const chatListRef = useRef<HTMLDivElement | null>(null);
    const chatInputRef = useRef<HTMLInputElement | null>(null);
    const typingChatRef = useRef(false);

    const scrollChatToBottom = () => {
        const el = chatListRef.current; if (!el) return;
        el.scrollTop = el.scrollHeight;
    };
    useEffect(() => { scrollChatToBottom(); }, [chatLog.length, showChat]);
    useEffect(() => { if (showChat) setTimeout(() => chatInputRef.current?.focus(), 60); }, [showChat]);

    // Chat bubble state
    const chatBubbleRef = useRef<Record<string, { text: string; until: number }>>({});
    const chatTalkUntilRef = useRef<Record<string, number>>({});

    const bubbleDurationFor = (text: string) => {
        const clean = String(text ?? "");
        const len = clean.length;
        const nl = (clean.match(/\n/g)?.length ?? 0);
        const ms = BUBBLE_BASE_MS + BUBBLE_PER_CHAR_MS * Math.min(len, 240) + BUBBLE_PER_NEWLINE_MS * nl;
        return clamp(ms, BUBBLE_MIN_MS, BUBBLE_MAX_MS);
    };

    const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] => {
        const lines: string[] = [];
        const paragraphs = String(text ?? "").split(/\n/);
        for (const para of paragraphs) {
            const words = para.split(/\s+/).filter(Boolean);
            if (words.length === 0) { lines.push(""); continue; }
            let cur = "";
            for (const w of words) {
                const test = cur ? cur + " " + w : w;
                if (ctx.measureText(test).width <= maxW) { cur = test; continue; }
                if (!cur) {
                    let chunk = "";
                    for (const ch of w) {
                        const trial = chunk + ch;
                        if (ctx.measureText(trial).width <= maxW) chunk = trial;
                        else { if (chunk) lines.push(chunk); chunk = ch; }
                    }
                    if (chunk) lines.push(chunk);
                } else {
                    lines.push(cur); cur = w;
                }
            }
            if (cur) lines.push(cur);
        }
        return lines;
    };

    // identity
    const myPrincipalTxt = useMemo(() => principalId || "anonymous", [principalId]);
    const myPeerId = useMemo(() => peerIdForPrincipal(roomId, myPrincipalTxt), [roomId, myPrincipalTxt]);

    /* ===== RTC roster UI ===== */
    const refreshRtcUI = () => {
        const peers = Array.from(rosterRef.current.keys()).sort((a, b) => {
            if (a === myPeerId) return -1;
            if (b === myPeerId) return 1;
            return a.localeCompare(b);
        });

        const readyOnly = peers.filter(isProfileReady);
        setParticipantsReady(readyOnly);
    };

    const ensureSelfInRoster = () => {
        rosterRef.current.set(myPeerId, myPrincipalTxt);
        refreshRtcUI();
    };

    const broadcastPos = () => {
        const movingNow = !!(keysRef.current.left || keysRef.current.right || keysRef.current.up || keysRef.current.down);
        const face = faceDirRef.current[myPeerId] ?? 1;
        const msg: PosMsg = { t: "pos", x: meRef.current.x, y: meRef.current.y, moving: movingNow, face };
        for (const [, c] of connsRef.current) if (c.open) { try { c.send(msg); } catch { } }
    };

    const addChatMessage = (fromPeerId: string, text: string, ts = Date.now(), self = false) => {
        const label = displayNameFor(fromPeerId);
        const item = {
            id: `${ts}-${fromPeerId}-${Math.random().toString(36).slice(2, 7)}`,
            fromPeerId,
            label,
            text,
            ts,
            self,
        };
        setChatLog((prev) => [...prev, item].slice(-400));
        const dur = bubbleDurationFor(text);
        const now = performance.now();
        chatBubbleRef.current[fromPeerId] = { text, until: now + dur };
        chatTalkUntilRef.current[fromPeerId] = now + Math.min(dur, 5000);
    };

    const sendChat = (textRaw: string) => {
        let text = String(textRaw ?? "")
            .replace(/\r/g, "")
            .replace(/[ \t]+/g, " ")
            .replace(/\n{3,}/g, "\n\n")
            .trim();
        if (text.length > 240) text = text.slice(0, 240);
        if (!text) return;
        const ts = Date.now();
        const wire: Msg = { t: "chat", text, ts, from: myPeerId };
        let sent = false;
        for (const [, c] of chatConnsRef.current) {
            if (c.open) { try { c.send(wire); sent = true; } catch { } }
        }
        if (!sent) {
            for (const [, c] of connsRef.current) { if (c.open) { try { c.send(wire); } catch { } } }
        }
        addChatMessage(myPeerId, text, ts, true);
        setChatInput("");
    };

    const handleInboundChat = (remotePeerId: string, payload: any) => {
        if (!payload || payload.t !== "chat") return;
        const from = typeof payload.from === "string" ? payload.from : remotePeerId;
        const ts = typeof payload.ts === "number" ? payload.ts : Date.now();
        const text = String(payload.text ?? "");
        addChatMessage(from, text, ts, false);
    };

    // ===== Outfit editor =====
    const [showOutfit, setShowOutfit] = useState(false);
    const [mySlots, setMySlots] = useState<OutfitSlotsArray>(DEFAULT_OUTFIT);
    const [activeSlot, setActiveSlot] = useState<string>(OUTFIT_SLOT_ORDER[0]);
    const previewRef = useRef<HTMLCanvasElement | null>(null);

    // Outfit canvas
    useEffect(() => {
        if (!showOutfit) return;
        const cvs = previewRef.current;
        const parts = partsRef.current;
        const lib = outfitLibRef.current;
        if (!cvs || !parts || !lib) return;

        const dpr = window.devicePixelRatio || 1;
        const W = 160, H = 160;
        const ctx = cvs.getContext("2d")!;
        cvs.width = W * dpr; cvs.height = H * dpr;
        cvs.style.width = W + "px"; cvs.style.height = H + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, W, H);

        const active = buildActiveOutfit(lib, mySlots);
        const scale = 3;
        const spriteW = PLAYER * scale;
        const x = Math.floor(W / 2 - spriteW / 2);
        const y = Math.floor(H / 2 - spriteW / 2) + 8;

        drawPlayerSprite(
            ctx, parts, x, y, scale,
            { phase: 0, amp: 0 }, false,
            active,
            { speaking: false, talkBlink: false }
        );
    }, [mySlots, showOutfit]);

    // Original slots before edit
    const originalSlotsRef = useRef<OutfitSlotsArray>(DEFAULT_OUTFIT);
    const shouldRevertRef = useRef(false);

    const openOutfit = () => {
        const applied = playerOutfitSlotsRef.current[myPeerId] || mySlots;
        originalSlotsRef.current = (applied.slice() as OutfitSlotsArray);
        setMySlots(originalSlotsRef.current);
        shouldRevertRef.current = true;
        setShowOutfit(true);
    };

    const closeOutfit = (commit = false) => {
        if (!commit && shouldRevertRef.current) setMySlots(originalSlotsRef.current);
        shouldRevertRef.current = false;
        setShowOutfit(false);
    };

    const onCancelOutfit = () => closeOutfit(false);

    // Apply to self & broadcast
    const broadcastLabel = () => {
        const myLabel = myLabelRef.current;
        if (!myLabel) return;
        for (const [, c] of connsRef.current) {
            if (c.open) { try { c.send({ t: "meta", label: myLabel } as MetaMsg); } catch { } }
        }
    };

    const broadcastOutfit = () => {
        const slots = playerOutfitSlotsRef.current[myPeerId] || DEFAULT_OUTFIT;
        for (const [, c] of connsRef.current) {
            if (c.open) {
                try { c.send({ t: "meta", outfit: slots } as MetaMsg); } catch { }
            }
        }
    };

    const onApplyOutfit = async () => {
        try {
            await canisterService.setMyOutfit(mySlots);
        } catch { }

        setOutfitSlotsFor(myPeerId, mySlots);
        broadcastOutfit();
        closeOutfit(true);
    };

    const recomputeAllOutfits = () => {
        const ids = Object.keys(playerOutfitSlotsRef.current);
        for (const pid of ids) {
            recomputeOutfitFor(pid);
        }
        outfitVersion.current++;
    };

    useEffect(() => {
        (async () => {
            if (!principalId) return;
            try {
                const slots = await canisterService.getUserOutfit(Principal.fromText(principalId));
                const norm = normalizeSlots(slots);
                setMySlots(norm);
                setOutfitSlotsFor(myPeerId, norm);
                broadcastOutfit();
            } catch { }
        })();
    }, [principalId, myPeerId]);

    // Mic gate
    const [needsMicGate, setNeedsMicGate] = useState(true);
    const [preJoinError, setPreJoinError] = useState<string | null>(null);
    const shouldRenderGate = needsMicGate && !authLoading && isAuthenticated && !!principalId;

    // Avatar preview on the lobby
    const prePreviewRef = useRef<HTMLCanvasElement | null>(null);

    // Pre-join avatar preview canvas
    useEffect(() => {
        if (!shouldRenderGate) return;
        const cvs = prePreviewRef.current;
        const parts = partsRef.current;
        const lib = outfitLibRef.current;
        if (!cvs || !parts || !lib) return;

        const dpr = window.devicePixelRatio || 1;
        const W = 220, H = 220;
        const ctx = cvs.getContext("2d")!;
        cvs.width = W * dpr; cvs.height = H * dpr;
        cvs.style.width = W + "px"; cvs.style.height = H + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.imageSmoothingEnabled = false;

        ctx.clearRect(0, 0, W, H);

        const slots = playerOutfitSlotsRef.current[myPeerId] || mySlots;
        const active = buildActiveOutfit(lib, slots);

        const scale = 4;
        const spriteW = PLAYER * scale;
        const x = Math.floor(W / 2 - spriteW / 2);
        const y = Math.floor(H / 2 - spriteW / 2) + 12;

        drawPlayerSprite(
            ctx, parts, x, y, scale,
            { phase: 0, amp: 0 },
            false,
            active,
            { speaking: false, talkBlink: false }
        );
    }, [shouldRenderGate, myPeerId, mySlots]);

    const handlePreJoin = async () => {
        setPreJoinError(null);
        try {
            await ensureAudioCtx()?.resume();

            const stream = await acquireMic(undefined);
            if (!stream) {
                throw new Error("Microphone permission is required to join.");
            }

            micOnRef.current = true;
            setMicOn(true);
            ensureSilentOut();
            tryPlayAllRemote();
            setNeedsMicGate(false);
        } catch (e: any) {
            setPreJoinError(e?.message || String(e));
        }
    };


    /** ===== MEDIA (audio) ===== */
    const localStreamRef = useRef<MediaStream | null>(null);
    const micOnRef = useRef(false);
    const [micOn, setMicOn] = useState(false);
    const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
    const [selectedMicId, setSelectedMicId] = useState<string>("");
    const [showMicSettings, setShowMicSettings] = useState(false);

    const remoteAudiosRef = useRef<Record<string, HTMLAudioElement | null>>({});
    const remoteUserMutedRef = useRef<Record<string, boolean>>({});

    // WebAudio (VAD & util)
    const audioCtxRef = useRef<AudioContext | null>(null);
    const silentOutRef = useRef<MediaStream | null>(null);

    const remoteAnalyserRef = useRef<Record<string, AnalyserNode | null>>({});
    const remoteSourceRef = useRef<Record<string, MediaStreamAudioSourceNode | null>>({});
    const remoteLevelRef = useRef<Record<string, number>>({});

    const localAnalyserRef = useRef<AnalyserNode | null>(null);
    const localSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const localLevelRef = useRef(0);

    /** speaking VAD */
    const speakingRef = useRef<Record<string, boolean>>({});
    const lastLoudAtRef = useRef<Record<string, number>>({});
    const lastLoudAtSelfRef = useRef<number>(0);
    const VAD_HOLD_MS = 200;
    const BLINK_MS = 200;
    const talkBlinkRef = useRef<Record<string, boolean>>({});
    const lastBlinkAtRef = useRef<Record<string, number>>({});

    const SPK_THRESHOLD = 0.02;

    /** AudioContext helper */
    const ensureAudioCtx = () => {
        if (!audioCtxRef.current) {
            const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
            audioCtxRef.current = new AC();
        }
        return audioCtxRef.current!;
    };

    /** Create a truly silent outbound stream (so we can be recvonly/bi-dir even if mic never on) */
    const ensureSilentOut = (): MediaStream | null => {
        try {
            if (silentOutRef.current) return silentOutRef.current;
            const ctx = ensureAudioCtx();
            const src = (ctx as any).createConstantSource ? (ctx as any).createConstantSource() : ctx.createOscillator();
            const gain = ctx.createGain();
            const dest = ctx.createMediaStreamDestination();
            gain.gain.value = 0;
            src.connect(gain).connect(dest);
            src.start?.();
            silentOutRef.current = dest.stream;
            return silentOutRef.current;
        } catch {
            return null;
        }
    };

    /** Outbound stream policy:
     *  - if mic ON -> real mic
     *  - else      -> silent stream
     */
    const getOutboundStream = (): MediaStream | null => {
        if (micOnRef.current && localStreamRef.current) return localStreamRef.current;
        return ensureSilentOut();
    };

    /** VAD helpers */
    const computeLevel = (an: AnalyserNode | null) => {
        if (!an) return 0;
        const buf = new Float32Array(an.fftSize);
        try {
            an.getFloatTimeDomainData(buf);
            let sum = 0;
            for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
            return Math.sqrt(sum / buf.length);
        } catch { return 0; }
    };

    const attachLocalAnalyser = (stream: MediaStream) => {
        try {
            const ctx = ensureAudioCtx();
            detachLocalAnalyser();
            const src = ctx.createMediaStreamSource(stream);
            const an = ctx.createAnalyser();
            an.fftSize = 512;
            src.connect(an);
            localSourceRef.current = src;
            localAnalyserRef.current = an;
        } catch { }
    };

    const detachLocalAnalyser = () => {
        try { localSourceRef.current?.disconnect(); } catch { }
        localSourceRef.current = null;
        localAnalyserRef.current = null;
        localLevelRef.current = 0;
    };

    const attachRemoteAnalyser = (pid: string, stream: MediaStream) => {
        try {
            const ctx = ensureAudioCtx();
            try { remoteSourceRef.current[pid]?.disconnect(); } catch { }
            const src = ctx.createMediaStreamSource(stream);
            const an = ctx.createAnalyser();
            an.fftSize = 512;
            src.connect(an);
            remoteSourceRef.current[pid] = src;
            remoteAnalyserRef.current[pid] = an;
        } catch {
            remoteSourceRef.current[pid] = null;
            remoteAnalyserRef.current[pid] = null;
        }
    };

    /** Device list */
    const refreshMics = async () => {
        try {
            const list = await navigator.mediaDevices.enumerateDevices();
            const ins = list.filter((d) => d.kind === "audioinput");
            setMics(ins);
            if (!selectedMicId && ins[0]?.deviceId) setSelectedMicId(ins[0].deviceId);
        } catch { }
    };
    useEffect(() => { void refreshMics(); }, []);
    useEffect(() => {
        const onDev = () => void refreshMics();
        navigator.mediaDevices?.addEventListener?.("devicechange", onDev);
        return () => navigator.mediaDevices?.removeEventListener?.("devicechange", onDev);
    }, []);


    /** Acquire/close mic */
    const acquireMic = async (deviceId?: string) => {
        try {
            const constraints: MediaStreamConstraints = {
                audio: {
                    deviceId: deviceId ? { exact: deviceId } : undefined,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                } as MediaTrackConstraints,
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            stream.getAudioTracks().forEach(t => {
                t.onended = () => {
                    micOnRef.current = false; setMicOn(false);
                    refreshCallsAfterMicChange();
                };
            });
            localStreamRef.current = stream;
            attachLocalAnalyser(stream);
            return stream;
        } catch {
            return null;
        }
    };

    const closeMic = () => {
        try { localStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch { }
        localStreamRef.current = null;
        detachLocalAnalyser();
    };

    /** Try playing every remote audio (for autoplay unlock) */
    const tryPlayAllRemote = () => {
        for (const el of Object.values(remoteAudiosRef.current)) {
            try { el?.play?.().catch(() => { }); } catch { }
        }
    };

    /** call this after any mic state change (on/off/apply device) */
    const refreshCallsAfterMicChange = () => {
        for (const [, c] of connsRef.current) {
            if (c.open) { try { c.send({ t: "media-refresh", why: micOnRef.current ? "mic-on" : "mic-off" } as Msg); } catch { } }
        }
        for (const rid of mediaConnsRef.current.keys()) {
            try { mediaConnsRef.current.get(rid)?.close(); } catch { }
            mediaConnsRef.current.delete(rid);
        }
        const out = getOutboundStream();
        if (!out) return;
        setTimeout(() => {
            for (const rid of connsRef.current.keys()) startMediaCall(rid);
        }, 120);
    };

    /** Replace sender track on existing RTCPeerConnections without full reneg */
    const swapOutboundTrackForAll = (stream: MediaStream | null) => {
        const track = stream?.getAudioTracks?.()[0] || null;
        for (const [, call] of mediaConnsRef.current) {
            const pc: RTCPeerConnection | undefined = (call as any)?.peerConnection;
            const sender = pc?.getSenders().find(s => s.track && s.track.kind === "audio");
            if (sender) {
                sender.replaceTrack(track).catch(() => { });
            }
        }
    };

    /** Toggle Mic main button */
    const onToggleMic = async () => {
        await ensureAudioCtx()?.resume().catch(() => { });
        if (!micOnRef.current) {
            const stream = await acquireMic(selectedMicId || undefined);
            if (!stream) return;
            micOnRef.current = true;
            setMicOn(true);
            swapOutboundTrackForAll(stream);
            for (const [, c] of connsRef.current) c.open && c.send({ t: "media-refresh", why: "mic-on" } as Msg);
        } else {
            micOnRef.current = false;
            setMicOn(false);
            const silent = ensureSilentOut();
            swapOutboundTrackForAll(silent);
            closeMic();
            for (const [, c] of connsRef.current) c.open && c.send({ t: "media-refresh", why: "mic-off" } as Msg);
        }
    };

    /** Apply device in settings */
    const onApplyMic = async () => {
        await ensureAudioCtx()?.resume().catch(() => { });
        closeMic();
        const stream = await acquireMic(selectedMicId || undefined);
        if (!stream) return;
        micOnRef.current = true;
        setMicOn(true);
        refreshCallsAfterMicChange();
    };


    /** Auto-update VAD & mouth blink */
    useEffect(() => {
        let timer = window.setInterval(() => {
            const now = performance.now();

            // local
            const lvlSelf = computeLevel(localAnalyserRef.current);
            if (lvlSelf > SPK_THRESHOLD) lastLoudAtSelfRef.current = now;
            speakingRef.current[myPeerId] = (now - lastLoudAtSelfRef.current) < VAD_HOLD_MS;

            // remotes
            Object.keys(remoteAnalyserRef.current).forEach(pid => {
                const an = remoteAnalyserRef.current[pid];
                const lvl = computeLevel(an || null);
                if (lvl > SPK_THRESHOLD) lastLoudAtRef.current[pid] = now;
                const speakingNow = (now - (lastLoudAtRef.current[pid] || 0)) < VAD_HOLD_MS;
                speakingRef.current[pid] = speakingNow;

                if (speakingNow) {
                    if (!lastBlinkAtRef.current[pid] || now - lastBlinkAtRef.current[pid] >= BLINK_MS) {
                        talkBlinkRef.current[pid] = !talkBlinkRef.current[pid];
                        lastBlinkAtRef.current[pid] = now;
                    }
                } else {
                    talkBlinkRef.current[pid] = false;
                }
            });
        }, 150);
        return () => window.clearInterval(timer);
    }, [myPeerId]);


    /** Start/answer media calls */
    const startMediaCall = (remotePeerId: string) => {
        const peer = peerRef.current; if (!peer) return;
        if (mediaConnsRef.current.has(remotePeerId)) return;

        const out = getOutboundStream();
        if (!out) return;

        let call: MediaConnection | undefined;
        try {
            call = peer.call(remotePeerId, out, { metadata: { kind: "proximity-audio" } });
        } catch { return; }
        if (!call) return;
        hookMediaConn(remotePeerId, call);
    };

    const answerMediaCall = (remotePeerId: string, call: MediaConnection) => {
        const out = getOutboundStream();
        try {
            if (out) call.answer(out); else call.answer();
        } catch (e) {
            log(`answer error ${pretty(remotePeerId)}: ${String((e as any)?.message || e)}`);
        }
        hookMediaConn(remotePeerId, call);
    };

    /** Watch native PC states (retry on fail) */
    const watchPeerConn = (remotePeerId: string, call: MediaConnection) => {
        const pc: RTCPeerConnection | undefined = (call as any)?.peerConnection;
        if (!pc) return;
        const bump = (why: string) => {
            log(`PC(${pretty(remotePeerId)}) ${why}, retry...`);
            try { call.close(); } catch { }
            mediaConnsRef.current.delete(remotePeerId);
            setTimeout(() => startMediaCall(remotePeerId), 250);
        };
        pc.onconnectionstatechange = () => {
            const st = pc.connectionState;
            if (st === "failed" || st === "disconnected") bump(`state=${st}`);
        };
        pc.oniceconnectionstatechange = () => {
            const st = pc.iceConnectionState;
            if (st === "failed" || st === "disconnected") bump(`ice=${st}`);
        };
    };

    /** Volume attenuation by zone & distance */
    const calcAudibility = (meTx: number, meTy: number, pTx: number, pTy: number) => {
        const myRule = audioRuleAt(meTx, meTy);
        const hisRule = audioRuleAt(pTx, pTy);

        if (myRule.kind === "room") {
            const same = hisRule.kind === "room" && hisRule.zoneId === myRule.zoneId;
            return { audible: same, vol: same ? 1 : 0 };
        }

        if (hisRule.kind === "room") return { audible: false, vol: 0 };

        const R = myRule.kind === "radius" ? myRule.radius : DEFAULT_AUDIO_RADIUS_TILES;
        const d = Math.max(Math.abs(pTx - meTx), Math.abs(pTy - meTy));
        if (d > R) return { audible: false, vol: 0 };

        const t = Math.min(1, d / Math.max(1, R));
        const vol = clamp(1 - t * t * 0.85, 0.18, 1);
        return { audible: true, vol };
    };

    /** Attach/maintain MediaConnection */
    const hookMediaConn = (remotePeerId: string, call: MediaConnection) => {
        const old = mediaConnsRef.current.get(remotePeerId);
        if (old && old !== call) {
            try { old.close(); } catch { }
            mediaConnsRef.current.delete(remotePeerId);
        }
        mediaConnsRef.current.set(remotePeerId, call);
        watchPeerConn(remotePeerId, call);

        call.on("stream", (remoteStream) => {
            let el = remoteAudiosRef.current[remotePeerId];
            if (!el) {
                el = document.createElement("audio");
                el.autoplay = true;
                (el as any).playsInline = true;
                el.muted = true;
                el.volume = 1;
                document.body.appendChild(el);
                remoteAudiosRef.current[remotePeerId] = el;
            }

            el.srcObject = remoteStream;
            attachRemoteAnalyser(remotePeerId, remoteStream);
            el.play?.().catch(() => { });

            try {
                const me = meRef.current;
                const { col: meTx, row: meTy } = centerTileOf(me.x, me.y);
                const p = othersRef.current[remotePeerId];
                if (p) {
                    const { col: pTx, row: pTy } = centerTileOf(p.x, p.y);
                    const { audible, vol } = calcAudibility(meTx, meTy, pTx, pTy);
                    const forceMute = !!remoteUserMutedRef.current[remotePeerId];
                    el.muted = !(audible && !forceMute);
                    el.volume = audible ? vol : 0;
                }
            } catch { }

            tryPlayAllRemote();
        });

        call.on("close", () => {
            mediaConnsRef.current.delete(remotePeerId);

            const el = remoteAudiosRef.current[remotePeerId];
            try { el?.pause(); if (el) (el as any).srcObject = null; el?.remove(); } catch { }
            remoteAudiosRef.current[remotePeerId] = null;

            try { remoteSourceRef.current[remotePeerId]?.disconnect(); } catch { }
            remoteSourceRef.current[remotePeerId] = null;
            remoteAnalyserRef.current[remotePeerId] = null;
            remoteLevelRef.current[remotePeerId] = 0;

            setTimeout(() => {
                if (!mediaConnsRef.current.has(remotePeerId)) startMediaCall(remotePeerId);
            }, 220);
        });

        call.on("error", (e) => {
            log(`audio error ${pretty(remotePeerId)}: ${String((e as any)?.message || e)}`);
        });
    };

    /** Small helper so our keyboard/mouse gesture also unlocks audio */
    const isEditableTarget = (e: KeyboardEvent) => {
        const t = (e.target as HTMLElement) || null;
        if (!t) return false;
        if (t.isContentEditable) return true;
        const tag = (t.tagName || "").toLowerCase();
        return tag === "input" || tag === "textarea" || tag === "select";
    };

    /** Live mic level meter (only while panel open) */
    const [micLevel, setMicLevel] = useState(0);
    useEffect(() => {
        let raf = 0;
        const loop = () => {
            if (showMicSettings) {
                setMicLevel(computeLevel(localAnalyserRef.current));
                raf = requestAnimationFrame(loop);
            }
        };
        if (showMicSettings) raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [showMicSettings]);


    /** ===== Proximity gating + attenuation (called every frame) ===== */
    const updateAudioZones = () => {
        const me = meRef.current;
        const { col: meTx, row: meTy } = centerTileOf(me.x, me.y);

        for (const rid of Object.keys(remoteAudiosRef.current)) {
            const el = remoteAudiosRef.current[rid];
            if (!el) continue;

            const p = othersRef.current[rid];
            const forceMute = !!remoteUserMutedRef.current[rid];

            if (!p) { el.muted = true; continue; }

            const { col: pTx, row: pTy } = centerTileOf(p.x, p.y);
            const { audible, vol } = calcAudibility(meTx, meTy, pTx, pTy);

            const shouldPlay = audible && !forceMute;
            if (shouldPlay) {
                if (el.muted) {
                    el.muted = false;
                    el.play?.().catch(() => { });
                }
                el.volume = vol;
            } else {
                if (!el.muted) el.muted = true;
                el.volume = 0;
            }
        }
    };

    /** Public util */
    const setPeerMuted = (peerId: string, muted: boolean) => {
        remoteUserMutedRef.current[peerId] = muted;
        const el = remoteAudiosRef.current[peerId];
        if (el) el.muted = muted || el.muted;
    };

    /** UX: make sure first interaction resumes AudioContext + tries to play audio */
    useEffect(() => {
        const unlock = async () => {
            try { await ensureAudioCtx().resume(); } catch { }
            tryPlayAllRemote();
        };
        const onPointer = () => unlock();
        const onKey = (e: KeyboardEvent) => { if (!isEditableTarget(e)) unlock(); };
        window.addEventListener("pointerdown", onPointer, { passive: true, capture: true });
        window.addEventListener("keydown", onKey, true);
        return () => {
            window.removeEventListener("pointerdown", onPointer, true as any);
            window.removeEventListener("keydown", onKey, true);
        };
    }, []);

    const chatPanelRef = useRef<HTMLDivElement | null>(null);
    const rightSidebarRef = useRef<HTMLDivElement | null>(null);
    const micPanelRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const onPointerDown = (e: PointerEvent) => {
            if (!(showChat || showSidebar || showMicSettings)) return;
            if (showOutfit) return;

            const target = e.target as HTMLElement | null;
            if (!target) return;
            if (target.closest("[data-no-dismiss]")) return;

            const inside = (ref: React.RefObject<HTMLElement>) =>
                !!ref.current && ref.current.contains(target);

            if (showMicSettings) {
                if (!inside(micPanelRef)) setShowMicSettings(false);
                return;
            }

            if (showChat || showSidebar) {
                const inChat = inside(chatPanelRef);
                const inSidebar = inside(rightSidebarRef);

                if (!inChat && !inSidebar) {
                    if (showChat) setShowChat(false);
                    if (showSidebar) setShowSidebar(false);
                }

                return;
            }
        };

        window.addEventListener("pointerdown", onPointerDown, true);
        return () => window.removeEventListener("pointerdown", onPointerDown, true);
    }, [showChat, showSidebar, showMicSettings, showOutfit]);

    /** ===== WORLD load ===== */
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const world = await loadWorldMap();
                if (mounted) {
                    worldRef.current = world;
                    scanDoors();
                    markDone("world");
                }
            } catch { worldRef.current = null; }
        })();
        return () => { mounted = false; };
    }, []);

    /** ===== Player assets load ===== */
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const parts = await loadSpriteParts();
                if (alive) { partsRef.current = parts; markDone("sprites"); }
                recomputeAllOutfits();
            } catch { }
        })();
        return () => { alive = false; };
    }, []);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const lib = await loadOutfitParts();
                if (!alive) return;
                outfitLibRef.current = lib;
                recomputeAllOutfits();
                if (!playerOutfitSlotsRef.current[myPeerId]) {
                    setOutfitSlotsFor(myPeerId, DEFAULT_OUTFIT);
                }
                markDone("outfit");
            } catch { }
        })();
        return () => { alive = false; };
    }, [myPeerId]);

    const recomputeOutfitFor = (pid: string) => {
        const lib = outfitLibRef.current || null;
        const slots = playerOutfitSlotsRef.current[pid] || DEFAULT_OUTFIT;
        playerOutfitPartsRef.current[pid] = buildActiveOutfit(lib, slots);
        outfitVersion.current++;
    };
    const setOutfitSlotsFor = (pid: string, slots: string[] | null | undefined) => {
        playerOutfitSlotsRef.current[pid] = normalizeSlots(slots);
        recomputeOutfitFor(pid);
    };

    /** ===== DOOR state ===== */
    const doorSetRef = useRef<Set<string>>(new Set());

    const scanDoors = () => {
        const s = new Set<string>();
        for (let r = 0; r < MAP_ROWS; r++) {
            for (let c = 0; c < MAP_COLS; c++) {
                if (isDoorId((wallLayout[r][c] | 0))) s.add(doorKey(c, r));
            }
        }
        doorSetRef.current = s;
    };

    const isDoorOpen = (c: number, r: number) => (wallLayout[r]?.[c] === DOOR_OPEN_ID);

    const rebuildWorld = async () => {
        try {
            const world = await loadWorldMap();
            worldRef.current = world;
        } catch { }
    };

    const canHearDoorAt = (doorCol: number, doorRow: number) => {
        const { col: myCol, row: myRow } = centerTileOf(meRef.current.x, meRef.current.y);
        const dCheb = Math.max(Math.abs(myCol - doorCol), Math.abs(myRow - doorRow));
        return dCheb <= DOOR_SFX_RADIUS_TILES;
    };

    // SFX open/close
    const sfxDoorOpenRef = useRef<HTMLAudioElement | null>(null);
    const sfxDoorCloseRef = useRef<HTMLAudioElement | null>(null);
    useEffect(() => {
        sfxDoorOpenRef.current = new Audio("/assets/audio/DOOR_OPEN.mp3");
        sfxDoorCloseRef.current = new Audio("/assets/audio/DOOR_CLOSE.mp3");
        [sfxDoorOpenRef.current, sfxDoorCloseRef.current].forEach(a => {
            if (!a) return;
            a.preload = "auto";
            a.volume = 0.7;
            (a as any).playsInline = true;
        });
    }, []);
    const playDoorSfx = (open: boolean) => {
        const base = open ? sfxDoorOpenRef.current : sfxDoorCloseRef.current;
        if (!base) return;
        try {
            const el = base.cloneNode(true) as HTMLAudioElement;
            el.volume = base.volume;
            el.play().catch(() => { });
        } catch { }
    };

    const setDoor = async (c: number, r: number, open: boolean, opts?: { silent?: boolean }) => {
        if (r < 0 || r >= MAP_ROWS || c < 0 || c >= MAP_COLS) return false;

        const prev = wallLayout[r][c] | 0;
        const next = open ? DOOR_OPEN_ID : DOOR_CLOSED_ID;
        const changed = prev !== next;

        wallLayout[r][c] = next;
        const tr = r - 1;
        if (tr >= 0) {
            topLayout[tr][c] = open ? TOP_DOOR_OPEN_ID : TOP_DOOR_CLOSED_ID;
        }

        doorSetRef.current.add(doorKey(c, r));

        if (changed && !opts?.silent && canHearDoorAt(c, r)) {
            playDoorSfx(open);
        }

        await rebuildWorld();
        return changed;
    };

    const findAdjacentDoor = (tc: number, tr: number): { col: number; row: number; open: boolean } | null => {
        const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
        for (const [dx, dy] of dirs) {
            const c = tc + dx, r = tr + dy;
            if (r < 0 || r >= MAP_ROWS || c < 0 || c >= MAP_COLS) continue;
            const id = wallLayout[r][c] | 0;
            if (isDoorId(id)) return { col: c, row: r, open: id === DOOR_OPEN_ID };
        }
        return null;
    };

    const broadcastDoor = (col: number, row: number, open: boolean) => {
        const wire: Msg = { t: "door", col, row, open };
        for (const [, c] of connsRef.current) if (c.open) { try { c.send(wire); } catch { } }
    };
    const sendDoorSnapshotTo = (peerId: string) => {
        const conn = connsRef.current.get(peerId);
        if (!conn || !conn.open) return;
        for (const key of doorSetRef.current) {
            const [cStr, rStr] = key.split(",");
            const c = Number(cStr), r = Number(rStr);
            const open = isDoorOpen(c, r);
            const msg: Msg = { t: "door", col: c, row: r, open, silent: true };
            try { conn.send(msg); } catch { }
        }
    };

    /** ===== LOADING overlay progress ===== */
    type StageKey = "join" | "world" | "sprites" | "outfit" | "peerOpen" | "peers";

    const STAGE_WEIGHTS: Record<StageKey, number> = {
        join: 10,
        world: 20,
        sprites: 12,
        outfit: 13,
        peerOpen: 20,
        peers: 25,
    };

    const [showLoader, setShowLoader] = useState<boolean>(true);
    const [showPixelReveal, setShowPixelReveal] = useState<boolean>(false);
    const [subtext, setSubtext] = useState<string>("Loading...");
    const [percentText, setPercentText] = useState<number>(0);
    const [uiPct, setUiPct] = useState(0);
    const loaderVisibleRef = useRef(false);
    const widthPct = `${uiPct}%`;

    useEffect(() => {
        if (showLoader) {
            if (!loaderVisibleRef.current) {
                loaderVisibleRef.current = true;
                setUiPct(0);
            }
        } else {
            loaderVisibleRef.current = false;
            setUiPct(0);
        }
    }, [showLoader]);

    useEffect(() => {
        setUiPct(prev => (percentText > prev ? percentText : prev));
    }, [percentText]);

    const expectedPeersRef = useRef<Set<string>>(new Set());
    const connectedPeersRef = useRef<Set<string>>(new Set());
    const loaderDoneRef = useRef<boolean>(false);
    const maxExpectedPeersRef = useRef<number>(1);
    const peersPctRef = useRef<number>(0);
    const progressGenRef = useRef<number>(0);

    const startProgressSession = React.useCallback(() => {
        progressGenRef.current++;
        targetPctRef.current = 0;
        peersPctRef.current = 0;
        maxExpectedPeersRef.current = Math.max(1, expectedPeersRef.current.size || 1);
        setPercentText(0);
    }, []);

    const stageDoneRef = useRef<Record<Exclude<StageKey, "peers">, boolean>>({
        join: false,
        world: false,
        sprites: false,
        outfit: false,
        peerOpen: false,
    });

    const targetPctRef = useRef<number>(0);
    const setStatus = (msg: string) => setSubtext(msg);

    const recomputeProgress = () => {
        let pctBase = 0;
        pctBase += stageDoneRef.current.join ? STAGE_WEIGHTS.join : 0;
        pctBase += stageDoneRef.current.world ? STAGE_WEIGHTS.world : 0;
        pctBase += stageDoneRef.current.sprites ? STAGE_WEIGHTS.sprites : 0;
        pctBase += stageDoneRef.current.outfit ? STAGE_WEIGHTS.outfit : 0;
        pctBase += stageDoneRef.current.peerOpen ? STAGE_WEIGHTS.peerOpen : 0;

        const totalPeersExpected = Math.max(1, expectedPeersRef.current.size);
        maxExpectedPeersRef.current = Math.max(maxExpectedPeersRef.current, totalPeersExpected);
        const currPeers = Math.min(connectedPeersRef.current.size, totalPeersExpected);

        const peersRaw = (currPeers / Math.max(1, maxExpectedPeersRef.current)) * STAGE_WEIGHTS.peers;
        peersPctRef.current = Math.max(peersPctRef.current, peersRaw);

        const pct = pctBase + peersPctRef.current;

        const allDone =
            stageDoneRef.current.join &&
            stageDoneRef.current.world &&
            stageDoneRef.current.sprites &&
            stageDoneRef.current.outfit &&
            stageDoneRef.current.peerOpen &&
            currPeers >= totalPeersExpected;

        const newTarget = allDone ? 100 : Math.min(99, Math.floor(pct));
        targetPctRef.current = Math.max(targetPctRef.current, newTarget);

        if (!stageDoneRef.current.join) setStatus("Checking access...");
        else if (!stageDoneRef.current.world) setStatus("Building the world...");
        else if (!stageDoneRef.current.sprites || !stageDoneRef.current.outfit) setStatus("Customizing your avatar...");
        else if (!stageDoneRef.current.peerOpen) setStatus("Booting voice & chat...");
        else if (currPeers < totalPeersExpected) setStatus("Syncing players...");
        else setStatus("All set!");

        if (allDone && !loaderDoneRef.current) {
            loaderDoneRef.current = true;
            setTimeout(() => {
                setShowPixelReveal(true);
                setShowLoader(false);
            }, 350);
        }
    };

    useEffect(() => {
        let lastGen = progressGenRef.current;
        const id = setInterval(() => {
            if (progressGenRef.current !== lastGen) {
                lastGen = progressGenRef.current;
                setPercentText(0);
                return;
            }
            setPercentText(prev => {
                const t = targetPctRef.current;
                if (t <= prev) return prev;
                const step = Math.max(1, Math.ceil((t - prev) * 0.2));
                return Math.min(t, prev + step);
            });
        }, 80);
        return () => clearInterval(id);
    }, []);

    const markDone = (k: Exclude<StageKey, "peers">) => {
        if (!stageDoneRef.current[k]) {
            stageDoneRef.current[k] = true;
            recomputeProgress();
        }
    };

    const setPeersTargets = (ids: string[]) => {
        expectedPeersRef.current = new Set(ids);
        connectedPeersRef.current.clear();
        maxExpectedPeersRef.current = Math.max(maxExpectedPeersRef.current, ids.length || 1);
        setStatus(ids.length > 1 ? "Syncing players..." : "Warming up...");
        recomputeProgress();
    };

    const markPeerConnected = (peerId: string) => {
        if (expectedPeersRef.current.has(peerId) && !connectedPeersRef.current.has(peerId)) {
            connectedPeersRef.current.add(peerId);
            recomputeProgress();
        }
    };

    /** ===== INIT + join backend ===== */
    const dialedPosRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!roomId) { navigate("/dashboard", { replace: true }); return; }
        if (authLoading) return;
        if (!isAuthenticated || !principalId) {
            const nextPath = `/room/${roomId}`;
            sessionStorage.setItem('next', nextPath);
            setShowLoader(false);
            setShowPixelReveal(false);
            navigate(`/profile?next=${encodeURIComponent(nextPath)}`, { replace: true });
            return;
        }

        if (needsMicGate) {
            setShowLoader(false);
            setShowPixelReveal(false);
            return;
        }
        if (!nameReady) {
            setShowLoader(true);
            setShowPixelReveal(false);
            setStatus("Getting your profile...");
            return;
        }

        if (creatingRef.current || peerRef.current || closingRef.current) return;

        creatingRef.current = true;
        let cancelled = false;

        setShowLoader(true);
        setShowPixelReveal(false);
        loaderDoneRef.current = false;
        expectedPeersRef.current = new Set();
        connectedPeersRef.current = new Set();
        startProgressSession();
        setStatus("Checking access...");
        recomputeProgress();

        (async () => {
            try {
                const jr = await joinRoom(roomId);
                if (!("Ok" in jr)) { return; }
                if (cancelled) return;
                joinedRef.current = true;
                markDone("join");
                setStatus("Preparing the stage...");

                const room = await getRoom(roomId);
                const principals = (room?.participants || []).map(principalToText);
                let targetsPeerIds = principals
                    .filter((pt) => pt && pt !== myPrincipalTxt)
                    .map((pt) => peerIdForPrincipal(roomId, pt));

                if (targetsPeerIds.length === 0) targetsPeerIds = [myPeerId];

                setPeersTargets(targetsPeerIds);

                if (cancelled) return;

                const peer = await createPeerWithRetry(myPeerId, 4);
                if (!peer) {
                    try { await leaveRoom(roomId); } catch { }
                    joinedRef.current = false;
                    return;
                }
                if (cancelled) { await destroyPeerCompletely(peer); return; }
                peerRef.current = peer;
                markDone("peerOpen");
                setStatus("Almost there...");

                if (expectedPeersRef.current.has(myPeerId)) {
                    markPeerConnected(myPeerId);
                }

                ensureSelfInRoster();

                for (const rid of targetsPeerIds) {
                    if (rid === myPeerId) continue;
                    if (connsRef.current.has(rid)) continue;

                    const dc = peer.connect(rid, { label: "pos", reliable: true, serialization: "json" });
                    dialedPosRef.current.add(rid);
                    hookGameConn(rid, dc);

                    const chat = peer.connect(rid, { label: "chat", reliable: true, serialization: "json" });
                    hookChatConn(rid, chat);
                }

                const onConnection = (conn: DataConnection) => {
                    const remotePeerId = conn.peer;
                    if (conn.label === "pos") {
                        rosterRef.current.set(remotePeerId, principalFromPeerId(roomId, remotePeerId));
                        refreshRtcUI();
                        hookGameConn(remotePeerId, conn);
                        return;
                    }
                    if (conn.label === "chat") {
                        hookChatConn(remotePeerId, conn);
                        return;
                    }
                    hookGameConn(remotePeerId, conn);
                };
                const onDisconnected = () => {
                    if (closingRef.current) return;
                    try { peer.reconnect(); } catch { }
                };
                const onClose = () => log("Peer closed");
                const onError = (err: any) => log(`Peer error: ${String(err?.message || err)}`);
                const onCall = (call: MediaConnection) => {
                    const rid = call.peer;
                    rosterRef.current.set(rid, principalFromPeerId(roomId, rid));
                    refreshRtcUI();
                    void resolveRemoteProfile(rid);
                    answerMediaCall(rid, call);
                };

                handlersRef.current = { onConnection, onDisconnected, onClose, onError, onCall };
                peer.on("connection", onConnection);
                peer.on("disconnected", onDisconnected);
                peer.on("close", onClose);
                peer.on("error", onError);
                peer.on("call", onCall);
            } finally {
                creatingRef.current = false;
            }
        })();

        const onPageHide = () => { void gracefulLeave(); };
        const onBeforeUnload = () => { void gracefulLeave(); };
        window.addEventListener("pagehide", onPageHide);
        window.addEventListener("beforeunload", onBeforeUnload);

        return () => {
            cancelled = true;
            window.removeEventListener("pagehide", onPageHide);
            window.removeEventListener("beforeunload", onBeforeUnload);
            void gracefulLeave();
        };
    }, [roomId, isAuthenticated, principalId, authLoading, myPeerId, nameReady, needsMicGate]);

    /** Destroy Peer and wait for close */
    const destroyPeerCompletely = (peer: Peer | null, timeoutMs = 1500) =>
        new Promise<void>((resolve) => {
            if (!peer) return resolve();
            let done = false;
            const finish = () => { if (!done) { done = true; resolve(); } };

            try {
                const h = handlersRef.current;
                if (h.onConnection) peer.off("connection", h.onConnection);
                if (h.onDisconnected) peer.off("disconnected", h.onDisconnected);
                if (h.onClose) peer.off("close", h.onClose);
                if (h.onError) peer.off("error", h.onError);
                if (h.onCall) peer.off("call", h.onCall);
                handlersRef.current = {};
            } catch { }

            const to = setTimeout(finish, timeoutMs);
            const onClose = () => { clearTimeout(to); finish(); };
            const onDisc = () => { clearTimeout(to); finish(); };
            const onErr = () => { clearTimeout(to); finish(); };

            try {
                peer.once("close", onClose);
                peer.once("disconnected", onDisc);
                peer.once("error", onErr);
                try { peer.disconnect(); } catch { }
                try { peer.destroy(); } catch { }
            } catch {
                clearTimeout(to);
                finish();
            }
        });

    /** LEAVE */
    const gracefulLeave = async () => {
        if (closingRef.current) return;
        closingRef.current = true;
        try {
            if (joinedRef.current) { try { await leaveRoom(roomId); } catch { } }
            joinedRef.current = false;

            for (const [, c] of connsRef.current) {
                try { c.send({ t: "bye", peerId: myPeerId } as Msg); } catch { }
                try { c.close(); } catch { }
            }
            for (const [, c] of chatConnsRef.current) { try { c.close(); } catch { } }
            connsRef.current.clear(); chatConnsRef.current.clear();

            for (const [, mc] of mediaConnsRef.current) { try { mc.close(); } catch { } }
            mediaConnsRef.current.clear();

            for (const k of Object.keys(remoteAudiosRef.current)) {
                const el = remoteAudiosRef.current[k];
                try { el?.pause(); if (el) (el as any).srcObject = null; el?.remove(); } catch { }
                remoteAudiosRef.current[k] = null;
            }
            closeMic();

            try { localSourceRef.current?.disconnect(); } catch { }
            localSourceRef.current = null;
            localAnalyserRef.current = null;

            for (const k of Object.keys(remoteSourceRef.current)) {
                try { remoteSourceRef.current[k]?.disconnect(); } catch { }
                remoteSourceRef.current[k] = null;
                remoteAnalyserRef.current[k] = null;
            }

            othersRef.current = {};
            rosterRef.current.clear();
            refreshRtcUI();

            const p = peerRef.current;
            await destroyPeerCompletely(p);
            peerRef.current = null;

            setChatLog([]);
            chatBubbleRef.current = {};

            await new Promise((r) => setTimeout(r, 250));
        } finally {
            creatingRef.current = false;
            closingRef.current = false;
        }
    };

    /** Helper: create Peer with a small retry if "ID is taken" */
    const createPeerWithRetry = async (id: string, tries = 4): Promise<Peer | null> => {
        for (let i = 0; i < tries; i++) {
            const peer = new Peer(id, { debug: 1, config: rtcConfig });
            const opened = await new Promise<boolean>((resolve) => {
                const onOpen = () => { cleanup(); resolve(true); };
                const onError = (err: any) => {
                    const msg = String(err?.message || err);
                    cleanup();
                    if (/unavailable-id|is taken|taken/i.test(msg)) resolve(false);
                    else { resolve(false); }
                };
                const cleanup = () => { peer.off("open", onOpen); peer.off("error", onError); };
                peer.once("open", onOpen);
                peer.once("error", onError);
            });
            if (opened) return peer;
            try { await destroyPeerCompletely(peer); } catch { }
            await new Promise((r) => setTimeout(r, 400 + i * 300));
        }
        return null;
    };

    /** hook Game DC */
    const hookGameConn = (remotePeerId: string, conn: DataConnection) => {
        connsRef.current.set(remotePeerId, conn);

        conn.on("open", () => {
            if (!rosterRef.current.has(remotePeerId)) {
                rosterRef.current.set(remotePeerId, principalFromPeerId(roomId, remotePeerId));
                refreshRtcUI();
            }
            void resolveRemoteProfile(remotePeerId);

            markPeerConnected(remotePeerId);

            try { conn.send({ t: "hello", peerId: myPeerId, principal: myPrincipalTxt } as Msg); } catch { }

            try {
                const movingNow = !!(keysRef.current.left || keysRef.current.right || keysRef.current.up || keysRef.current.down);
                const face = faceDirRef.current[myPeerId] ?? 1;
                conn.send({ t: "pos", x: meRef.current.x, y: meRef.current.y, moving: movingNow, face } as Msg);
            } catch { }

            try {
                const slots = playerOutfitSlotsRef.current[myPeerId] || DEFAULT_OUTFIT;
                const meta: MetaMsg = { t: "meta", outfit: slots };
                const labelNow = myLabelRef.current;
                if (labelNow) {
                    meta.label = labelNow;
                }
                conn.send(meta);
            } catch { }

            try { conn.send({ t: "media-refresh", why: "manual" } as Msg); } catch { }

            setTimeout(() => {
                try {
                    const slots = playerOutfitSlotsRef.current[myPeerId] || DEFAULT_OUTFIT;
                    const meta: MetaMsg = { t: "meta", outfit: slots, label: myLabelRef.current || undefined };
                    conn.send(meta);
                } catch { }
            }, 500);

            if (conn.label === "pos" && dialedPosRef.current.has(remotePeerId)) {
                try { conn.send({ t: "door-sync-req" } as Msg); } catch { }
            }

            const peer = peerRef.current;
            if (peer && !chatConnsRef.current.has(remotePeerId)) {
                const dcChat = peer.connect(remotePeerId, { label: "chat", reliable: true, serialization: "json" });
                hookChatConn(remotePeerId, dcChat);
            }

            startMediaCall(remotePeerId);
        });

        conn.on("data", (raw) => {
            const m = raw as Msg;
            if (!m || typeof m !== "object") return;

            if (m.t === "hello") {
                rosterRef.current.set(remotePeerId, (m as any).principal || principalFromPeerId(roomId, remotePeerId));
                refreshRtcUI();
            } else if (m.t === "meta") {
                if (typeof m.label === "string") {
                    labelCacheRef.current[remotePeerId] = m.label.trim().slice(0, 24);
                }
                if (Array.isArray((m as any).outfit)) {
                    setOutfitSlotsFor(remotePeerId, (m as any).outfit);
                }
                setLabelsVersion(v => v + 1);
                refreshRtcUI();
            }
            else if (m.t === "pos") {
                othersRef.current[remotePeerId] = { x: m.x, y: m.y };
                if (m.face === 1 || m.face === -1) faceDirRef.current[remotePeerId] = m.face;
                if (typeof m.moving === "boolean") remoteMovingRef.current[remotePeerId] = m.moving;
                lastPosAtRef.current[remotePeerId] = performance.now();
            } else if (m.t === "bye") {
                delete othersRef.current[remotePeerId];
                connsRef.current.get(remotePeerId)?.close();
                rosterRef.current.delete(remotePeerId);
                refreshRtcUI();
            } else if (m.t === "chat") {
                handleInboundChat(remotePeerId, m);
            } else if (m.t === "media-refresh") {
                if (!mediaConnsRef.current.has(remotePeerId)) {
                    startMediaCall(remotePeerId);
                }
            } else if (m.t === "door") {
                void setDoor(m.col, m.row, m.open, { silent: !!m.silent });
            } else if (m.t === "door-sync-req") {
                sendDoorSnapshotTo(remotePeerId);
            } else if (m.t === "spin") {
                const dur = typeof m.dur === "number" ? m.dur : ARM_SPIN_MS;
                triggerArmSpin(remotePeerId, dur);
            }
        });

        conn.on("close", () => {
            delete othersRef.current[remotePeerId];
            connsRef.current.delete(remotePeerId);
            rosterRef.current.delete(remotePeerId);
            dialedPosRef.current.delete(remotePeerId);
            refreshRtcUI();

            try { mediaConnsRef.current.get(remotePeerId)?.close(); } catch { }
            mediaConnsRef.current.delete(remotePeerId);
            const el = remoteAudiosRef.current[remotePeerId];
            try { el?.pause(); if (el) (el as any).srcObject = null; el?.remove(); } catch { }
            remoteAudiosRef.current[remotePeerId] = null;

            try { remoteSourceRef.current[remotePeerId]?.disconnect(); } catch { }
            remoteSourceRef.current[remotePeerId] = null;
            remoteAnalyserRef.current[remotePeerId] = null;
            remoteLevelRef.current[remotePeerId] = 0;
        });

        conn.on("error", (err: any) => {
            log(`DC(game) error ${pretty(remotePeerId)}: ${String(err?.message || err)}`);
        });
    };

    /** hook Chat DC */
    const hookChatConn = (remotePeerId: string, conn: DataConnection) => {
        chatConnsRef.current.set(remotePeerId, conn);
        conn.on("open", () => log(`DC(chat) open ${pretty(remotePeerId)}`));
        conn.on("data", (raw) => {
            try { const m = raw as Msg; if (m?.t === "chat") handleInboundChat(remotePeerId, m); } catch { }
        });
        conn.on("close", () => { log(`DC(chat) close ${pretty(remotePeerId)}`); chatConnsRef.current.delete(remotePeerId); });
        conn.on("error", (err: any) => log(`DC(chat) error ${pretty(remotePeerId)}: ${String(err?.message || err)}`));
    };



    /** ===== Input & render loop ===== */
    useEffect(() => {
        const cvs = canvasRef.current; if (!cvs) return;
        const DPR = window.devicePixelRatio || 1;

        const resize = () => {
            const w = window.innerWidth, h = window.innerHeight;
            cvs.width = Math.floor(w * DPR);
            cvs.height = Math.floor(h * DPR);
            cvs.style.width = w + "px";
            cvs.style.height = h + "px";

            setZoomTarget(zoomTargetRef.current);
        };

        resize(); window.addEventListener("resize", resize);

        const onPointerMove = (e: PointerEvent) => {
            lastPointerRef.current.x = e.clientX;
            lastPointerRef.current.y = e.clientY;
        };
        cvs.addEventListener("pointermove", onPointerMove, { passive: true });

        const onWheel = (e: WheelEvent) => {
            if (!(e.ctrlKey || e.metaKey)) return;
            e.preventDefault();
            const dir = -e.deltaY;
            const factor = Math.exp(dir * WHEEL_SENS);
            setZoomTarget(zoomTargetRef.current * factor);
        };
        cvs.addEventListener("wheel", onWheel, { passive: false });

        // pointer gesture -> spin
        const onDown = (e: PointerEvent) => {
            if (e.button !== 0) return;
            ensureAudioCtx()?.resume().catch(() => { });
            triggerArmSpin(myPeerId);
            const spin: SpinMsg = { t: "spin", dur: ARM_SPIN_MS };
            for (const [, c] of connsRef.current) if (c.open) { try { c.send(spin); } catch { } }
        };
        cvs.addEventListener("pointerdown", onDown);

        // anim state per peer
        type AnimState = { phase: number; amp: number; lastX: number; lastY: number };
        const animRef = { current: {} as Record<string, AnimState> };

        const updateAnimFor = (pid: string, p: PlayerPos, dt: number, movingHint?: boolean): AnimSample => {
            const st = (animRef.current[pid] ||= { phase: 0, amp: 0, lastX: p.x, lastY: p.y });
            const dx = p.x - st.lastX;
            const dy = p.y - st.lastY;
            const speed = Math.hypot(dx, dy) / Math.max(dt, 1e-6);
            const MOVING = movingHint ?? speed > 1;

            const WALK_CPS = 2.5;
            if (MOVING) st.phase += dt * (Math.PI * 2) * WALK_CPS;
            if (st.phase > Math.PI * 2000) st.phase -= Math.PI * 2000;

            const target = MOVING ? 1 : 0;
            const ease = 8;
            st.amp += (target - st.amp) * Math.min(1, dt * ease);

            st.lastX = p.x; st.lastY = p.y;
            return { phase: st.phase, amp: st.amp };
        };

        const step = (t: number) => {
            let dt = (t - lastRef.current) / 1000;
            if (dt > 0.05) dt = 0.05;
            lastRef.current = t;

            // Input / Movement
            const k = keysRef.current;
            let vx = 0, vy = 0;
            if (k.left) vx -= 1;
            if (k.right) vx += 1;
            if (k.up) vy -= 1;
            if (k.down) vy += 1;

            if (vx || vy) {
                const len = Math.hypot(vx, vy) || 1;
                vx /= len; vy /= len;

                const dx = vx * SPEED * dt;
                const dy = vy * SPEED * dt;

                const solved = resolveMove(
                    meRef.current.x + HITBOX_LEFT,
                    meRef.current.y + HITBOX_TOP,
                    HITBOX_W, HITBOX_H,
                    dx, dy
                );

                meRef.current.x = solved.x - HITBOX_LEFT;
                meRef.current.y = solved.y - HITBOX_TOP;
            }

            // Face direction (left/right)
            if (k.left && !k.right) faceDirRef.current[myPeerId] = -1;
            else if (k.right && !k.left) faceDirRef.current[myPeerId] = 1;

            // broadcast pos @15Hz
            sendAccRef.current += dt;
            if (sendAccRef.current >= 1 / 15) {
                sendAccRef.current = 0;
                broadcastPos();
            }

            /** ===== SPEAKING/VAD INDICATOR ===== */
            const computeLevelNow = () => {
                localLevelRef.current = computeLevel(localAnalyserRef.current);
                for (const [rid, an] of Object.entries(remoteAnalyserRef.current)) {
                    remoteLevelRef.current[rid] = computeLevel(an);
                }
            };
            computeLevelNow();

            const nowMs = performance.now();
            const BLINK = (pid: string, speaking: boolean) => {
                const last = lastBlinkAtRef.current[pid] || 0;
                if (speaking) {
                    if (nowMs - last >= BLINK_MS) {
                        talkBlinkRef.current[pid] = !talkBlinkRef.current[pid];
                        lastBlinkAtRef.current[pid] = nowMs;
                    }
                } else {
                    talkBlinkRef.current[pid] = false;
                    lastBlinkAtRef.current[pid] = nowMs;
                }
            };
            const SPK = (lvl: number) => (lvl || 0) > SPK_THRESHOLD;
            BLINK(myPeerId, SPK(localLevelRef.current) || nowMs < (chatTalkUntilRef.current[myPeerId] || 0));
            for (const rid of Object.keys(remoteLevelRef.current)) {
                BLINK(rid, SPK(remoteLevelRef.current[rid]) || nowMs < (chatTalkUntilRef.current[rid] || 0));
            }

            // === Camera & Zoom === 
            const DPR = window.devicePixelRatio || 1;
            const cvs = canvasRef.current!;
            const ctx = cvs.getContext("2d")!;

            const viewW = cvs.width / DPR;
            const viewH = cvs.height / DPR;

            // smooth-lerp zoomActual -> zoomTarget
            const zNow = zoomActualRef.current;
            const zTgt = zoomTargetRef.current;
            const zNext = zNow + (zTgt - zNow) * Math.min(1, dt * ZOOM_LERP);
            zoomActualRef.current = zNext;

            const z = zoomActualRef.current;

            // World size after zoom (in screen px)
            const worldWpx = CANVAS_W * z;
            const worldHpx = CANVAS_H * z;

            // Letterbox padding when world < viewport
            const padX = Math.max(0, (viewW - worldWpx) / 2);
            const padY = Math.max(0, (viewH - worldHpx) / 2);

            // Viewport in world units (px), clamped to world
            const vpW = Math.min(viewW / z, CANVAS_W);
            const vpH = Math.min(viewH / z, CANVAS_H);

            // Camera follows the player; clamped to world
            let camX = 0, camY = 0;
            const canScrollX = vpW < CANVAS_W;
            const canScrollY = vpH < CANVAS_H;
            const me = meRef.current;

            if (canScrollX) camX = clamp(me.x + PLAYER / 2 - vpW / 2, 0, CANVAS_W - vpW);
            if (canScrollY) camY = clamp(me.y + PLAYER / 2 - vpH / 2, 0, CANVAS_H - vpH);

            // On-screen draw rect (rounded to avoid shimmer)
            const destW = Math.floor(vpW * z);
            const destH = Math.floor(vpH * z);
            const dstX = Math.floor(padX);
            const dstY = Math.floor(padY);

            // === DRAW ===
            ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
            ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, viewW, viewH);

            const world = worldRef.current;

            // Floor
            if (world) {
                ctx.drawImage(world.floor, camX, camY, vpW, vpH, dstX, dstY, destW, destH);
            } else {
                ctx.fillStyle = "#0b1220";
                ctx.fillRect(0, 0, viewW, viewH);
            }

            // Build render list
            type Renderable = {
                pid: string;
                sx: number; sy: number;
                scale: number;
                anim: AnimSample;
                flipX: boolean;
                label: string;
                face: FaceState;
                overrides?: { armFrontRot?: number; armBackRot?: number };
            };
            const renderList: Renderable[] = [];

            const parts = partsRef.current;
            const spriteScale = Math.ceil(PLAYER * z) / PLAYER;
            const NET_LAG_GRACE_MS = 220;

            // others
            for (const [rid, p] of Object.entries(othersRef.current)) {
                const sx = Math.floor(padX + (p.x - camX) * z);
                const sy = Math.floor(padY + (p.y - camY) * z);

                const movingHint =
                    remoteMovingRef.current[rid] === true &&
                    (nowMs - (lastPosAtRef.current[rid] || 0) < NET_LAG_GRACE_MS);

                const anim = (window as any).noopAnim
                    ? { phase: 0, amp: 0 }
                    : updateAnimFor(rid, p, dt, movingHint);

                const flipX = (faceDirRef.current[rid] ?? 1) === -1;
                const speaking = SPK(remoteLevelRef.current[rid] || 0) || nowMs < (chatTalkUntilRef.current[rid] || 0);
                const blink = speaking ? ((nowMs / 200) % 2 < 1 ? true : false) : !!talkBlinkRef.current[rid];

                renderList.push({
                    pid: rid,
                    sx, sy,
                    scale: spriteScale,
                    anim,
                    flipX,
                    label: displayNameFor(rid),
                    face: { speaking, talkBlink: blink },
                    overrides: getArmSpinOverride(rid, flipX, nowMs),
                });
            }

            // Local player
            {
                const p = meRef.current;
                const sx = Math.floor(padX + (p.x - camX) * z);
                const sy = Math.floor(padY + (p.y - camY) * z);

                const anim = updateAnimFor(myPeerId, p, dt, !!(k.left || k.right || k.up || k.down));
                const flipX = (faceDirRef.current[myPeerId] ?? 1) === -1;
                const speaking = SPK(localLevelRef.current || 0) || nowMs < (chatTalkUntilRef.current[myPeerId] || 0);
                const blink = speaking ? ((nowMs / 200) % 2 < 1 ? true : false) : !!talkBlinkRef.current[myPeerId];

                renderList.push({
                    pid: myPeerId,
                    sx, sy,
                    scale: spriteScale,
                    anim,
                    flipX,
                    label: myLabelRef.current,
                    face: { speaking, talkBlink: blink },
                    overrides: getArmSpinOverride(myPeerId, flipX, nowMs),
                });
            }

            // sort by Y for proper overlap
            renderList.sort((a, b) => a.sy - b.sy);

            // SHADOW PLAYERS
            if (parts) {
                for (const r of renderList) {
                    drawPlayerShadow(ctx, parts, r.sx, r.sy, r.scale, r.anim, r.flipX, playerOutfitPartsRef.current[r.pid], r.face, r.overrides);
                }
            }

            // WORLD SHADOW/WALL/OBJECT
            if (world) {
                ctx.drawImage(world.shadow, camX, camY, vpW, vpH, dstX, dstY, destW, destH);
                ctx.drawImage(world.wall, camX, camY, vpW, vpH, dstX, dstY, destW, destH);
                ctx.drawImage(world.object, camX, camY, vpW, vpH, dstX, dstY, destW, destH);
            }

            // PLAYERS
            if (parts) {
                for (const r of renderList) {
                    drawPlayerSprite(ctx, parts, r.sx, r.sy, r.scale, r.anim, r.flipX, playerOutfitPartsRef.current[r.pid], r.face, r.overrides);
                }
            } else {
                for (const r of renderList) {
                    ctx.fillStyle = r.pid === myPeerId ? "#84cc16" : "#60a5fa";
                    const wpx = Math.ceil(PLAYER * spriteScale);
                    ctx.fillRect(r.sx, r.sy, wpx, wpx);
                }
            }

            // OVER layer
            if (world) {
                ctx.drawImage(world.over, camX, camY, vpW, vpH, dstX, dstY, destW, destH);
            }

            // Labels and chat bubbles (scaled with zoom; pixel-snapped)
            ctx.font = LABEL_FONT;
            for (const r of renderList) {
                // label
                const name = r.label || "";
                if (name) {
                    ctx.save();
                    ctx.fillStyle = "#e5e7eb";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "alphabetic";
                    const labelX = r.sx + Math.ceil(PLAYER * r.scale) / 2;
                    const labelY = Math.max(12, r.sy - 22);
                    ctx.strokeStyle = LABEL_STROKE;
                    ctx.lineWidth = 3;
                    ctx.lineJoin = "round";
                    try { ctx.strokeText(name, labelX, labelY); } catch { }
                    try { ctx.fillText(name, labelX, labelY); } catch { }
                    ctx.restore();
                }

                // bubble
                const bubble = chatBubbleRef.current[r.pid];
                if (bubble && nowMs < bubble.until) {
                    const remain = (bubble.until - nowMs);
                    const alpha = Math.max(0, Math.min(1, remain / 350));

                    ctx.save();
                    ctx.globalAlpha = 0.92 * alpha;
                    ctx.font = BUBBLE_FONT;

                    const paddingX = 8, paddingY = 6;
                    const labelX = r.sx + Math.ceil(PLAYER * r.scale) / 2;
                    const labelY = Math.max(12, r.sy - 22);

                    const lines = wrapText(ctx, bubble.text, BUBBLE_MAX_W);
                    const widths = lines.map((ln) => Math.ceil(ctx.measureText(ln).width));
                    const boxW = Math.max(60, Math.min(BUBBLE_MAX_W, Math.max(...widths, 0))) + paddingX * 2;
                    const boxH = lines.length * BUBBLE_LINE_H + paddingY * 2;

                    const x = Math.floor(labelX - boxW / 2);
                    const y = Math.floor(labelY - 10 - boxH);

                    const radius = 6;
                    ctx.beginPath();
                    ctx.moveTo(x + radius, y);
                    ctx.lineTo(x + boxW - radius, y);
                    ctx.quadraticCurveTo(x + boxW, y, x + boxW, y + radius);
                    ctx.lineTo(x + boxW, y + boxH - radius);
                    ctx.quadraticCurveTo(x + boxW, y + boxH, x + boxW - radius, y + boxH);
                    ctx.lineTo(x + radius, y + boxH);
                    ctx.quadraticCurveTo(x, y + boxH, x, y + boxH - radius);
                    ctx.lineTo(x, y + radius);
                    ctx.quadraticCurveTo(x, y, x + radius, y);
                    ctx.closePath();

                    ctx.fillStyle = "rgba(17,24,39,0.85)";
                    ctx.fill();
                    ctx.strokeStyle = "rgba(255,255,255,0.12)";
                    ctx.lineWidth = 1;
                    ctx.stroke();

                    ctx.fillStyle = "white";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "top";
                    let ty = y + paddingY;
                    for (let i = 0; i < lines.length; i++) {
                        ctx.fillText(lines[i], labelX, ty);
                        ty += BUBBLE_LINE_H;
                    }
                    ctx.restore();
                }
            }

            // Audio zone overlay (room/radius aware; matches letterbox)
            if (micOn) {
                const { col: meTx, row: meTy } = centerTileOf(meRef.current.x, meRef.current.y);
                const myRule = audioRuleAt(meTx, meTy);

                let audibleSet: Set<string> | null = null;
                if (myRule.kind !== "room") {
                    const myRadius = myRule.kind === "radius" ? myRule.radius : DEFAULT_AUDIO_RADIUS_TILES;
                    audibleSet = computeAudibleTiles(meTx, meTy, myRadius);
                }

                const startCol = Math.max(0, Math.floor(camX / TILE));
                const endCol = Math.min(MAP_COLS - 1, Math.floor((camX + vpW - 1e-6) / TILE));
                const startRow = Math.max(0, Math.floor(camY / TILE));
                const endRow = Math.min(MAP_ROWS - 1, Math.floor((camY + vpH - 1e-6) / TILE));

                let ov = overlayCvsRef.current;
                if (!ov) {
                    ov = document.createElement("canvas");
                    overlayCvsRef.current = ov;
                }
                if (ov.width !== destW || ov.height !== destH) {
                    ov.width = destW;
                    ov.height = destH;
                }
                const octx = (overlayCtxRef.current = ov.getContext("2d")!);
                octx.setTransform(1, 0, 0, 1, 0, 0);
                octx.imageSmoothingEnabled = false;
                octx.clearRect(0, 0, destW, destH);

                octx.globalCompositeOperation = "source-over";
                octx.globalAlpha = 0.18;
                octx.fillStyle = "#000";
                octx.fillRect(0, 0, destW, destH);

                octx.globalAlpha = 1;
                octx.globalCompositeOperation = "destination-out";
                octx.beginPath();

                const rectForTile = (c: number, r: number) => {
                    const x0 = Math.floor((c * TILE - camX) * z);
                    const y0 = Math.floor((r * TILE - camY) * z);
                    const w = Math.ceil(TILE * z);
                    const h = Math.ceil(TILE * z);
                    octx.rect(x0, y0, w, h);
                };

                for (let r = startRow; r <= endRow; r++) {
                    for (let c = startCol; c <= endCol; c++) {
                        if (myRule.kind === "room") {
                            const rr = audioRuleAt(c, r);
                            if (rr.kind === "room" && rr.zoneId === myRule.zoneId) rectForTile(c, r);
                        } else {
                            const rr = audioRuleAt(c, r);
                            if (rr.kind !== "room" && audibleSet?.has(`${c},${r}`)) rectForTile(c, r);
                        }
                    }
                }

                octx.fill();

                ctx.drawImage(ov, dstX, dstY);
            }

            updateAudioZones();

            rafRef.current = requestAnimationFrame(step);
        };

        const kd = (e: KeyboardEvent) => {
            if (isEditableTarget(e) || e.ctrlKey || e.metaKey || e.altKey) return;
            const k = e.key.toLowerCase();

            if (typingChatRef.current) {
                if (
                    k === "w" || k === "a" || k === "s" || k === "d" ||
                    k === "arrowup" || k === "arrowdown" || k === "arrowleft" || k === "arrowright" ||
                    k === "=" || k === "+" || k === "-" || k === "_" ||
                    k === "x" || k === "c"
                ) return;
            }

            if (k === "w" || k === "arrowup") keysRef.current.up = true;
            if (k === "s" || k === "arrowdown") keysRef.current.down = true;
            if (k === "a" || k === "arrowleft") keysRef.current.left = true;
            if (k === "d" || k === "arrowright") keysRef.current.right = true;

            if (k === "=" || k === "+") requestZoomIn();
            if (k === "-" || k === "_") requestZoomOut();

            if (k === "enter") {
                const input = chatInputRef.current;
                if (showChat) { input?.focus(); e.preventDefault(); }
            }

            if (k === "escape") {
                if (showOutfit) {
                    closeOutfit(false);
                } else if (showMicSettings) {
                    setShowMicSettings(false);
                } else if (showChat) {
                    setShowChat(false);
                } else if (showSidebar) {
                    setShowSidebar(false);
                }
            }

            if (k === "c" && !e.repeat) {
                setShowChat((v) => !v);
                e.preventDefault();
                return;
            }

            if (k === "x" && !e.repeat) {
                const { col: tc, row: tr } = centerTileOf(meRef.current.x, meRef.current.y);
                const adj = findAdjacentDoor(tc, tr);
                if (adj) {
                    const next = !adj.open;
                    void setDoor(adj.col, adj.row, next);
                    broadcastDoor(adj.col, adj.row, next);
                    triggerArmSpin(myPeerId);
                    const spin: SpinMsg = { t: "spin", dur: ARM_SPIN_MS };
                    for (const [, c] of connsRef.current) if (c.open) { try { c.send(spin); } catch { } }
                }
            }
        };

        const ku = (e: KeyboardEvent) => {
            const k = e.key.toLowerCase();
            if (typingChatRef.current) {
                if (
                    k === "w" || k === "a" || k === "s" || k === "d" ||
                    k === "arrowup" || k === "arrowdown" || k === "arrowleft" || k === "arrowright"
                ) return;
            }
            if (k === "w" || k === "arrowup") keysRef.current.up = false;
            if (k === "s" || k === "arrowdown") keysRef.current.down = false;
            if (k === "a" || k === "arrowleft") keysRef.current.left = false;
            if (k === "d" || k === "arrowright") keysRef.current.right = false;
        };

        rafRef.current = requestAnimationFrame(step);
        window.addEventListener("keydown", kd, true);
        window.addEventListener("keyup", ku, true);

        return () => {
            cancelAnimationFrame(rafRef.current);
            window.removeEventListener("resize", resize);
            window.removeEventListener("keydown", kd, true);
            window.removeEventListener("keyup", ku, true);
            cvs.removeEventListener("pointerdown", onDown);
            cvs.removeEventListener("pointermove", onPointerMove);
            cvs.removeEventListener("wheel", onWheel as any);
        };
    }, [myPeerId, micOn, myDisplayName]);

    /** ===== Small avatar head (for participants) ===== */
    const AvatarHead: React.FC<{ pid: string; name: string; size?: number; ring?: boolean }> = ({
        pid, name, size = 32, ring = true
    }) => {
        const ref = useRef<HTMLCanvasElement | null>(null);
        const offRef = useRef<HTMLCanvasElement | null>(null);

        const draw = React.useCallback(() => {
            const cvs = ref.current; if (!cvs) return;

            const dpr = window.devicePixelRatio || 1;
            cvs.width = size * dpr; cvs.height = size * dpr;
            cvs.style.width = `${size}px`; cvs.style.height = `${size}px`;

            const ctx = cvs.getContext("2d")!;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, size, size);

            ctx.save();
            ctx.beginPath();
            ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();

            const parts = partsRef.current;
            const outfit = playerOutfitPartsRef.current[pid];

            if (parts && outfit) {
                const scale = 4;
                let off = offRef.current;
                if (!off) {
                    off = document.createElement("canvas");
                    offRef.current = off;
                }
                off.width = PLAYER * scale;
                off.height = PLAYER * scale;
                const octx = off.getContext("2d")!;
                octx.setTransform(1, 0, 0, 1, 0, 0);
                octx.imageSmoothingEnabled = false;
                octx.clearRect(0, 0, off.width, off.height);

                const speaking = !!speakingRef.current[pid];
                const blink = !!talkBlinkRef.current[pid];

                drawPlayerSprite(
                    octx, parts,
                    0, 0, scale,
                    { phase: 0, amp: 0 },
                    false,
                    outfit,
                    { speaking, talkBlink: blink }
                );

                const sx = HEAD_BOX.x * scale;
                const sy = HEAD_BOX.y * scale;
                const sw = HEAD_BOX.w * scale;
                const sh = HEAD_BOX.h * scale;
                ctx.drawImage(off, sx, sy, sw, sh, 0, 0, size, size);
            } else {
                ctx.fillStyle = "rgba(255,255,255,0.06)";
                ctx.fillRect(0, 0, size, size);
                ctx.fillStyle = "#a3e635";
                ctx.font = `${Math.floor(size * 0.45)}px ui-sans-serif,system-ui,Segoe UI`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(String(name || "").slice(0, 1).toUpperCase(), size / 2, size / 2 + 1);
            }

            ctx.restore();

            if (ring) {
                ctx.strokeStyle = "rgba(163,230,53,0.6)";
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(size / 2, size / 2, size / 2 - 0.75, 0, Math.PI * 2);
                ctx.stroke();
            }
        }, [pid, name, size]);

        useEffect(() => {
            let raf = 0;
            let last = 0;
            const tick = (ts: number) => {
                if (ts - last > 100) {
                    last = ts;
                    draw();
                }
                raf = requestAnimationFrame(tick);
            };
            draw();
            raf = requestAnimationFrame(tick);
            return () => cancelAnimationFrame(raf);
        }, [pid, draw, labelsVersion]);

        return <canvas ref={ref} style={{ display: "block" }} aria-label={`${name} avatar`} />;
    };

    /** ===== Participant row in sidebar ===== */
    const ParticipantRow: React.FC<{ pid: string }> = React.memo(({ pid }) => {
        const name = displayNameFor(pid);
        const uname = usernameFor(pid);
        const isSelf = pid === myPeerId;

        const badgeRef = useRef<HTMLSpanElement | null>(null);
        useEffect(() => {
            const id = setInterval(() => {
                const el = badgeRef.current; if (!el) return;
                const spk = !!speakingRef.current[pid];
                el.style.opacity = spk ? "1" : "0";
                el.style.visibility = spk ? "visible" : "hidden";
            }, 120);
            return () => clearInterval(id);
        }, [pid]);

        return (
            <li className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/5 transition">
                <div className="shrink-0">
                    <AvatarHead pid={pid} name={name || prettyId(pid)} size={32} />
                </div>

                <div className="min-w-0 flex-1">
                    <div className="text-sm text-white truncate">
                        {isSelf ? `${name} (you)` : name}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono truncate">
                        @{uname || prettyId(principalFromPeerId(roomId, pid))}
                    </div>
                </div>

                <div className="ml-2">
                    <span
                        ref={badgeRef}
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border transition-opacity duration-150
                                    bg-emerald-600/20 text-emerald-300 border-emerald-500/30
                                    opacity-0 invisible`}
                        title="Currently speaking"
                    >
                        speaking
                    </span>
                </div>
            </li>
        );
    });

    /** ===== Mobile Joystick ===== */
    const MobileJoystick: React.FC = () => {
        const baseRef = useRef<HTMLDivElement | null>(null);
        const [dragging, setDragging] = useState(false);
        const [knob, setKnob] = useState({ x: 0, y: 0 });

        const applyVector = (nx: number, ny: number) => {
            if (typingChatRef.current) return;
            const dead = 0.18;
            keysRef.current.left = nx < -dead;
            keysRef.current.right = nx > dead;
            keysRef.current.up = ny < -dead;
            keysRef.current.down = ny > dead;
        };

        const updateFromClient = (cx: number, cy: number) => {
            const el = baseRef.current;
            if (!el) return;
            const r = el.getBoundingClientRect();
            const centerX = r.left + r.width / 2;
            const centerY = r.top + r.height / 2;
            let dx = cx - centerX;
            let dy = cy - centerY;
            const max = Math.min(r.width, r.height) / 2;
            const len = Math.hypot(dx, dy) || 1;
            const clamped = Math.min(len, max);
            const nx = (dx / len) * (clamped / max);
            const ny = (dy / len) * (clamped / max);
            setKnob({ x: nx, y: ny });
            applyVector(nx, ny);
        };

        const reset = () => {
            setKnob({ x: 0, y: 0 });
            applyVector(0, 0);
        };

        useEffect(() => {
            const mv = (e: PointerEvent) => { if (dragging) updateFromClient(e.clientX, e.clientY); };
            const up = () => { setDragging(false); reset(); };
            window.addEventListener("pointermove", mv, { passive: true });
            window.addEventListener("pointerup", up, { passive: true });
            window.addEventListener("pointercancel", up, { passive: true });
            return () => {
                window.removeEventListener("pointermove", mv);
                window.removeEventListener("pointerup", up);
                window.removeEventListener("pointercancel", up);
            };
        }, [dragging]);

        const knobPx = (pct: number, size: number) => (size / 2) * pct;

        const BASE_SIZE = 140;
        const KNOB_SIZE = 64;

        return (
            <div
                data-no-dismiss
                className="absolute left-6 bottom-6 select-none z-[44]"
                style={{ touchAction: "none" }}
            >
                <div
                    ref={baseRef}
                    onPointerDown={(e) => {
                        e.preventDefault();
                        (e.currentTarget as any).setPointerCapture?.(e.pointerId);
                        setDragging(true);
                        updateFromClient(e.clientX, e.clientY);
                    }}
                    className="relative rounded-full border backdrop-blur-md border-white/15 bg-white/5"
                    style={{ width: BASE_SIZE, height: BASE_SIZE }}
                    aria-label="Move joystick"
                >
                    {/* crosshair */}
                    <div className="absolute inset-0 pointer-events-none" aria-hidden>
                        <div className="absolute left-1/2 top-0 -translate-x-1/2 w-px h-full bg-white/10" />
                        <div className="absolute top-1/2 left-0 -translate-y-1/2 h-px w-full bg-white/10" />
                        <div className="absolute inset-0 rounded-full border border-white/10" />
                    </div>

                    {/* knob */}
                    <div
                        className="absolute rounded-full border shadow-md bg-white/30 border-white/30"
                        style={{
                            width: KNOB_SIZE,
                            height: KNOB_SIZE,
                            left: `calc(50% - ${KNOB_SIZE / 2}px + ${knobPx(knob.x, BASE_SIZE)}px)`,
                            top: `calc(50% - ${KNOB_SIZE / 2}px + ${knobPx(knob.y, BASE_SIZE)}px)`,
                            transition: dragging ? "none" : "left 120ms ease, top 120ms ease",
                            willChange: "left, top",
                        }}
                    />
                </div>
            </div>
        );
    };

    const IconButton: React.FC<{
        title: string;
        active?: boolean;
        danger?: boolean;
        onClick?: () => void;
        children: React.ReactNode;
        badge?: number | string;
        badgeSrOnly?: string;
    } & React.ButtonHTMLAttributes<HTMLButtonElement>> = ({
        title, active, danger, onClick, children, className, badge, badgeSrOnly, ...rest
    }) => {
            const variant = danger
                ? "bg-rose-500/25 border-rose-400/60 text-rose-50 hover:bg-rose-500/35"
                : active
                    ? "bg-lime-400/25 border-lime-300/60 text-lime-50 hover:bg-lime-400/35"
                    : "bg-white/5 border-white/15 text-white hover:bg-white/10";

            const hasBadge =
                badge !== undefined &&
                badge !== null &&
                String(badge).trim() !== "" &&
                Number(badge) > 0;

            return (
                <button
                    {...rest}
                    onClick={onClick}
                    data-no-dismiss
                    title={title}
                    aria-pressed={!!active}
                    className={[
                        "relative inline-flex items-center justify-center h-9 w-9 rounded-lg border transition",
                        "backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-white/20",
                        variant,
                        className || ""
                    ].join(" ")}
                >
                    {children}

                    {hasBadge && (
                        <>
                            <span
                                aria-hidden
                                className="pointer-events-none absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1
                                            rounded-full grid place-items-center text-[10px] font-semibold
                                            bg-lime-400 text-white border border-lime-300 shadow"
                            >
                                {typeof badge === "number" ? formatBadge(badge) : String(badge)}
                            </span>
                            {badgeSrOnly ? <span className="sr-only">{badgeSrOnly}</span> : null}
                        </>
                    )}

                </button>
            );
        };

    // Mic button with split settings toggle
    const micVariantClasses = (active?: boolean, danger?: boolean) =>
        danger
            ? "bg-rose-500/25 border-rose-400/60 text-rose-50"
            : active
                ? "bg-lime-400/25 border-lime-300/60 text-lime-50"
                : "bg-white/5 border-white/15 text-white";

    // Mic split button (main + dropdown)
    const MicSplitButton: React.FC<{
        active: boolean;
        danger: boolean;
        onToggle: () => void;
        onToggleSettings: () => void;
        expanded?: boolean;
    }> = ({ active, danger, onToggle, onToggleSettings, expanded }) => {
        const variant = micVariantClasses(active, danger);

        return (
            <div
                data-no-dismiss
                className={[
                    "inline-flex items-stretch rounded-lg overflow-hidden border backdrop-blur-md",
                    "focus-within:ring-2 focus-within:ring-white/20",
                    variant
                ].join(" ")}
                role="group"
                aria-label="Microphone controls"
            >
                <button
                    type="button"
                    data-no-dismiss
                    onClick={onToggle}
                    title="Mic on/off"
                    aria-pressed={active}
                    className="inline-flex items-center justify-center h-9 w-9 hover:bg-white/10 focus:outline-none transition"
                >
                    {active ? <IconMicOn className="w-5 h-5" /> : <IconMicOff className="w-5 h-5" />}
                </button>

                <div className="w-px my-1 self-stretch bg-white/15" aria-hidden />

                <button
                    type="button"
                    data-no-dismiss
                    onClick={onToggleSettings}
                    title={expanded ? "Hide mic settings" : "Mic settings"}
                    aria-haspopup="dialog"
                    aria-expanded={!!expanded}
                    className="inline-flex items-center justify-center h-9 w-7 hover:bg-white/10 focus:outline-none transition"
                >
                    {expanded ? <IconChevronUp className="w-4 h-4" /> : <IconChevronDown className="w-4 h-4" />}
                </button>
            </div>
        );
    };

    /** ===== UI ===== */
    return (
        <div className="fixed inset-0 bg-black">
            {shouldRenderGate && (
                <AnimatePresence>
                    <motion.div
                        key="gate"
                        className="absolute inset-0 z-[90] bg-black overflow-hidden"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        role="dialog"
                        aria-modal="true"
                    >
                        {/* BACKGROUND: animated grid + lime fog + floating pixels */}
                        <div className="absolute inset-0 bg-black">
                            <div className="lobby-anim-grid absolute inset-0 opacity-[0.22]" aria-hidden />
                            <motion.div
                                aria-hidden
                                className="pointer-events-none absolute -top-24 -left-20 w-[46rem] h-[46rem] rounded-full blur-3xl"
                                style={{ background: "radial-gradient(closest-side, rgba(163,230,53,0.16), transparent 70%)" }}
                                initial={{ opacity: 0, scale: 0.92 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.8, delay: 0.1 }}
                            />
                            <motion.div
                                aria-hidden
                                className="pointer-events-none absolute -bottom-28 -right-24 w-[38rem] h-[38rem] rounded-full blur-3xl"
                                style={{ background: "radial-gradient(closest-side, rgba(163,230,53,0.12), transparent 70%)" }}
                                initial={{ opacity: 0, scale: 1.06 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.9, delay: 0.2 }}
                            />

                            {/* Floating pixel objects */}
                            {[
                                { left: "9%", top: "18%", size: 12, delay: 0.2 },
                                { left: "22%", top: "70%", size: 10, delay: 0.6 },
                                { left: "48%", top: "14%", size: 14, delay: 0.1 },
                                { left: "68%", top: "64%", size: 12, delay: 0.4 },
                                { left: "82%", top: "28%", size: 10, delay: 0.9 },
                                { left: "35%", top: "48%", size: 8, delay: 0.5 },
                                { left: "56%", top: "82%", size: 9, delay: 0.7 },
                                { left: "76%", top: "12%", size: 11, delay: 0.35 },
                            ].map((f, i) => (
                                <motion.div
                                    key={i}
                                    aria-hidden
                                    className="absolute"
                                    style={{ left: f.left, top: f.top, width: f.size, height: f.size, imageRendering: "pixelated" }}
                                    initial={{ y: 0, opacity: 0.7 }}
                                    animate={{ y: [0, -10, 0], opacity: [0.7, 1, 0.7] }}
                                    transition={{ duration: 4.5, repeat: Infinity, delay: f.delay, ease: "easeInOut" }}
                                >
                                    <div className="w-full h-full rounded-[2px] bg-lime-300/50 border border-lime-400/60 shadow-[0_0_12px_rgba(163,230,53,0.25)]" />
                                </motion.div>
                            ))}
                        </div>

                        {/* CONTENT */}
                        <div className="relative h-full w-full flex flex-col">
                            {/* Top bar */}
                            <motion.header
                                initial={{ y: -8, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ duration: 0.35, delay: 0.05 }}
                                className="px-6 md:px-8 pt-5 flex items-center gap-4"
                            >
                                <div className="flex-1 min-w-0 text-center md:text-left">
                                    <div className="text-[11px] tracking-[0.2em] uppercase text-white">Welcome to</div>
                                    <div className="text-white text-2xl sm:text-3xl md:text-4xl tracking-tight">
                                        <span className="font-logo text-lime-400">{String(roomId || "-").toUpperCase()}</span>
                                    </div>
                                </div>

                                <div className="hidden md:flex items-center gap-3 text-right">
                                    <div className="text-xs text-slate-300">
                                        Player:&nbsp;
                                        <span className="font-semibold text-white">
                                            {(user?.name || user?.username) ? (user?.name || user?.username) : "Anonymous"}
                                        </span>
                                    </div>
                                </div>
                            </motion.header>

                            {/* HERO */}
                            <div className="flex-1 grid place-items-center px-6 md:px-8 pb-8">
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.99 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.99 }}
                                    transition={{ type: "spring", stiffness: 240, damping: 22 }}
                                    className="mx-auto w-full max-w-[960px] flex items-center justify-center gap-8 md:gap-12"
                                >
                                    {/* LEFT: preview card */}
                                    <motion.div
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.08, duration: 0.28 }}
                                        className="relative shrink-0 rounded-2xl overflow-hidden border border-lime-400/30
                                                   shadow-[0_0_0_1px_rgba(163,230,53,0.25),0_0_60px_rgba(163,230,53,0.08)]
                                                   bg-gradient-to-b from-lime-400/10 via-slate-900/60 to-slate-900/80
                                                   w-[220px] h-[220px] grid place-items-center"
                                    >
                                        <canvas
                                            ref={prePreviewRef}
                                            width={220}
                                            height={220}
                                            className="block w-[220px] h-[220px]"
                                            style={{ imageRendering: "pixelated" }}
                                        />
                                    </motion.div>

                                    {/* RIGHT: Join */}
                                    <motion.div
                                        initial={{ opacity: 0, x: 8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.12, duration: 0.30 }}
                                        className="flex-1 min-w-[260px] max-w-[560px]"
                                    >
                                        <div className="inline-flex items-center gap-2 px-2 py-1 rounded-full border border-lime-400/30
                                                        bg-lime-400/10 text-lime-300 text-[11px] font-semibold tracking-wide uppercase">
                                            Ready to join
                                        </div>

                                        <h2 className="mt-3 text-white text-2xl sm:text-3xl font-bold">
                                            Step in and meet others
                                        </h2>
                                        <p className="mt-2 text-slate-300 text-sm sm:text-base max-w-[64ch]">
                                            Move around, chat, and explore. Hit the button to enter the room.
                                        </p>

                                        {preJoinError && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 6 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="mt-3 mb-2 text-sm rounded-lg border border-rose-500/40 bg-rose-900/30 text-rose-200 px-3 py-2"
                                            >
                                                {preJoinError}
                                            </motion.div>
                                        )}

                                        <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
                                            <motion.button
                                                type="button"
                                                onClick={() => { handlePreJoin(); }}
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                className="inline-flex items-center justify-center px-5 py-3 rounded-xl
                                                           bg-lime-400 text-black font-semibold border border-lime-300 shadow
                                                           hover:bg-lime-300 transition w-full sm:w-auto"
                                                title="Join room"
                                            >
                                                Join room
                                            </motion.button>

                                            <div className="text-[11px] text-slate-400">
                                                You can adjust settings later inside the room.
                                            </div>
                                        </div>
                                    </motion.div>
                                </motion.div>
                            </div>
                        </div>

                        <style>
                            {`
                            .lobby-anim-grid{
                                --c1: rgba(255,255,255,0.05);
                                --c2: rgba(163,230,53,0.10);
                                background-image:
                                linear-gradient(var(--c1) 1px, transparent 1px),
                                linear-gradient(90deg, var(--c1) 1px, transparent 1px),
                                radial-gradient(circle at 20% 20%, var(--c2), transparent 35%),
                                radial-gradient(circle at 80% 60%, rgba(163,230,53,0.08), transparent 40%);
                                background-size:
                                40px 40px,
                                40px 40px,
                                100% 100%,
                                100% 100%;
                                animation: lobbyGridMove 18s linear infinite;
                            }
                            @keyframes lobbyGridMove {
                                0% { background-position: 0 0, 0 0, 0 0, 0 0; }
                                50% { background-position: 40px 20px, 20px 40px, 1% 1%, -1% -1%; }
                                100% { background-position: 80px 40px, 40px 80px, 0 0, 0 0; }
                            }

                            .lobby-grid{
                                display: grid;
                                grid-template-columns: minmax(420px, 720px) 1fr;
                                gap: 2rem;
                                align-items: center;
                                justify-items: center;
                            }

                            @media (orientation: portrait), (max-width: 760px){
                                .lobby-grid{
                                grid-template-columns: 1fr;
                                gap: 1.5rem;
                                }
                            }

                            .text-panel{ padding: 0.5rem 0.25rem; }
                            `}
                        </style>
                    </motion.div>
                </AnimatePresence>
            )}

            {/* unified loading overlay */}
            <AnimatePresence>
                {showLoader && (
                    <motion.div
                        key="loader"
                        className="absolute inset-0 bg-black grid place-items-center z-[60]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.92 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ type: "spring", stiffness: 220, damping: 22 }}
                            className="text-center"
                        >
                            <div className="text-white text-xl">Connecting to room...</div>
                            <div className="text-gray-400 text-sm mt-2">{subtext}</div>
                            <div className="mt-4 w-64 mx-auto">
                                <div className="text-gray-400 text-xs mb-1 text-right tabular-nums">{uiPct}%</div>

                                <div className="h-1.5 w-full bg-white/10 rounded overflow-hidden">
                                    <motion.div
                                        className="h-full rounded relative"
                                        style={{ width: widthPct, backgroundColor: "rgb(132 204 22)" }}
                                    >
                                        <div className="absolute inset-0 opacity-60 loader-stripes" style={{ mixBlendMode: "overlay" }} />
                                    </motion.div>
                                </div>
                            </div>
                        </motion.div>

                        <style>
                            {`
                            .loader-stripes{
                                --band: 8px;
                                --period: calc(var(--band) * 2);
                                --loop-x: calc(var(--period) * 1.41421356);

                                background-image:
                                repeating-linear-gradient(
                                    45deg,
                                    rgba(255,255,255,0.35) 0 var(--band),
                                    rgba(255,255,255,0.05) var(--band) var(--period)
                                );
                                background-repeat: repeat;
                                animation: loader-stripe-slide-x 0.9s linear infinite;
                                will-change: background-position;
                                transform: translateZ(0);
                            }

                            @keyframes loader-stripe-slide-x {
                                from { background-position: 0 0; }
                                to   { background-position: var(--loop-x) 0; }
                            }
                            `}
                        </style>
                    </motion.div>
                )}
            </AnimatePresence>

            <PixelReveal
                play={showPixelReveal}
                durationMs={2000}
                cols={28}
                zIndex={80}
                onComplete={() => setShowPixelReveal(false)}
            />

            <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full block"
                style={{
                    imageRendering: "pixelated",
                    opacity: showLoader ? 0 : 1,
                    transition: "opacity 120ms ease"
                }}
                onContextMenu={(e) => e.preventDefault()}
            />

            {/* Chat panel */}            
            <div
                ref={chatPanelRef}
                style={{
                    position: "absolute",
                    top: 0, left: 0, height: "100%", width: 320,
                    background: "rgba(2,6,23,0.92)", borderRight: "1px solid rgba(148,163,184,0.25)",
                    color: "#e5e7eb", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    transform: `translateX(${showChat ? 0 : -330}px)`,
                    transition: "transform 220ms ease",
                    display: "flex", flexDirection: "column", zIndex: 50,
                    backdropFilter: "blur(6px)",
                }}
                aria-hidden={!showChat}
            >
                <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(163,230,53,0.3)", background: "rgba(21,128,61,0.05)" }}>
                    <div style={{ fontWeight: 700 }}>Chat</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{roomId || "-"}</div>
                </div>

                <div ref={chatListRef} style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
                    {chatLog.length === 0 ? (
                        <div style={{ color: "#94a3b8" }}>No messages yet...</div>
                    ) : (
                        chatLog.map((m) => (
                            <div key={m.id} style={{ fontSize: 13, marginBottom: 8, wordBreak: "break-word" }}>
                                <span style={{ color: "#94a3b8", fontSize: 11, marginRight: 8 }}>
                                    {new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                                <span style={{ fontWeight: 700, color: m.self ? "#a3e635" : "#e5e7eb" }}>
                                    {m.self ? "You" : (m.label || pretty(m.fromPeerId))}
                                </span>
                                <span style={{ color: "#94a3b8", margin: "0 6px" }}>:</span>
                                <span style={{ whiteSpace: "pre-wrap" }}>{m.text}</span>
                            </div>
                        ))
                    )}
                </div>

                <div style={{ padding: 10, borderTop: "1px solid rgba(148,163,184,0.25)" }}>
                    <div style={{ display: "flex", gap: 8 }}>
                        <input
                            id="chat-input-box"
                            ref={chatInputRef}
                            value={chatInput}
                            onFocus={() => { typingChatRef.current = true; }}
                            onBlur={() => { typingChatRef.current = false; }}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(chatInput); } }}
                            placeholder="Type a message..."
                            style={{
                                flex: 1,
                                padding: "8px 10px",
                                borderRadius: 8,
                                border: "1px solid rgba(148,163,184,0.35)",
                                background: "rgba(15,23,42,0.6)",
                                color: "#e5e7eb",
                                outline: "none",
                            }}
                        />
                        <button
                            onClick={() => sendChat(chatInput)}
                            disabled={!chatInput.trim()}
                            style={{
                                padding: "8px 12px",
                                borderRadius: 8,
                                background: chatInput.trim() ? "rgb(132,204,22)" : "rgba(148,163,184,0.25)",
                                color: chatInput.trim() ? "#0b1b06" : "#cbd5e1",
                                border: "1px solid rgba(132,204,22,0.5)",
                                cursor: chatInput.trim() ? "pointer" : "not-allowed",
                            }}
                        >
                            Send
                        </button>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 11, color: "#94a3b8" }}>
                        Enter to send - Shift+Enter for newline - Press C to toggle chat
                    </div>
                </div>
            </div>

            {/* Bottom center controls */}
            <div
                data-no-dismiss
                className="absolute left-1/2 -translate-x-1/2 bottom-6 z-[45] flex items-center gap-2"
            >
                {/* Chat */}
                <IconButton
                    title="Toggle chat (C)"
                    onClick={() => setShowChat(v => !v)}
                    active={showChat}
                    badge={chatLog.length}
                    badgeSrOnly={`${chatLog.length} messages`}
                >
                    <IconChat className="w-5 h-5" />
                </IconButton>

                {/* Mic */}
                <MicSplitButton
                    active={micOn}
                    danger={!micOn}
                    onToggle={onToggleMic}
                    onToggleSettings={() => setShowMicSettings(v => !v)}
                    expanded={showMicSettings}
                />

                {/* Participants */}
                <IconButton
                    title="Participants"
                    onClick={() => setShowSidebar(v => !v)}
                    active={showSidebar}
                    badge={participantsReady.length}
                    badgeSrOnly={`${participantsReady.length} participants`}
                >
                    <IconUsers className="w-5 h-5" />
                </IconButton>

                <div className="w-px h-6 bg-white/20 mx-1" />

                {/* Outfit */}
                <IconButton
                    title="Customize outfit"
                    onClick={openOutfit}
                    active={showOutfit}
                >
                    <IconOutfit className="w-5 h-5" />
                </IconButton>

                <div className="w-px h-6 bg-white/20 mx-1" />

                {/* Leave */}
                <IconButton
                    title="Leave room"
                    onClick={async () => { await gracefulLeave(); navigate("/dashboard", { replace: true }); }}
                    danger
                >
                    <IconLeave className="w-5 h-5" />
                </IconButton>
            </div>

            {/* Zoom controls */}
            <div
                data-no-dismiss
                className="absolute bottom-6 right-6 z-[46] flex flex-col gap-2"
            >
                <IconButton title="Zoom in (+)" onClick={requestZoomIn} aria-label="Zoom in">
                    <IconZoomIn className="w-5 h-5" />
                </IconButton>
                <IconButton title="Zoom out (-)" onClick={requestZoomOut} aria-label="Zoom out">
                    <IconZoomOut className="w-5 h-5" />
                </IconButton>
            </div>

            {/* Mobile joystick */}
            {useJoystick && !showChat && !showOutfit && <MobileJoystick />}

            {/* Mic settings popover */}
            <AnimatePresence>
                {showMicSettings && (
                    <motion.div
                        ref={micPanelRef}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 16 }}
                        transition={{ type: "spring", stiffness: 260, damping: 20 }}
                        className="absolute left-1/2 -translate-x-1/2 bottom-28 z-[70] w-[min(92vw,620px)] rounded-2xl border border-white/15 bg-slate-900/90 backdrop-blur-xl p-0 shadow-2xl overflow-hidden"
                    >
                        {/* header */}
                        <div className="px-4 py-3 bg-gradient-to-r from-lime-900/20 to-transparent border-b border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white">
                                <IconMicOn className="w-4 h-4 text-lime-300" />
                                <span className="font-medium">Microphone</span>
                            </div>
                            <button
                                onClick={() => setShowMicSettings(false)}
                                className="text-slate-300 hover:text-white text-sm"
                            >
                                Close
                            </button>
                        </div>

                        {/* body */}
                        <div className="p-4">
                            <div className="flex flex-col md:flex-row md:items-center gap-3">
                                <select
                                    className="flex-1 px-3 py-2 rounded-lg border border-white/15 bg-slate-800/70 text-slate-100
                                               focus:outline-none focus:ring-2 focus:ring-lime-400/40 focus:border-lime-400/40"
                                    value={selectedMicId}
                                    onChange={(e) => setSelectedMicId(e.target.value)}
                                    title="Select microphone device"
                                >
                                    {mics.length === 0 ? (
                                        <option value="">(no devices)</option>
                                    ) : (
                                        mics.map((d) => (
                                            <option key={d.deviceId} value={d.deviceId}>
                                                {(d.label || "Microphone")}{d.deviceId === "default" ? " [default]" : ""}
                                            </option>
                                        ))
                                    )}
                                </select>

                                <button
                                    onClick={async () => { await onApplyMic(); setShowMicSettings(false); }}
                                    className="px-4 py-2 rounded-lg bg-lime-600 hover:bg-lime-500 text-white"
                                >
                                    Apply
                                </button>
                            </div>

                            {/* meter */}
                            <div className="mt-4">
                                <div className="text-xs text-slate-400 mb-1">Input level</div>
                                <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-lime-500 to-lime-400 transition-[width] duration-75"
                                        style={{ width: `${Math.min(100, Math.round((micLevel || 0) * 180))}%` }}
                                    />
                                </div>
                                <div className="mt-2 text-xs text-slate-400">
                                    Status: {micOn ? "Mic ON (sending to peers you can hear)" : "Mic OFF"}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Right sidebar (participants) */}
            <div
                ref={rightSidebarRef}
                className={`absolute top-0 right-0 h-full w-[340px] bg-slate-900/95 backdrop-blur border-l border-slate-700 text-white transition-transform duration-300 ease-out z-[70] ${showSidebar ? "translate-x-0" : "translate-x-full"}`}
            >
                <div className="flex flex-col h-full">
                    {/* header */}
                    <div className="px-4 py-3 border-b border-white/10 bg-gradient-to-l from-slate-800/50 to-transparent flex items-center justify-between">
                        <div className="min-w-0">
                            <div className="font-semibold">Room</div>
                            <div className="text-xs text-slate-400 truncate max-w-[200px]">{roomId || "-"}</div>
                        </div>
                        <button
                            onClick={onInviteClick}
                            disabled={inviteCopied}
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${inviteCopied
                                ? "bg-emerald-700 text-white"
                                : "bg-lime-600 hover:bg-lime-500 text-white"
                                }`}
                            title={inviteCopied ? "Link copied" : "Copy this room link"}
                        >
                            <IconCopy className="w-4 h-4" />
                            {inviteCopied ? "Copied" : "Invite"}
                        </button>
                    </div>

                    {/* body */}
                    <div className="flex-1 overflow-y-auto p-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="font-medium">Participants</div>
                            <div className="text-xs text-slate-400">{participantsReady.length}</div>
                        </div>

                        {participantsReady.length === 0 ? (
                            <div className="text-slate-400 text-sm">No connected participants</div>
                        ) : (
                            <ul className="space-y-2">
                                {participantsReady.map((p) => (
                                    <ParticipantRow key={p} pid={p} />
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* footer */}
                    <div className="p-4 border-t border-slate-700/60">
                        <button
                            data-no-dismiss
                            onClick={() => setShowMicSettings(true)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-700/50 hover:bg-gray-600/50 text-white transition"
                            title="Open microphone settings"
                        >
                            <IconSettings className="w-4 h-4" />
                            Mic settings
                        </button>
                    </div>

                </div>
            </div>

            {/* Outfit Editor Modal */}
            <AnimatePresence>
                {showOutfit && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            key="outfit-backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            className="fixed inset-0 z-[65] bg-black/40 backdrop-blur-sm"
                            onClick={() => closeOutfit(false)}
                            aria-hidden
                        />

                        {/* Modal */}
                        <div className="fixed inset-0 z-[70] grid place-items-center pb-28 md:pb-32 pointer-events-none">
                            <motion.div
                                key="outfit-modal"
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 16 }}
                                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                                role="dialog"
                                aria-modal="true"
                                className="pointer-events-auto w-[min(96vw,900px)] rounded-xl border border-slate-700 bg-slate-900/95 backdrop-blur p-4 shadow-2xl"
                            >
                                {/* header */}
                                <div className="flex items-center justify-between mb-3">
                                    <div className="text-white font-medium">Outfit</div>
                                    <button
                                        onClick={() => closeOutfit(false)}
                                        className="text-slate-300 hover:text-white text-sm"
                                    >
                                        Close
                                    </button>
                                </div>

                                {/* 3-pane layout */}
                                <div className="grid grid-cols-1 md:grid-cols-[180px_1fr_220px] gap-4">

                                    {/* left: slot menu */}
                                    <div className="rounded-lg border border-slate-700/70 overflow-hidden">
                                        <div className="bg-slate-800/60 px-3 py-2 text-xs text-slate-300">Slots</div>
                                        <div className="max-h-[300px] overflow-y-auto p-1">
                                            {OUTFIT_SLOT_ORDER.map((slot) => {
                                                const active = activeSlot === slot;
                                                return (
                                                    <button
                                                        key={slot}
                                                        onClick={() => setActiveSlot(slot)}
                                                        className={`w-full text-left px-3 py-2 rounded-md mb-1 capitalize transition
                                                            ${active
                                                                ? "bg-lime-400/20 text-lime-200 border border-lime-400/30"
                                                                : "text-slate-200 hover:bg-slate-700/40"
                                                            }`}
                                                    >
                                                        {slot.replace(/_/g, " ")}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* middle: option grid */}
                                    <div className="rounded-lg border border-slate-700/70 p-3 min-h-[240px]">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="text-slate-200 font-medium capitalize">
                                                {activeSlot.replace(/_/g, " ")}
                                            </div>
                                            <div className="text-xs text-slate-400">
                                                {(OUTFIT_OPTIONS[activeSlot as keyof typeof OUTFIT_OPTIONS] || []).length} items
                                            </div>
                                        </div>

                                        {(() => {
                                            const slotKey = activeSlot as keyof typeof OUTFIT_OPTIONS;
                                            const slotIdx = OUTFIT_SLOT_ORDER.indexOf(activeSlot as any);
                                            const items = OUTFIT_OPTIONS[slotKey] || [];
                                            if (slotIdx < 0) return (
                                                <div className="text-slate-400 text-sm">Slot not recognized.</div>
                                            );

                                            return (
                                                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                                                    {items.map((opt) => {
                                                        const selected = mySlots[slotIdx] === opt.id;
                                                        return (
                                                            <button
                                                                key={opt.id}
                                                                onClick={() => {
                                                                    const next = mySlots.slice() as OutfitSlotsArray;
                                                                    next[slotIdx] = opt.id;
                                                                    setMySlots(next);
                                                                }}
                                                                title={opt.label}
                                                                className={`group relative aspect-square rounded-lg border text-left transition
                                                                            ${selected
                                                                        ? "border-lime-400 ring-2 ring-lime-400/60"
                                                                        : "border-slate-700 hover:border-slate-500"}
                                                                            bg-slate-800/60`}
                                                            >
                                                                {/* label */}
                                                                <div className="absolute inset-0 grid place-items-center px-2 text-center">
                                                                    <div className={`text-[12px] leading-tight ${selected ? "text-lime-200" : "text-slate-200"}`}>
                                                                        {opt.label}
                                                                    </div>
                                                                </div>
                                                                {/* selected tick */}
                                                                {selected && (
                                                                    <div className="absolute top-1 right-1 text-[10px] px-1.5 py-0.5 rounded bg-lime-500 text-white">
                                                                        selected
                                                                    </div>
                                                                )}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* right: preview */}
                                    <div className="rounded-lg border border-slate-700/70 p-3">
                                        <div className="text-slate-200 font-medium mb-2">Preview</div>
                                        <div
                                            className="rounded-md border border-slate-700 bg-slate-800/60 grid place-items-center"
                                            style={{ width: 180, height: 180 }}
                                        >
                                            <canvas ref={previewRef} style={{ imageRendering: "pixelated" }} />
                                        </div>

                                        <div className="mt-3 flex flex-wrap gap-2">
                                            <button
                                                onClick={() => setMySlots(DEFAULT_OUTFIT)}
                                                className="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-white text-sm"
                                            >
                                                Reset to default
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* footer actions */}
                                <div className="mt-4 flex items-center justify-end gap-2">
                                    <button
                                        onClick={onCancelOutfit}
                                        className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={onApplyOutfit}
                                        className="px-4 py-2 rounded bg-lime-600 hover:bg-lime-500 text-white"
                                    >
                                        Apply
                                    </button>
                                </div>

                                <div className="mt-2 text-xs text-slate-400">
                                    Pick a slot on the left - click an item box to change it. Press Apply to save.
                                </div>
                            </motion.div>
                        </div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Room;
