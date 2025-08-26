"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useSpring, useTransform } from "framer-motion";
import { IcWebSocket, createWsConfig } from "ic-websocket-js";
import { canisterId, backend } from "../../../declarations/backend";
import { canisterService } from "../services/canisterService";
import { useAuth } from "../contexts/AuthContext";
import { Principal } from "@dfinity/principal";
import type { SignIdentity } from "@dfinity/agent";
import { DEFAULT_OUTFIT, normalizeSlots, OUTFIT_OPTIONS, OUTFIT_SLOT_ORDER, type OutfitSlotsArray } from "@/constants/outfit";
import { buildActiveOutfit } from "@/lib/resolveOutfit";
import {
  Mic, MicOff, Users, Settings, MessageSquare,
  ZoomIn, ZoomOut, LogOut, UserPen, Copy
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
  type OutfitLibrary
} from "../components/player/sprite";
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
  TOP_DOOR_CLOSED_ID
} from "../components/world/map";
import LoginRequired from '../components/auth/LoginRequired';
import PixelReveal from "@/components/pixel-reveal";

const isSignIdentity = (v: any): v is SignIdentity =>
  !!v &&
  typeof v === "object" &&
  typeof (v as any).getPublicKey === "function" &&
  typeof (v as any).sign === "function";

// ===== RTC Networking Config =====
const icUrl = "https://icp0.io";
const gatewayUrl = import.meta.env.VITE_GATEWAY as string;
const interval = Number(import.meta.env.VITE_INTERVAL);
const HOST = import.meta.env.VITE_TURN_HOST as string;
const PORT = import.meta.env.VITE_TURN_PORT as string;
const USER = import.meta.env.VITE_TURN_USERNAME as string;
const CREDENTIAL = import.meta.env.VITE_TURN_CREDENTIAL as string;

// ===== Types (sinkron Types.mo) =====
type Ice = { candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null };
type RtcPayload = { Offer: string } | { Answer: string } | { Ice: Ice };

type WsMessage =
  | { Subscribe: { roomId: string } }
  | { Unsubscribe: { roomId: string } }
  | { RoomJoin: { roomId: string } }
  | { RoomLeave: { roomId: string } }
  | { Participants: { roomId: string; participants: (string | { toText: () => string })[] } }
  | { Joined: { roomId: string; who: string | { toText: () => string } } }
  | { Left: { roomId: string; who: string | { toText: () => string } } }
  | { Subscribed: { roomId: string; who: string | { toText: () => string } } }
  | { RtcSend: { roomId: string; to: any; payload: RtcPayload } }
  | { RtcFrom: { roomId: string; from: any; payload: RtcPayload } }
  | { RtcHello: { roomId: string } }
  | { RtcHelloFrom: { roomId: string; from: any } }
  | { Error: string };

const toPid = (p: any) =>
  typeof p === "string" ? p : (p?.toText?.() ?? p?.__principal__ ?? String(p));
const pretty = (p: string) => (p.length > 16 ? `${p.slice(0, 6)}...${p.slice(-6)}` : p);
const wsIsOpen = (ws: IcWebSocket<any, any> | null) =>
  !!ws && (ws as any).readyState === WebSocket.OPEN;

// ===== RTC =====
const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: [`turn:${HOST}:${PORT}?transport=udp`], username: USER, credential: CREDENTIAL },
    { urls: [`turn:${HOST}:${PORT}?transport=tcp`], username: USER, credential: CREDENTIAL },
  ],
  iceTransportPolicy: "relay",
  bundlePolicy: "max-bundle",
  iceCandidatePoolSize: 3,
};

type PeerEntry = {
  pc: RTCPeerConnection;
  dc?: RTCDataChannel;
  dcChat?: RTCDataChannel;
  connected: boolean;
  audioTrans?: RTCRtpTransceiver | null;
};

type DoorMsg = { t: "door"; col: number; row: number; open: boolean; silent?: boolean };
type SpinMsg = { t: "spin"; dur?: number };

// ===== Game world size =====
const CANVAS_W = TILE * MAP_COLS;
const CANVAS_H = TILE * MAP_ROWS;

const PLAYER = 32;
const SPEED = 120;

const HITBOX_LEFT = 6;
const HITBOX_RIGHT = 6;
const HITBOX_TOP = 2;
const HITBOX_BOTTOM = 0;

const HITBOX_W = PLAYER - HITBOX_LEFT - HITBOX_RIGHT;
const HITBOX_H = PLAYER - HITBOX_TOP - HITBOX_BOTTOM;

// ===== Proximity audio =====
const DEFAULT_AUDIO_RADIUS_TILES = 2;
const DOOR_SFX_RADIUS_TILES = 1;

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
        if (dx === 0 && dy === 0) continue;
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

const SPAWN_COL_MIN = 8;
const SPAWN_COL_MAX = 13;
const SPAWN_ROW_MIN = 15;
const SPAWN_ROW_MAX = 22;

const randInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const pickSpawnTile = () => {
  const MAX_TRIES = 40;
  for (let i = 0; i < MAX_TRIES; i++) {
    const col = randInt(SPAWN_COL_MIN, SPAWN_COL_MAX);
    const row = randInt(SPAWN_ROW_MIN, SPAWN_ROW_MAX);
    if (!isSolidTile(col, row)) return { col, row };
  }
  for (let row = SPAWN_ROW_MIN; row <= SPAWN_ROW_MAX; row++) {
    for (let col = SPAWN_COL_MIN; col <= SPAWN_COL_MAX; col++) {
      if (!isSolidTile(col, row)) return { col, row };
    }
  }
  return { col: 9, row: 5 };
};

const tileSpawnPx = () => {
  const { col, row } = pickSpawnTile();
  return {
    x: col * TILE + Math.floor((TILE - PLAYER) / 2),
    y: row * TILE + Math.floor((TILE - PLAYER) / 2),
  };
};

type Player = { x: number; y: number; color: string; label: string };
const colorFor = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return `hsl(${h} 80% 60%)`;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ===== DC payload =====
type PosMsg = {
  t: "pos";
  x: number;
  y: number;
  moving?: boolean;
  face?: 1 | -1;
};

type MetaMsg = {
  t: "meta";
  label: string;
  outfit?: string[];
};

// Chat payload
type ChatWireMsg = {
  t: "chat";
  text: string;
  ts?: number;
  from?: string;
};

type ChatItem = {
  id: string;
  from: string;
  label: string;
  text: string;
  ts: number;
  self: boolean;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ===== Helper: device type =====
const isTouchLike = () => {
  if (typeof window === "undefined") return false;
  return (
    ("ontouchstart" in window) ||
    (navigator as any).maxTouchPoints > 0 ||
    (window.matchMedia && window.matchMedia("(pointer: coarse)").matches)
  );
};

const Websocket: React.FC = () => {
  const { isAuthenticated, login, isLoading: authLoading, identity, principalId, user } = useAuth();
  const navigate = useNavigate();

  const signIdentity = useMemo<SignIdentity | null>(
    () => (isSignIdentity(identity) ? identity : null),
    [identity]
  );

  // ===== viewport & zoom =====
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewSizeRef = useRef({ w: 0, h: 0 }); // css px

  const BASE_ZOOM = 2;
  const [zoom, setZoom] = useState(2);
  const DISPLAY_MIN = 1;
  const DISPLAY_MAX = 4;
  const minZoomRef = useRef(DISPLAY_MIN);
  const clampZoom = (z: number) => Math.max(DISPLAY_MIN, Math.min(DISPLAY_MAX, z));
  const onZoomIn = () => setZoom((z) => clampZoom(z * 1.2));
  const onZoomOut = () => setZoom((z) => clampZoom(z / 1.2));
  const zoomRef = useRef(zoom);
  const zoomSpring = useSpring(zoom, { stiffness: 220, damping: 28, mass: 0.7 });

  useEffect(() => {
    zoomSpring.set(zoom);
  }, [zoom, zoomSpring]);

  useEffect(() => {
    const unsub = zoomSpring.on("change", (v) => {
      zoomRef.current = clampZoom(v);
    });
    return unsub;
  }, [zoomSpring]);

  // ===== UI state =====
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState<string[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [trace, setTrace] = useState<string[]>([]);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showPixelReveal, setShowPixelReveal] = useState(false);
  const [labelsVersion, setLabelsVersion] = useState(0);
  const [peersVersion, setPeersVersion] = useState(0);
  const [showOutfit, setShowOutfit] = useState(false);
  const [mySlots, setMySlots] = useState<OutfitSlotsArray>(DEFAULT_OUTFIT);
  const [inviteCopied, setInviteCopied] = useState(false);
  const onInviteClick = async () => {
    await copyInvite();
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 1500);
  };

  // Outfit UI state
  const [activeSlot, setActiveSlot] = useState<string>(OUTFIT_SLOT_ORDER[0]);
  const previewRef = useRef<HTMLCanvasElement | null>(null);

  // Keep a snapshot of the *applied* outfit so we can safely revert on close/cancel
  const originalSlotsRef = useRef<OutfitSlotsArray>(DEFAULT_OUTFIT);
  const shouldRevertRef = useRef(false);

  /** Open the Outfit editor using the APPLIED outfit as the source of truth */
  const openOutfit = () => {
    const meId = principalIdRef.current;
    // Prefer the applied outfit stored in playerOutfitSlotsRef; fallback to current mySlots
    const applied = (meId && playerOutfitSlotsRef.current[meId]) || mySlots;
    originalSlotsRef.current = (applied.slice() as OutfitSlotsArray);

    // Start editor from the applied snapshot
    setMySlots(originalSlotsRef.current);
    shouldRevertRef.current = true;
    setShowOutfit(true);
  };

  /** Close the Outfit editor. If not committing, roll back to the snapshot */
  const closeOutfit = (commit = false) => {
    if (!commit && shouldRevertRef.current) {
      setMySlots(originalSlotsRef.current);
    }
    shouldRevertRef.current = false;
    setShowOutfit(false);
  };

  const onCancelOutfit = () => closeOutfit(false);

  useEffect(() => {
    const cvs = previewRef.current;
    const parts = partsRef.current;
    const lib = outfitLibRef.current;
    if (!cvs || !parts || !lib || !showOutfit) return;

    const ctx = cvs.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const W = 160, H = 160;

    // setup canvas
    cvs.width = W * dpr; cvs.height = H * dpr;
    cvs.style.width = W + "px"; cvs.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);

    const activeOutfit = buildActiveOutfit(lib, mySlots);

    const scale = 3;
    const spriteW = PLAYER * scale;
    const x = Math.floor(W / 2 - spriteW / 2);
    const y = Math.floor(H / 2 - spriteW / 2) + 8;

    drawPlayerSprite(
      ctx,
      parts,
      x,
      y,
      scale,
      { phase: 0, amp: 0 },
      false,
      activeOutfit,
      { speaking: false, talkBlink: false }
    );
  }, [mySlots, showOutfit, peersVersion]);

  // sinkron dari backend saat masuk
  useEffect(() => {
    (async () => {
      if (!principalId) return;
      try {
        const slots = await canisterService.getUserOutfit(Principal.fromText(principalId));
        const norm = normalizeSlots(slots);
        setMySlots(norm);
        setOutfitSlotsFor(principalId, norm);
        broadcastSelfMeta();
      } catch { }
    })();
  }, [principalId]);

  const onApplyOutfit = async () => {
    try {
      const res = await canisterService.setMyOutfit(mySlots);
      if ("Err" in res) throw new Error((res as any).Err);

      if (principalId) {
        setOutfitSlotsFor(principalId, mySlots);
        broadcastSelfMeta();
      }

      closeOutfit(true);
      log("Outfit saved");
    } catch (e) {
      log(`Outfit save failed: ${String(e)}`);
    }
  };

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
    return { armFrontRot: angle };
  };

  // Outfit
  const playerOutfitSlotsRef = useRef<Record<string, OutfitSlotsArray>>({});
  const playerOutfitPartsRef = useRef<Record<string, OutfitParts | undefined>>({});
  const outfitVersion = useRef(0);

  // Mobile joystick toggle (auto on touch devices)
  const [useJoystick, setUseJoystick] = useState(false);
  useEffect(() => {
    setUseJoystick(isTouchLike());
    const media = window.matchMedia?.("(pointer: coarse)");
    const handler = () => setUseJoystick(isTouchLike());
    media?.addEventListener?.("change", handler);
    return () => media?.removeEventListener?.("change", handler);
  }, []);

  // Chat UI
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatLog, setChatLog] = useState<ChatItem[]>([]);
  const chatListRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const typingChatRef = useRef(false);

  const scrollChatToBottom = () => {
    const el = chatListRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };
  useEffect(() => { scrollChatToBottom(); }, [chatLog.length, showChat]);

  // Mic/UI
  const [micOn, setMicOn] = useState(false);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>("");
  const [showMicSettings, setShowMicSettings] = useState(false);
  const [micLevel, setMicLevel] = useState(0);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      if (showMicSettings) {
        const me = principalIdRef.current;
        if (me) {
          const lvl = levelFromAnalyser(me);
          setMicLevel(lvl || 0);
        }
        raf = requestAnimationFrame(loop);
      }
    };
    if (showMicSettings) raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [showMicSettings]);

  // PHASE
  type Phase = "idle" | "connecting" | "joining" | "waiting" | "ready";
  const [uiJoinPhase, setUiJoinPhase] = useState<Phase>("idle");
  const uiPhaseRef = useRef<Phase>("idle");
  useEffect(() => { uiPhaseRef.current = uiJoinPhase; }, [uiJoinPhase]);
  const [joinProgress, setJoinProgress] = useState({ connected: 0, total: 0 });
  const isPlaying = () => uiPhaseRef.current === "waiting" || uiPhaseRef.current === "ready";

  // logs
  const pad = (n: number, w = 2) => n.toString().padStart(w, "0");
  const tag = () => {
    const d = new Date();
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
  };
  const log = (s: string) => setLogs((l) => [...l, `[${tag()}] ${s}`]);
  const tlog = (s: string) => setTrace((l) => [...l, `[${tag()}] ${s}`]);

  // ===== WS refs =====
  const wsRef = useRef<IcWebSocket<any, any> | null>(null);
  const closingRef = useRef(false);
  const epochRef = useRef(0);

  const deferNow = (fn: () => void, ms = 0) => {
    const e = epochRef.current;
    setTimeout(() => { if (e !== epochRef.current) return; try { fn(); } catch { } }, ms);
  };

  // inbound/send coordination
  const inOnMsgRef = useRef(false);
  const anyWaitersRef = useRef<Array<() => void>>([]);
  const notifyAnyInbound = () => {
    const w = anyWaitersRef.current.splice(0);
    w.forEach((res) => { try { res(); } catch { } });
  };
  const waitNextInbound = (timeoutMs = 3500) =>
    new Promise<void>((resolve) => {
      let done = false;
      const end = () => { if (!done) { done = true; resolve(); } };
      anyWaitersRef.current.push(end);
      setTimeout(end, timeoutMs);
    });

  type Watcher = { match: (m: WsMessage) => boolean; resolve: () => void; t: any };
  const watchersRef = useRef<Watcher[]>([]);
  const waitSpecificInbound = (match: (m: WsMessage) => boolean, timeoutMs = 4500) =>
    new Promise<void>((resolve) => {
      const w: Watcher = { match, resolve: () => { try { resolve(); } catch { } }, t: null };
      w.t = setTimeout(() => {
        const i = watchersRef.current.indexOf(w);
        if (i >= 0) watchersRef.current.splice(i, 1);
        w.resolve();
      }, timeoutMs);
      watchersRef.current.push(w);
    });
  const fireWatchers = (msg: WsMessage) => {
    for (let i = watchersRef.current.length - 1; i >= 0; i--) {
      const w = watchersRef.current[i];
      if (w.match(msg)) {
        watchersRef.current.splice(i, 1);
        clearTimeout(w.t);
        w.resolve();
      }
    }
  };

  // anti double-mount
  const didInitRef = useRef(false);

  // aux
  const participantsCountRef = useRef(0);
  const lastParticipantsAtRef = useRef(0);
  useEffect(() => { participantsCountRef.current = participants.length; }, [participants]);

  // ICE throttle per peer
  const iceOutboxRef = useRef<Record<string, any[]>>({});
  const iceTimerRef = useRef<Record<string, any>>({});
  const canSendIceRef = useRef<Record<string, boolean>>({});
  const enableIceSend = (peerId: string) => {
    if (canSendIceRef.current[peerId]) return;
    canSendIceRef.current[peerId] = true;
    if (iceOutboxRef.current[peerId]?.length && !iceTimerRef.current[peerId]) {
      startIceFlush(peerId);
    }
  };

  // Peering rules
  const selfJoinedRef = useRef(false);
  const existingAtJoinRef = useRef<Set<string>>(new Set());
  const initiatorToRef = useRef<Set<string>>(new Set());
  const joinedAfterMeRef = useRef<Set<string>>(new Set());

  // RTC maps
  const peersRef = useRef<Map<string, PeerEntry>>(new Map());
  const playersRef = useRef<Map<string, Player>>(new Map());
  const overlayCvsRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const activeRoomIdRef = useRef<string | null>(null);
  const principalIdRef = useRef<string | null>(null);
  const makingOfferRef = useRef<Record<string, boolean>>({});
  const pendingIceRef = useRef<Record<string, RTCIceCandidateInit[]>>({});

  // READY gating
  const expectedPeersRef = useRef<Set<string>>(new Set());
  const announcedReadyRef = useRef(false);
  const peerReadyRef = useRef<Record<string, boolean>>({});
  const isPeerGloballyReady = (pid: string) => peerReadyRef.current[pid] !== false;

  // AUDIO refs
  const localStreamRef = useRef<MediaStream | null>(null);
  const localAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const audioSendersRef = useRef<Record<string, RTCRtpSender | null>>({});
  const sendingToRef = useRef<Record<string, boolean>>({});
  const remoteAudioElsRef = useRef<Record<string, HTMLAudioElement | null>>({});
  const audioContainerRef = useRef<HTMLDivElement | null>(null);
  const lastAudioZoneUpdateRef = useRef(0);

  // WebAudio VAD
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef<Record<string, { analyser: AnalyserNode; data: Uint8Array }>>({});
  const lastLoudAtRef = useRef<Record<string, number>>({});
  const speakingRef = useRef<Record<string, boolean>>({});
  const talkBlinkRef = useRef<Record<string, boolean>>({});
  const lastBlinkAtRef = useRef<Record<string, number>>({});
  const BLINK_MS = 200;
  const VAD_HOLD_MS = 200;
  const VAD_THRESH = 0.02;

  // SFX door (open/close)
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
      // clone biar aman kalau overlap
      const el = base.cloneNode(true) as HTMLAudioElement;
      el.volume = base.volume;
      el.play().catch(() => { });
    } catch { }
  };

  // ===== Nama/label =====
  const normalizeLabel = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 24);
  const computeMyDisplayName = () => {
    const raw = (String(user?.name || "").trim() || String(user?.username || "").trim());
    return normalizeLabel(raw);
  };
  const labelCacheRef = useRef<Record<string, string>>({});
  const usernameCacheRef = useRef<Record<string, string>>({});

  const resolveRemoteLabel = async (pid: string) => {
    if (labelCacheRef.current[pid]) return labelCacheRef.current[pid];
    try {
      const principal = Principal.fromText(pid);
      const u: any = await canisterService.getUserByPrincipal(principal);

      const rawName = (String(u?.name || "").trim() || String(u?.username || "").trim());
      const label = normalizeLabel(rawName);

      const unameRaw = String(u?.username || "").trim();
      if (unameRaw) {
        usernameCacheRef.current[pid] = normalizeUsername(unameRaw);
      }

      if (label) {
        labelCacheRef.current[pid] = label;
        const p = playersRef.current.get(pid);
        if (p) p.label = label;
        setLabelsVersion((v) => v + 1);
      }
      return label || "";
    } catch (e) {
      log(`label fetch failed for ${pretty(pid)}: ${String(e)}`);
      return "";
    }
  };

  const normalizeUsername = (s: string) =>
    s.replace(/[^\w.-]+/g, "_").trim().slice(0, 24);

  const usernameFor = (pid: string) => {
    if (pid === principalId) {
      const me = String(user?.username || "").trim();
      return me ? normalizeUsername(me) : "";
    }
    return usernameCacheRef.current[pid] || "";
  };

  const broadcastDoor = (col: number, row: number, open: boolean) => {
    const wire: DoorMsg = { t: "door", col, row, open };
    const json = JSON.stringify(wire);
    for (const [, e] of peersRef.current) {
      const ch = e.dc && e.dc.readyState === "open" ? e.dc : null;
      if (ch) { try { ch.send(json); } catch { } }
    }
  };

  const broadcastArmSpin = (dur = ARM_SPIN_MS) => {
    const wire: SpinMsg = { t: "spin", dur };
    const json = JSON.stringify(wire);
    for (const [, e] of peersRef.current) {
      const ch = e.dc && e.dc.readyState === "open" ? e.dc : null;
      if (ch) { try { ch.send(json); } catch { } }
    }
  };

  // === SEND POS ===
  const sendSelfPosTo = (peerId: string) => {
    const e = peersRef.current.get(peerId);
    if (!e?.dc || e.dc.readyState !== "open") return;
    const meId = principalIdRef.current;
    if (!meId) return;

    const me = playersRef.current.get(meId) || ensurePlayer(meId);
    const movingNow = !!(inputRef.current.left || inputRef.current.right || inputRef.current.up || inputRef.current.down);

    const payload: PosMsg = {
      t: "pos",
      x: me.x,
      y: me.y,
      moving: movingNow,
      face: (faceDirRef.current[meId] ?? 1),
    };
    try { e.dc.send(JSON.stringify(payload)); } catch { }
    tlog(`⇢ sent snapshot pos → ${pretty(peerId)} (${Math.round(me.x)},${Math.round(me.y)})`);
  };

  const sendSelfMetaTo = (peerId: string) => {
    const e = peersRef.current.get(peerId);
    if (!e?.dc || e.dc.readyState !== "open") return;
    const myLabel = computeMyDisplayName();
    if (!myLabel) return;
    const meId = principalIdRef.current!;
    const slots = playerOutfitSlotsRef.current[meId] || DEFAULT_OUTFIT;
    try { e.dc.send(JSON.stringify({ t: "meta", label: myLabel, outfit: slots } as MetaMsg)); } catch { }
  };

  const broadcastSelfMeta = () => {
    const myLabel = computeMyDisplayName();
    if (!myLabel) return;
    const meId = principalIdRef.current!;
    const slots = playerOutfitSlotsRef.current[meId] || DEFAULT_OUTFIT;
    for (const [pid, e] of peersRef.current.entries()) {
      if (e.dc && e.dc.readyState === "open") {
        try { e.dc.send(JSON.stringify({ t: "meta", label: myLabel, outfit: slots } as MetaMsg)); } catch { }
      }
    }
  };

  const ensureAudioCtx = async () => {
    if (!audioCtxRef.current) {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new Ctx();
    }
    try { await audioCtxRef.current!.resume(); } catch { }
    return audioCtxRef.current!;
  };

  const attachAnalyser = async (pid: string, stream: MediaStream) => {
    const ctx = await ensureAudioCtx();
    const src = ctx.createMediaStreamSource(stream);
    const an = ctx.createAnalyser();
    an.fftSize = 1024;
    an.smoothingTimeConstant = 0.4;
    src.connect(an);
    analysersRef.current[pid] = { analyser: an, data: new Uint8Array(an.fftSize) };
  };

  const detachAnalyser = (pid: string) => {
    delete analysersRef.current[pid];
    delete lastLoudAtRef.current[pid];
    delete speakingRef.current[pid];
    delete talkBlinkRef.current[pid];
    delete lastBlinkAtRef.current[pid];
  };

  const levelFromAnalyser = (pid: string): number => {
    const e = analysersRef.current[pid];
    if (!e) return 0;
    const { analyser, data } = e;
    analyser.getByteTimeDomainData(data as unknown as Uint8Array<ArrayBuffer>);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / data.length);
    return rms;
  };

  useEffect(() => { activeRoomIdRef.current = activeRoomId; }, [activeRoomId]);
  useEffect(() => { principalIdRef.current = principalId; }, [principalId]);

  // Auto-join dari URL
  const [urlRoomId, setUrlRoomId] = useState<string | null>(null);
  const autoJoinStartedRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const m = window.location.pathname.match(/\/room\/([^/?#]+)/i);
    if (m && m[1]) {
      const rid = decodeURIComponent(m[1]).trim().toLowerCase();
      setUrlRoomId(rid);
      if (!isConnected) { setUiJoinPhase("connecting"); uiPhaseRef.current = "connecting"; }
    }
  }, [isConnected]);

  // World map
  const worldRef = useRef<WorldMap | null>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const world = await loadWorldMap();
        if (mounted) worldRef.current = world;
      } catch { worldRef.current = null; }
    })();
    return () => { mounted = false; };
  }, []);

  // Sprite parts
  const partsRef = useRef<SpriteParts | null>(null);
  const outfitLibRef = useRef<OutfitLibrary | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try { const parts = await loadSpriteParts(); if (mounted) partsRef.current = parts; } catch { }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const lib = await loadOutfitParts();   // returns OutfitLibrary
      if (!mounted) return;
      outfitLibRef.current = lib;
      // setelah library siap, re-build parts semua pemain
      for (const pid of playersRef.current.keys()) {
        recomputeOutfitFor(pid);
      }
      setPeersVersion(v => v + 1);
    })();
    return () => { mounted = false; };
  }, []);

  // outfit helper
  const recomputeOutfitFor = (pid: string) => {
    const lib = outfitLibRef.current || null;
    const slots = playerOutfitSlotsRef.current[pid] || DEFAULT_OUTFIT;
    playerOutfitPartsRef.current[pid] = buildActiveOutfit(lib, slots);
    outfitVersion.current++;
    setPeersVersion(v => v + 1);
  };

  const setOutfitSlotsFor = (pid: string, slots: string[] | null | undefined) => {
    playerOutfitSlotsRef.current[pid] = normalizeSlots(slots);
    recomputeOutfitFor(pid);
  };

  const fetchAndSetOutfit = async (pid: string) => {
    try {
      const uSlots = await canisterService.getUserOutfit(Principal.fromText(pid));
      setOutfitSlotsFor(pid, uSlots);
    } catch { }
  };

  // ===== Door helpers =====
  const doorSetRef = useRef<Set<string>>(new Set());
  const isDoorId = (id: number) => (id === DOOR_OPEN_ID || id === DOOR_CLOSED_ID);
  const doorKey = (c: number, r: number) => `${c},${r}`;

  const scanDoors = () => {
    const s = new Set<string>();
    for (let r = 0; r < MAP_ROWS; r++) {
      for (let c = 0; c < MAP_COLS; c++) {
        if (isDoorId(wallLayout[r][c] | 0)) s.add(doorKey(c, r));
      }
    }
    doorSetRef.current = s;
  };

  const sendDoorSnapshotTo = (peerId: string) => {
    const e = peersRef.current.get(peerId);
    if (!e?.dc || e.dc.readyState !== "open") return;

    for (const key of doorSetRef.current) {
      const [cStr, rStr] = key.split(",");
      const c = Number(cStr), r = Number(rStr);
      const open = isDoorOpen(c, r);
      const msg: DoorMsg = { t: "door", col: c, row: r, open, silent: true };
      try { e.dc.send(JSON.stringify(msg)); } catch { }
    }
  };

  const isDoorOpen = (c: number, r: number) => (wallLayout[r]?.[c] === DOOR_OPEN_ID);

  const rebuildWorld = async () => {
    try {
      const world = await loadWorldMap();
      worldRef.current = world;
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

    doorSetRef.current.add(`${c},${r}`);

    if (changed && !opts?.silent && canHearDoorAt(c, r)) {
      playDoorSfx(open);
    }

    await rebuildWorld();
    return changed;
  };

  const findAdjacentDoor = (tc: number, tr: number):
    | { col: number; row: number; open: boolean }
    | null => {
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    for (const [dx, dy] of dirs) {
      const c = tc + dx, r = tr + dy;
      if (r < 0 || r >= MAP_ROWS || c < 0 || c >= MAP_COLS) continue;
      const id = wallLayout[r][c] | 0;
      if (isDoorId(id)) return { col: c, row: r, open: id === DOOR_OPEN_ID };
    }
    return null;
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const world = await loadWorldMap();
        if (mounted) { worldRef.current = world; scanDoors(); }
      } catch { worldRef.current = null; }
    })();
    return () => { mounted = false; };
  }, []);

  const canHearDoorAt = (doorCol: number, doorRow: number): boolean => {
    const meId = principalIdRef.current;
    if (!meId) return false;
    const me = playersRef.current.get(meId);
    if (!me) return false;

    const { col: myCol, row: myRow } = centerTileOf(me.x, me.y);
    const dCheb = Math.max(Math.abs(myCol - doorCol), Math.abs(myRow - doorRow));
    return dCheb <= DOOR_SFX_RADIUS_TILES;
  };

  // Game helpers
  const ensurePlayer = (pid: string) => {
    const m = playersRef.current;
    if (m.has(pid)) return m.get(pid)!;
    const spawn = tileSpawnPx();
    const initialLabel = pid === principalId ? computeMyDisplayName() : (labelCacheRef.current[pid] || "");
    const p: Player = { x: spawn.x, y: spawn.y, color: colorFor(pid), label: initialLabel };
    m.set(pid, p);

    if (!playerOutfitSlotsRef.current[pid]) {
      setOutfitSlotsFor(pid, DEFAULT_OUTFIT);
      void fetchAndSetOutfit(pid);
    }

    if (pid !== principalId && !labelCacheRef.current[pid]) { void resolveRemoteLabel(pid); }
    return p;
  };

  const removePlayer = (pid: string) => { playersRef.current.delete(pid); };

  // Mic devices
  const refreshMics = async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const ins = list.filter((d) => d.kind === "audioinput");
      setMics(ins);
      if (!selectedMicId && ins[0]?.deviceId) setSelectedMicId(ins[0].deviceId);
    } catch { }
  };

  // AUDIO helpers
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
      const track = stream.getAudioTracks()[0];
      localStreamRef.current = stream;
      localAudioTrackRef.current = track;
      track.enabled = true;

      if (principalIdRef.current) await attachAnalyser(principalIdRef.current, stream);

      // FIX: setelah mic diambil, replace ke semua sender aktif
      for (const [pid] of peersRef.current) {
        const sender = audioSendersRef.current[pid];
        if (sender) { try { await sender.replaceTrack(track); } catch { } }
      }

      await refreshMics();
      log(`Mic acquired${deviceId ? ` (deviceId=${deviceId.slice(0, 6)}…)` : ""}`);
      return true;
    } catch (e) {
      log(`Mic error/denied: ${String(e)}`);
      return false;
    }
  };

  const switchMic = async (deviceId: string) => {
    try { localStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch { }
    localStreamRef.current = null;
    localAudioTrackRef.current = null;

    if (principalIdRef.current) detachAnalyser(principalIdRef.current);

    const ok = await acquireMic(deviceId);
    if (!ok) return;

    for (const pid of Array.from(peersRef.current.keys())) await setSendActiveForPeer(pid, false);
  };

  const setSendActiveForPeer = async (peerId: string, active: boolean) => {
    const sender = audioSendersRef.current[peerId];
    if (!sender) return;
    if (sendingToRef.current[peerId] === active) return;

    sendingToRef.current[peerId] = active;
    try {
      if (active) {
        if (!localAudioTrackRef.current) {
          const ok = await acquireMic(selectedMicId);
          if (!ok || !localAudioTrackRef.current) return;
        }
        if (localStreamRef.current && (sender as any).setStreams) {
          try { (sender as any).setStreams(localStreamRef.current); } catch { }
        }
        await sender.replaceTrack(localAudioTrackRef.current);
        try {
          const params = sender.getParameters();
          (params.encodings ||= [{}]);
          params.encodings[0].active = true;
          await sender.setParameters(params);
        } catch { }
      } else {
        await sender.replaceTrack(null);
        try {
          const params = sender.getParameters();
          (params.encodings ||= [{}]);
          params.encodings[0].active = false;
          await sender.setParameters(params);
        } catch { }
      }
    } catch { }
  };

  const primeSenderIfHaveMic = (peerId: string) => {
    const sender = audioSendersRef.current[peerId];
    const track = localAudioTrackRef.current;
    if (!sender || !track) return;
    try {
      if (localStreamRef.current && (sender as any).setStreams) {
        try { (sender as any).setStreams(localStreamRef.current); } catch { }
      }
      sender.replaceTrack(track).catch(() => { });
      sendingToRef.current[peerId] = true;
    } catch { }
  };

  // ====== RTC helpers ======
  const ensurePeer = (peerId: string): PeerEntry => {
    const map = peersRef.current;
    let e = map.get(peerId);
    if (e) return e;

    const pc = new RTCPeerConnection(rtcConfig);
    e = { pc, connected: false, audioTrans: null };
    map.set(peerId, e);

    // FIX: ✨ JANGAN tambah transceiver di sini. Lihat helper di bawah.

    pc.onconnectionstatechange = () => {
      e!.connected = pc.connectionState === "connected";
      log(`RTC[${pretty(peerId)}]: ${pc.connectionState}`);
      if (e!.connected) {
        ensurePlayer(peerId);
        void setSendActiveForPeer(peerId, micOn);
      }
      if (pc.connectionState === "failed" || "closed" === pc.connectionState) removePlayer(peerId);

      if (["connected", "disconnected", "failed", "closed"].includes(pc.connectionState)) {
        setPeersVersion((v) => v + 1);
      }

      if (["connected", "closed", "failed"].includes(pc.connectionState)) {
        const t = iceTimerRef.current[peerId];
        if (t) { clearTimeout(t as any); iceTimerRef.current[peerId] = null; }
      }
      checkSelfReadyAndAnnounce();
    };
    pc.oniceconnectionstatechange = () => { log(`ICE[${pretty(peerId)}]: ${pc.iceConnectionState}`); };
    pc.onicegatheringstatechange = () => { tlog(`gather[${pretty(peerId)}]: ${pc.iceGatheringState}`); };
    pc.onsignalingstatechange = () => { tlog(`signal[${pretty(peerId)}]: ${pc.signalingState}`); };

    pc.ontrack = async (ev) => {
      if (ev.track.kind !== "audio") return;
      const el = document.createElement("audio");
      el.autoplay = true;
      (el as any).playsInline = true;
      el.muted = true; // unmute via proximity
      el.volume = 1;
      const stream = ev.streams[0] ?? new MediaStream([ev.track]);
      el.srcObject = stream;
      remoteAudioElsRef.current[peerId] = el;
      audioContainerRef.current?.appendChild(el);
      el.play().catch(err => { log(`autoplay blocked (muted): ${String(err)}`); });
      log(`🔉 ontrack audio from ${pretty(peerId)}`);
      try { await attachAnalyser(peerId, stream); } catch { }
    };

    // 🆕 terima berbagai datachannel
    pc.ondatachannel = (ev) => {
      const ch = ev.channel;
      if (ch.label === "chat") {
        e!.dcChat = ch;
        hookChatDC(peerId, ch);
      } else {
        e!.dc = ch;
        hookGameDC(peerId, ch);
      }
    };

    pc.onicecandidate = (ev) => {
      const rid = activeRoomIdRef.current;
      if (!rid) return;
      if (ev.candidate) {
        const c = ev.candidate.toJSON();
        const opt = <T,>(v: T | null | undefined): [] | [T] => (v == null ? [] : [v]);
        const wireIce: any = {
          candidate: c.candidate || "",
          sdpMid: opt(c.sdpMid),
          sdpMLineIndex: opt(c.sdpMLineIndex != null ? Number(c.sdpMLineIndex) : null),
        };
        queueIceFor(peerId, wireIce);
        tlog(`⇢ enqueue ICE → ${pretty(peerId)} ${c.sdpMid ?? ""}/${c.sdpMLineIndex ?? ""}`);
      } else {
        tlog(`ICE gather complete → ${pretty(peerId)}`);
      }
    };

    return e;
  };

  const removePeer = (peerId: string) => {
    const e = peersRef.current.get(peerId);
    if (e) {
      try { e.dc?.close(); } catch { }
      try { e.dcChat?.close(); } catch { }
      try { e.pc.close(); } catch { }
    }
    peersRef.current.delete(peerId);
    removePlayer(peerId);

    try {
      audioSendersRef.current[peerId] = null;
      delete sendingToRef.current[peerId];
      const el = remoteAudioElsRef.current[peerId];
      if (el) { el.pause?.(); (el as any).srcObject = null; el.remove(); }
      delete remoteAudioElsRef.current[peerId];
    } catch { }
    detachAnalyser(peerId);
  };

  // ===== Facing & net-motion tracking =====
  const faceDirRef = useRef<Record<string, 1 | -1>>({});
  const remoteMovingRef = useRef<Record<string, boolean>>({});
  const lastPosAtRef = useRef<Record<string, number>>({});

  const NET_LAG_GRACE_MS = 220;

  // 🗨️ Bubble chat tracker
  const chatBubbleRef = useRef<Record<string, { text: string; until: number }>>({});
  const chatTalkUntilRef = useRef<Record<string, number>>({});

  const BUBBLE_MIN_MS = 5000;
  const BUBBLE_MAX_MS = 15000;
  const BUBBLE_BASE_MS = 5000;
  const BUBBLE_PER_CHAR_MS = 50;
  const BUBBLE_PER_NEWLINE_MS = 250;

  const BUBBLE_FONT = "13px ui-monospace, SFMono-Regular, Menlo, monospace";
  const BUBBLE_MAX_W = 220;
  const BUBBLE_LINE_H = 16;

  const bubbleDurationFor = (text: string) => {
    const clean = String(text ?? "");
    const len = clean.length;
    const nl = (clean.match(/\n/g)?.length ?? 0);
    const ms = BUBBLE_BASE_MS
      + BUBBLE_PER_CHAR_MS * Math.min(len, 240)
      + BUBBLE_PER_NEWLINE_MS * nl;
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
        if (ctx.measureText(test).width <= maxW) {
          cur = test;
          continue;
        }
        if (!cur) {
          let chunk = "";
          for (const ch of w) {
            const trial = chunk + ch;
            if (ctx.measureText(trial).width <= maxW) chunk = trial;
            else { if (chunk) lines.push(chunk); chunk = ch; }
          }
          if (chunk) { lines.push(chunk); }
        } else {
          lines.push(cur);
          cur = w;
        }
      }
      if (cur) lines.push(cur);
    }
    return lines;
  };

  // === DC: GAME (pos/meta/ready)
  const hookGameDC = (peerId: string, dc: RTCDataChannel) => {
    dc.onopen = () => {
      log(`DC(game) open → ${pretty(peerId)}`);
      sendSelfMetaTo(peerId);
      sendSelfPosTo(peerId);
      if (joinedAfterMeRef.current.has(peerId)) {
        sendDoorSnapshotTo(peerId);
      }
      checkSelfReadyAndAnnounce();
    };
    dc.onclose = () => log(`DC(game) close → ${pretty(peerId)}`);
    dc.onerror = (e) => log(`DC(game) error → ${pretty(peerId)}: ${String(e)}`);
    dc.onmessage = (ev) => {
      try {
        const msg: PosMsg | MetaMsg | any = JSON.parse(ev.data);

        if (msg?.t === "meta") {
          const label = normalizeLabel(String(msg.label || ""));
          const p = ensurePlayer(peerId);
          if (label) {
            p.label = label;
            labelCacheRef.current[peerId] = label;
          }
          if (Array.isArray(msg.outfit)) {
            setOutfitSlotsFor(peerId, msg.outfit);
          }
          return;
        }

        if (msg?.t === "pos") {
          const p = ensurePlayer(peerId);
          const oldX = p.x, oldY = p.y;
          p.x = msg.x; p.y = msg.y;

          if (msg.face === 1 || msg.face === -1) {
            faceDirRef.current[peerId] = msg.face;
          } else {
            const dx = p.x - oldX;
            if (dx > 0.1) faceDirRef.current[peerId] = 1;
            else if (dx < -0.1) faceDirRef.current[peerId] = -1;
          }

          if (typeof msg.moving === "boolean") {
            remoteMovingRef.current[peerId] = msg.moving;
          } else {
            const moved = Math.hypot(p.x - oldX, p.y - oldY) > 0.5;
            remoteMovingRef.current[peerId] = moved;
          }

          lastPosAtRef.current[peerId] = performance.now();
          return;
        }

        if (msg?.t === "ready") {
          peerReadyRef.current[peerId] = true;
          log(`Peer ready → ${pretty(peerId)}`);
          setPeersVersion((v) => v + 1);
        }

        if (msg?.t === "door") {
          const m = msg as DoorMsg;
          void setDoor(m.col, m.row, m.open, { silent: !!m.silent });
          return;
        }

        if (msg?.t === "spin") {
          const dur = typeof msg.dur === "number" ? msg.dur : ARM_SPIN_MS;
          triggerArmSpin(peerId, dur);
          return;
        }

      } catch { }
    };
  };

  // === DC: CHAT (reliable ordered)
  const hookChatDC = (peerId: string, dc: RTCDataChannel) => {
    dc.onopen = () => { log(`DC(chat) open → ${pretty(peerId)}`); };
    dc.onclose = () => log(`DC(chat) close → ${pretty(peerId)}`);
    dc.onerror = (e) => log(`DC(chat) error → ${pretty(peerId)}: ${String(e)}`);
    dc.onmessage = (ev) => {
      try {
        const data: any = JSON.parse(ev.data);
        if (data?.t === "chat") {
          const from = data.from || peerId;
          const ts = typeof data.ts === "number" ? data.ts : Date.now();
          const text = String(data.text ?? "");
          addChatMessage(from, text, ts, /*self*/ false);
        }
      } catch { }
    };
  };

  // READY check
  const checkSelfReadyAndAnnounce = () => {
    if (uiPhaseRef.current !== "waiting") return;
    const expected = expectedPeersRef.current;
    const total = expected.size;
    let connected = 0;
    for (const pid of expected) {
      const e = peersRef.current.get(pid);
      const dcOpen = !!(e?.dc && e.dc.readyState === "open");
      if (e?.connected && dcOpen) connected++;
    }
    setJoinProgress({ connected, total });
    if (total === 0 || connected < total) return;

    if (!announcedReadyRef.current) {
      announcedReadyRef.current = true;
      for (const [, e] of peersRef.current) {
        if (e.dc && e.dc.readyState === "open") {
          try { e.dc.send(JSON.stringify({ t: "ready" })); } catch { }
        }
      }
    }
    setUiJoinPhase("ready"); uiPhaseRef.current = "ready";
  };

  // FIX: helper — hanya initiator yang menambah transceiver
  const ensureInitiatorAudio = (peerId: string) => {
    const e = ensurePeer(peerId);
    if (e.audioTrans) return e.audioTrans;
    const init: RTCRtpTransceiverInit = { direction: "sendrecv" };
    if (localStreamRef.current) (init as any).streams = [localStreamRef.current];
    const tr = e.pc.addTransceiver("audio", init);
    e.audioTrans = tr;
    audioSendersRef.current[peerId] = tr.sender;
    sendingToRef.current[peerId] = false;
    if (localAudioTrackRef.current) {
      try {
        if (localStreamRef.current && (tr.sender as any).setStreams) {
          try { (tr.sender as any).setStreams(localStreamRef.current); } catch { }
        }
        tr.sender.replaceTrack(localAudioTrackRef.current).catch(() => { });
        sendingToRef.current[peerId] = true;
      } catch { }
    }
    return tr;
  };

  // FIX: helper — responder pakai transceiver yang datang dari Offer
  const ensureResponderAudioFromOffer = (peerId: string) => {
    const e = ensurePeer(peerId);
    // Ambil transceiver audio yang dibuat otomatis setelah setRemoteDescription(offer)
    let tr =
      e.pc.getTransceivers().find((t) => t.receiver && t.receiver.track && t.receiver.track.kind === "audio") ||
      e.audioTrans ||
      null;

    if (!tr) {
      // fallback (jarang perlu): kalau belum ada, baru buat
      tr = e.pc.addTransceiver("audio", { direction: "sendrecv" });
    }

    e.audioTrans = tr;
    tr.direction = "sendrecv";
    audioSendersRef.current[peerId] = tr.sender;

    if (localAudioTrackRef.current) {
      try {
        if (localStreamRef.current && (tr.sender as any).setStreams) {
          try { (tr.sender as any).setStreams(localStreamRef.current); } catch { }
        }
        tr.sender.replaceTrack(localAudioTrackRef.current).catch(() => { });
        sendingToRef.current[peerId] = true;
      } catch { }
    }
    return tr;
  };

  const canSignalNow = () => selfJoinedRef.current && wsIsOpen(wsRef.current);

  const createOfferTo = async (peerId: string) => {
    const rid = activeRoomIdRef.current;
    if (!rid) return;

    const e = ensurePeer(peerId);
    makingOfferRef.current[peerId] = true;

    try {
      // FIX: hanya initiator yang menambah transceiver audio
      ensureInitiatorAudio(peerId);

      // Datachannel dibuat oleh initiator
      if (!e.dc) {
        e.dc = e.pc.createDataChannel("game", { ordered: false, maxRetransmits: 0 });
        hookGameDC(peerId, e.dc);
      }
      if (!e.dcChat) {
        e.dcChat = e.pc.createDataChannel("chat");
        hookChatDC(peerId, e.dcChat);
      }

      const offer = await e.pc.createOffer();
      await e.pc.setLocalDescription(offer);

      deferNow(() => {
        if (!canSignalNow()) return;
        wsSend(
          { RtcSend: { roomId: rid, to: Principal.fromText(peerId), payload: { Offer: offer.sdp! } } },
          (m) => {
            if (!("RtcFrom" in m || "RtcHelloFrom" in m)) return false;
            if ("RtcFrom" in m) return toPid(m.RtcFrom.from) === peerId;
            return toPid((m as any).RtcHelloFrom.from) === peerId;
          }
        );
      }, 0);

      log(`→ offer (joiner) to ${pretty(peerId)}`);
    } finally {
      makingOfferRef.current[peerId] = false;
    }
  };

  const addRemoteIce = async (peerId: string, cand: RTCIceCandidateInit) => {
    const pc = ensurePeer(peerId).pc;
    if (pc.remoteDescription) {
      try { await (pc as any).addIceCandidate(cand); }
      catch (e) { log(`addIceCandidate failed: ${String(e)}`); }
    } else {
      (pendingIceRef.current[peerId] ||= []).push(cand);
    }
  };
  const flushPendingIce = async (peerId: string) => {
    const pend = pendingIceRef.current[peerId];
    if (!pend || !pend.length) return;
    const pc = ensurePeer(peerId).pc;
    for (const c of pend) { try { await (pc as any).addIceCandidate(c); } catch (e) { log(`flush ICE: ${String(e)}`); } }
    delete pendingIceRef.current[peerId];
  };

  // Strict sender
  const OUTBOUND_TIMEOUT_MS = 6000;
  const computeMinGap = (obj: WsMessage) => {
    const manyPeers = participantsCountRef.current >= 5;

    if ("RtcSend" in obj) {
      const pay = (obj as any).RtcSend.payload || {};
      if ("Ice" in pay) {
        return manyPeers ? 110 : 70;
      }
      if ("Offer" in pay || "Answer" in pay) {
        return manyPeers ? 140 : 100;
      }
      return manyPeers ? 140 : 100;
    }

    if ("RoomJoin" in obj || "Subscribe" in obj) return manyPeers ? 140 : 90;

    return manyPeers ? 140 : 0;
  };

  const sendTailRef = useRef<Promise<void>>(Promise.resolve());
  const wsSend = (obj: WsMessage, expect?: (m: WsMessage) => boolean, minGapMs?: number) => {
    if (closingRef.current) return;
    sendTailRef.current = sendTailRef.current
      .then(async () => {
        while (!wsIsOpen(wsRef.current) || closingRef.current) await sleep(15);
        while (inOnMsgRef.current) await sleep(0);
        if (!wsIsOpen(wsRef.current) || closingRef.current) return;

        wsRef.current!.send(obj);
        tlog(`⇢ send ${Object.keys(obj)[0]} ${JSON.stringify(obj)}`);

        if (expect) { await waitSpecificInbound(expect, OUTBOUND_TIMEOUT_MS); }
        else { await waitNextInbound(OUTBOUND_TIMEOUT_MS); }
        const gap = minGapMs ?? computeMinGap(obj);
        if (gap > 0) await sleep(gap);
      })
      .catch(() => { });
  };

  // ICE throttle per peer
  const startIceFlush = (peerId: string) => {
    const rid = activeRoomIdRef.current;
    if (!rid) return;

    const JITTER = () => 90 + Math.floor(Math.random() * 90);
    const myEpoch = epochRef.current;

    const flushOne = async () => {
      if (myEpoch !== epochRef.current) {
        clearTimeout(iceTimerRef.current[peerId]);
        iceTimerRef.current[peerId] = null;
        iceOutboxRef.current[peerId] = [];
        return;
      }

      const q = iceOutboxRef.current[peerId];
      if (!q || q.length === 0 || !canSendIceRef.current[peerId]) {
        clearTimeout(iceTimerRef.current[peerId]);
        iceTimerRef.current[peerId] = null;
        return;
      }

      if (!canSignalNow()) {
        clearTimeout(iceTimerRef.current[peerId]);
        iceTimerRef.current[peerId] = null;
        return;
      }

      const one = q.shift();
      const obj: WsMessage = {
        RtcSend: { roomId: rid!, to: Principal.fromText(peerId), payload: { Ice: one } as any }
      };
      while (inOnMsgRef.current) await sleep(0);
      wsSend(obj, undefined, 0);
      tlog(`⇢ send(ICE) (pipelined) ${JSON.stringify(obj)}`);

      iceTimerRef.current[peerId] = setTimeout(() => { void flushOne(); }, JITTER());
    };

    if (!iceTimerRef.current[peerId]) {
      iceTimerRef.current[peerId] = setTimeout(() => { void flushOne(); }, JITTER());
    }
  };

  const queueIceFor = (peerId: string, wireIce: any) => {
    (iceOutboxRef.current[peerId] ||= []).push(wireIce);
    if (canSendIceRef.current[peerId]) {
      if (!iceTimerRef.current[peerId]) startIceFlush(peerId);
    }
  };

  // Connect once
  useEffect(() => {
    if (!signIdentity) return;
    if (didInitRef.current) return;
    didInitRef.current = true;

    const wsConfig = createWsConfig({
      canisterId,
      canisterActor: backend,
      identity: signIdentity,
      networkUrl: icUrl,
      ackMessageIntervalMs: interval,
    });

    const socket = new IcWebSocket(gatewayUrl, undefined, wsConfig);
    wsRef.current = socket;
    closingRef.current = false;

    socket.onopen = () => {
      epochRef.current++;
      setIsConnected(true);
      log("WS connected");
      tlog("WS open");
      closingRef.current = false;
    };

    socket.onclose = (ev: CloseEvent & { reason?: string }) => {
      setIsConnected(false);
      closingRef.current = true;

      const reason = (ev as any).reason || "";
      log(`WS disconnected${reason ? ` (reason: ${reason})` : ""}`);
      tlog(`WS close${reason ? `: ${reason}` : ""}`);

      sendTailRef.current = Promise.resolve();
      anyWaitersRef.current.splice(0).forEach((r) => r());
      watchersRef.current.splice(0).forEach((w) => { clearTimeout(w.t); w.resolve(); });

      Object.values(iceTimerRef.current).forEach((t) => clearTimeout(t as any));
      iceTimerRef.current = {};
    };

    socket.onerror = (e) => {
      closingRef.current = true;
      log(`WS error: ${String(e)}`);
      tlog(`WS error: ${String(e)}`);
      anyWaitersRef.current.splice(0).forEach((r) => r());
      watchersRef.current.splice(0).forEach((w) => { clearTimeout(w.t); w.resolve(); });
      Object.values(iceTimerRef.current).forEach((t) => clearTimeout(t as any));
      iceTimerRef.current = {};
    };

    const dialTo = async (targets: string[], reason: string) => {
      if (!targets.length) return;
      log(`dialing ${targets.length} peer(s) due to ${reason}`);

      const LIMIT = 3;
      const queue = [...targets];

      const runOne = async (pid: string) => {
        try {
          initiatorToRef.current.add(pid);
          ensurePeer(pid);
          await createOfferTo(pid);
          await sleep(40);
        } catch (e) {
          log(`dial error to ${pretty(pid)}: ${String(e)}`);
        }
      };

      const workers: Promise<void>[] = [];
      for (let i = 0; i < Math.min(LIMIT, queue.length); i++) {
        workers.push((async () => {
          while (queue.length) {
            const pid = queue.shift()!;
            await runOne(pid);
          }
        })());
      }
      await Promise.allSettled(workers);
    };

    socket.onmessage = async (ev: MessageEvent) => {
      inOnMsgRef.current = true;
      const data = ev.data as WsMessage;
      tlog(`⇠ recv ${Object.keys(data || {})[0]} ${JSON.stringify(data)}`);

      try {
        if (!data || typeof data !== "object") return;
        fireWatchers(data);
        notifyAnyInbound();

        if ("Participants" in data) {
          const now = Date.now();
          if (now - lastParticipantsAtRef.current < 350) return;
          lastParticipantsAtRef.current = now;

          const rid = data.Participants.roomId;
          const arr = data.Participants.participants.map(toPid);
          setParticipants(arr);
          log(`Snapshot[${rid}]: ${arr.length} participants`);

          const me = principalIdRef.current;
          if (me) {
            const others = arr.filter((p) => p !== me);
            others.forEach((pid) => { void resolveRemoteLabel(pid); });

            if (!selfJoinedRef.current) {
              for (const pid of others) {
                if (!existingAtJoinRef.current.has(pid)) {
                  existingAtJoinRef.current.add(pid);
                  ensurePeer(pid);
                  tlog(`queue existing-before-self-join ${pretty(pid)}`);
                }
              }
            } else {
              if (uiPhaseRef.current === "waiting") {
                const before = new Set(expectedPeersRef.current);
                for (const pid of Array.from(expectedPeersRef.current)) {
                  if (!others.includes(pid)) {
                    expectedPeersRef.current.delete(pid);
                    tlog(`expected-peers trimmed (gone): ${pretty(pid)}`);
                  }
                }
                if (before.size !== expectedPeersRef.current.size) checkSelfReadyAndAnnounce();
              }
              const targets = others
                .filter((pid) => !initiatorToRef.current.has(pid))
                .filter((pid) => !joinedAfterMeRef.current.has(pid));
              if (targets.length) await dialTo(targets, "participants-after-self-join");
            }
          }
          return;
        }

        if ("Joined" in data) {
          const rid = data.Joined.roomId;
          const who = toPid(data.Joined.who);
          const me = principalIdRef.current;
          if (!me) return;

          setParticipants((prev) => (prev.includes(who) ? prev : [...prev, who]));

          if (who === me) {
            selfJoinedRef.current = true;
            const queued = Array.from(existingAtJoinRef.current);
            existingAtJoinRef.current.clear();

            announcedReadyRef.current = false;
            expectedPeersRef.current = new Set(queued);
            if (queued.length > 0) {
              setUiJoinPhase("waiting"); uiPhaseRef.current = "waiting";
              setJoinProgress({ connected: 0, total: queued.length });
            } else {
              setUiJoinPhase("ready"); uiPhaseRef.current = "ready";
            }

            log(`Joined(self) in ${rid} — will initiate to ${queued.length} existing peer(s)`);
            if (queued.length) await sleep(0);

            deferNow(() => {
              if (!canSignalNow()) return;
              wsSend({ RtcHello: { roomId: rid } }, (m) => "RtcHelloFrom" in m);
            }, 0);

            checkSelfReadyAndAnnounce();
          } else {
            void resolveRemoteLabel(who);

            if (!selfJoinedRef.current) {
              existingAtJoinRef.current.add(who);
              tlog(`queue existing-before-self-join (via Joined) ${pretty(who)}`);
            } else {
              joinedAfterMeRef.current.add(who);
              ensurePeer(who);
              log(`New peer after self-join: ${pretty(who)} (waiting for offer)`);
              peerReadyRef.current[who] = false;
              setTimeout(() => {
                const e = peersRef.current.get(who);
                if (e?.connected && peerReadyRef.current[who] === false) {
                  peerReadyRef.current[who] = true;
                  log(`Peer auto-ready (timeout) → ${pretty(who)}`);
                  setPeersVersion((v) => v + 1);
                }
              }, 20000);
            }
          }
          return;
        }

        if ("Left" in data) {
          const who = toPid(data.Left.who);
          setParticipants((prev) => prev.filter((x) => x !== who));
          removePeer(who);
          log(`Left: ${pretty(who)}`);

          if (uiPhaseRef.current === "waiting" && expectedPeersRef.current.has(who)) {
            expectedPeersRef.current.delete(who);
            tlog(`expected-peers trimmed (left): ${pretty(who)}`);
            checkSelfReadyAndAnnounce();
          }
          return;
        }

        if ("Subscribed" in data) {
          const rid = data.Subscribed.roomId;
          const who = toPid(data.Subscribed.who);
          if (principalIdRef.current && who === principalIdRef.current) {
            log(`Subscribed self to ${rid} → RoomJoin`);
            setTimeout(() => {
              wsSend(
                { RoomJoin: { roomId: rid } },
                (m) => "Joined" in m && toPid(m.Joined.who) === principalIdRef.current && m.Joined.roomId === rid
              );
            }, 0);
          } else {
            log(`Peer ready: ${pretty(who)} in ${rid}`);
          }
          return;
        }

        if ("RtcHelloFrom" in data) {
          const from = toPid(data.RtcHelloFrom.from);
          log(`RtcHelloFrom ${pretty(from)}`);
          return;
        }

        if ("RtcFrom" in data && "Offer" in data.RtcFrom.payload) {
          const rid = data.RtcFrom.roomId;
          const from = toPid(data.RtcFrom.from);
          const sdp = data.RtcFrom.payload.Offer;

          deferNow(async () => {
            const pc = ensurePeer(from).pc;
            const makingOffer = !!makingOfferRef.current[from];
            const stable = pc.signalingState === "stable";
            const offerCollision = makingOffer || !stable;
            try {
              if (offerCollision) { await pc.setLocalDescription({ type: "rollback" } as any); }
              await pc.setRemoteDescription({ type: "offer", sdp });
              ensureResponderAudioFromOffer(from);
              await flushPendingIce(from);
              primeSenderIfHaveMic(from);
              const ans = await pc.createAnswer();
              await pc.setLocalDescription(ans);
              wsSend(
                { RtcSend: { roomId: rid, to: Principal.fromText(from), payload: { Answer: ans.sdp! } } },
                (m) => {
                  if (!("RtcFrom" in m || "RtcHelloFrom" in m)) return false;
                  if ("RtcFrom" in m) return toPid(m.RtcFrom.from) === from;
                  return toPid((m as any).RtcHelloFrom.from) === from;
                }
              );
              enableIceSend(from);
              log(`← offer from ${pretty(from)} | → answer`);
            } catch (err) {
              log(`handle offer error: ${String(err)}`);
            }
          }, 0);
          return;
        }

        if ("RtcFrom" in data && "Answer" in data.RtcFrom.payload) {
          const from = toPid(data.RtcFrom.from);
          const sdp = data.RtcFrom.payload.Answer;
          const pc = ensurePeer(from).pc;

          if (pc.signalingState !== "have-local-offer") {
            tlog(`skip remote answer: state=${pc.signalingState}`);
            return;
          }
          try {
            await pc.setRemoteDescription({ type: "answer", sdp });
            await flushPendingIce(from);
            enableIceSend(from);
            log(`← answer from ${pretty(from)}`);
          } catch (err) {
            log(`setRemoteDescription(answer) failed: ${String(err)} (state=${pc.signalingState})`);
          }
          return;
        }

        if ("RtcFrom" in data && "Ice" in data.RtcFrom.payload) {
          const rid = data.RtcFrom.roomId;
          const from = toPid(data.RtcFrom.from);
          if (rid !== activeRoomIdRef.current) return;

          const pl: any = data.RtcFrom.payload.Ice;
          const cand: RTCIceCandidateInit = {
            candidate: pl.candidate,
            sdpMid: Array.isArray(pl.sdpMid) ? (pl.sdpMid[0] ?? undefined) : pl.sdpMid,
            sdpMLineIndex: (() => {
              const v = Array.isArray(pl.sdpMLineIndex) ? (pl.sdpMLineIndex[0] ?? undefined) : pl.sdpMLineIndex;
              return v == null ? undefined : Number(v);
            })(),
          };

          tlog(`⇠ ICE recv ${pretty(from)} ${cand.sdpMid ?? ""}/${cand.sdpMLineIndex ?? ""}`);
          await addRemoteIce(from, cand);
          return;
        }

        if ("Error" in data) {
          log(`WS Error: ${data.Error}`);
          return;
        }
      } finally {
        inOnMsgRef.current = false;
      }
    };

    return () => {
      closingRef.current = true;
      try { wsRef.current?.close(); } catch { }
      wsRef.current = null;
      didInitRef.current = false;

      Object.values(iceTimerRef.current).forEach((t) => clearTimeout(t as any));
      iceTimerRef.current = {};
      iceOutboxRef.current = {};
      canSendIceRef.current = {};
      peersRef.current.forEach((e) => { try { e.dc?.close(); } catch { } try { e.dcChat?.close(); } catch { } try { e.pc.close(); } catch { } });
      peersRef.current.clear();
      playersRef.current.clear();
      setParticipants([]);
      existingAtJoinRef.current.clear();
      initiatorToRef.current.clear();
      joinedAfterMeRef.current.clear();
      selfJoinedRef.current = false;

      anyWaitersRef.current.splice(0).forEach((r) => r());
      watchersRef.current.splice(0).forEach((w) => { clearTimeout(w.t); w.resolve(); });
      sendTailRef.current = Promise.resolve();

      expectedPeersRef.current.clear();
      announcedReadyRef.current = false;
      peerReadyRef.current = {};
      setUiJoinPhase("idle");
      uiPhaseRef.current = "idle";
      setJoinProgress({ connected: 0, total: 0 });

      try {
        localAudioTrackRef.current?.stop();
        localStreamRef.current?.getTracks().forEach(t => t.stop());
      } catch { }
      localAudioTrackRef.current = null;
      localStreamRef.current = null;
      setMicOn(false);

      try {
        Object.values(remoteAudioElsRef.current).forEach(el => { try { el?.pause(); el && (el.srcObject = null); el?.remove(); } catch { } });
      } catch { }
      remoteAudioElsRef.current = {};
    };
  }, [signIdentity]);

  // Label refresh
  useEffect(() => {
    if (!principalId) return;
    const me = ensurePlayer(principalId);
    const newLabel = computeMyDisplayName();
    if (me.label !== newLabel) {
      me.label = newLabel;
      broadcastSelfMeta();
    }
  }, [user, principalId]);

  const displayNameFor = (pid: string) => {
    if (pid === principalId) return computeMyDisplayName() || pretty(pid);
    return labelCacheRef.current[pid] || playersRef.current.get(pid)?.label || pretty(pid);
  };

  const participantsReady = useMemo(
    () => participants.filter((p) => p === principalId || isPeerGloballyReady(p)),
    [participants, principalId, labelsVersion, peersVersion]
  );

  // ===== JOIN helpers =====
  const joinRoom = (rawId: string) => {
    if (!rawId.trim() || !wsRef.current) return;
    const rid = rawId.trim().toLowerCase();
    setActiveRoomId(rid);

    existingAtJoinRef.current.clear();
    initiatorToRef.current.clear();
    joinedAfterMeRef.current.clear();
    selfJoinedRef.current = false;

    expectedPeersRef.current.clear();
    announcedReadyRef.current = false;
    peerReadyRef.current = {};
    pixelOnceRef.current = false;
    setUiJoinPhase("joining");
    uiPhaseRef.current = "joining";
    setJoinProgress({ connected: 0, total: 0 });

    setParticipants([]);
    setChatLog([]);

    wsSend(
      { Subscribe: { roomId: rid } },
      (m) => "Subscribed" in m && toPid(m.Subscribed.who) === principalIdRef.current && m.Subscribed.roomId === rid
    );
    log(`Subscribing ${rid}… (intent=join)`);
  };

  useEffect(() => {
    if (!signIdentity) return;
    if (!isConnected) return;
    if (!urlRoomId) return;
    if (autoJoinStartedRef.current) return;
    autoJoinStartedRef.current = true;
    joinRoom(urlRoomId);
  }, [signIdentity, isConnected, urlRoomId]);

  // ===== Actions =====
  const onLeave = async () => {
    const rid = activeRoomId;

    try {
      if (rid && wsRef.current) {
        wsSend(
          { RoomLeave: { roomId: rid } },
          (m) => ("Left" in m ? toPid(m.Left.who) === principalIdRef.current : false)
        );
        await sleep(150);
        wsSend(
          { Unsubscribe: { roomId: rid } },
          (m) => ("Subscribed" in m ? false : true),
          120
        );
      }

      Object.values(iceTimerRef.current).forEach((t) => clearTimeout(t as any));
      iceTimerRef.current = {};
      iceOutboxRef.current = {};
      canSendIceRef.current = {};
      peersRef.current.forEach((e) => {
        try { e.dc?.close(); } catch { }
        try { e.dcChat?.close(); } catch { }
        try { e.pc.close(); } catch { }
      });
      peersRef.current.clear();
      playersRef.current.clear();
      existingAtJoinRef.current.clear();
      initiatorToRef.current.clear();
      joinedAfterMeRef.current.clear();
      selfJoinedRef.current = false;
      pixelOnceRef.current = false;

      setParticipants([]);
      setActiveRoomId(null);
      setChatLog([]);
      setUiJoinPhase("idle");
      uiPhaseRef.current = "idle";
      setJoinProgress({ connected: 0, total: 0 });

      try {
        localAudioTrackRef.current?.stop();
        localStreamRef.current?.getTracks().forEach((t) => t.stop());
      } catch { }
      localAudioTrackRef.current = null;
      localStreamRef.current = null;
      setMicOn(false);

      try {
        Object.values(remoteAudioElsRef.current).forEach((el) => {
          try { el?.pause(); if (el) (el.srcObject = null); el?.remove(); } catch { }
        });
      } catch { }
      remoteAudioElsRef.current = {};
    } finally {
      navigate("/dashboard", { replace: true });
    }
  };

  const resumeAllRemoteAudio = () => {
    for (const el of Object.values(remoteAudioElsRef.current)) {
      if (!el) continue;
      try {
        el.play()?.catch(err => log(`replay remote audio: ${String(err)}`));
      } catch { }
    }
  };

  const onToggleMic = async () => {
    if (!isPlaying()) { log("Join a room first to use the mic."); return; }
    await ensureAudioCtx();
    if (!micOn) {
      const ok = await acquireMic(selectedMicId || undefined);
      if (!ok) return;
      setMicOn(true);
      log("Mic ON");
      await refreshMics();
      setTimeout(resumeAllRemoteAudio, 0);
    } else {
      setMicOn(false);
      for (const pid of Array.from(peersRef.current.keys())) { await setSendActiveForPeer(pid, false); }
      try { localAudioTrackRef.current && (localAudioTrackRef.current.enabled = false); } catch { }
      try { localStreamRef.current?.getTracks().forEach(t => t.stop()); } catch { }
      localStreamRef.current = null;
      localAudioTrackRef.current = null;
      if (principalIdRef.current) detachAnalyser(principalIdRef.current);
      log("Mic OFF");
    }
  };

  const onApplyMic = async () => {
    if (!isPlaying()) { log("Join a room first."); return; }
    await ensureAudioCtx();
    await switchMic(selectedMicId);
    if (!micOn) setMicOn(true);
    log("Mic source applied");
  };

  useEffect(() => { refreshMics(); }, []);

  // Resize fullscreen canvas
  useEffect(() => {
    const resize = () => {
      const cvs = canvasRef.current;
      if (!cvs) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      viewSizeRef.current = { w, h };

      const dpr = window.devicePixelRatio || 1;
      cvs.width = Math.floor(w * dpr);
      cvs.height = Math.floor(h * dpr);
      cvs.style.width = w + "px";
      cvs.style.height = h + "px";

      minZoomRef.current = DISPLAY_MIN;
      setZoom((z) => clampZoom(z));
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // ===== Input & render =====
  const inputRef = useRef({ up: false, down: false, left: false, right: false });
  const lastRef = useRef(performance.now());
  const accRef = useRef(0);

  const meSendRef = useRef<{ inited: boolean; x: number; y: number; moving: boolean }>({
    inited: false,
    x: 0,
    y: 0,
    moving: false,
  });

  const isMoveKey = (k: string) =>
    k === "w" || k === "a" || k === "s" || k === "d" ||
    k === "arrowup" || k === "arrowdown" || k === "arrowleft" || k === "arrowright";
  const isZoomKey = (k: string) => k === "=" || k === "+" || k === "-" || k === "_";

  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      if (!isAuthenticated) return;
      const k = e.key.toLowerCase();
      if (typingChatRef.current && (isMoveKey(k) || isZoomKey(k))) {
        return;
      }
      if (k === "w" || k === "arrowup") { inputRef.current.up = true; e.preventDefault(); }
      if (k === "s" || k === "arrowdown") { inputRef.current.down = true; e.preventDefault(); }
      if (k === "a" || k === "arrowleft") { inputRef.current.left = true; e.preventDefault(); }
      if (k === "d" || k === "arrowright") { inputRef.current.right = true; e.preventDefault(); }
      if (k === "=" || k === "+") { onZoomIn(); }
      if (k === "-" || k === "_") { onZoomOut(); }
      if (k === "enter") {
        const input = document.getElementById("chat-input-box") as HTMLInputElement | null;
        if (input && showChat) { input.focus(); e.preventDefault(); }
      }
      if (k === "x") {
        if (e.repeat) return;
        if (!isAuthenticated || !isPlaying() || !principalIdRef.current) return;
        if (typingChatRef.current) return;

        const me = playersRef.current.get(principalIdRef.current);
        if (!me) return;
        const { col: tc, row: tr } = centerTileOf(me.x, me.y);

        const adj = findAdjacentDoor(tc, tr);
        if (!adj) return;

        const meP = principalIdRef.current;
        if (!meP) return;
        triggerArmSpin(meP);
        broadcastArmSpin();

        const nextOpen = !adj.open;
        void setDoor(adj.col, adj.row, nextOpen);
        broadcastDoor(adj.col, adj.row, nextOpen);
      }
      if (k === "escape") {
        if (showOutfit) {
          closeOutfit(false);
        } else if (showMicSettings) {
          setShowMicSettings(false);
        } else if (showChat || showSidebar) {
          setShowChat(false);
          setShowSidebar(false);
        }
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (!isAuthenticated) return;
      const k = e.key.toLowerCase();
      if (typingChatRef.current && (isMoveKey(k) || isZoomKey(k))) {
        return;
      }
      if (k === "w" || k === "arrowup") { inputRef.current.up = false; e.preventDefault(); }
      if (k === "s" || k === "arrowdown") { inputRef.current.down = false; e.preventDefault(); }
      if (k === "a" || k === "arrowleft") { inputRef.current.left = false; e.preventDefault(); }
      if (k === "d" || k === "arrowright") { inputRef.current.right = false; e.preventDefault(); }
    };
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); };
  }, [showChat, showSidebar, showOutfit, showMicSettings, isAuthenticated]);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (!isPlaying()) return;
      const me = principalIdRef.current;
      if (!me) return;
      triggerArmSpin(me);
      broadcastArmSpin();
    };

    cvs.addEventListener("pointerdown", onDown);
    return () => cvs.removeEventListener("pointerdown", onDown);
  }, []);

  const shouldRenderPeer = (pid: string) => {
    if (!isPlaying()) return false;
    if (pid === principalId) return true;
    return isPeerGloballyReady(pid);
  };

  // Anim state
  type AnimState = { phase: number; amp: number; lastX: number; lastY: number };
  const animRef = useRef<Record<string, AnimState>>({});

  const updateAnimFor = (pid: string, p: Player, dt: number, movingHint?: boolean): AnimSample => {
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

  const centerTileOf = (xPx: number, yPx: number) => {
    const cx = xPx + HITBOX_LEFT + HITBOX_W / 2;
    const cy = yPx + HITBOX_TOP + HITBOX_H / 2;
    return { col: Math.floor(cx / TILE), row: Math.floor(cy / TILE) };
  };

  // AUDIO zones update
  const updateAudioZones = (nowMs: number) => {
    if (!isPlaying() || !principalId) return;
    if (nowMs - lastAudioZoneUpdateRef.current < 180) return;
    lastAudioZoneUpdateRef.current = nowMs;

    const me = playersRef.current.get(principalId);
    if (!me) return;

    const { col: meTx, row: meTy } = centerTileOf(me.x, me.y);
    const myRule = audioRuleAt(meTx, meTy);

    let audibleSet: Set<string> | null = null;
    if (myRule.kind !== "room") {
      const myRadius = myRule.kind === "radius" ? myRule.radius : DEFAULT_AUDIO_RADIUS_TILES;
      audibleSet = computeAudibleTiles(meTx, meTy, myRadius);
    }

    for (const [pid] of peersRef.current.entries()) {
      if (pid === principalId) continue;
      const el = remoteAudioElsRef.current[pid];
      let canHear = false;

      const p = playersRef.current.get(pid);
      if (p) {
        const { col: pTx, row: pTy } = centerTileOf(p.x, p.y);
        const hisRule = audioRuleAt(pTx, pTy);

        if (myRule.kind === "room") {
          canHear = (hisRule.kind === "room" && hisRule.zoneId === myRule.zoneId);
        } else {
          if (hisRule.kind === "room") canHear = false;
          else canHear = !!audibleSet?.has(`${pTx},${pTy}`);
        }
      }

      if (el) {
        const shouldUnmute = !!canHear;
        if (shouldUnmute && el.muted) {
          el.muted = false;
          el.play().catch(err => log(`resume remote audio ${pretty(pid)}: ${String(err)}`));
        } else if (!shouldUnmute && !el.muted) {
          el.muted = true;
        }
      }

      const wantSend = micOn && canHear;
      void setSendActiveForPeer(pid, wantSend);
    }
  };

  // VAD update
  const updateVAD = (nowMs: number) => {
    for (const pid of Object.keys(analysersRef.current)) {
      const lvl = levelFromAnalyser(pid);
      if (lvl > VAD_THRESH) lastLoudAtRef.current[pid] = nowMs;
      const speakingNow = (nowMs - (lastLoudAtRef.current[pid] || 0)) < VAD_HOLD_MS;
      speakingRef.current[pid] = speakingNow;

      const last = lastBlinkAtRef.current[pid] || 0;
      if (speakingNow) {
        if (nowMs - last >= BLINK_MS) {
          talkBlinkRef.current[pid] = !talkBlinkRef.current[pid];
          lastBlinkAtRef.current[pid] = nowMs;
        }
      } else {
        talkBlinkRef.current[pid] = false;
        lastBlinkAtRef.current[pid] = nowMs;
      }
    }
  };

  const addChatMessage = (fromPid: string, text: string, ts = Date.now(), self = false) => {
    const label =
      playersRef.current.get(fromPid)?.label ||
      labelCacheRef.current[fromPid] ||
      (fromPid === principalIdRef.current ? computeMyDisplayName() : pretty(fromPid));

    const item: ChatItem = {
      id: `${ts}-${fromPid}-${Math.random().toString(36).slice(2, 7)}`,
      from: fromPid,
      label: label || pretty(fromPid),
      text,
      ts,
      self,
    };
    setChatLog((prev) => [...prev, item].slice(-400));

    const dur = bubbleDurationFor(text);
    const now = performance.now();
    chatBubbleRef.current[fromPid] = { text, until: now + dur };
    chatTalkUntilRef.current[fromPid] = now + Math.min(dur, 5000);
  };

  const sendChat = (textRaw: string) => {
    let text = String(textRaw ?? "")
      .replace(/\r/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (text.length > 240) text = text.slice(0, 240);
    if (!text) return;
    if (!isPlaying()) return;

    const ts = Date.now();
    const from = principalIdRef.current || "";
    const wire: ChatWireMsg = { t: "chat", text, ts, from };

    for (const [, e] of peersRef.current) {
      const ch = e.dcChat && e.dcChat.readyState === "open" ? e.dcChat :
        (e.dc && e.dc.readyState === "open" ? e.dc : null);
      if (ch) { try { ch.send(JSON.stringify(wire)); } catch { } }
    }

    addChatMessage(from, text, ts, true);
    setChatInput("");
  };

  // ==== Invite link helper ====
  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      log("Invite link copied to clipboard");
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = window.location.href;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        log("Invite link copied");
      } catch {
        log("Failed to copy invite link");
      }
    }
  };

  // ==== Avatar: render kepala karakter (dari outfit) ====
  const HEAD_BOX = { x: 6, y: 2, w: 20, h: 20 };

  const AvatarHead: React.FC<{ pid: string; name: string; size?: number; ring?: boolean }> = ({
    pid, name, size = 32, ring = true
  }) => {
    const ref = useRef<HTMLCanvasElement | null>(null);

    const draw = React.useCallback(() => {
      const cvs = ref.current;
      if (!cvs) return;

      const dpr = window.devicePixelRatio || 1;
      cvs.width = size * dpr; cvs.height = size * dpr;
      cvs.style.width = `${size}px`; cvs.style.height = `${size}px`;
      const ctx = cvs.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, size, size);

      // clip lingkaran
      ctx.save();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      const parts = partsRef.current;
      const outfit = playerOutfitPartsRef.current[pid];

      if (parts && outfit) {
        const scale = 4;
        const off = document.createElement("canvas");
        off.width = PLAYER * scale;
        off.height = PLAYER * scale;
        const octx = off.getContext("2d")!;
        drawPlayerSprite(
          octx, parts,
          0, 0, scale,
          { phase: 0, amp: 0 },
          false,
          outfit,
          { speaking: false, talkBlink: false }
        );

        const sx = HEAD_BOX.x * scale;
        const sy = HEAD_BOX.y * scale;
        const sw = HEAD_BOX.w * scale;
        const sh = HEAD_BOX.h * scale;

        ctx.drawImage(off, sx, sy, sw, sh, 0, 0, size, size);
      } else {
        // fallback inisial
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = "#a3e635";
        ctx.font = `${Math.floor(size * 0.45)}px ui-sans-serif,system-ui,Segoe UI`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(name || "").slice(0, 1).toUpperCase(), size / 2, size / 2 + 1);
      }

      ctx.restore();

      // ring
      if (ring) {
        ctx.strokeStyle = "rgba(163,230,53,0.6)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - 0.75, 0, Math.PI * 2);
        ctx.stroke();
      }
    }, [pid, name, size]);

    useEffect(() => {
      // pastikan outfit ready
      if (!playerOutfitPartsRef.current[pid]) {
        recomputeOutfitFor(pid);
      }
      draw();
      // re-render saat peers/outfit berubah
    }, [pid, draw, peersVersion, labelsVersion]);

    return <canvas ref={ref} aria-label={`${name} avatar`} style={{ display: "block" }} />;
  };

  const ParticipantRow: React.FC<{ pid: string }> = React.memo(({ pid }) => {
    const name = displayNameFor(pid);
    const uname = usernameFor(pid);
    const isSelf = pid === principalId;

    const [speaking, setSpeaking] = useState(false);
    useEffect(() => {
      let alive = true;
      let offTimer: any = null;

      const tick = () => {
        const now = !!speakingRef.current[pid];
        if (now) {
          if (offTimer) { clearTimeout(offTimer); offTimer = null; }
          if (alive) setSpeaking(true);
        } else if (!offTimer) {
          offTimer = setTimeout(() => { if (alive) setSpeaking(false); offTimer = null; }, 180);
        }
      };

      const id = setInterval(tick, 150);
      return () => { alive = false; clearInterval(id); if (offTimer) clearTimeout(offTimer); };
    }, [pid]);

    return (
      <li className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/5 transition">
        <div className="shrink-0">
          <AvatarHead pid={pid} name={name || pretty(pid)} size={32} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-sm text-white truncate">
            {isSelf ? `${name} (you)` : name}
          </div>
          <div className="text-[11px] text-slate-400 font-mono truncate">
            @{uname || pretty(pid)}
          </div>
        </div>

        <div className="ml-2">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border transition-opacity duration-150
          bg-emerald-600/20 text-emerald-300 border-emerald-500/30
          ${speaking ? "opacity-100 visible" : "opacity-0 invisible"}`}
            title="Currently speaking"
          >
            speaking
          </span>
        </div>
      </li>
    );
  });

  // === GAME LOOP with camera & zoom ===
  useEffect(() => {
    const cvs = canvasRef.current; if (!cvs) return;
    const ctx = cvs.getContext("2d")!;
    let raf = 0;

    const step = async (t: number) => {
      let dt = (t - lastRef.current) / 1000;
      if (dt > 0.05) dt = 0.05;
      lastRef.current = t;

      // update posisi & broadcast
      if (principalId && isPlaying()) {
        const me = ensurePlayer(principalId);
        let vx = 0, vy = 0;
        const inp = inputRef.current;
        if (inp.left) vx -= 1; if (inp.right) vx += 1;
        if (inp.up) vy -= 1; if (inp.down) vy += 1;
        if (vx || vy) {
          const len = Math.hypot(vx, vy) || 1; vx /= len; vy /= len;

          const dx = vx * SPEED * dt;
          const dy = vy * SPEED * dt;

          const hitboxX = me.x + HITBOX_LEFT;
          const hitboxY = me.y + HITBOX_TOP;

          const out = resolveMove(hitboxX, hitboxY, HITBOX_W, HITBOX_H, dx, dy);
          me.x = clamp(out.x - HITBOX_LEFT, 0, CANVAS_W - PLAYER);
          me.y = clamp(out.y - HITBOX_TOP, 0, CANVAS_H - PLAYER);
        }

        if (inp.left && !inp.right) faceDirRef.current[principalId] = -1;
        else if (inp.right && !inp.left) faceDirRef.current[principalId] = 1;

        const movingNow = !!(inp.left || inp.right || inp.up || inp.down);

        accRef.current += dt;
        const SEND_HZ = 30;
        const EPS = 0.25;
        const due = accRef.current >= 1 / SEND_HZ;
        const last = meSendRef.current;
        const movedEnough = !last.inited || Math.hypot(me.x - last.x, me.y - last.y) > EPS;
        const movingToggled = !last.inited || movingNow !== last.moving;

        if (due && (movedEnough || movingToggled)) {
          accRef.current = 0;
          const payload: PosMsg = {
            t: "pos",
            x: me.x,
            y: me.y,
            moving: movingNow,
            face: faceDirRef.current[principalId] ?? 1,
          };
          const json = JSON.stringify(payload);
          for (const [, e] of peersRef.current) {
            const ch = e.dc;
            if (ch && ch.readyState === "open") { try { ch.send(json); } catch { } }
          }
          meSendRef.current = { inited: true, x: me.x, y: me.y, moving: movingNow };
        } else if (due) {
          accRef.current = 0;
        }
      }

      updateVAD(performance.now());
      updateAudioZones(performance.now());

      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;

      const { w, h } = viewSizeRef.current;
      const z = (zoomRef.current || DISPLAY_MIN) * BASE_ZOOM;

      const worldWpx = CANVAS_W * z;
      const worldHpx = CANVAS_H * z;

      const padX = Math.max(0, (w - worldWpx) / 2);
      const padY = Math.max(0, (h - worldHpx) / 2);

      const vpW = Math.min(w / z, CANVAS_W);
      const vpH = Math.min(h / z, CANVAS_H);

      let camX = 0, camY = 0;
      const canScrollX = vpW < CANVAS_W;
      const canScrollY = vpH < CANVAS_H;
      const me = principalId ? playersRef.current.get(principalId) : null;
      if (me) {
        if (canScrollX) camX = clamp(me.x + PLAYER / 2 - vpW / 2, 0, CANVAS_W - vpW);
        if (canScrollY) camY = clamp(me.y + PLAYER / 2 - vpH / 2, 0, CANVAS_H - vpH);
      }

      const destW = Math.floor(vpW * z);
      const destH = Math.floor(vpH * z);

      // FLOOR
      ctx.clearRect(0, 0, w, h);
      const world = worldRef.current;
      if (world) {
        ctx.drawImage(world.floor, camX, camY, vpW, vpH, Math.floor(padX), Math.floor(padY), destW, destH);
      } else {
        ctx.strokeStyle = "rgba(148,163,184,0.25)";
        ctx.lineWidth = 1;
        const startX = Math.floor(camX / TILE) * TILE;
        const startY = Math.floor(camY / TILE) * TILE;
        for (let x = startX; x <= camX + vpW; x += TILE) {
          const sx = Math.floor(padX + (x - camX) * z) + 0.5;
          ctx.beginPath(); ctx.moveTo(sx, padY); ctx.lineTo(sx, padY + destH); ctx.stroke();
        }
        for (let y = startY; y <= camY + vpH; y += TILE) {
          const sy = Math.floor(padY + (y - camY) * z) + 0.5;
          ctx.beginPath(); ctx.moveTo(padX, sy); ctx.lineTo(padX + destW, sy); ctx.stroke();
        }
      }

      // PLAYERS
      ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
      const parts = partsRef.current;
      const now = performance.now();

      type Renderable = {
        pid: string;
        sx: number;
        sy: number;
        scale: number;
        anim: AnimSample;
        flipX: boolean;
        label: string;
        isLocal: boolean;
        face: FaceState;
        overrides?: { armFrontRot?: number; armBackRot?: number };
      };
      const renderList: Renderable[] = [];

      for (const [pid, p] of playersRef.current.entries()) {
        if (!shouldRenderPeer(pid)) continue;

        const sx = Math.floor(padX + (p.x - camX) * z);
        const sy = Math.floor(padY + (p.y - camY) * z);

        const isLocal = pid === principalId;
        const movingHint = isLocal
          ? (inputRef.current.left || inputRef.current.right || inputRef.current.up || inputRef.current.down)
          : (remoteMovingRef.current[pid] === true && (now - (lastPosAtRef.current[pid] || 0) < NET_LAG_GRACE_MS));

        const anim = updateAnimFor(pid, p, dt, movingHint);
        const faceDir = faceDirRef.current[pid] ?? 1;
        const scale = Math.ceil(PLAYER * z) / PLAYER;
        const flipX = faceDir === -1;
        const overrides = getArmSpinOverride(pid, flipX, now);

        const talkingBecauseChat = (now < (chatTalkUntilRef.current[pid] || 0));
        const speaking = !!(speakingRef.current[pid] || talkingBecauseChat);
        const blink = speaking
          ? ((now / 200) % 2 < 1 ? true : false)
          : !!talkBlinkRef.current[pid];

        renderList.push({
          pid, sx, sy, scale, anim, flipX: faceDir === -1, label: p.label, isLocal,
          face: { speaking, talkBlink: blink },
          overrides,
        });
      }

      renderList.sort((a, b) => a.sy - b.sy);

      if (parts) {
        const world = worldRef.current;

        // SHADOW PLAYERS
        for (const r of renderList) {
          drawPlayerShadow(ctx, parts, r.sx, r.sy, r.scale, r.anim, r.flipX, playerOutfitPartsRef.current[r.pid], r.face, r.overrides);
        }

        // SHADOW TILE
        if (world) {
          ctx.drawImage(world.shadow, camX, camY, vpW, vpH, Math.floor(padX), Math.floor(padY), destW, destH);
        }

        // WALL
        if (world) {
          ctx.drawImage(world.wall, camX, camY, vpW, vpH, Math.floor(padX), Math.floor(padY), destW, destH);
        }

        // OBJECT
        if (world) {
          ctx.drawImage(world.object, camX, camY, vpW, vpH, Math.floor(padX), Math.floor(padY), destW, destH);
        }

        // PLAYER
        for (const r of renderList) {
          drawPlayerSprite(ctx, parts, r.sx, r.sy, r.scale, r.anim, r.flipX, playerOutfitPartsRef.current[r.pid], r.face, r.overrides);
        }

        // OVERLAY/TOP
        if (world) {
          ctx.drawImage(world.over, camX, camY, vpW, vpH, Math.floor(padX), Math.floor(padY), destW, destH);
        }

        // === DOOR HINT (Press X …) ===
        if (isPlaying() && principalId) {
          const meP = playersRef.current.get(principalId);
          if (meP) {
            const { col: tc, row: tr } = centerTileOf(meP.x, meP.y);
            const adj = findAdjacentDoor(tc, tr);
            if (adj) {
              const prompt = `Press X to ${adj.open ? "close" : "open"} the door`;
              ctx.save();
              ctx.font = "13px ui-monospace, SFMono-Regular, Menlo, monospace";
              ctx.textAlign = "center";
              ctx.textBaseline = "alphabetic";
              const cx = Math.floor(w / 2);
              const SAFE_BOTTOM = 110;
              const cy = h - SAFE_BOTTOM;
              ctx.strokeStyle = "rgba(0,0,0,0.8)";
              ctx.lineWidth = 4;
              try { ctx.strokeText(prompt, cx, cy); } catch { }
              ctx.fillStyle = "#e5e7eb";
              try { ctx.fillText(prompt, cx, cy); } catch { }
              ctx.restore();

            }
          }
        }

        // LABEL + BUBBLE
        for (const r of renderList) {
          const name = r.label || "";
          if (name) {
            ctx.save();
            ctx.fillStyle = "#e5e7eb";
            ctx.textAlign = "center";
            ctx.textBaseline = "alphabetic";
            const labelX = r.sx + Math.ceil(PLAYER * z) / 2;
            const labelY = Math.max(12, r.sy - 22);
            ctx.strokeStyle = "rgba(0,0,0,0.7)";
            ctx.lineWidth = 3;
            ctx.lineJoin = "round";
            try { ctx.strokeText(name, labelX, labelY); } catch { }
            try { ctx.fillText(name, labelX, labelY); } catch { }
            ctx.restore();
          }

          // Chat bubble
          const bubble = chatBubbleRef.current[r.pid];
          if (bubble && now < bubble.until) {
            const remain = (bubble.until - now);
            const alpha = clamp(remain / 350, 0, 1);

            ctx.save();
            ctx.globalAlpha = 0.92 * alpha;
            ctx.font = BUBBLE_FONT;
            const paddingX = 8, paddingY = 6;

            const labelX = r.sx + Math.ceil(PLAYER * z) / 2;
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
      } else {
        for (const r of renderList) {
          ctx.fillStyle = playersRef.current.get(r.pid)!.color;
          const wpx = Math.ceil(PLAYER * z);
          ctx.fillRect(r.sx, r.sy, wpx, wpx);
        }
        const world = worldRef.current;
        if (world) {
          ctx.drawImage(world.shadow, camX, camY, vpW, vpH, Math.floor(padX), Math.floor(padY), destW, destH);
          ctx.drawImage(world.wall, camX, camY, vpW, vpH, Math.floor(padX), Math.floor(padY), destW, destH);
          ctx.drawImage(world.object, camX, camY, vpW, vpH, Math.floor(padX), Math.floor(padY), destW, destH);
          ctx.drawImage(world.over, camX, camY, vpW, vpH, Math.floor(padX), Math.floor(padY), destW, destH);
        }
        for (const r of renderList) {
          const text = playersRef.current.get(r.pid)!.label || "";
          if (text) {
            ctx.save();
            ctx.fillStyle = "#e5e7eb";
            ctx.textAlign = "center";
            ctx.textBaseline = "alphabetic";
            const labelX = r.sx + Math.ceil(PLAYER * z) / 2;
            const labelY = Math.max(12, r.sy - 22);
            ctx.strokeStyle = "rgba(0,0,0,0.7)";
            ctx.lineWidth = 3;
            try { ctx.strokeText(text, labelX, labelY); } catch { }
            try { ctx.fillText(text, labelX, labelY); } catch { }
            ctx.restore();
          }
        }
      }

      // Overlay area audio when mic ON
      if (micOn && isPlaying() && me) {
        const { col: meTx, row: meTy } = centerTileOf(me.x, me.y);
        const myRule = audioRuleAt(meTx, meTy);

        let audibleSet: Set<string> | null = null;
        if (myRule.kind !== "room") {
          const rad = myRule.kind === "radius" ? myRule.radius : DEFAULT_AUDIO_RADIUS_TILES;
          audibleSet = computeAudibleTiles(meTx, meTy, rad);
        }

        const startCol = Math.max(0, Math.floor(camX / TILE));
        const endCol = Math.min(MAP_COLS - 1, Math.floor((camX + vpW - 1) / TILE));
        const startRow = Math.max(0, Math.floor(camY / TILE));
        const endRow = Math.min(MAP_ROWS - 1, Math.floor((camY + vpH - 1) / TILE));

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
        octx.clearRect(0, 0, destW, destH);

        octx.globalCompositeOperation = "source-over";
        octx.globalAlpha = 0.15;
        octx.fillStyle = "#000";
        octx.fillRect(0, 0, destW, destH);

        octx.globalAlpha = 1;
        octx.globalCompositeOperation = "destination-out";

        const expand = 0.25;

        octx.beginPath();
        const rectForTile = (c: number, r: number) => {
          const x0 = Math.floor(((c * TILE) - camX) * z) - expand;
          const y0 = Math.floor(((r * TILE) - camY) * z) - expand;
          const x1 = Math.ceil((((c + 1) * TILE) - camX) * z) + expand;
          const y1 = Math.ceil((((r + 1) * TILE) - camY) * z) + expand;
          octx.rect(x0, y0, x1 - x0, y1 - y0);
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
        octx.globalCompositeOperation = "source-over";

        const outerX = Math.floor(padX);
        const outerY = Math.floor(padY);
        ctx.drawImage(ov, outerX, outerY);
      }

      raf = requestAnimationFrame(step as any);
    };

    lastRef.current = performance.now();
    raf = requestAnimationFrame(step as any);
    return () => cancelAnimationFrame(raf);
  }, [principalId, uiJoinPhase, micOn]);

  // smooth progress (0→target) + text counter
  const [percentText, setPercentText] = useState(0);
  const [hideAfterDone, setHideAfterDone] = useState(false);
  const pixelOnceRef = useRef(false);

  const progress = useSpring(0, { stiffness: 140, damping: 22, mass: 0.6 });
  const widthPct = useTransform(progress, (v) => `${v}%`);

  useEffect(() => {
    if (uiJoinPhase !== "ready") return;
    if (percentText < 100) return;
    if (pixelOnceRef.current) return;

    pixelOnceRef.current = true;
    setHideAfterDone(true);
    setShowPixelReveal(true);
  }, [uiJoinPhase, percentText]);

  const computePhaseTarget = () => {
    const { connected, total } = joinProgress;
    switch (uiJoinPhase) {
      case "connecting": return 20;
      case "joining": return 45;
      case "waiting": return total > 0 ? Math.min(99, 45 + Math.round(55 * (connected / total))) : 60;
      case "idle": return 0;
      case "ready": return 100;
      default: return 0;
    }
  };
  const targetForPhase = computePhaseTarget();

  useEffect(() => {
    if (uiJoinPhase === "connecting" || uiJoinPhase === "idle") {
      progress.set(0);
    }
    progress.set(targetForPhase);
  }, [uiJoinPhase, targetForPhase, progress]);

  useEffect(() => {
    const unsub = progress.on("change", (v) => {
      const n = Math.round(v);
      setPercentText(n);
      if (uiJoinPhase === "ready" && n >= 100) {
        const t = setTimeout(() => setHideAfterDone(true), 180);
        return () => clearTimeout(t);
      } else {
        setHideAfterDone(false);
      }
    });
    return unsub;
  }, [progress, uiJoinPhase]);

  const showLoader = uiJoinPhase !== "ready" || !hideAfterDone;

  const subtext = (() => {
    const { connected, total } = joinProgress;
    switch (uiJoinPhase) {
      case "connecting": return "Contacting server…";
      case "joining": return "Joining room…";
      case "waiting": return `Connecting peers ${connected}/${total}…`;
      case "idle": return "Waiting to join a room.";
      case "ready": return "All set.";
      default: return "";
    }
  })();

  // === Mobile Joystick (inner component) ===
  const MobileJoystick: React.FC = () => {
    const baseRef = useRef<HTMLDivElement | null>(null);
    const [dragging, setDragging] = useState(false);
    const [knob, setKnob] = useState({ x: 0, y: 0 }); // -1..1

    const applyVector = (nx: number, ny: number) => {
      if (typingChatRef.current) return;
      const dead = 0.18;
      inputRef.current.left = nx < -dead;
      inputRef.current.right = nx > dead;
      inputRef.current.up = ny < -dead;
      inputRef.current.down = ny > dead;
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

    const knobPx = (pct: number, size: number) => ((size / 2 - 0) * pct);

    const BASE_SIZE = 140;
    const KNOB_SIZE = 64;

    return (
      <div
        className="absolute left-3 bottom-28 md:bottom-6 select-none z-30"
        style={{ touchAction: "none" }}
      >
        <div
          ref={baseRef}
          onPointerDown={(e) => { e.preventDefault(); (e.currentTarget as any).setPointerCapture?.(e.pointerId); setDragging(true); updateFromClient(e.clientX, e.clientY); }}
          className="relative rounded-full border border-white/15 bg-slate-800/40 backdrop-blur"
          style={{ width: BASE_SIZE, height: BASE_SIZE }}
        >
          <div className="absolute inset-0" aria-hidden>
            <div className="absolute left-1/2 top-0 -translate-x-1/2 w-px h-full bg-white/10" />
            <div className="absolute top-1/2 left-0 -translate-y-1/2 h-px w-full bg-white/10" />
          </div>

          <div
            className="absolute rounded-full bg-white/30 border border-white/30 shadow-md"
            style={{
              width: KNOB_SIZE,
              height: KNOB_SIZE,
              left: `calc(50% - ${KNOB_SIZE / 2}px + ${knobPx(knob.x, BASE_SIZE)}px)`,
              top: `calc(50% - ${KNOB_SIZE / 2}px + ${knobPx(knob.y, BASE_SIZE)}px)`,
              transition: dragging ? "none" : "transform 120ms ease, left 120ms ease, top 120ms ease",
            }}
          />
        </div>
        <div className="mt-1 text-[11px] text-white/60 font-mono text-center">move</div>
      </div>
    );
  };

  // ====== RENDER ======
  return (
    <div ref={wrapperRef} className="fixed inset-0 bg-black">
      {/* === FULLSCREEN CANVAS === */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" style={{ imageRendering: "pixelated" }} />

      {/* audio sinks */}
      <div
        ref={audioContainerRef}
        style={{ position: "absolute", width: 0, height: 0, overflow: "hidden", pointerEvents: "none", opacity: 0 }}
        aria-hidden
      />

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
                <div className="text-gray-400 text-xs mb-1 text-right tabular-nums">{percentText}%</div>

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

      {/* === LEFT SIDEBAR (CHAT) === */}
      <div
        className={`absolute top-0 left-0 h-full w-[320px] bg-slate-900/95 backdrop-blur border-r border-slate-700 text-white transition-transform duration-300 ease-out z-[70] ${showChat ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex flex-col h-full">
          <div className="px-4 py-3 border-b border-lime-500/30 bg-gradient-to-r from-lime-900/20 to-transparent flex items-center justify-between">
            <div className="font-semibold text-white">Chat</div>
            <div className="text-xs text-slate-300 truncate max-w-[160px]">{activeRoomId ?? "—"}</div>
          </div>
          <div ref={chatListRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
            {chatLog.length === 0 ? (
              <div className="text-slate-400 text-sm px-2 py-3">No messages yet…</div>
            ) : (
              chatLog.map((m) => (
                <div key={m.id} className={`text-[13px] ${m.self ? "text-emerald-300" : "text-slate-100"}`}>
                  <span className="font-mono text-[11px] text-slate-400 mr-2">
                    {new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="font-medium">{m.self ? "You" : m.label || pretty(m.from)}</span>
                  <span className="text-slate-400 mx-2">:</span>
                  <span className="break-words whitespace-pre-wrap">{m.text}</span>
                </div>
              ))
            )}
          </div>

          <div className="p-3 border-t border-slate-700">
            <div className="flex items-center gap-2">
              <input
                id="chat-input-box"
                ref={chatInputRef}
                value={chatInput}
                onFocus={() => {
                  typingChatRef.current = true;
                  inputRef.current.up = false;
                  inputRef.current.down = false;
                  inputRef.current.left = false;
                  inputRef.current.right = false;
                }}
                onBlur={() => { typingChatRef.current = false; }}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendChat(chatInput);
                  }
                }}
                className="flex-1 px-3 py-2 rounded-lg border border-white/15 bg-slate-800/70 text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-lime-400/40 focus:border-lime-400/40"
                placeholder={isPlaying()
                  ? "Type a message (Shift+Enter for newline), then press Enter…"
                  : "Join a room first to chat"}
                disabled={!isPlaying()}
              />
              <button
                onClick={() => sendChat(chatInput)}
                disabled={!isPlaying() || !chatInput.trim()}
                className="px-3 py-2 rounded-lg bg-lime-600 hover:bg-lime-500 text-white disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* === RIGHT SIDEBAR (Room → Participants) === */}
      <div
        className={`absolute top-0 right-0 h-full w-[340px] bg-slate-900/95 backdrop-blur border-l border-slate-700 text-white transition-transform duration-300 ease-out z-[70] ${showSidebar ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex flex-col h-full">
          {/* header */}
          <div className="px-4 py-3 border-b border-white/10 bg-gradient-to-l from-slate-800/50 to-transparent flex items-center justify-between">
            <div className="min-w-0">
              <div className="font-semibold">Room</div>
              <div className="text-xs text-slate-400 truncate max-w-[200px]">{activeRoomId ?? "—"}</div>
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
              <Copy className="w-4 h-4" />
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
          <div className="p-4 border-t border-slate-700/60">
            <button
              onClick={() => setShowMicSettings(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-700/50 hover:bg-gray-600/50 text-white transition"
              title="Open microphone settings"
            >
              <Settings className="w-4 h-4" />
              Mic settings
            </button>
          </div>
        </div>
      </div>

      {/* === SIDEBARS CLICK-AWAY BACKDROP === */}
      <AnimatePresence>
        {(showChat || showSidebar) && (
          <motion.div
            key="sidebars-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[69]"
            onClick={() => {
              setShowChat(false);
              setShowSidebar(false);
            }}
            aria-hidden
          />
        )}
      </AnimatePresence>

      {/* === BOTTOM CONTROL BAR === */}
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent"
      >
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center space-x-4">

            {/* Chat toggle */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowChat((v) => !v)}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all relative z-50
                ${showChat
                  ? "bg-lime-500/20 text-lime-300 border-2 border-lime-500/50"
                  : "bg-gray-700/50 hover:bg-gray-600/50 text-white"
                }`}
              title="Toggle chat"
            >
              <MessageSquare className="w-5 h-5" />
              {chatLog.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-lime-500 text-white text-xs min-w-[20px] h-5 px-1 rounded-full grid place-items-center">
                  {chatLog.length}
                </span>
              )}
            </motion.button>

            {/* Mic toggle */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onToggleMic}
              disabled={!isPlaying()}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all z-50
                ${micOn
                  ? "bg-emerald-600/40 hover:bg-emerald-600/60 text-white border border-emerald-400/30"
                  : "bg-red-500/20 hover:bg-red-500/30 text-red-400"
                } disabled:opacity-50`}
              title={isPlaying() ? "Toggle microphone" : "Join a room first"}
            >
              {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </motion.button>

            {/* Participants (badge) */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowSidebar((v) => !v)}
              className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-700/50 hover:bg-gray-600/50 text-white transition-all relative z-50"
              title="Participants"
            >
              <Users className="w-5 h-5" />
              <span className="absolute -top-2 -right-2 bg-lime-500 text-white text-xs min-w-[20px] h-5 px-1 rounded-full grid place-items-center">
                {participantsReady.length}
              </span>
            </motion.button>

            {/* Zoom out */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onZoomOut}
              className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-700/50 hover:bg-gray-600/50 text-white transition-all z-50"
              title="Zoom out"
            >
              <ZoomOut className="w-5 h-5" />
            </motion.button>

            {/* Zoom in */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onZoomIn}
              className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-700/50 hover:bg-gray-600/50 text-white transition-all z-50"
              title="Zoom in"
            >
              <ZoomIn className="w-5 h-5" />
            </motion.button>

            {/* Outfit editor toggle */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => (showOutfit ? closeOutfit(false) : openOutfit())}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all z-50
                ${showOutfit
                  ? "bg-lime-500/20 text-lime-300 border-2 border-lime-500/50"
                  : "bg-gray-700/50 hover:bg-gray-600/50 text-white"
                }`}
              title="Outfit"
            >
              <UserPen className="w-5 h-5" />
            </motion.button>

            {/* Leave room */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onLeave}
              disabled={!identity || !activeRoomId}
              className="w-12 h-12 rounded-full flex items-center justify-center bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-all z-50 disabled:opacity-50"
              title="Leave"
            >
              <LogOut className="w-5 h-5" />
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Mic settings popover */}
      <AnimatePresence>
        {showMicSettings && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="absolute left-1/2 -translate-x-1/2 bottom-28 z-[70] w-[min(92vw,620px)] rounded-2xl border border-white/15 bg-slate-900/90 backdrop-blur-xl p-0 shadow-2xl overflow-hidden"
          >
            {/* header */}
            <div className="px-4 py-3 bg-gradient-to-r from-lime-900/20 to-transparent border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <Mic className="w-4 h-4 text-lime-300" />
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
                  disabled={!isPlaying()}
                  className="px-4 py-2 rounded-lg bg-lime-600 hover:bg-lime-500 text-white disabled:opacity-50"
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

      {/* Outfit editor */}
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

            {/* Centered modal container */}
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
                  <button onClick={() => closeOutfit(false)} className="text-slate-300 hover:text-white text-sm">
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
                      <div className="text-slate-200 font-medium capitalize">{activeSlot.replace(/_/g, " ")}</div>
                      <div className="text-xs text-slate-400">
                        {(OUTFIT_OPTIONS[activeSlot as keyof typeof OUTFIT_OPTIONS] || []).length} items
                      </div>
                    </div>

                    {(() => {
                      // Resolve index + items for the active slot
                      const slotKey = activeSlot as keyof typeof OUTFIT_OPTIONS;
                      const slotIdx = OUTFIT_SLOT_ORDER.indexOf(activeSlot as any);
                      const items = OUTFIT_OPTIONS[slotKey] || [];
                      if (slotIdx < 0) return <div className="text-slate-400 text-sm">Slot not recognized.</div>;

                      return (
                        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                          {items.map((opt) => {
                            const selected = mySlots[slotIdx] === opt.id;
                            return (
                              <button
                                key={opt.id}
                                onClick={() => {
                                  // Update the selected item for this slot
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
                    disabled={!isPlaying()}
                    className="px-4 py-2 rounded bg-lime-600 hover:bg-lime-500 text-white disabled:opacity-50"
                  >
                    Apply
                  </button>
                </div>

                <div className="mt-2 text-xs text-slate-400">
                  Pick a slot on the left → click an item box to change it. Press Apply to save.
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {useJoystick && isPlaying() && <MobileJoystick />}

      {!isAuthenticated && (
        <LoginRequired
          onLogin={login}
          isLoading={authLoading}
          subtitle="Authentication Required"
          description="Please authenticate with Internet Identity to join this room"
          showFeatures={false}
        />
      )}
    </div>
  );
};

export default Websocket;
