"use client"

import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Principal } from '@dfinity/principal';
import { InteractiveGridPattern } from '@/components/ui/interactive-grid';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    Video, VideoOff, Mic, MicOff, Settings,
    PhoneOff, Copy, Users, User, Globe, Shield,
    Activity, Camera, AlertTriangle, EyeOff,
    Languages, MessageSquare, Mic2, Volume2,
    ChevronDown, Pause, Play,
    Trash
} from 'lucide-react';
import TargetCursor from '../components/target-cursor';
import { useAuth } from '../contexts/AuthContext';
import { useRoom } from '../hooks/useRoom';
import { useRealTimeRoom } from '../hooks/useRealTimeRoom';
import { useTranslation } from '../hooks/useTranslation';
import LoginRequired from '../components/auth/LoginRequired';
import ProfileSetupRequired from '../components/auth/ProfileSetupRequired';
import { Signal } from '../types/backend';

// Animation variants 
const smoothTransition = {
    duration: 0.8,
    ease: "easeOut" as const,
};

interface PeerConnectionData {
    pc: RTCPeerConnection;
    remoteStream: MediaStream | null;
    videoElement: HTMLVideoElement | null;
    connectionState: RTCPeerConnectionState;
    hasRemoteDescription: boolean;
    hasLocalDescription: boolean;
    isOfferer: boolean;
    isAnswerer: boolean;
}

interface SpeechLog {
    id: string;
    participantId: string;
    participantName: string;
    originalText: string;
    translatedText?: string;
    detectedLanguage?: string;
    timestamp: Date;
    isTranslating: boolean;
    isLocal: boolean;
    confidence?: number;
}

declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
    }
}

const Room: React.FC = () => {
    const { id: roomId } = useParams<{ id: string }>();
    const navigate = useNavigate();

    // ========== HOOKS ==========
    const {
        isAuthenticated,
        user,
        principalId,
        login,
        isLoading: authLoading,
        error: authError
    } = useAuth();

    const {
        leaveRoom,
        getRoom,
        sendSignal,
        getSignals,
        clearSignals,
        isLoading: roomLoading,
        error: roomError
    } = useRoom();

    const {
        roomData,
        participants,
        isHost,
        isLoading: realtimeLoading,
        error: realtimeError,
        stopPolling
    } = useRealTimeRoom(roomId, principalId);

    const {
        translate,
        detectLanguage,
        isLoading: translationLoading,
        supportedLanguages
    } = useTranslation();

    // ========== WEBRTC REFS ==========
    const localStream = useRef<MediaStream | null>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const peerConnections = useRef<Map<string, PeerConnectionData>>(new Map());
    const pendingICECandidates = useRef<Map<string, RTCIceCandidate[]>>(new Map());
    const signalIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const remoteVideosContainerRef = useRef<HTMLDivElement>(null);
    const processedSignals = useRef<Set<string>>(new Set());
    const previousParticipants = useRef<string[]>([]);

    // ========== SPEECH RECOGNITION REFS ==========
    const speechRecognitionRef = useRef<any>(null);
    const shouldRestartSpeechRef = useRef(false);

    // ========== STATES ==========
    const [isSignalPolling, setIsSignalPolling] = useState(false);
    const [loading, setLoading] = useState(false);
    const [connectedPeers, setConnectedPeers] = useState<string[]>([]);

    // ========== MEDIA CONTROL STATES ==========
    const [availableDevices, setAvailableDevices] = useState<{
        cameras: MediaDeviceInfo[];
        microphones: MediaDeviceInfo[];
    }>({
        cameras: [],
        microphones: []
    });
    const [selectedCameraId, setSelectedCameraId] = useState<string>('');
    const [selectedMicrophoneId, setSelectedMicrophoneId] = useState<string>('');
    const [isCameraEnabled, setIsCameraEnabled] = useState(true);
    const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(true);
    const [isDevicesLoading, setIsDevicesLoading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    // ========== UI STATES ==========
    const [showParticipants, setShowParticipants] = useState(false);
    const [showAITranslate, setShowAITranslate] = useState(false);

    // ========== AI TRANSLATION STATES ==========
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [sourceLanguage, setSourceLanguage] = useState('id-ID');
    const [targetLanguage, setTargetLanguage] = useState('en-US');
    const [speechLogs, setSpeechLogs] = useState<SpeechLog[]>([]);
    const [recognitionActive, setRecognitionActive] = useState(false);

    // ========== COMPUTED VALUES ==========
    const isUserReady = isAuthenticated && user?.username;

    // ========== MAIN AUTOMATIC WEBRTC FLOW ==========
    const initializeAutomaticWebRTC = async () => {
        if (!roomData || !isUserReady) return;

        console.log('[AUTO-WEBRTC] Starting automatic WebRTC initialization...');

        try {
            // Step 1: Enumerate devices first
            if (availableDevices.cameras.length === 0 && availableDevices.microphones.length === 0) {
                console.log('[AUTO-WEBRTC] Step 1: Enumerating devices...');
                await enumerateDevices();
            }

            // Step 2: Setup media (camera & microphone)
            if (!localStream.current) {
                console.log('[AUTO-WEBRTC] Step 2: Setting up media...');
                await setupMedia(selectedCameraId, selectedMicrophoneId, isCameraEnabled, isMicrophoneEnabled);
            }

            // Step 3: Start signal polling for automatic responses
            if (!isSignalPolling) {
                console.log('[AUTO-WEBRTC] Step 3: Starting signal polling...');
                startAutomaticSignalPolling();
            }

            // Step 4: Handle participant changes
            handleParticipantChanges();

            console.log('[AUTO-WEBRTC] Automatic WebRTC initialization complete!');

        } catch (error) {
            console.error('[AUTO-WEBRTC] Initialization failed:', error);
        }
    };

    // ========== AI TRANSLATION FUNCTIONS ==========
    const initializeSpeechRecognition = () => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn('Speech Recognition not supported');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();

        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = sourceLanguage;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            setRecognitionActive(true);
        };

        recognition.onend = () => {
            setRecognitionActive(false);
            if (shouldRestartSpeechRef.current && showAITranslate) {
                setIsTranscribing(true);
                if (shouldRestartSpeechRef.current && speechRecognitionRef.current) {
                    try {
                        speechRecognitionRef.current.start();
                    } catch (error) {
                        console.error('[AI-TRANSLATE] Restart failed:', error);
                    }
                }
            } else {
                setIsTranscribing(false);
            }
        };

        recognition.onerror = (event: any) => {
            console.error('[AI-TRANSLATE] Speech recognition error:', event.error);
            setRecognitionActive(false);
        };

        recognition.onresult = async (event: any) => {
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];

                if (result.isFinal) {
                    finalTranscript += result[0].transcript;
                    const confidence = result[0].confidence;

                    if (finalTranscript.trim()) {
                        await handleSpeechResult(
                            finalTranscript.trim(),
                            principalId || 'local',
                            user?.name || user?.username || 'You',
                            true,
                            confidence
                        );
                    }
                }
            }
        };

        speechRecognitionRef.current = recognition;
    };

    const handleSpeechResult = async (
        text: string,
        participantId: string,
        participantName: string,
        isLocal: boolean,
        confidence?: number
    ) => {
        const logId = `${participantId}-${Date.now()}-${Math.random()}`;

        // Create initial log entry
        const newLog: SpeechLog = {
            id: logId,
            participantId,
            participantName,
            originalText: text,
            timestamp: new Date(),
            isTranslating: true,
            isLocal,
            confidence
        };

        setSpeechLogs(prev => [newLog, ...prev]);

        try {
            // Detect language
            const detectedLang = await detectLanguage(text);

            // Translate to target language
            const translatedText = await translate(text, targetLanguage);

            // Update log with translation
            setSpeechLogs(prev => prev.map(log =>
                log.id === logId
                    ? {
                        ...log,
                        translatedText,
                        detectedLanguage: detectedLang,
                        isTranslating: false
                    }
                    : log
            ));

            console.log('[AI-TRANSLATE] Translation completed:', {
                original: text,
                translated: translatedText,
                language: detectedLang
            });

        } catch (error) {
            console.error('[AI-TRANSLATE] Translation failed:', error);

            // Update log with error
            setSpeechLogs(prev => prev.map(log =>
                log.id === logId
                    ? {
                        ...log,
                        translatedText: 'Translation failed',
                        isTranslating: false
                    }
                    : log
            ));
        }
    };

    const startAITranscription = () => {
        if (!speechRecognitionRef.current) {
            initializeSpeechRecognition();
        }

        if (speechRecognitionRef.current && !recognitionActive) {
            try {
                shouldRestartSpeechRef.current = true;
                speechRecognitionRef.current.start();
                setIsTranscribing(true);
                console.log('[AI-TRANSLATE] Starting transcription...');
            } catch (error) {
                console.error('[AI-TRANSLATE] Failed to start:', error);
            }
        }
    };

    const stopAITranscription = () => {
        if (speechRecognitionRef.current) {
            shouldRestartSpeechRef.current = false;
            speechRecognitionRef.current.stop();
            setIsTranscribing(false);
        }
    };

    const clearSpeechLogs = () => {
        setSpeechLogs([]);
    };

    const getLanguageName = (code: string): string => {
        const langMap: Record<string, string> = {
            'id-ID': '🇮🇩 Indonesian',
            'en-US': '🇺🇸 English (US)',
            'en-GB': '🇬🇧 English (UK)',
            'ja-JP': '🇯🇵 Japanese',
            'ko-KR': '🇰🇷 Korean',
            'zh-CN': '🇨🇳 Chinese',
            'zh-TW': '🇹🇼 Chinese (TW)',
            'es-ES': '🇪🇸 Spanish',
            'fr-FR': '🇫🇷 French',
            'de-DE': '🇩🇪 German',
            'pt-BR': '🇧🇷 Portuguese',
            'ru-RU': '🇷🇺 Russian',
            'ar-SA': '🇸🇦 Arabic',
            'hi-IN': '🇮🇳 Hindi',
            'th-TH': '🇹🇭 Thai',
            'vi-VN': '🇻🇳 Vietnamese',
            'tr-TR': '🇹🇷 Turkish',
        };

        return langMap[code] || code;
    };

    // ========== CLEANUP FUNCTIONS ==========
    const cleanupAllPeerConnections = () => {
        console.log('[CLEANUP] Cleaning up all peer connections...');

        // Stop signal polling
        stopSignalPolling();

        // Close all peer connections
        peerConnections.current.forEach((peerData, principalId) => {
            if (peerData.pc) {
                peerData.pc.close();
                console.log(`[CLEANUP] Closed peer connection for ${principalId}`);
            }

            // Stop remote stream
            if (peerData.remoteStream) {
                peerData.remoteStream.getTracks().forEach(track => track.stop());
            }

            // Safe video element removal
            if (peerData.videoElement) {
                try {
                    const parentElement = peerData.videoElement.parentElement;
                    if (parentElement && parentElement.parentNode) {
                        parentElement.parentNode.removeChild(parentElement);
                    }
                } catch (error) {
                    console.warn(`[CLEANUP] Could not remove video element for ${principalId}:`, error);
                }
            }
        });

        // Clear all maps
        peerConnections.current.clear();
        pendingICECandidates.current.clear();
        processedSignals.current.clear();
        setConnectedPeers([]);

        console.log('[CLEANUP] All peer connections cleanup complete');
    };

    const cleanupPeerConnection = (targetPrincipal: string) => {
        console.log(`[CLEANUP] Cleaning up connection for ${targetPrincipal}...`);

        const peerData = peerConnections.current.get(targetPrincipal);
        if (peerData) {
            if (peerData.pc) {
                peerData.pc.close();
            }
            if (peerData.remoteStream) {
                peerData.remoteStream.getTracks().forEach(track => track.stop());
            }

            // ENHANCED VIDEO ELEMENT REMOVAL
            const videoWrapper = document.getElementById(`video-wrapper-${targetPrincipal}`);
            if (videoWrapper && videoWrapper.parentNode) {
                videoWrapper.parentNode.removeChild(videoWrapper);
                console.log(`[CLEANUP] Removed video wrapper for ${targetPrincipal}`);
            }
        }

        peerConnections.current.delete(targetPrincipal);
        pendingICECandidates.current.delete(targetPrincipal);

        setConnectedPeers(prev => prev.filter(p => p !== targetPrincipal));

        console.log(`[CLEANUP] Connection cleanup complete for ${targetPrincipal}`);
    };

    const cleanupLocalMedia = () => {
        console.log('[CLEANUP] Cleaning up local media...');

        if (localStream.current) {
            localStream.current.getTracks().forEach(track => track.stop());
            localStream.current = null;
        }

        if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
        }

        console.log('[CLEANUP] Local media cleanup complete');
    };

    // ========== SYMMETRIC PARTICIPANT HANDLING ==========
    const handleParticipantChanges = () => {
        if (!principalId || !roomData) return;

        const otherParticipants = roomData.participants.filter(p =>
            p && typeof p.toText === 'function' && p.toText() !== principalId
        );

        const currentPrincipalTexts = otherParticipants.map(p => p.toText());
        const previousPrincipalTexts = previousParticipants.current;

        console.log(`[PARTICIPANTS] Current others:`, currentPrincipalTexts);
        console.log(`[PARTICIPANTS] Previous others:`, previousPrincipalTexts);

        // Case 1: No other participants - cleanup all connections
        if (currentPrincipalTexts.length === 0) {
            console.log('[PARTICIPANTS] No other participants - cleaning up all connections');
            cleanupAllPeerConnections();
            previousParticipants.current = currentPrincipalTexts;
            return;
        }

        // Case 2: Remove connections for participants who left
        const participantsWhoLeft = previousPrincipalTexts.filter(p => !currentPrincipalTexts.includes(p));
        participantsWhoLeft.forEach(leftPrincipal => {
            console.log(`[PARTICIPANTS] Participant left: ${leftPrincipal}`);
            cleanupPeerConnection(leftPrincipal);
        });

        // Case 3: Handle NEW participants joining (BIDIRECTIONAL APPROACH)
        const newParticipants = currentPrincipalTexts.filter(p => !previousPrincipalTexts.includes(p));

        if (newParticipants.length > 0) {
            console.log(`[PARTICIPANTS] NEW participants detected:`, newParticipants);

            // CRITICAL FIX: Both existing and new participants establish connections
            newParticipants.forEach(async (newPrincipalText) => {
                console.log(`[PARTICIPANTS] I (existing user) am establishing connection with NEW user: ${newPrincipalText}`);
                await handleNewParticipantConnection(newPrincipalText);
            });

            // Also notify that we detected new participants - this will trigger them to connect to us too
            console.log(`[PARTICIPANTS] Detected ${newParticipants.length} new participants. They should also connect to existing users.`);
        }

        // Case 4: Ensure all current participants have connections (safety check)
        currentPrincipalTexts.forEach(async (otherPrincipalText) => {
            if (!peerConnections.current.has(otherPrincipalText)) {
                console.log(`[PARTICIPANTS] Creating missing connection to: ${otherPrincipalText}`);
                await handleNewParticipantConnection(otherPrincipalText);
            }
        });

        // Update previous participants
        previousParticipants.current = currentPrincipalTexts;
    };

    // ========== SYMMETRIC CONNECTION ESTABLISHMENT ==========
    const handleNewParticipantConnection = async (targetPrincipalText: string) => {
        try {
            console.log(`[BIDIRECTIONAL] Establishing connection with ${targetPrincipalText}...`);
            console.log(`[BIDIRECTIONAL] My principal: ${principalId}, Target: ${targetPrincipalText}`);

            // Create peer connection if it doesn't exist
            if (!peerConnections.current.has(targetPrincipalText)) {
                console.log(`[BIDIRECTIONAL] Creating new peer connection for ${targetPrincipalText}`);
                await createPeerConnectionForUser(targetPrincipalText);
            } else {
                console.log(`[BIDIRECTIONAL] Peer connection already exists for ${targetPrincipalText}`);
            }

            // BIDIRECTIONAL OFFER STRATEGY:
            // Both users attempt to connect, but only the one with smaller principal sends offer
            // This ensures EVERY pair of users has a connection
            const shouldIOffer = principalId < targetPrincipalText;

            if (shouldIOffer) {
                console.log(`[BIDIRECTIONAL] I WILL send offer to ${targetPrincipalText} (I have smaller principal: ${principalId} < ${targetPrincipalText})`);

                // Add staggered delay to prevent signal collision
                const delay = Math.random() * 1500 + 1000; // 1-2.5 seconds
                setTimeout(async () => {
                    const peerData = peerConnections.current.get(targetPrincipalText);
                    if (peerData && peerData.pc.signalingState === 'stable') {
                        console.log(`[BIDIRECTIONAL] Now sending offer to ${targetPrincipalText} after delay`);
                        await sendOfferToUser(targetPrincipalText);
                    } else {
                        console.log(`[BIDIRECTIONAL] Peer not ready for offer: ${targetPrincipalText}, state: ${peerData?.pc.signalingState}`);

                        // Retry after a bit if peer connection exists but not stable
                        if (peerData) {
                            setTimeout(async () => {
                                if (peerData.pc.signalingState === 'stable') {
                                    console.log(`[BIDIRECTIONAL] Retrying offer to ${targetPrincipalText}`);
                                    await sendOfferToUser(targetPrincipalText);
                                }
                            }, 2000);
                        }
                    }
                }, delay);
            } else {
                console.log(`[BIDIRECTIONAL] I will WAIT for offer from ${targetPrincipalText} (they have smaller principal: ${targetPrincipalText} < ${principalId})`);
                console.log(`[BIDIRECTIONAL] Expected: ${targetPrincipalText} should send offer to me (${principalId})`);
            }

        } catch (error) {
            console.error(`[BIDIRECTIONAL] Error establishing connection with ${targetPrincipalText}:`, error);

            // Retry on error
            setTimeout(() => {
                console.log(`[BIDIRECTIONAL] Retrying connection with ${targetPrincipalText} after error`);
                handleNewParticipantConnection(targetPrincipalText);
            }, 3000);
        }
    };

    // ========== DEVICE ENUMERATION AND MANAGEMENT ==========
    const enumerateDevices = async () => {
        try {
            setIsDevicesLoading(true);
            console.log('[DEVICES] Enumerating media devices...');

            // Request permissions first to get device labels
            await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

            const devices = await navigator.mediaDevices.enumerateDevices();

            const cameras = devices.filter(device => device.kind === 'videoinput');
            const microphones = devices.filter(device => device.kind === 'audioinput');

            console.log('[DEVICES] Found cameras:', cameras.length);
            console.log('[DEVICES] Found microphones:', microphones.length);

            setAvailableDevices({ cameras, microphones });

            // Set default devices if not already selected
            if (!selectedCameraId && cameras.length > 0) {
                setSelectedCameraId(cameras[0].deviceId);
            }
            if (!selectedMicrophoneId && microphones.length > 0) {
                setSelectedMicrophoneId(microphones[0].deviceId);
            }

        } catch (error) {
            console.error('[DEVICES] Error enumerating devices:', error);
        } finally {
            setIsDevicesLoading(false);
        }
    };

    // ========== MEDIA SETUP ==========
    const setupMedia = async (
        cameraId?: string,
        microphoneId?: string,
        enableCamera: boolean = true,
        enableMicrophone: boolean = true
    ) => {
        try {
            console.log('[MEDIA] Requesting camera & mic...');
            console.log('[MEDIA] - Camera ID:', cameraId || 'default');
            console.log('[MEDIA] - Microphone ID:', microphoneId || 'default');
            console.log('[MEDIA] - Camera enabled:', enableCamera);
            console.log('[MEDIA] - Microphone enabled:', enableMicrophone);

            // Stop existing stream
            if (localStream.current) {
                localStream.current.getTracks().forEach(track => track.stop());
            }

            const constraints: MediaStreamConstraints = {
                video: enableCamera ? {
                    deviceId: cameraId ? { exact: cameraId } : undefined,
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 }
                } : false,
                audio: enableMicrophone ? {
                    deviceId: microphoneId ? { exact: microphoneId } : undefined,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                } : false
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            localStream.current = stream;

            // VERIFY LOCAL STREAM
            console.log('[MEDIA] Got local stream:');
            console.log('[MEDIA] - Stream active:', stream.active);
            console.log('[MEDIA] - Total tracks:', stream.getTracks().length);

            stream.getTracks().forEach((track, index) => {
                console.log(`[MEDIA] - Track ${index}: ${track.kind}, enabled: ${track.enabled}, readyState: ${track.readyState}`);
            });

            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
                console.log('[MEDIA] Set local video source');
            }

            // UPDATE TRACKS IN EXISTING PEER CONNECTIONS
            await updateTracksInPeerConnections(stream);

        } catch (err) {
            console.error('[MEDIA] Error:', err);
            alert(`Failed to access media devices: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    };

    // ========== UPDATE TRACKS IN PEER CONNECTIONS ==========
    const updateTracksInPeerConnections = async (newStream: MediaStream) => {
        console.log('[MEDIA] Updating tracks in existing peer connections...');

        for (const [targetPrincipal, peerData] of peerConnections.current) {
            console.log(`[MEDIA] Updating tracks for connection: ${targetPrincipal}`);

            try {
                // ENHANCED TRACK REPLACEMENT STRATEGY
                const senders = peerData.pc.getSenders();

                // Replace tracks instead of removing/adding to avoid renegotiation
                for (const sender of senders) {
                    if (sender.track) {
                        const trackKind = sender.track.kind;
                        const newTrack = newStream.getTracks().find(track => track.kind === trackKind);

                        if (newTrack) {
                            try {
                                await sender.replaceTrack(newTrack);
                                console.log(`[MEDIA] Replaced ${trackKind} track for ${targetPrincipal}`);
                            } catch (replaceError) {
                                console.warn(`[MEDIA] Replace track failed for ${trackKind}, falling back to remove/add:`, replaceError);

                                // Fallback: remove and add track
                                peerData.pc.removeTrack(sender);
                                peerData.pc.addTrack(newTrack, newStream);
                                console.log(`[MEDIA] Fallback: Removed and added ${trackKind} track for ${targetPrincipal}`);
                            }
                        } else {
                            // Track kind not available in new stream (e.g., camera turned off)
                            peerData.pc.removeTrack(sender);
                            console.log(`[MEDIA] Removed ${trackKind} track for ${targetPrincipal} (not available in new stream)`);
                        }
                    }
                }

                // Add any new tracks that don't have senders yet
                newStream.getTracks().forEach(track => {
                    const existingSender = peerData.pc.getSenders().find(sender =>
                        sender.track && sender.track.kind === track.kind
                    );

                    if (!existingSender) {
                        peerData.pc.addTrack(track, newStream);
                        console.log(`[MEDIA] Added new ${track.kind} track to ${targetPrincipal}`);
                    }
                });

                // ONLY RENEGOTIATE IF NECESSARY (when adding/removing tracks, not replacing)
                const needsRenegotiation = senders.length !== newStream.getTracks().length;

                if (needsRenegotiation && peerData.pc.signalingState === 'stable') {
                    console.log(`[MEDIA] Renegotiating connection with ${targetPrincipal}...`);

                    const offer = await peerData.pc.createOffer();
                    await peerData.pc.setLocalDescription(offer);

                    const signal: Signal = {
                        from: Principal.fromText(principalId),
                        to: Principal.fromText(targetPrincipal),
                        kind: 'offer',
                        data: JSON.stringify(offer)
                    };

                    await sendSignal(roomId!, signal);
                    console.log(`[MEDIA] Sent renegotiation offer to ${targetPrincipal}`);
                } else {
                    console.log(`[MEDIA] Track replacement completed for ${targetPrincipal} without renegotiation`);
                }

            } catch (error) {
                console.error(`[MEDIA] Error updating tracks for ${targetPrincipal}:`, error);
            }
        }
    };

    // ========== MEDIA CONTROL FUNCTIONS ==========
    const handleCameraChange = async (cameraId: string) => {
        console.log('[CONTROLS] Changing camera to:', cameraId);
        setSelectedCameraId(cameraId);

        try {
            await setupMedia(cameraId, selectedMicrophoneId, isCameraEnabled, isMicrophoneEnabled);
        } catch (error) {
            console.error('[CONTROLS] Error switching camera:', error);
        }
    };

    const handleMicrophoneChange = async (microphoneId: string) => {
        console.log('[CONTROLS] Changing microphone to:', microphoneId);
        setSelectedMicrophoneId(microphoneId);

        try {
            await setupMedia(selectedCameraId, microphoneId, isCameraEnabled, isMicrophoneEnabled);
        } catch (error) {
            console.error('[CONTROLS] Error switching microphone:', error);
        }
    };

    const toggleCamera = async () => {
        const newCameraState = !isCameraEnabled;
        console.log('[CONTROLS] Toggling camera:', newCameraState ? 'ON' : 'OFF');
        setIsCameraEnabled(newCameraState);

        if (localStream.current) {
            const videoTracks = localStream.current.getVideoTracks();

            if (videoTracks.length > 0) {
                videoTracks.forEach(track => {
                    track.enabled = newCameraState;
                });

                // Update track in peer connections
                for (const [targetPrincipal, peerData] of peerConnections.current) {
                    const senders = peerData.pc.getSenders();
                    const videoSender = senders.find(sender => sender.track && sender.track.kind === 'video');

                    if (videoSender && videoSender.track) {
                        videoSender.track.enabled = newCameraState;
                        console.log(`[CONTROLS] Updated video track enabled state for ${targetPrincipal}: ${newCameraState}`);
                    }
                }
            } else if (newCameraState) {
                await setupMedia(selectedCameraId, selectedMicrophoneId, newCameraState, isMicrophoneEnabled);
            }
        } else if (newCameraState) {
            await setupMedia(selectedCameraId, selectedMicrophoneId, newCameraState, isMicrophoneEnabled);
        }
    };

    const toggleMicrophone = async () => {
        const newMicState = !isMicrophoneEnabled;
        console.log('[CONTROLS] Toggling microphone:', newMicState ? 'ON' : 'OFF');
        setIsMicrophoneEnabled(newMicState);

        if (localStream.current) {
            const audioTracks = localStream.current.getAudioTracks();

            if (audioTracks.length > 0) {
                audioTracks.forEach(track => {
                    track.enabled = newMicState;
                });

                // Update track in peer connections
                for (const [targetPrincipal, peerData] of peerConnections.current) {
                    const senders = peerData.pc.getSenders();
                    const audioSender = senders.find(sender => sender.track && sender.track.kind === 'audio');

                    if (audioSender && audioSender.track) {
                        audioSender.track.enabled = newMicState;
                        console.log(`[CONTROLS] Updated audio track enabled state for ${targetPrincipal}: ${newMicState}`);
                    }
                }
            } else if (newMicState) {
                await setupMedia(selectedCameraId, selectedMicrophoneId, isCameraEnabled, newMicState);
            }
        } else if (newMicState) {
            await setupMedia(selectedCameraId, selectedMicrophoneId, isCameraEnabled, newMicState);
        }
    };

    // ========== DYNAMIC GRID CALCULATOR ==========
    const getVideoGridLayout = (totalVideos: number) => {
        if (totalVideos <= 0) return { cols: 1, rows: 1 };
        if (totalVideos === 1) return { cols: 1, rows: 1 };
        if (totalVideos === 2) return { cols: 2, rows: 1 };
        if (totalVideos <= 4) return { cols: 2, rows: 2 };
        if (totalVideos <= 6) return { cols: 3, rows: 2 };
        if (totalVideos <= 9) return { cols: 3, rows: 3 };
        if (totalVideos <= 12) return { cols: 4, rows: 3 };
        return { cols: 4, rows: Math.ceil(totalVideos / 4) };
    };

    // ========== ENHANCED PEER CONNECTION ==========
    const createPeerConnectionForUser = async (targetPrincipal: string): Promise<void> => {
        try {
            console.log(`[PEER] Creating peer connection for ${targetPrincipal}...`);

            const pc = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' }
                ],
                iceCandidatePoolSize: 10,
                iceTransportPolicy: 'all'
            });

            // CREATE VIDEO ELEMENT BUT DON'T ADD TO DOM YET
            const videoElement = document.createElement('video');
            videoElement.autoplay = true;
            videoElement.playsInline = true;
            videoElement.muted = false;
            videoElement.className = 'w-full h-full bg-gray-800 rounded-lg object-cover';
            videoElement.style.aspectRatio = '16/9';

            // ENHANCED TRACK HANDLING - DEBUGGING
            pc.ontrack = (event) => {
                console.log(`[REMOTE] - Track received from ${targetPrincipal}:`);
                console.log(`[REMOTE] - Track kind: ${event.track.kind}`);
                console.log(`[REMOTE] - Track enabled: ${event.track.enabled}`);
                console.log(`[REMOTE] - Track readyState: ${event.track.readyState}`);
                console.log(`[REMOTE] - Streams count: ${event.streams.length}`);

                const [remoteStream] = event.streams;

                if (remoteStream) {
                    console.log(`[REMOTE] - Remote stream received from ${targetPrincipal}`);
                    console.log(`[REMOTE] - Stream active: ${remoteStream.active}`);
                    console.log(`[REMOTE] - Stream tracks: ${remoteStream.getTracks().length}`);

                    // Log each track in the stream
                    remoteStream.getTracks().forEach((track, index) => {
                        console.log(`[REMOTE] - Track ${index}: ${track.kind}, enabled: ${track.enabled}, readyState: ${track.readyState}`);
                    });

                    // Set video source
                    videoElement.srcObject = remoteStream;

                    // Update peer data
                    const peerData = peerConnections.current.get(targetPrincipal);
                    if (peerData) {
                        peerData.remoteStream = remoteStream;
                    }

                    // ENHANCED VIDEO PLAY WITH ERROR HANDLING
                    videoElement.play()
                        .then(() => {
                            console.log(`[REMOTE] Video playing successfully for ${targetPrincipal}`);
                        })
                        .catch(err => {
                            console.error(`[REMOTE] Video play failed for ${targetPrincipal}:`, err);

                            // Retry playing after a short delay
                            setTimeout(() => {
                                videoElement.play().catch(retryErr => {
                                    console.error(`[REMOTE] Video play retry failed for ${targetPrincipal}:`, retryErr);
                                });
                            }, 1000);
                        });

                    // ADD VIDEO EVENT LISTENERS FOR DEBUGGING
                    videoElement.onloadedmetadata = () => {
                        console.log(`[REMOTE] Video metadata loaded for ${targetPrincipal}`);
                        console.log(`[REMOTE] - Video dimensions: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
                    };

                    videoElement.oncanplay = () => {
                        console.log(`[REMOTE]  Video can play for ${targetPrincipal}`);
                    };

                    videoElement.onerror = (error) => {
                        console.error(`[REMOTE] Video error for ${targetPrincipal}:`, error);
                    };

                } else {
                    console.warn(`[REMOTE] No remote stream in track event from ${targetPrincipal}`);
                }

                // Enhanced remote audio monitoring for AI translation
                if (event.track.kind === 'audio' && showAITranslate) {
                    try {
                        const audioContext = new AudioContext();
                        const source = audioContext.createMediaStreamSource(remoteStream);
                        const analyser = audioContext.createAnalyser();

                        analyser.fftSize = 256;
                        source.connect(analyser);

                        const dataArray = new Uint8Array(analyser.frequencyBinCount);

                        // Simple volume detection for remote speech
                        const checkAudioLevel = () => {
                            analyser.getByteFrequencyData(dataArray);
                            const average = dataArray.reduce((sum, value) => sum + value) / dataArray.length;

                            if (average > 30) { // Threshold for speech detection
                                // For now, we'll just log detected speech activity
                                // handleSpeechResult(
                                //     '[Remote audio detected - speech-to-text not implemented]',
                                //     targetPrincipal,
                                //     `User ${targetPrincipal.substring(0, 8)}...`,
                                //     false
                                // );
                            }

                            if (showAITranslate) {
                                requestAnimationFrame(checkAudioLevel);
                            }
                        };

                        checkAudioLevel();

                    } catch (error) {
                        console.warn('[AI-TRANSLATE] Audio monitoring setup failed:', error);
                    }
                }
            };

            // ENHANCED CONNECTION STATE TRACKING - ONLY SHOW VIDEO WHEN CONNECTED
            pc.onconnectionstatechange = () => {
                console.log(`[PEER] Connection state for ${targetPrincipal}:`, pc.connectionState);

                const peerData = peerConnections.current.get(targetPrincipal);
                if (peerData) {
                    peerData.connectionState = pc.connectionState;
                }

                switch (pc.connectionState) {
                    case 'connected':
                        console.log(`[PEER] Successfully connected to ${targetPrincipal}`);

                        // ONLY ADD VIDEO ELEMENT TO DOM WHEN CONNECTED
                        if (remoteVideosContainerRef.current && !document.getElementById(`video-wrapper-${targetPrincipal}`)) {
                            const videoWrapper = document.createElement('div');
                            videoWrapper.className = 'relative bg-gray-800/50 rounded-xl overflow-hidden border border-gray-600/50 hover:border-lime-400/50 transition-all w-full';
                            videoWrapper.style.aspectRatio = '16/9';
                            videoWrapper.id = `video-wrapper-${targetPrincipal}`;

                            // Apply SpotlightCard effect (optional)
                            videoWrapper.style.background = 'linear-gradient(145deg, rgba(55, 65, 81, 0.5), rgba(75, 85, 99, 0.5))';
                            videoWrapper.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';

                            // Set video element styling
                            videoElement.className = 'w-full h-full object-cover';

                            // CLEAN USER LABEL
                            const label = document.createElement('div');
                            label.className = 'absolute bottom-3 left-3 bg-black/70 text-white text-xs px-2 py-1 rounded backdrop-blur-sm border border-white/20';
                            label.textContent = `${targetPrincipal.substring(0, 8)}...`;

                            // CONNECTION STATUS INDICATOR
                            const statusIndicator = document.createElement('div');
                            statusIndicator.className = 'absolute top-3 right-3 w-3 h-3 bg-lime-400 rounded-full border-2 border-white animate-pulse';
                            statusIndicator.id = `status-${targetPrincipal}`;

                            // PARTICIPANT BADGE
                            const participantBadge = document.createElement('div');
                            participantBadge.className = 'absolute top-3 left-3 bg-lime-500/20 text-lime-300 border border-lime-500/30 text-xs px-2 py-1 rounded backdrop-blur-sm';
                            participantBadge.innerHTML = '<div class="w-2 h-2 bg-lime-400 rounded-full mr-2 animate-pulse" style="display: inline-block;"></div>Connected';

                            videoWrapper.appendChild(videoElement);
                            videoWrapper.appendChild(label);
                            videoWrapper.appendChild(statusIndicator);
                            videoWrapper.appendChild(participantBadge);
                            remoteVideosContainerRef.current.appendChild(videoWrapper);

                            console.log(`[PEER] Video element added to DOM for ${targetPrincipal} with 16:9 aspect ratio`);
                        }

                        // VERIFY REMOTE STREAMS AFTER CONNECTION
                        setTimeout(() => {
                            const receivers = pc.getReceivers();
                            console.log(`[PEER] Receivers for ${targetPrincipal}:`, receivers.length);

                            receivers.forEach((receiver, index) => {
                                if (receiver.track) {
                                    console.log(`[PEER] - Receiver ${index}: ${receiver.track.kind}, enabled: ${receiver.track.enabled}`);
                                }
                            });

                            const senders = pc.getSenders();
                            console.log(`[PEER] Senders for ${targetPrincipal}:`, senders.length);

                            senders.forEach((sender, index) => {
                                if (sender.track) {
                                    console.log(`[PEER] - Sender ${index}: ${sender.track.kind}, enabled: ${sender.track.enabled}`);
                                }
                            });
                        }, 2000);

                        setConnectedPeers(prev => {
                            if (!prev.includes(targetPrincipal)) {
                                return [...prev, targetPrincipal];
                            }
                            return prev;
                        });
                        break;

                    case 'connecting':
                        console.log(`[PEER] Connecting to ${targetPrincipal}...`);
                        // Don't show video element yet, just log
                        break;

                    case 'disconnected':
                    case 'failed':
                        console.log(`[PEER] Connection ${pc.connectionState} for ${targetPrincipal}`);

                        // REMOVE VIDEO ELEMENT FROM DOM WHEN DISCONNECTED/FAILED
                        const existingWrapper = document.getElementById(`video-wrapper-${targetPrincipal}`);
                        if (existingWrapper && existingWrapper.parentNode) {
                            existingWrapper.parentNode.removeChild(existingWrapper);
                            console.log(`[PEER] Video element removed from DOM for ${targetPrincipal}`);
                        }

                        setConnectedPeers(prev => prev.filter(p => p !== targetPrincipal));

                        if (pc.connectionState === 'failed') {
                            console.log(`[PEER] Connection failed for ${targetPrincipal}, will retry...`);
                            setTimeout(() => {
                                cleanupPeerConnection(targetPrincipal);
                                handleNewParticipantConnection(targetPrincipal);
                            }, 3000);
                        }
                        break;

                    default:
                        console.log(`[PEER] Connection state ${pc.connectionState} for ${targetPrincipal}`);
                        // Don't show video element for other states
                        break;
                }
            };

            pc.onsignalingstatechange = () => {
                console.log(`[PEER] Signaling state for ${targetPrincipal}:`, pc.signalingState);

                const peerData = peerConnections.current.get(targetPrincipal);
                if (peerData) {
                    peerData.hasLocalDescription = !!pc.localDescription;
                    peerData.hasRemoteDescription = !!pc.remoteDescription;
                }
            };

            pc.oniceconnectionstatechange = () => {
                console.log(`[PEER] ICE connection state for ${targetPrincipal}:`, pc.iceConnectionState);

                if (pc.iceConnectionState === 'failed') {
                    console.log(`[PEER] ICE failed for ${targetPrincipal}, restarting ICE...`);
                    pc.restartIce();
                }
            };

            // ICE candidate handling
            pc.onicecandidate = async (event) => {
                if (event.candidate) {
                    try {
                        await sendICECandidate(event.candidate, targetPrincipal);
                    } catch (error) {
                        console.error(`[PEER] Failed to send ICE candidate for ${targetPrincipal}:`, error);
                    }
                } else {
                    console.log(`[PEER] ICE gathering completed for ${targetPrincipal}`);
                }
            };

            // ENHANCED LOCAL TRACK ADDITION WITH VERIFICATION
            if (localStream.current) {
                console.log(`[PEER] Adding local tracks to ${targetPrincipal}...`);

                localStream.current.getTracks().forEach((track, index) => {
                    try {
                        console.log(`[PEER] Adding track ${index} (${track.kind}) to ${targetPrincipal}`);
                        console.log(`[PEER] - Track enabled: ${track.enabled}, readyState: ${track.readyState}`);

                        const sender = pc.addTrack(track, localStream.current!);
                        console.log(`[PEER] Added ${track.kind} track for ${targetPrincipal}`, sender);
                    } catch (error) {
                        console.error(`[PEER] Failed to add ${track.kind} track for ${targetPrincipal}:`, error);
                    }
                });

                // VERIFY TRACKS WERE ADDED
                setTimeout(() => {
                    const senders = pc.getSenders();
                    console.log(`[PEER] Verification - Total senders for ${targetPrincipal}:`, senders.length);

                    senders.forEach((sender, index) => {
                        if (sender.track) {
                            console.log(`[PEER] - Sender ${index}: ${sender.track.kind}`);
                        } else {
                            console.warn(`[PEER] - Sender ${index}: NO TRACK!`);
                        }
                    });
                }, 1000);
            } else {
                console.warn(`[PEER] No local stream available when creating peer connection for ${targetPrincipal}`);
            }

            // Store peer connection data
            peerConnections.current.set(targetPrincipal, {
                pc,
                remoteStream: null,
                videoElement, // Store video element but it's not in DOM yet
                connectionState: pc.connectionState,
                hasLocalDescription: false,
                hasRemoteDescription: false,
                isOfferer: false,
                isAnswerer: false
            });

            console.log(`[PEER] Peer connection created for ${targetPrincipal}`);

        } catch (err) {
            console.error(`[PEER] Error creating peer connection for ${targetPrincipal}:`, err);
        }
    };

    // ========== SIGNAL POLLING ==========
    const startAutomaticSignalPolling = () => {
        if (isSignalPolling || !roomId || !principalId) return;

        console.log('[POLLING] Starting automatic signal polling...');
        setIsSignalPolling(true);

        signalIntervalRef.current = setInterval(async () => {
            try {
                await processIncomingSignals();
            } catch (error) {
                console.error('[POLLING] Error:', error);
            }
        }, 2000);
    };

    const processIncomingSignals = async () => {
        if (!roomId || !principalId) return;

        try {
            const signals = await getSignals(roomId, Principal.fromText(principalId));
            if (signals.length === 0) return;

            console.log(`[AUTO-SIGNAL] Found ${signals.length} incoming signals`);

            // Process signals by type priority: offers first, then answers, then ICE
            const offers = signals.filter(s => s.kind === 'offer');
            const answers = signals.filter(s => s.kind === 'answer');
            const ices = signals.filter(s => s.kind === 'ice');

            // Process offers first
            for (const signal of offers) {
                const signalId = `${signal.from.toText()}-${signal.kind}-${Date.now()}`;
                if (!processedSignals.current.has(signalId)) {
                    processedSignals.current.add(signalId);
                    await autoProcessOffer(signal);
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }

            // Process answers second
            for (const signal of answers) {
                const signalId = `${signal.from.toText()}-${signal.kind}-${Date.now()}`;
                if (!processedSignals.current.has(signalId)) {
                    processedSignals.current.add(signalId);
                    await autoProcessAnswer(signal);
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }

            // Process ICE candidates last
            for (const signal of ices) {
                await autoProcessICE(signal);
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            // Clear signals after processing all
            if (signals.length > 0) {
                setTimeout(async () => {
                    try {
                        await clearSignals(roomId);
                        console.log('[AUTO-SIGNAL] Cleared processed signals');
                    } catch (error) {
                        console.error('[AUTO-SIGNAL] Error clearing signals:', error);
                    }
                }, 500);
            }

        } catch (error) {
            console.error('[AUTO-SIGNAL] Error processing signals:', error);
        }
    };

    const stopSignalPolling = () => {
        console.log('Stopping signal polling');
        setIsSignalPolling(false);
        if (signalIntervalRef.current) {
            clearInterval(signalIntervalRef.current);
            signalIntervalRef.current = null;
        }
    };

    // ========== ENHANCED SIGNAL PROCESSING ==========
    const autoProcessOffer = async (offerSignal: Signal) => {
        const fromPrincipal = offerSignal.from.toText();

        try {
            console.log(`[AUTO-OFFER] Processing offer from ${fromPrincipal}`);

            // Create peer connection if doesn't exist
            if (!peerConnections.current.has(fromPrincipal)) {
                await createPeerConnectionForUser(fromPrincipal);
            }

            const peerData = peerConnections.current.get(fromPrincipal);
            if (!peerData || !roomId) return;

            // ENHANCED RENEGOTIATION HANDLING
            if (peerData.pc.signalingState === 'stable' && peerData.hasRemoteDescription) {
                console.log(`[AUTO-OFFER] Handling renegotiation offer from ${fromPrincipal}`);

                // This is a renegotiation offer
                const remoteDesc = new RTCSessionDescription(JSON.parse(offerSignal.data));
                await peerData.pc.setRemoteDescription(remoteDesc);

                // Create and send answer for renegotiation
                const answer = await peerData.pc.createAnswer();
                await peerData.pc.setLocalDescription(answer);

                const answerSignal: Signal = {
                    from: Principal.fromText(principalId),
                    to: offerSignal.from,
                    kind: 'answer',
                    data: JSON.stringify(answer)
                };

                await sendSignal(roomId, answerSignal);
                console.log(`[AUTO-OFFER] Sent renegotiation answer to ${fromPrincipal}`);

                return;
            }

            // Handle offer collision by principal comparison
            if (peerData.pc.signalingState === 'have-local-offer') {
                console.log(`[AUTO-OFFER] Offer collision detected with ${fromPrincipal}`);

                if (principalId < fromPrincipal) {
                    console.log(`[AUTO-OFFER] Ignoring offer from ${fromPrincipal} (I have smaller principal)`);
                    return;
                } else {
                    console.log(`[AUTO-OFFER] Rolling back my offer for ${fromPrincipal} (they have smaller principal)`);
                    try {
                        await peerData.pc.setLocalDescription(undefined);
                        peerData.hasLocalDescription = false;
                    } catch (rollbackError) {
                        console.error(`[AUTO-OFFER] Rollback failed:`, rollbackError);
                        cleanupPeerConnection(fromPrincipal);
                        await createPeerConnectionForUser(fromPrincipal);
                        const newPeerData = peerConnections.current.get(fromPrincipal);
                        if (newPeerData) {
                            peerData.pc = newPeerData.pc;
                        }
                    }
                }
            }

            // Set remote description (initial offer)
            const remoteDesc = new RTCSessionDescription(JSON.parse(offerSignal.data));
            await peerData.pc.setRemoteDescription(remoteDesc);
            peerData.hasRemoteDescription = true;
            peerData.isAnswerer = true;

            // Create and set answer
            const answer = await peerData.pc.createAnswer();
            await peerData.pc.setLocalDescription(answer);
            peerData.hasLocalDescription = true;

            // Send answer
            const answerSignal: Signal = {
                from: Principal.fromText(principalId),
                to: offerSignal.from,
                kind: 'answer',
                data: JSON.stringify(answer)
            };

            await sendSignal(roomId, answerSignal);
            console.log(`[AUTO-OFFER] Sent answer to ${fromPrincipal}`);

            // Process pending ICE candidates
            setTimeout(() => {
                processPendingICECandidates(fromPrincipal);
            }, 300);

        } catch (error) {
            console.error(`[AUTO-OFFER] Error processing offer from ${fromPrincipal}:`, error);

            setTimeout(() => {
                cleanupPeerConnection(fromPrincipal);
                handleNewParticipantConnection(fromPrincipal);
            }, 2000);
        }
    };

    const autoProcessAnswer = async (answerSignal: Signal) => {
        const fromPrincipal = answerSignal.from.toText();

        try {
            console.log(`[AUTO-ANSWER] Processing answer from ${fromPrincipal}`);

            const peerData = peerConnections.current.get(fromPrincipal);
            if (!peerData) {
                console.log(`[AUTO-ANSWER] No peer connection found for ${fromPrincipal}`);
                return;
            }

            if (peerData.pc.signalingState !== 'have-local-offer') {
                console.log(`[AUTO-ANSWER] Peer not ready for answer, state: ${peerData.pc.signalingState}`);
                return;
            }

            const remoteDesc = new RTCSessionDescription(JSON.parse(answerSignal.data));
            await peerData.pc.setRemoteDescription(remoteDesc);
            peerData.hasRemoteDescription = true;

            console.log(`[AUTO-ANSWER] Processed answer from ${fromPrincipal}`);

            // Process pending ICE candidates
            setTimeout(() => {
                processPendingICECandidates(fromPrincipal);
            }, 300);

        } catch (error) {
            console.error(`[AUTO-ANSWER] Error processing answer from ${fromPrincipal}:`, error);
        }
    };

    const autoProcessICE = async (iceSignal: Signal) => {
        const fromPrincipal = iceSignal.from.toText();

        try {
            const peerData = peerConnections.current.get(fromPrincipal);

            // Store ICE candidate if no peer connection
            if (!peerData) {
                const pending = pendingICECandidates.current.get(fromPrincipal) || [];
                pending.push(new RTCIceCandidate(JSON.parse(iceSignal.data)));
                pendingICECandidates.current.set(fromPrincipal, pending);
                console.log(`[AUTO-ICE] Stored ICE candidate from ${fromPrincipal} (no peer connection)`);
                return;
            }

            // Validate ICE candidate data
            const candidateData = JSON.parse(iceSignal.data);
            if (!candidateData || (!candidateData.candidate && candidateData.candidate !== '')) {
                console.log(`[AUTO-ICE] Skipping end-of-candidates from ${fromPrincipal}`);
                return;
            }

            // Check if peer is ready for ICE candidates
            const canAddICE = (
                peerData.pc.remoteDescription !== null &&
                peerData.pc.connectionState !== 'closed' &&
                peerData.pc.connectionState !== 'failed'
            );

            if (!canAddICE) {
                // Store for later
                const pending = pendingICECandidates.current.get(fromPrincipal) || [];
                pending.push(new RTCIceCandidate(candidateData));
                pendingICECandidates.current.set(fromPrincipal, pending);
                console.log(`[AUTO-ICE] Stored ICE candidate from ${fromPrincipal} (peer not ready)`);
                return;
            }

            // Add ICE candidate
            const candidate = new RTCIceCandidate(candidateData);
            await peerData.pc.addIceCandidate(candidate);
            console.log(`[AUTO-ICE] Added ICE candidate from ${fromPrincipal}`);

        } catch (error) {
            console.error(`[AUTO-ICE] Error processing ICE from ${fromPrincipal}:`, error);

            // Store failed candidate for retry
            try {
                const candidateData = JSON.parse(iceSignal.data);
                const pending = pendingICECandidates.current.get(fromPrincipal) || [];
                pending.push(new RTCIceCandidate(candidateData));
                pendingICECandidates.current.set(fromPrincipal, pending);
                console.log(`[AUTO-ICE] Stored failed ICE candidate for retry: ${fromPrincipal}`);
            } catch (storeError) {
                console.error(`[AUTO-ICE] Failed to store ICE candidate:`, storeError);
            }
        }
    };

    // ========== ICE CANDIDATE HELPERS ==========
    const processPendingICECandidates = async (targetPrincipal: string) => {
        const pending = pendingICECandidates.current.get(targetPrincipal) || [];
        if (pending.length === 0) return;

        const peerData = peerConnections.current.get(targetPrincipal);
        if (!peerData || !peerData.pc.remoteDescription) {
            console.log(`[ICE] Cannot process pending ICE for ${targetPrincipal} - no remote description`);
            return;
        }

        console.log(`[ICE] Processing ${pending.length} pending ICE candidates for ${targetPrincipal}...`);

        const failedCandidates: RTCIceCandidate[] = [];

        for (const candidate of pending) {
            try {
                await peerData.pc.addIceCandidate(candidate);
                console.log(`[ICE] Added pending ICE candidate for ${targetPrincipal}`);
                await new Promise(resolve => setTimeout(resolve, 50));
            } catch (error) {
                console.error(`[ICE] Failed to add pending ICE candidate for ${targetPrincipal}:`, error);
                failedCandidates.push(candidate);
            }
        }

        // Update pending candidates
        if (failedCandidates.length > 0) {
            pendingICECandidates.current.set(targetPrincipal, failedCandidates);
            console.log(`[ICE] ${failedCandidates.length} ICE candidates will be retried for ${targetPrincipal}`);

            setTimeout(() => {
                processPendingICECandidates(targetPrincipal);
            }, 2000);
        } else {
            pendingICECandidates.current.delete(targetPrincipal);
            console.log(`[ICE] All pending ICE candidates processed for ${targetPrincipal}`);
        }
    };

    const sendICECandidate = async (candidate: RTCIceCandidate, targetPrincipal: string) => {
        if (!roomId || !candidate) return;

        try {
            const signal: Signal = {
                from: Principal.fromText(principalId),
                to: Principal.fromText(targetPrincipal),
                kind: 'ice',
                data: JSON.stringify({
                    candidate: candidate.candidate,
                    sdpMid: candidate.sdpMid,
                    sdpMLineIndex: candidate.sdpMLineIndex,
                    usernameFragment: candidate.usernameFragment
                })
            };
            await sendSignal(roomId, signal);
            console.log(`[ICE] Sent ICE candidate to ${targetPrincipal}`);
        } catch (err) {
            console.error(`[ICE] Failed to send ICE candidate to ${targetPrincipal}:`, err);
        }
    };

    // ========== OFFER/ANSWER ==========
    const sendOfferToUser = async (targetPrincipal: string) => {
        const peerData = peerConnections.current.get(targetPrincipal);
        if (!peerData || !roomId) return;

        try {
            console.log(`[OFFER] Sending offer to ${targetPrincipal}...`);

            if (peerData.pc.signalingState !== 'stable') {
                console.log(`[OFFER] Peer not ready for offer, state: ${peerData.pc.signalingState}`);
                return;
            }

            const offer = await peerData.pc.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });

            await peerData.pc.setLocalDescription(offer);
            peerData.hasLocalDescription = true;
            peerData.isOfferer = true;

            const signal: Signal = {
                from: Principal.fromText(principalId),
                to: Principal.fromText(targetPrincipal),
                kind: 'offer',
                data: JSON.stringify(offer)
            };

            await sendSignal(roomId, signal);
            console.log(`[OFFER] Sent offer to ${targetPrincipal}`);
        } catch (err) {
            console.error(`[OFFER] Error sending offer to ${targetPrincipal}:`, err);
        }
    };

    // ========== ROOM MANAGEMENT ==========
    const loadInitialRoomData = async () => {
        if (!roomId) return;

        setLoading(true);
        try {
            console.log('Loading initial room data for ID:', roomId);
            const room = await getRoom(roomId);
            if (!room) {
                alert(`Room "${roomId}" not found`);
                navigate('/dashboard');
            }
        } catch (error) {
            console.error('Error loading initial room:', error);
            alert(`Failed to load room data: ${error instanceof Error ? error.message : 'Unknown error'}`);
            navigate('/dashboard');
        } finally {
            setLoading(false);
        }
    };

    // ========== UTILITY FUNCTIONS ==========
    const copyRoomLink = () => {
        const roomLink = `${window.location.origin}/room/${roomId}`;
        navigator.clipboard.writeText(roomLink);
        // Visual feedback
        const button = document.activeElement as HTMLButtonElement;
        if (button) {
            const originalText = button.textContent;
            button.textContent = 'Copied!';
            setTimeout(() => {
                if (button.textContent === 'Copied!') {
                    button.textContent = originalText;
                }
            }, 2000);
        }
    };

    const handleLeaveRoom = async () => {
        if (!roomId) return;

        setLoading(true);
        try {
            cleanupAllPeerConnections();
            cleanupLocalMedia();
            stopPolling();

            const result = await leaveRoom(roomId);
            if ('Err' in result) {
                alert(`Failed to leave room: ${result.Err}`);
            } else {
                navigate('/dashboard');
            }
        } catch (error) {
            console.error('Leave room error:', error);
            alert('Failed to leave room');
        } finally {
            setLoading(false);
        }
    };

    // ========== EFFECTS ==========
    useEffect(() => {
        if (roomId && isUserReady && !roomData) {
            loadInitialRoomData();
        }
    }, [roomId, isUserReady, roomData]);

    useEffect(() => {
        if (roomData && isUserReady) {
            initializeAutomaticWebRTC();
        }
    }, [roomData, isUserReady]);

    useEffect(() => {
        if (roomData && isUserReady) {
            handleParticipantChanges();
        }
    }, [participants, principalId, roomData]);

    useEffect(() => {
        const preventReload = (event: BeforeUnloadEvent) => {
            // Prevent reload/close
            event.preventDefault();
            event.returnValue = ''; // Chrome requires returnValue to be set

            // Custom message (modern browsers may not show this)
            return 'Are you sure you want to leave this video call? You will be disconnected from the room.';
        };

        const preventKeyboardReload = (event: KeyboardEvent) => {
            // Prevent F5
            if (event.key === 'F5') {
                event.preventDefault();
                return false;
            }

            // Prevent Ctrl+R / Cmd+R
            if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
                event.preventDefault();
                return false;
            }

            // Prevent Ctrl+F5 (hard reload)
            if (event.ctrlKey && event.key === 'F5') {
                event.preventDefault();
                return false;
            }

            // Prevent Ctrl+Shift+R (hard reload)
            if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'R') {
                event.preventDefault();
                return false;
            }
        };

        const preventContextMenu = (event: MouseEvent) => {
            // Prevent right-click menu (which has reload option)
            event.preventDefault();
            return false;
        };

        // Add event listeners
        window.addEventListener('beforeunload', preventReload);
        document.addEventListener('keydown', preventKeyboardReload);
        document.addEventListener('contextmenu', preventContextMenu);

        return () => {
            window.removeEventListener('beforeunload', preventReload);
            document.removeEventListener('keydown', preventKeyboardReload);
            document.removeEventListener('contextmenu', preventContextMenu);
        };
    }, []);

    useEffect(() => {
        return () => {
            console.log('[UNMOUNT] Component unmounting - cleaning up...');
            cleanupAllPeerConnections();
            cleanupLocalMedia();
        };
    }, []);

    useEffect(() => {
        if (isUserReady) {
            enumerateDevices();
        }
    }, [isUserReady]);

    useEffect(() => {
        if (showAITranslate && isUserReady) {
            initializeSpeechRecognition();
        }

        return () => {
            shouldRestartSpeechRef.current = false;
            if (speechRecognitionRef.current) {
                speechRecognitionRef.current.stop();
            }
        };
    }, [showAITranslate, isUserReady]);


    // ========== RENDER CONDITIONS ==========
    if (authLoading || loading || roomLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center"
                >
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-lime-400 mx-auto mb-6"></div>
                    <div className="text-white text-xl">
                        {loading ? 'Connecting to room...' : 'Loading...'}
                    </div>
                    <div className="text-gray-400 text-sm mt-2">
                        Setting up your video connection
                    </div>
                </motion.div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <LoginRequired
                onLogin={login}
                isLoading={authLoading}
                title="Join Video Room"
                subtitle="Authentication Required"
                description="Please authenticate with Internet Identity to join this video room"
                showFeatures={false}
            />
        );
    }


    if (!user?.username) {
        return (
            <ProfileSetupRequired
                onComplete={() => navigate('/profile')}
                isLoading={authLoading}
            />
        );
    }

    if (!roomData && !loading && !realtimeLoading) {
        return (
            <div className="min-h-screen bg-black text-white overflow-hidden relative">
                <TargetCursor targetSelector=".cursor-target" spinDuration={2} hideDefaultCursor={true} />

                <InteractiveGridPattern
                    className={cn(
                        "[mask-image:radial-gradient(800px_circle_at_center,white,transparent)]",
                        "absolute inset-0 h-full w-full z-0",
                        "fill-red-500/10 stroke-red-500/10"
                    )}
                    width={20}
                    height={20}
                    squares={[80, 80]}
                    squaresClassName="hover:fill-red-500/20"
                />

                <div className="absolute inset-0 z-[1] pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/50" />
                    <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 via-transparent to-purple-500/5" />
                </div>

                <div className="relative z-10 flex items-center justify-center min-h-screen px-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center max-w-md"
                    >
                        <div className="w-20 h-20 bg-red-400/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-400/30">
                            <AlertTriangle className="h-10 w-10 text-red-400" />
                        </div>
                        <h1 className="text-3xl font-bold text-white mb-4">Room Not Found</h1>
                        <p className="text-gray-300 mb-6">
                            The room "{roomId}" doesn't exist or has been deleted.
                        </p>
                        <div className="space-y-3">
                            <Button
                                onClick={() => navigate('/dashboard')}
                                className="w-full bg-lime-400 text-black hover:bg-lime-500 cursor-target"
                            >
                                Back to Dashboard
                            </Button>
                            <Button
                                onClick={() => navigate('/')}
                                variant="outline"
                                className="w-full border-gray-600 text-gray-300 hover:bg-gray-700 cursor-target"
                            >
                                Go Home
                            </Button>
                        </div>
                    </motion.div>
                </div>
            </div>
        );
    }

    // ========== MAIN RENDER ==========
    return (
        <div className="min-h-screen bg-black text-white overflow-hidden relative">
            {/* Target Cursor */}
            <TargetCursor targetSelector=".cursor-target" spinDuration={2} hideDefaultCursor={true} />

            {/* Interactive Grid Background */}
            <InteractiveGridPattern
                className={cn(
                    "[mask-image:radial-gradient(1000px_circle_at_center,white,transparent)]",
                    "absolute inset-0 h-full w-full z-0",
                    "fill-lime-500/5 stroke-lime-500/5"
                )}
                width={20}
                height={20}
                squares={[100, 100]}
                squaresClassName="hover:fill-lime-500/10"
            />

            {/* Overlay */}
            <div className="absolute inset-0 z-[1] pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/80" />
                <div className="absolute inset-0 bg-gradient-to-r from-lime-500/3 via-transparent to-purple-500/3" />
            </div>

            {/* Header */}
            <motion.header
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={smoothTransition}
                className="fixed top-0 w-full z-50 bg-black/80 backdrop-blur-md border-b border-lime-500/20"
            >
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <motion.div
                        className="flex items-center space-x-4 cursor-target"
                        whileHover={{ scale: 1.05 }}
                        transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    >
                        <h1 className="font-logo text-2xl text-lime-400 m-0">
                            PIXELIY
                        </h1>
                        <div className="hidden md:block h-6 w-px bg-lime-400/0"></div>
                        <div className="hidden md:block">
                            <p className="text-sm text-gray-400">Room</p>
                            <p className="text-sm font-semibold text-white">{roomId}</p>
                        </div>
                    </motion.div>

                    <nav className="hidden lg:flex items-center space-x-6">
                        <div className="flex items-center space-x-2">
                            <Users className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-400">{participants.length} participants</span>
                        </div>
                    </nav>

                    <motion.div
                        className="flex items-center space-x-3"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        <Button
                            variant="outline"
                            size="sm"
                            className="border-lime-400/20 text-lime-400 hover:bg-lime-400/10 cursor-target"
                            onClick={copyRoomLink}
                        >
                            <Copy className="w-4 h-4 mr-2" />
                            <span className="hidden md:inline">Copy Link</span>
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            className="cursor-target"
                            onClick={handleLeaveRoom}
                        >
                            <PhoneOff className="w-4 h-4 mr-2" />
                            <span className="hidden md:inline">Leave</span>
                        </Button>
                    </motion.div>
                </div>
            </motion.header>

            {/* Error Display */}
            {(authError || roomError || realtimeError) && (
                <motion.div
                    className="fixed top-20 left-4 right-4 z-40"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <div className="max-w-md mx-auto bg-red-500/20 border border-red-500/50 rounded-xl p-4 backdrop-blur-md">
                        <p className="text-red-300 flex items-center text-sm">
                            <AlertTriangle className="w-4 h-4 mr-2" />
                            {authError || roomError || realtimeError}
                        </p>
                    </div>
                </motion.div>
            )}

            {/* Main Video Area */}
            <main className="pt-16 h-screen flex flex-col relative z-10">
                {roomData && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6 }}
                        className="flex-1 flex flex-col"
                    >
                        {/* Video Grid Container */}
                        <div className="flex-1 p-4">
                            <div className="h-full max-w-7xl mx-auto">
                                {/* Dynamic Video Grid */}
                                {(() => {
                                    const totalVideos = connectedPeers.length + 1; // Include local video
                                    const { cols, rows } = getVideoGridLayout(totalVideos);

                                    const containerHeight = window.innerHeight - 200; // Account for header/controls
                                    const containerWidth = Math.min(window.innerWidth - 32, 1280); // Max width with padding

                                    const videoWidth = containerWidth / cols;

                                    const aspectRatio = 16 / 9;
                                    let finalVideoWidth = videoWidth;
                                    let finalVideoHeight = videoWidth / aspectRatio;

                                    // If height exceeds available space, scale down
                                    if (finalVideoHeight * rows > containerHeight) {
                                        finalVideoHeight = containerHeight / rows;
                                        finalVideoWidth = finalVideoHeight * aspectRatio;
                                    }

                                    return (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: 0.3, duration: 0.6 }}
                                            className="gap-4"
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: `repeat(${cols}, ${finalVideoWidth}px)`,
                                                gridTemplateRows: `repeat(${rows}, ${finalVideoHeight}px)`,
                                                justifyContent: 'center',
                                                alignContent: 'center',
                                                width: '100%',
                                                height: `${containerHeight}px`
                                            }}
                                        >
                                            {/* Local Video */}
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: 0.2 }}
                                                className="relative group w-full"
                                                style={{ aspectRatio: '16/9' }}
                                            >
                                                <div className="relative w-full h-full bg-gray-800/50 rounded-xl overflow-hidden border border-gray-600/50 hover:border-green-400/50 transition-all">
                                                    {/* Apply consistent gradient background like remote videos */}
                                                    <div
                                                        className="absolute inset-0 z-0"
                                                        style={{
                                                            background: 'linear-gradient(145deg, rgba(55, 65, 81, 0.5), rgba(75, 85, 99, 0.5))',
                                                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                                                        }}
                                                    />

                                                    <video
                                                        ref={localVideoRef}
                                                        autoPlay
                                                        muted
                                                        playsInline
                                                        className="relative z-10 w-full h-full object-cover"
                                                    />

                                                    {/* Camera Off Overlay */}
                                                    {!isCameraEnabled && (
                                                        <motion.div
                                                            initial={{ opacity: 0 }}
                                                            animate={{ opacity: 1 }}
                                                            className="absolute inset-0 z-20 flex items-center justify-center bg-gray-800/90 backdrop-blur-sm"
                                                        >
                                                            <div className="text-center text-gray-300">
                                                                <VideoOff className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                                                                <div className="text-sm font-medium">Camera off</div>
                                                            </div>
                                                        </motion.div>
                                                    )}

                                                    {/* Top Left - Participant Badge (consistent with remote videos) */}
                                                    <div className="absolute top-3 left-3 z-30">
                                                        <div className="bg-green-500/20 text-green-300 border border-green-500/30 text-xs px-2 py-1 rounded backdrop-blur-sm">
                                                            <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse" style={{ display: 'inline-block' }}></div>
                                                            You
                                                        </div>
                                                    </div>

                                                    {/* Top Right - Connection Status & Media Status */}
                                                    <div className="absolute top-3 right-3 z-30 flex items-center space-x-2">
                                                        {/* Connection Status Indicator */}
                                                        <div className="w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>

                                                        {/* Media Status Icons */}
                                                        {!isCameraEnabled && (
                                                            <div className="w-6 h-6 bg-red-500/20 rounded-full flex items-center justify-center border border-red-500/30">
                                                                <VideoOff className="w-3 h-3 text-red-400" />
                                                            </div>
                                                        )}
                                                        {!isMicrophoneEnabled && (
                                                            <div className="w-6 h-6 bg-red-500/20 rounded-full flex items-center justify-center border border-red-500/30">
                                                                <MicOff className="w-3 h-3 text-red-400" />
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Bottom Left - User Label (consistent with remote videos) */}
                                                    <div className="absolute bottom-3 left-3 z-30">
                                                        <div className="bg-black/70 text-white text-xs px-2 py-1 rounded backdrop-blur-sm border border-white/20">
                                                            {String(user?.name || '').trim() || String(user?.username || '').trim()}
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>

                                            {/* Remote Videos Container */}
                                            <div
                                                ref={remoteVideosContainerRef}
                                                className="contents"
                                            >
                                                {/* Remote videos will be dynamically added here by WebRTC logic */}
                                                {/* Each remote video will have style={{ aspectRatio: '16/9' }} applied */}
                                            </div>

                                            {/* Empty Slots for Visual Balance */}
                                            {Array.from({
                                                length: Math.max(0, (cols * rows) - totalVideos)
                                            }).map((_, index) => (
                                                <motion.div
                                                    key={`empty-${index}`}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    transition={{ delay: 0.3 + index * 0.1 }}
                                                    className="relative group w-full"
                                                    style={{ aspectRatio: '16/9' }}
                                                >
                                                    <div className="w-full h-full bg-gray-800/20 border-2 border-dashed border-gray-600/30 rounded-xl flex items-center justify-center">
                                                        <div className="text-center">
                                                            <div className="w-8 h-8 bg-gray-600/30 rounded-full flex items-center justify-center mx-auto mb-2">
                                                                <Users className="w-4 h-4 text-gray-500" />
                                                            </div>
                                                            <p className="text-xs text-gray-500">Waiting...</p>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </motion.div>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Bottom Controls */}
                        <motion.div
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="p-4 bg-gradient-to-t from-black/80 to-transparent"
                        >
                            <div className="max-w-4xl mx-auto">
                                <div className="flex items-center justify-center space-x-4">
                                    {/* Camera Toggle */}
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={toggleCamera}
                                        className={cn(
                                            "w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-target z-100",
                                            isCameraEnabled
                                                ? "bg-gray-700/50 hover:bg-gray-600/50 text-white"
                                                : "bg-red-500/20 hover:bg-red-500/30 text-red-400"
                                        )}
                                    >
                                        {isCameraEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                                    </motion.button>

                                    {/* Microphone Toggle */}
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={toggleMicrophone}
                                        className={cn(
                                            "w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-target z-100",
                                            isMicrophoneEnabled
                                                ? "bg-gray-700/50 hover:bg-gray-600/50 text-white"
                                                : "bg-red-500/20 hover:bg-red-500/30 text-red-400"
                                        )}
                                    >
                                        {isMicrophoneEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                                    </motion.button>

                                    {/* Settings */}
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => setShowSettings(true)}
                                        className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-700/50 hover:bg-gray-600/50 text-white transition-all cursor-target z-100"
                                    >
                                        <Settings className="w-5 h-5" />
                                    </motion.button>

                                    {/* Participants */}
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => setShowParticipants(!showParticipants)}
                                        className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-700/50 hover:bg-gray-600/50 text-white transition-all cursor-target relative z-100"
                                    >
                                        <Users className="w-5 h-5" />
                                        <Badge className="absolute -top-2 -right-2 bg-lime-500 text-white text-xs min-w-[20px] h-5">
                                            {participants.length}
                                        </Badge>
                                    </motion.button>

                                    {/* AI Translate Sidebar */}
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => setShowAITranslate(!showAITranslate)}
                                        className={cn(
                                            "w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-target z-100 relative",
                                            showAITranslate
                                                ? "bg-purple-600/30 text-purple-300 border-2 border-purple-500/50"
                                                : "bg-gray-700/50 hover:bg-gray-600/50 text-white"
                                        )}
                                    >
                                        <Languages className="w-5 h-5" />
                                        {speechLogs.length > 0 && (
                                            <Badge className="absolute -top-2 -right-2 bg-purple-500 text-white text-xs min-w-[20px] h-5">
                                                {speechLogs.length}
                                            </Badge>
                                        )}
                                    </motion.button>

                                    {/* Leave Room */}
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={handleLeaveRoom}
                                        className="w-12 h-12 rounded-full flex items-center justify-center bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-all cursor-target z-100"
                                    >
                                        <PhoneOff className="w-5 h-5" />
                                    </motion.button>
                                </div>

                                {/* Room Info */}
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.6 }}
                                    className="mt-4 text-center"
                                >
                                    <div className="flex items-center justify-center space-x-6 text-sm text-gray-400">
                                        <div className="flex items-center space-x-2">
                                            <Shield className="w-4 h-4" />
                                            <span>End-to-End Encrypted</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Globe className="w-4 h-4" />
                                            <span>P2P Network</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Activity className="w-4 h-4" />
                                            <span>Real-time</span>
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </main>

            {/* Participants Sidebar */}
            <AnimatePresence>
                {showParticipants && (
                    <motion.div
                        initial={{ opacity: 0, x: 300 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 300 }}
                        className="fixed top-16 right-0 bottom-0 w-80 bg-gray-900/90 backdrop-blur-md border-l border-gray-700/50 z-50"
                    >
                        <div className="p-6 h-full flex flex-col">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-semibold text-white">Participants</h3>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowParticipants(false)}
                                    className="text-gray-400 hover:text-white cursor-target"
                                >
                                    <EyeOff className="w-4 h-4" />
                                </Button>
                            </div>

                            <div className="space-y-3 flex-1 overflow-y-auto">
                                {/* Current User */}
                                <div className="flex items-center space-x-3 p-3 bg-green-500/10 rounded-lg border border-green-500/20 cursor-target">
                                    <div className="w-10 h-10 bg-green-400/20 rounded-full flex items-center justify-center">
                                        <User className="w-5 h-5 text-green-400" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-white">
                                            {String(user?.name || '').trim() || String(user?.username || '').trim()} (You)
                                        </p>
                                        <p className="text-xs text-green-300">{isHost ? 'Host' : 'Participant'}</p>
                                    </div>
                                    <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
                                        Online
                                    </Badge>
                                </div>

                                {/* Other Participants */}
                                {participants
                                    .filter(participant => participant !== principalId)
                                    .map((participant, index) => (
                                        <motion.div
                                            key={participant}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.1 }}
                                            className="flex items-center space-x-3 p-3 bg-gray-800/50 rounded-lg border border-gray-600/50 cursor-target"
                                        >
                                            <div className="w-10 h-10 bg-blue-400/20 rounded-full flex items-center justify-center">
                                                <User className="w-5 h-5 text-blue-400" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-medium text-white">
                                                    {`User #${index + 1}`}
                                                </p>
                                                <p className="text-xs text-gray-400">
                                                    {participant.length > 20
                                                        ? `${participant.substring(0, 20)}...`
                                                        : participant
                                                    }
                                                </p>
                                            </div>
                                            <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                                                Connected
                                            </Badge>
                                        </motion.div>
                                    ))
                                }

                                {/* Empty State when no other participants */}
                                {participants.filter(participant => participant !== principalId).length === 0 && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="text-center py-8"
                                    >
                                        <div className="w-16 h-16 bg-gray-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Users className="w-8 h-8 text-gray-500" />
                                        </div>
                                        <p className="text-gray-400 text-sm mb-2">No other participants yet</p>
                                        <p className="text-gray-500 text-xs">Share the room id to invite others</p>
                                    </motion.div>
                                )}
                            </div>

                            <div className="pt-4 border-t border-gray-700/50">
                                <div className="space-y-3">
                                    {/* Room Info */}
                                    <div className="bg-gray-800/30 rounded-lg p-3">
                                        <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                                            <span>Room ID</span>
                                            <span className="font-mono">{roomId}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-gray-400">
                                            <span>Total Participants</span>
                                            <span>{participants.length}</span>
                                        </div>
                                    </div>

                                    {/* Invite Button */}
                                    <Button
                                        onClick={copyRoomLink}
                                        className="w-full bg-lime-600 hover:bg-lime-700 cursor-target"
                                    >
                                        <Copy className="w-4 h-4 mr-2" />
                                        Invite Others
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* AI Translation Sidebar */}
            <AnimatePresence>
                {showAITranslate && (
                    <motion.div
                        initial={{ opacity: 0, x: -300 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -300 }}
                        className="fixed top-16 left-0 bottom-0 w-96 bg-gray-900/90 backdrop-blur-md border-r border-gray-700/50 z-50"
                    >
                        <div className="p-6 h-full flex flex-col">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center space-x-3">
                                    <Languages className="w-5 h-5 text-purple-400" />
                                    <h3 className="text-lg font-semibold text-white">AI Translation</h3>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowAITranslate(false)}
                                    className="text-gray-400 hover:text-white cursor-target"
                                >
                                    ✕
                                </Button>
                            </div>

                            {/* Controls */}
                            <div className="space-y-4 mb-6">
                                {/* Source Language Selection */}
                                <div>
                                    <label className="block text-sm font-medium mb-2 text-white">
                                        From (Source Language)
                                    </label>
                                    <select
                                        value={sourceLanguage}
                                        onChange={(e) => {
                                            setSourceLanguage(e.target.value);
                                            // Restart speech recognition with new language if active
                                            if (recognitionActive) {
                                                stopAITranscription();
                                                setTimeout(() => {
                                                    startAITranscription();
                                                }, 500);
                                            }
                                        }}
                                        className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white cursor-target scrollbar-hidden"
                                    >
                                        {supportedLanguages.map(lang => (
                                            <option key={lang} value={lang}>
                                                {getLanguageName(lang)}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Target Language Selection */}
                                <div>
                                    <label className="block text-sm font-medium mb-2 text-white">
                                        To (Target Language)
                                    </label>
                                    <select
                                        value={targetLanguage}
                                        onChange={(e) => setTargetLanguage(e.target.value)}
                                        className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white cursor-target scrollbar-hidden"
                                    >
                                        {supportedLanguages.map(lang => (
                                            <option key={lang} value={lang}>
                                                {getLanguageName(lang)}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Transcription Controls */}
                                <div className="flex items-center space-x-3">
                                    <Button
                                        onClick={startAITranscription}
                                        disabled={isTranscribing}
                                        size="sm"
                                        className={cn(
                                            "flex-1",
                                            isTranscribing
                                                ? "bg-green-600/50 cursor-not-allowed"
                                                : "bg-green-600 hover:bg-green-700"
                                        )}
                                    >
                                        <Play className="w-4 h-4 mr-2" />
                                        {isTranscribing ? 'Listening...' : 'Start Listening'}
                                    </Button>

                                    <Button
                                        onClick={stopAITranscription}
                                        disabled={!isTranscribing}
                                        size="sm"
                                        variant="destructive"
                                        className="disabled:opacity-50"
                                    >
                                        <Pause className="w-4 h-4" />
                                    </Button>

                                    <Button
                                        onClick={clearSpeechLogs}
                                        size="sm"
                                        variant="outline"
                                        className="border-gray-600 hover:bg-gray-700"
                                    >
                                        <Trash className='w-4 h-4' />
                                    </Button>
                                </div>
                            </div>

                            {/* Translate Logs */}
                            <div className="flex-1 overflow-hidden">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-medium text-white">Translate Logs</h4>
                                    {translationLoading && (
                                        <div className="flex items-center space-x-2 text-purple-400">
                                            <div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                                            <span className="text-xs">Translating...</span>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-3 overflow-y-auto h-full scrollbar-hidden">
                                    {speechLogs.length === 0 ? (
                                        <div className="text-center py-8">
                                            <MessageSquare className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                                            <p className="text-gray-400 text-sm">No speech detected yet</p>
                                            <p className="text-gray-500 text-xs mt-1">Start listening to see translations</p>
                                        </div>
                                    ) : (
                                        speechLogs.map((log) => (
                                            <motion.div
                                                key={log.id}
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className={cn(
                                                    "p-3 rounded-lg border-l-4",
                                                    log.isLocal
                                                        ? "bg-green-500/10 border-green-400"
                                                        : "bg-blue-500/10 border-blue-400"
                                                )}
                                            >
                                                {/* Header */}
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center space-x-2">
                                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${log.isLocal ? 'bg-green-400/20' : 'bg-blue-400/20'
                                                            }`}>
                                                            {log.isLocal ? (
                                                                <Mic2 className={`w-3 h-3 ${log.isLocal ? 'text-green-400' : 'text-blue-400'}`} />
                                                            ) : (
                                                                <Volume2 className={`w-3 h-3 ${log.isLocal ? 'text-green-400' : 'text-blue-400'}`} />
                                                            )}
                                                        </div>
                                                        <span className="text-xs font-medium text-white">
                                                            {log.participantName}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs text-gray-400">
                                                        {log.timestamp.toLocaleTimeString()}
                                                    </span>
                                                </div>

                                                {/* Original Text */}
                                                <div className="mb-2">
                                                    <div className="flex items-center space-x-2 mb-1">
                                                        <span className="text-xs text-gray-400">From:</span>
                                                        <Badge variant="outline" className="text-xs font-mono">
                                                            {log.participantId.length > 12
                                                                ? `${log.participantId.substring(0, 12)}...`
                                                                : log.participantId
                                                            }
                                                        </Badge>
                                                    </div>
                                                    <p className="text-sm text-white">{log.originalText}</p>
                                                </div>

                                                {/* Translation */}
                                                <div>
                                                    <div className="flex items-center space-x-2 mb-1">
                                                        <span className="text-xs text-gray-400">Translation:</span>
                                                        <Badge variant="outline" className="text-xs text-purple-400">
                                                            {getLanguageName(targetLanguage)}
                                                        </Badge>
                                                    </div>

                                                    {log.isTranslating ? (
                                                        <div className="flex items-center space-x-2 text-purple-400">
                                                            <div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                                                            <span className="text-sm">Translating...</span>
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-purple-300 bg-purple-500/10 rounded p-2">
                                                            {log.translatedText}
                                                        </p>
                                                    )}
                                                </div>
                                            </motion.div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Footer Info */}
                            <div className="pt-4 border-t border-gray-700/50">
                                <div className="text-xs text-gray-400 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span>AI Translation</span>
                                        <span className="text-purple-400">LLaMA 3.1</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span>Total Logs</span>
                                        <span>{speechLogs.length}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Settings Modal */}
            <AnimatePresence>
                {showSettings && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-md"
                        onClick={() => setShowSettings(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8, y: 50 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.8, y: 50 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-xl rounded-3xl w-full max-w-lg mx-4 border border-gray-600/30 shadow-2xl overflow-hidden"
                        >
                            {/* Header with Gradient */}
                            <div className="relative bg-gradient-to-r from-lime-500/10 to-purple-500/10 p-6 border-b border-gray-700/50">
                                <div className="absolute inset-0 bg-gradient-to-r from-lime-400/5 to-purple-400/5" />
                                <div className="relative flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 bg-gradient-to-br from-lime-400/20 to-purple-400/20 rounded-xl flex items-center justify-center border border-lime-400/20">
                                            <Settings className="w-5 h-5 text-lime-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-white">Settings</h3>
                                            <p className="text-sm text-gray-400">Configure your media devices</p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowSettings(false)}
                                        className="text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-xl cursor-target transition-all"
                                    >
                                        ✕
                                    </Button>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-6 space-y-6">
                                {/* Camera Section */}
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 }}
                                    className="space-y-3"
                                >
                                    <div className="flex items-center space-x-3 mb-3">
                                        <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                                            <Video className="w-4 h-4 text-blue-400" />
                                        </div>
                                        <div>
                                            <label className="text-sm font-semibold text-white">Camera Device</label>
                                            <p className="text-xs text-gray-400">Select your preferred camera</p>
                                        </div>
                                    </div>

                                    <div className="relative">
                                        <select
                                            value={selectedCameraId}
                                            onChange={(e) => handleCameraChange(e.target.value)}
                                            className="w-full bg-gray-800/50 border border-gray-600/50 rounded-xl px-4 py-3 text-white cursor-target focus:outline-none focus:ring-2 focus:ring-lime-400/50 focus:border-lime-400/50 transition-all appearance-none pr-10"
                                        >
                                            <option value="">Default Camera</option>
                                            {availableDevices.cameras.map((device, index) => (
                                                <option key={device.deviceId} value={device.deviceId}>
                                                    {device.label || `Camera ${index + 1}`}
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    </div>

                                    {/* Camera Status */}
                                    <div className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg border border-gray-700/30">
                                        <div className="flex items-center space-x-2">
                                            <div className={`w-2 h-2 rounded-full ${isCameraEnabled ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
                                            <span className="text-sm text-gray-300">
                                                Camera: {isCameraEnabled ? 'Enabled' : 'Disabled'}
                                            </span>
                                        </div>
                                        <Badge variant="outline" className="text-xs text-blue-400 border-blue-500/30">
                                            {availableDevices.cameras.length} available
                                        </Badge>
                                    </div>
                                </motion.div>

                                {/* Microphone Section */}
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="space-y-3"
                                >
                                    <div className="flex items-center space-x-3 mb-3">
                                        <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                                            <Mic className="w-4 h-4 text-green-400" />
                                        </div>
                                        <div>
                                            <label className="text-sm font-semibold text-white">Microphone Device</label>
                                            <p className="text-xs text-gray-400">Select your preferred microphone</p>
                                        </div>
                                    </div>

                                    <div className="relative">
                                        <select
                                            value={selectedMicrophoneId}
                                            onChange={(e) => handleMicrophoneChange(e.target.value)}
                                            className="w-full bg-gray-800/50 border border-gray-600/50 rounded-xl px-4 py-3 text-white cursor-target focus:outline-none focus:ring-2 focus:ring-lime-400/50 focus:border-lime-400/50 transition-all appearance-none pr-10"
                                        >
                                            <option value="">Default Microphone</option>
                                            {availableDevices.microphones.map((device, index) => (
                                                <option key={device.deviceId} value={device.deviceId}>
                                                    {device.label || `Microphone ${index + 1}`}
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    </div>

                                    {/* Microphone Status */}
                                    <div className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg border border-gray-700/30">
                                        <div className="flex items-center space-x-2">
                                            <div className={`w-2 h-2 rounded-full ${isMicrophoneEnabled ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
                                            <span className="text-sm text-gray-300">
                                                Microphone: {isMicrophoneEnabled ? 'Enabled' : 'Disabled'}
                                            </span>
                                        </div>
                                        <Badge variant="outline" className="text-xs text-green-400 border-green-500/30">
                                            {availableDevices.microphones.length} available
                                        </Badge>
                                    </div>
                                </motion.div>
                            </div>

                            {/* Footer Actions */}
                            <div className="p-6 bg-gray-800/30 border-t border-gray-700/50">
                                <div className="space-y-4">
                                    {/* Refresh Devices Button */}
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={enumerateDevices}
                                        disabled={isDevicesLoading}
                                        className="w-full bg-gradient-to-r from-lime-500/90 to-green-500/90 hover:from-lime-600 hover:to-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 px-4 rounded-xl font-semibold transition-all cursor-target flex items-center justify-center space-x-2 shadow-lg"
                                    >
                                        {isDevicesLoading ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                                                <span>Refreshing Devices...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Camera className="w-4 h-4" />
                                                <span>Refresh All Devices</span>
                                            </>
                                        )}
                                    </motion.button>

                                    {/* Quick Actions */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <Button
                                            onClick={() => {
                                                toggleCamera();
                                                setShowSettings(false);
                                            }}
                                            variant="outline"
                                            className="border-gray-600 hover:bg-gray-700/50 text-white cursor-target"
                                        >
                                            <Video className="w-4 h-4 mr-2" />
                                            {isCameraEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
                                        </Button>
                                        <Button
                                            onClick={() => {
                                                toggleMicrophone();
                                                setShowSettings(false);
                                            }}
                                            variant="outline"
                                            className="border-gray-600 hover:bg-gray-700/50 text-white cursor-target"
                                        >
                                            <Mic className="w-4 h-4 mr-2" />
                                            {isMicrophoneEnabled ? 'Mute Mic' : 'Unmute Mic'}
                                        </Button>
                                    </div>

                                    {/* Device Statistics */}
                                    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/30">
                                        <h4 className="text-sm font-medium text-white mb-3 flex items-center">
                                            <Activity className="w-4 h-4 mr-2 text-lime-400" />
                                            Device Status
                                        </h4>
                                        <div className="grid grid-cols-2 gap-4 text-xs">
                                            <div>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-gray-400">Cameras Found</span>
                                                    <span className="text-blue-400 font-medium">{availableDevices.cameras.length}</span>
                                                </div>
                                                <div className="w-full bg-gray-700 rounded-full h-1.5">
                                                    <div
                                                        className="bg-blue-400 h-1.5 rounded-full transition-all"
                                                        style={{ width: `${Math.min(availableDevices.cameras.length * 25, 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-gray-400">Microphones Found</span>
                                                    <span className="text-green-400 font-medium">{availableDevices.microphones.length}</span>
                                                </div>
                                                <div className="w-full bg-gray-700 rounded-full h-1.5">
                                                    <div
                                                        className="bg-green-400 h-1.5 rounded-full transition-all"
                                                        style={{ width: `${Math.min(availableDevices.microphones.length * 25, 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Background Effects */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <motion.div
                    className="absolute top-1/4 left-1/4 w-72 h-72 bg-lime-600/10 rounded-full blur-3xl"
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.3, 0.5, 0.3],
                    }}
                    transition={{
                        duration: 8,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                />
                <motion.div
                    className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-purple-600/10 rounded-full blur-3xl"
                    animate={{
                        scale: [1.2, 1, 1.2],
                        opacity: [0.5, 0.3, 0.5],
                    }}
                    transition={{
                        duration: 6,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 2
                    }}
                />
                <motion.div
                    className="absolute top-3/4 left-1/2 w-72 h-72 bg-green-600/10 rounded-full blur-3xl"
                    animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.4, 0.6, 0.4],
                    }}
                    transition={{
                        duration: 10,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 4
                    }}
                />
            </div>
        </div>
    );
};

export default Room;