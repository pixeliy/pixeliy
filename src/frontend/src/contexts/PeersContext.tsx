import {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
    useCallback,
    useMemo,
    ReactNode,
} from 'react';
import Peer, { DataConnection } from 'peerjs';
import { useAuth } from './AuthContext';
import { canisterService } from '../services/canisterService';

// Chat message type
type ChatMessage = {
    id: string;
    from: string;
    text: string;
    ts: number;
    self: boolean;
};

// Presence and wire message types
type PresenceRoster = { kind: 'presence'; type: 'roster'; ids: string[]; from: string; ts: number };
type PresenceHello = { kind: 'presence'; type: 'hello'; from: string; ts: number };
type PresenceBye = { kind: 'presence'; type: 'bye'; from: string; ts: number };
type WireChat = { kind: 'chat'; channel: 'global'; text: string; from: string; ts: number; id?: string; };
type WireEnvelope = PresenceRoster | PresenceHello | PresenceBye | WireChat;

// Context value type
type PeersContextValue = {
    isPeerReady: boolean;
    statusText: string;
    activeCount: number;
    messages: ChatMessage[];
    sendChat: (text: string) => void;
};

// Context handle
const PeersContext = createContext<PeersContextValue | undefined>(undefined);

// TURN configuration
function buildPeerOptions(selfId: string) {
    const host = (import.meta as any).env?.VITE_PEER_HOST as string | undefined;
    const port = (import.meta as any).env?.VITE_PEER_PORT ? Number((import.meta as any).env.VITE_PEER_PORT) : undefined;
    const path = (import.meta as any).env?.VITE_PEER_PATH as string | undefined;
    const secure = (import.meta as any).env?.VITE_PEER_SECURE && String((import.meta as any).env.VITE_PEER_SECURE) === 'true';

    const TURN_HOST = (import.meta as any).env.VITE_TURN_HOST as string;
    const TURN_PORT = Number((import.meta as any).env.VITE_TURN_PORT);
    const TURNS_PORT = Number((import.meta as any).env.VITE_TURNS_PORT);
    const TURN_USERNAME = (import.meta as any).env.VITE_TURN_USERNAME as string;
    const TURN_CREDENTIAL = (import.meta as any).env.VITE_TURN_CREDENTIAL as string;

    const ICE_CONFIG: RTCConfiguration = {
        iceServers: [
            {
                urls: [
                    `turn:${TURN_HOST}:${TURN_PORT}?transport=udp`,
                    `turn:${TURN_HOST}:${TURN_PORT}?transport=tcp`,
                    `turns:${TURN_HOST}:${TURNS_PORT}?transport=tcp`,
                ],
                username: TURN_USERNAME,
                credential: TURN_CREDENTIAL,
            },
        ],
        iceTransportPolicy: 'relay',
        bundlePolicy: 'balanced',
        rtcpMuxPolicy: 'require',
    };

    const opts: any = {
        config: ICE_CONFIG,
        debug: 0,
        pingInterval: 25_000,
    };
    if (host) opts.host = host;
    if (port) opts.port = port;
    if (path) opts.path = path;
    if (typeof secure === 'boolean') opts.secure = secure;

    return { id: selfId, opts };
}

export function PeersProvider({ children }: { children: ReactNode }) {
    const { isAuthenticated, principalId } = useAuth();
    const selfId = principalId;

    // Live object
    const peerRef = useRef<Peer | null>(null);
    const connsRef = useRef<Map<string, DataConnection>>(new Map());
    const rosterRef = useRef<Set<string>>(new Set());

    // UI state
    const [isPeerReady, setPeerReady] = useState(false);
    const [statusText, setStatusText] = useState<'idle' | 'connecting' | 'connected' | 'disconnected' | `error:${string}` | 'closed'>('idle');
    const [rosterCount, setRosterCount] = useState<number>(1);
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    // De-duplication state
    const seenMsgIdsRef = useRef<Set<string>>(new Set());

    // Derived state
    const activeCount = rosterCount;

    // Boardcast to all connections
    const broadcast = (msg: WireEnvelope) => {
        connsRef.current.forEach((c) => {
            if (c.open) {
                try { c.send(msg); } catch { }
            }
        });
    };

    // Send roaster to a specific connection
    const sendRosterTo = (conn: DataConnection) => {
        const env: PresenceRoster = {
            kind: 'presence',
            type: 'roster',
            ids: Array.from(rosterRef.current),
            from: selfId,
            ts: Date.now(),
        };
        try { conn.send(env); } catch { }
    };

    // Add id to roster
    const addToRoster = useCallback((id: string) => {
        if (!id) return;
        if (!rosterRef.current.has(id)) {
            rosterRef.current.add(id);
            setRosterCount(rosterRef.current.size);
        }
    }, []);

    // Remove id from roster
    const removeFromRoster = useCallback((id: string) => {
        if (!id) return;
        if (rosterRef.current.delete(id)) {
            setRosterCount(rosterRef.current.size);
        }
    }, []);

    // Ensure a connection exists
    const ensureConnectTo = useCallback((peer: Peer, peerId: string) => {
        if (!peerId || peerId === selfId) return;
        const existing = connsRef.current.get(peerId);
        if (existing) return;

        const conn = peer.connect(peerId, {
            reliable: true,
            metadata: { channel: 'global', initiator: selfId },
        });
        connsRef.current.set(peerId, conn);
        setupConnHandlers(conn);
    }, [selfId]);

    // Connect to all missing from roster
    const connectMissingFromRoster = useCallback((peer: Peer) => {
        rosterRef.current.forEach((rid) => {
            if (rid !== selfId && !connsRef.current.get(rid)) {
                ensureConnectTo(peer, rid);
            }
        });
    }, [ensureConnectTo, selfId]);

    // Merge roster ids
    const handleRosterMerge = useCallback((ids: string[]) => {
        let changed = false;
        for (const id of ids) {
            if (id && !rosterRef.current.has(id)) {
                rosterRef.current.add(id);
                changed = true;
            }
        }
        if (changed) setRosterCount(rosterRef.current.size);
    }, []);

    // Setup connection handlers
    const setupConnHandlers = useCallback((conn: DataConnection) => {
        const rid = conn.peer;
        if (!rid || rid === selfId) return;
        if (!connsRef.current.get(rid)) connsRef.current.set(rid, conn);

        conn.on('open', () => {
            addToRoster(rid);
            const hello: PresenceHello = { kind: 'presence', type: 'hello', from: selfId, ts: Date.now() };
            try { conn.send(hello); } catch { }
            sendRosterTo(conn);
            const peer = peerRef.current;
            if (peer) connectMissingFromRoster(peer);
        });

        conn.on('data', (raw: any) => {
            const env = raw as WireEnvelope;

            if (env.kind === 'presence') {
                if (env.type === 'hello') {
                    addToRoster(env.from);
                } else if (env.type === 'bye') {
                    const c = connsRef.current.get(env.from);
                    if (c) {
                        try { c.close(); } catch { }
                        connsRef.current.delete(env.from);
                    }
                    removeFromRoster(env.from);
                } else if (env.type === 'roster') {
                    handleRosterMerge(env.ids);
                    const peer = peerRef.current;
                    if (peer) connectMissingFromRoster(peer);
                }
            } else if (env.kind === 'chat' && env.channel === 'global') {
                const id = (env as any).id ?? `${env.from}-${env.ts}`;
                if (seenMsgIdsRef.current.has(id)) return;
                seenMsgIdsRef.current.add(id);

                const msg: ChatMessage = {
                    id,
                    from: env.from,
                    text: String((env as any).text || '').slice(0, 2000),
                    ts: env.ts,
                    self: env.from === selfId,
                };

                setMessages(prev => {
                    const next = [...prev, msg];
                    return next.length > 300 ? next.slice(-300) : next;
                });
            }
        });

        const onCloseOrError = () => {
            connsRef.current.delete(rid);
            removeFromRoster(rid);
        };

        conn.on('close', onCloseOrError);
        conn.on('error', onCloseOrError);
    }, [selfId, addToRoster, removeFromRoster, handleRosterMerge, connectMissingFromRoster]);

    // Send one outbound connection
    const seedConnectOnce = useCallback(async () => {
        try {
            const peer = peerRef.current;
            if (!peer) return;
            if (connsRef.current.size > 0) return;

            const principals = await canisterService.getOnlineUsers();
            const ids = (principals ?? [])
                .map((p: any) => (typeof p?.toText === 'function' ? p.toText() : String(p)))
                .filter(Boolean)
                .filter((id: string) => id !== selfId);

            if (ids.length === 0) return;
            ensureConnectTo(peer, ids[0]);
        } catch { }
    }, [ensureConnectTo, selfId]);

    // Register online
    const registerOnline = useCallback(async () => {
        try { await canisterService.registerOnline(); } catch { }
    }, []);

    // Unregister online
    const unregisterOnline = useCallback(async () => {
        try {
            if ((canisterService as any).unregisterOnline) {
                await (canisterService as any).unregisterOnline();
            }
        } catch { }
    }, []);

    // Lifecycle for auth and peer
    useEffect(() => {
        if (!isAuthenticated || !selfId) {
            if (peerRef.current) {
                try {
                    const bye: PresenceBye = { kind: 'presence', type: 'bye', from: selfId, ts: Date.now() };
                    broadcast(bye);
                } catch { }
                try { peerRef.current.destroy(); } catch { }
                peerRef.current = null;
            }
            connsRef.current.forEach((c) => { try { c.close(); } catch { } });
            connsRef.current.clear();
            rosterRef.current.clear();
            setRosterCount(1);
            setPeerReady(false);
            setStatusText('idle');
            return;
        }

        if (peerRef.current) return;

        rosterRef.current = new Set([selfId]);
        setRosterCount(1);
        setStatusText('connecting');

        const { id, opts } = buildPeerOptions(selfId);
        const peer = new Peer(id, opts as any);
        peerRef.current = peer;

        const onOpen = () => {
            setPeerReady(true);
            setStatusText('connected');
            registerOnline();
            seedConnectOnce();
        };

        const onConnection = (conn: DataConnection) => {
            connsRef.current.set(conn.peer, conn);
            setupConnHandlers(conn);
        };

        const onError = (err: any) => {
            setStatusText(`error:${String(err?.type || 'unknown')}`);
        };
        const onDisconnected = () => {
            setStatusText('disconnected');
            try { peer.reconnect(); } catch { }
        };

        peer.on('open', onOpen);
        peer.on('connection', onConnection);
        peer.on('error', onError);
        peer.on('disconnected', onDisconnected);

        const openGuard = setTimeout(() => {
            if (!peer.open) setStatusText('error:signaling-timeout');
        }, 12_000);

        const onBeforeUnload = () => {
            try {
                const bye: PresenceBye = { kind: 'presence', type: 'bye', from: selfId, ts: Date.now() };
                broadcast(bye);
            } catch { }
            unregisterOnline();
        };

        window.addEventListener('beforeunload', onBeforeUnload);

        return () => {
            clearTimeout(openGuard);
            window.removeEventListener('beforeunload', onBeforeUnload);
            try { peer.destroy(); } catch { }
            peerRef.current = null;
            connsRef.current.forEach((c) => { try { c.close(); } catch { } });
            connsRef.current.clear();

            try {
                const bye: PresenceBye = { kind: 'presence', type: 'bye', from: selfId, ts: Date.now() };
                broadcast(bye);
            } catch { }

            unregisterOnline();
            rosterRef.current.clear();
            setRosterCount(1);
            setPeerReady(false);
            setStatusText('closed');
        };
    }, [isAuthenticated, selfId, registerOnline, seedConnectOnce, setupConnHandlers, unregisterOnline]);

    // Heartbeat and light discovery
    useEffect(() => {
        if (!isPeerReady) return;

        const t1 = setInterval(registerOnline, 30_000);
        const t2 = setInterval(() => {
            if (connsRef.current.size === 0) seedConnectOnce();
        }, 15_000);

        const onVis = () => {
            if (document.visibilityState === 'visible') {
                registerOnline();
                if (connsRef.current.size === 0) seedConnectOnce();
            }
        };

        window.addEventListener('visibilitychange', onVis);

        const onOnline = () => setStatusText(peerRef.current?.open ? 'connected' : 'connecting');
        const onOffline = () => setStatusText('disconnected');
        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);

        return () => {
            clearInterval(t1);
            clearInterval(t2);
            window.removeEventListener('visibilitychange', onVis);
            window.removeEventListener('online', onOnline);
            window.removeEventListener('offline', onOffline);
        };
    }, [isPeerReady, registerOnline, seedConnectOnce]);

    // Send chat message
    const sendChat = useCallback((text: string) => {
        const trimmed = text.trim();
        if (!trimmed) return;

        const ts = Date.now();
        const id = `${selfId}-${ts}-${Math.random().toString(36).slice(2, 8)}`;

        const env: WireChat = {
            kind: 'chat',
            channel: 'global',
            text: trimmed.slice(0, 2000),
            from: selfId,
            ts,
            id,
        } as WireChat & { id: string };

        seenMsgIdsRef.current.add(id);

        setMessages((prev) =>
            [...prev, { id, from: selfId, text: env.text, ts: env.ts, self: true }].slice(-300)
        );

        broadcast(env);
    }, [selfId]);

    // Context value
    const value: PeersContextValue = useMemo(() => ({
        isPeerReady,
        statusText,
        activeCount,
        messages,
        sendChat,
    }), [isPeerReady, statusText, activeCount, messages, sendChat]);

    // Provider output
    return <PeersContext.Provider value={value}>{children}</PeersContext.Provider>;
}

// Hook to use the context
export function usePeers(): PeersContextValue {
    const ctx = useContext(PeersContext);
    if (!ctx) throw new Error('usePeers must be used within a PeersProvider');
    return ctx;
}
