import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Principal } from '@dfinity/principal';
import { useAuth } from '../contexts/AuthContext';
import { useRoom } from '../hooks/useRoom';
import { useRealTimeRoom } from '../hooks/useRealTimeRoom';
import { Signal } from '../types/backend';

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

    // ========== WEBRTC REFS ==========
    const localStream = useRef<MediaStream | null>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const peerConnections = useRef<Map<string, PeerConnectionData>>(new Map());
    const pendingICECandidates = useRef<Map<string, RTCIceCandidate[]>>(new Map());
    const signalIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const remoteVideosContainerRef = useRef<HTMLDivElement>(null);
    const processedSignals = useRef<Set<string>>(new Set());
    const previousParticipants = useRef<string[]>([]);

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

            // 🔥 ENHANCED VIDEO ELEMENT REMOVAL
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

            // 🔥 BIDIRECTIONAL OFFER STRATEGY:
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

            // 🔥 CREATE VIDEO ELEMENT BUT DON'T ADD TO DOM YET
            const videoElement = document.createElement('video');
            videoElement.autoplay = true;
            videoElement.playsInline = true;
            videoElement.muted = false;
            videoElement.className = 'w-full h-full bg-gray-800 rounded-lg object-cover';
            videoElement.style.aspectRatio = '16/9';

            // 🔥 ENHANCED TRACK HANDLING - DEBUGGING
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

                    // 🔥 ENHANCED VIDEO PLAY WITH ERROR HANDLING
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

                    // 🔥 ADD VIDEO EVENT LISTENERS FOR DEBUGGING
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
            };

            // 🔥 ENHANCED CONNECTION STATE TRACKING - ONLY SHOW VIDEO WHEN CONNECTED
            pc.onconnectionstatechange = () => {
                console.log(`[PEER] Connection state for ${targetPrincipal}:`, pc.connectionState);

                const peerData = peerConnections.current.get(targetPrincipal);
                if (peerData) {
                    peerData.connectionState = pc.connectionState;
                }

                switch (pc.connectionState) {
                    case 'connected':
                        console.log(`[PEER] Successfully connected to ${targetPrincipal}`);

                        // 🔥 ONLY ADD VIDEO ELEMENT TO DOM WHEN CONNECTED - CLEAN DESIGN
                        if (remoteVideosContainerRef.current && !document.getElementById(`video-wrapper-${targetPrincipal}`)) {
                            const videoWrapper = document.createElement('div');
                            videoWrapper.className = 'relative bg-gray-800 rounded-lg overflow-hidden';
                            videoWrapper.style.aspectRatio = '16/9';
                            videoWrapper.id = `video-wrapper-${targetPrincipal}`;

                            // 🔥 CLEAN USER LABEL - Just first 8 characters
                            const label = document.createElement('div');
                            label.className = 'absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded backdrop-blur-sm';
                            label.textContent = `${targetPrincipal.substring(0, 8)}...`;

                            // 🔥 MINIMAL CONNECTION STATUS INDICATOR
                            const statusIndicator = document.createElement('div');
                            statusIndicator.className = 'absolute top-2 right-2 w-3 h-3 bg-green-400 rounded-full border-2 border-white';
                            statusIndicator.id = `status-${targetPrincipal}`;

                            videoWrapper.appendChild(videoElement);
                            videoWrapper.appendChild(label);
                            videoWrapper.appendChild(statusIndicator);
                            remoteVideosContainerRef.current.appendChild(videoWrapper);

                            console.log(`[PEER] Video element added to DOM for ${targetPrincipal}`);
                        }

                        // 🔥 VERIFY REMOTE STREAMS AFTER CONNECTION
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

                        // 🔥 REMOVE VIDEO ELEMENT FROM DOM WHEN DISCONNECTED/FAILED
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

            // 🔥 ENHANCED LOCAL TRACK ADDITION WITH VERIFICATION
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

                // 🔥 VERIFY TRACKS WERE ADDED
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

            // 🔥 ENHANCED RENEGOTIATION HANDLING
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
                // alert('Left room successfully!');
                navigate('/dashboard');
            }
        } catch (error) {
            console.error('Leave room error:', error);
            alert('Failed to leave room');
        } finally {
            setLoading(false);
        }
    };

    // ========== UTILITY FUNCTIONS ==========
    const copyRoomLink = () => {
        const roomLink = `${window.location.origin}/room/${roomId}`;
        navigator.clipboard.writeText(roomLink);
        const button = document.activeElement as HTMLButtonElement;
        if (button) {
            const originalText = button.textContent;
            button.textContent = 'Link Copied!';
            setTimeout(() => {
                button.textContent = originalText;
            }, 2000);
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

    // ========== RENDER CONDITIONS ==========
    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                    <div className="text-white text-xl">Loading room...</div>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-white text-2xl mb-4">Please Login</h1>
                    <p className="text-gray-400 mb-6">You need to login to access this room</p>
                    <button
                        onClick={login}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
                    >
                        Login with Internet Identity
                    </button>
                </div>
            </div>
        );
    }

    if (!user?.username) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-white text-2xl mb-4">Registration Required</h1>
                    <p className="text-gray-400 mb-6">
                        You need to complete registration before accessing rooms
                    </p>
                    <button
                        onClick={() => navigate('/profile')}
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition-colors"
                    >
                        Go to Registration
                    </button>
                </div>
            </div>
        );
    }

    if (!roomData && !loading && !realtimeLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-white text-2xl mb-4">Room Not Found</h1>
                    <p className="text-gray-400 mb-6">
                        The room "{roomId}" does not exist or has been closed.
                    </p>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    // ========== MAIN RENDER ==========
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white">
            {/* Header */}
            <motion.header
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="bg-gray-900/50 backdrop-blur-md border-b border-gray-800 sticky top-0 z-10"
            >
                <div className="max-w-6xl mx-auto px-6 py-4">
                    <div className="flex justify-between items-center">
                        {/* Left: Logo */}
                        <motion.div
                            whileHover={{ scale: 1.05 }}
                            className="flex items-center space-x-3"
                        >
                            <span className="text-white font-bold text-lg">Pixeliy Meet</span>
                        </motion.div>

                        {/* Center: Room Info */}
                        <div className="text-center">
                            <h1 className="text-xl font-bold text-white">{roomId}</h1>
                            <p className="text-gray-400 text-sm">
                                {connectedPeers.length + 1} participants • {isHost ? '👑 Host' : '👤 Participant'}
                            </p>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center space-x-3">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={copyRoomLink}
                                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                            >
                                🔗 Copy Link
                            </motion.button>
                        </div>
                    </div>
                </div>
            </motion.header>

            <div className="flex items-center justify-center min-h-[calc(100vh-80px)] px-6">
                {/* Error Display */}
                {(authError || roomError || realtimeError) && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="fixed top-24 left-1/2 transform -translate-x-1/2 bg-red-500/20 border border-red-500/50 rounded-xl p-4 z-50 backdrop-blur-md"
                    >
                        <p className="text-red-300">
                            {authError || roomError || realtimeError}
                        </p>
                    </motion.div>
                )}

                {/* Room Content */}
                {roomData && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6 }}
                        className="w-full max-w-7xl"
                    >
                        {/* Video Section */}
                        <div className="p-4 pb-24">
                            {/* Dynamic Video Grid */}
                            {(() => {
                                const totalVideos = connectedPeers.length + 1;
                                const { cols, rows } = getVideoGridLayout(totalVideos);

                                return (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.3, duration: 0.6 }}
                                        className="gap-6 w-full"
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: `repeat(${cols}, 1fr)`,
                                            gridTemplateRows: `repeat(${rows}, 1fr)`,
                                            aspectRatio: totalVideos === 1 ? '16/9' : 'auto'
                                        }}
                                    >
                                        {/* Local Video */}
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: 0.4, duration: 0.5 }}
                                            className="relative bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl overflow-hidden shadow-2xl border border-gray-700/50"
                                            style={{ aspectRatio: '16/9' }}
                                        >
                                            <video
                                                ref={localVideoRef}
                                                autoPlay
                                                muted
                                                playsInline
                                                className={`w-full h-full object-cover ${!isCameraEnabled ? 'opacity-30' : ''}`}
                                            />

                                            {/* Local Video Overlay */}
                                            <div className="absolute bottom-3 left-3 bg-black/70 text-white text-xs px-3 py-1 rounded-lg backdrop-blur-sm border border-white/20">
                                                You
                                            </div>

                                            {/* Mic Status */}
                                            <div className="absolute top-3 right-3">
                                                {!isMicrophoneEnabled && (
                                                    <motion.div
                                                        initial={{ scale: 0 }}
                                                        animate={{ scale: 1 }}
                                                        className="bg-red-600 text-white text-xs px-2 py-1 rounded-lg shadow-lg"
                                                    >
                                                        🔇
                                                    </motion.div>
                                                )}
                                            </div>

                                            {/* Camera Off Overlay */}
                                            {!isCameraEnabled && (
                                                <motion.div
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    className="absolute inset-0 flex items-center justify-center bg-gray-800/90 backdrop-blur-sm"
                                                >
                                                    <div className="text-center text-gray-300">
                                                        <div className="text-5xl mb-3">📹</div>
                                                        <div className="text-sm font-medium">Camera off</div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </motion.div>

                                        {/* Remote Videos Container */}
                                        <div
                                            ref={remoteVideosContainerRef}
                                            className="contents"
                                        >
                                        </div>
                                    </motion.div>
                                );
                            })()}
                        </div>

                        {/* Media Controls Bar */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6, duration: 0.5 }}
                            className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40"
                        >
                            <div className="bg-gray-900/90 backdrop-blur-md border border-gray-700/50 rounded-2xl px-6 py-4 shadow-2xl">
                                <div className="flex items-center space-x-4">
                                    {/* Camera Toggle */}
                                    <motion.button
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={toggleCamera}
                                        className={`p-3 rounded-xl transition-all ${isCameraEnabled
                                                ? 'bg-gray-700/50 hover:bg-gray-600 text-white border border-gray-600'
                                                : 'bg-red-600 hover:bg-red-700 text-white border border-red-500'
                                            }`}
                                        title={isCameraEnabled ? 'Turn off camera' : 'Turn on camera'}
                                    >
                                        <span className="text-xl">📹</span>
                                    </motion.button>

                                    {/* Microphone Toggle */}
                                    <motion.button
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={toggleMicrophone}
                                        className={`p-3 rounded-xl transition-all ${isMicrophoneEnabled
                                                ? 'bg-gray-700/50 hover:bg-gray-600 text-white border border-gray-600'
                                                : 'bg-red-600 hover:bg-red-700 text-white border border-red-500'
                                            }`}
                                        title={isMicrophoneEnabled ? 'Mute microphone' : 'Unmute microphone'}
                                    >
                                        <span className="text-xl">
                                            {isMicrophoneEnabled ? '🎤' : '🔇'}
                                        </span>
                                    </motion.button>

                                    {/* Settings */}
                                    <motion.button
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => setShowSettings(true)}
                                        className="p-3 rounded-xl bg-gray-700/50 hover:bg-gray-600 text-white border border-gray-600 transition-all"
                                        title="Settings"
                                    >
                                        <span className="text-xl">⚙️</span>
                                    </motion.button>

                                    {/* Leave Room */}
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={handleLeaveRoom}
                                        disabled={loading || roomLoading}
                                        className="px-6 py-3 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:opacity-50 text-white font-semibold transition-all border border-red-500"
                                        title="Leave room"
                                    >
                                        <span className="text-sm">
                                            {loading ? 'Leaving...' : 'Leave'}
                                        </span>
                                    </motion.button>
                                </div>
                            </div>
                        </motion.div>

                        {/* Settings Modal */}
                        {showSettings && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm"
                            >
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                    className="bg-gray-800/90 backdrop-blur-md rounded-2xl p-6 w-full max-w-md mx-4 border border-gray-700/50 shadow-2xl"
                                >
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="text-xl font-bold text-white">Settings</h3>
                                        <motion.button
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={() => setShowSettings(false)}
                                            className="text-gray-400 hover:text-white text-xl p-1 rounded-lg hover:bg-gray-700 transition-all"
                                        >
                                            ✕
                                        </motion.button>
                                    </div>

                                    <div className="space-y-6">
                                        {/* Camera Selection */}
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-300 mb-3">
                                                📹 Camera Device
                                            </label>
                                            <select
                                                value={selectedCameraId}
                                                onChange={(e) => handleCameraChange(e.target.value)}
                                                disabled={isDevicesLoading}
                                                className="w-full bg-gray-700/50 border border-gray-600 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 disabled:opacity-50 transition-all backdrop-blur-sm"
                                            >
                                                <option value="">Select Camera...</option>
                                                {availableDevices.cameras.map((camera) => (
                                                    <option key={camera.deviceId} value={camera.deviceId}>
                                                        {camera.label || `Camera ${camera.deviceId.substring(0, 8)}...`}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Microphone Selection */}
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-300 mb-3">
                                                🎤 Microphone Device
                                            </label>
                                            <select
                                                value={selectedMicrophoneId}
                                                onChange={(e) => handleMicrophoneChange(e.target.value)}
                                                disabled={isDevicesLoading}
                                                className="w-full bg-gray-700/50 border border-gray-600 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 disabled:opacity-50 transition-all backdrop-blur-sm"
                                            >
                                                <option value="">Select Microphone...</option>
                                                {availableDevices.microphones.map((microphone) => (
                                                    <option key={microphone.deviceId} value={microphone.deviceId}>
                                                        {microphone.label || `Microphone ${microphone.deviceId.substring(0, 8)}...`}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Refresh Devices */}
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={enumerateDevices}
                                            disabled={isDevicesLoading}
                                            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 text-white py-3 rounded-xl font-semibold transition-all"
                                        >
                                            {isDevicesLoading ? (
                                                <div className="flex items-center justify-center space-x-2">
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                    <span>Loading...</span>
                                                </div>
                                            ) : '🔄 Refresh Devices'}
                                        </motion.button>

                                        {/* Device Status */}
                                        <div className="pt-4 border-t border-gray-700/50">
                                            <div className="text-sm text-gray-400 space-y-1">
                                                <p>📹 Camera: {availableDevices.cameras.length} available</p>
                                                <p>🎤 Microphone: {availableDevices.microphones.length} available</p>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </motion.div>
                )}
            </div>

            {/* Background Effects */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-purple-600/10 rounded-full blur-3xl"></div>
                <div className="absolute top-3/4 left-1/2 w-72 h-72 bg-green-600/10 rounded-full blur-3xl"></div>
            </div>
        </div>
    );
};

export default Room;