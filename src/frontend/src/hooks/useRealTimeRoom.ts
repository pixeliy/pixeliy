import { useState, useEffect, useRef, useCallback } from 'react';
import { Room } from '../types/backend';
import { useRoom } from './useRoom';

interface UseRealTimeRoomReturn {
    roomData: Room | null;
    participants: string[];
    isHost: boolean;
    isLoading: boolean;
    error: string | null;
    refreshRoom: () => Promise<void>;
    startPolling: () => void;
    stopPolling: () => void;
    pollingStatus: 'idle' | 'active' | 'pending' | 'error';
}

export const useRealTimeRoom = (
    roomId: string | undefined,
    principalId: string,
    initialRoom?: Room | null
): UseRealTimeRoomReturn => {
    const { getRoom } = useRoom();
    const [roomData, setRoomData] = useState<Room | null>(initialRoom || null);
    const [participants, setParticipants] = useState<string[]>([]);
    const [isHost, setIsHost] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pollingStatus, setPollingStatus] = useState<'idle' | 'active' | 'pending' | 'error'>('idle');
    
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const isPollingRef = useRef(false);
    const pendingRequestRef = useRef(false); // Prevent multiple concurrent requests
    const lastSuccessfulFetchRef = useRef<number>(0);
    const retryCountRef = useRef(0);
    const participantHashRef = useRef<string>(''); // Track participant changes
    
    // Configuration
    const POLLING_INTERVAL = 3000; // 3 seconds
    const MAX_RETRY_COUNT = 3;
    const RETRY_BACKOFF_BASE = 2000; // 2 seconds base
    const REQUEST_TIMEOUT = 10000; // 10 seconds timeout

    const updateRoomInfo = useCallback((room: Room) => {
        // Check if current user is host
        const hostText = room.host && typeof room.host.toText === 'function'
            ? room.host.toText()
            : room.host?.toString() || '';
        
        setIsHost(hostText === principalId);
        
        // Convert participants to readable format
        const participantIds = room.participants.map(p => {
            if (p && typeof p.toText === 'function') {
                const text = p.toText();
                return text.substring(0, 8) + '...' + text.substring(text.length - 8);
            } else if (p && p.toString) {
                const text = p.toString();
                return text.substring(0, 8) + '...' + text.substring(text.length - 8);
            } else {
                return 'Invalid Principal';
            }
        }).filter(id => id !== 'Invalid Principal');
        
        // Check if participants actually changed
        const newParticipantHash = participantIds.sort().join(',');
        const hasChanged = newParticipantHash !== participantHashRef.current;
        
        if (hasChanged) {
            console.log('Participants changed:', { 
                old: participantHashRef.current, 
                new: newParticipantHash 
            });
            participantHashRef.current = newParticipantHash;
            setParticipants(participantIds);
        }
    }, [principalId]);

    const refreshRoom = useCallback(async () => {
        if (!roomId || pendingRequestRef.current) {
            console.log('Request blocked - no roomId or pending request');
            return;
        }
        
        // Set pending flag to prevent concurrent requests
        pendingRequestRef.current = true;
        setIsLoading(true);
        setError(null);
        setPollingStatus('pending');
        
        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Request timeout')), REQUEST_TIMEOUT);
        });
        
        try {
            console.log('Refreshing room data for:', roomId);
            
            // Race between actual request and timeout
            const room = await Promise.race([
                getRoom(roomId),
                timeoutPromise
            ]);
            
            if (room) {
                // Check if room data actually changed
                const roomChanged = !roomData || 
                    roomData.participants.length !== room.participants.length ||
                    roomData.host.toText() !== room.host.toText();
                
                if (roomChanged) {
                    console.log('Room data changed, updating...');
                    setRoomData(room);
                    updateRoomInfo(room);
                }
                
                // Reset retry count on success
                retryCountRef.current = 0;
                lastSuccessfulFetchRef.current = Date.now();
                setPollingStatus('active');
            } else {
                setError('Room not found');
                setPollingStatus('error');
            }
        } catch (err) {
            console.error('Error refreshing room:', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to refresh room';
            setError(errorMessage);
            setPollingStatus('error');
            
            // Increment retry count
            retryCountRef.current += 1;
            
            // Stop polling if max retries reached
            if (retryCountRef.current >= MAX_RETRY_COUNT) {
                console.error('Max retries reached, stopping polling');
                stopPolling();
            }
        } finally {
            setIsLoading(false);
            pendingRequestRef.current = false;
        }
    }, [roomId, getRoom, roomData, updateRoomInfo]);

    const startPolling = useCallback(() => {
        if (isPollingRef.current || !roomId || !principalId) {
            console.log('Polling blocked - already active or missing data');
            return;
        }
        
        console.log('Starting smart room polling for:', roomId);
        isPollingRef.current = true;
        retryCountRef.current = 0;
        setPollingStatus('active');
        
        // Initial refresh with delay to avoid immediate spam
        setTimeout(() => {
            if (isPollingRef.current) {
                refreshRoom();
            }
        }, 1000);
        
        // Set up smart polling interval
        intervalRef.current = setInterval(() => {
            if (!isPollingRef.current) {
                return;
            }
            
            // Skip if there's a pending request
            if (pendingRequestRef.current) {
                console.log('Skipping poll - request pending');
                return;
            }
            
            // Implement exponential backoff for errors
            const timeSinceLastSuccess = Date.now() - lastSuccessfulFetchRef.current;
            const shouldSkip = retryCountRef.current > 0 && 
                timeSinceLastSuccess < (RETRY_BACKOFF_BASE * Math.pow(2, retryCountRef.current - 1));
            
            if (shouldSkip) {
                console.log('Skipping poll - backoff period');
                return;
            }
            
            refreshRoom();
        }, POLLING_INTERVAL);
        
    }, [roomId, principalId, refreshRoom]);

    const stopPolling = useCallback(() => {
        console.log('Stopping room polling');
        isPollingRef.current = false;
        setPollingStatus('idle');
        
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        
        // Cancel any pending request
        pendingRequestRef.current = false;
    }, []);

    // Visibility API - pause polling when tab is not visible
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                console.log('Tab hidden, pausing polling');
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
            } else if (isPollingRef.current && !intervalRef.current) {
                console.log('Tab visible, resuming polling');
                intervalRef.current = setInterval(() => {
                    if (!isPollingRef.current || pendingRequestRef.current) return;
                    refreshRoom();
                }, POLLING_INTERVAL);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [refreshRoom]);

    // Start polling when roomId and principalId are available
    useEffect(() => {
        if (roomId && principalId) {
            startPolling();
        }
        
        return () => {
            stopPolling();
        };
    }, [roomId, principalId, startPolling, stopPolling]);

    // Update room info when initial room data changes
    useEffect(() => {
        if (initialRoom) {
            setRoomData(initialRoom);
            updateRoomInfo(initialRoom);
        }
    }, [initialRoom, updateRoomInfo]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopPolling();
        };
    }, [stopPolling]);

    return {
        roomData,
        participants,
        isHost,
        isLoading,
        error,
        refreshRoom,
        startPolling,
        stopPolling,
        pollingStatus,
    };
};