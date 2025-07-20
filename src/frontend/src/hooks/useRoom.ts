import { useState, useCallback } from 'react';
import { Principal } from '@dfinity/principal';
import { canisterService } from '../services/canisterService';
import { Room, Signal, Result } from '../types/backend';

interface UseRoomReturn {
    currentRoom: Room | null;
    isLoading: boolean;
    error: string | null;
    createRoom: (roomId: string) => Promise<Result<Room, string>>;
    joinRoom: (roomId: string) => Promise<Result<Room, string>>;
    leaveRoom: (roomId: string) => Promise<Result<Room, string>>;
    getRoom: (roomId: string) => Promise<Room | null>;
    sendSignal: (roomId: string, signal: Signal) => Promise<void>;
    getSignals: (roomId: string, to: Principal) => Promise<Signal[]>;
    clearSignals: (roomId: string) => Promise<void>;
}

export const useRoom = (): UseRoomReturn => {
    const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const createRoom = useCallback(async (roomId: string): Promise<Result<Room, string>> => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await canisterService.createRoom(roomId);
            if ('Ok' in result) {
                setCurrentRoom(result.Ok);
            }
            return result;
        } catch (err) {
            const error = err instanceof Error ? err.message : 'Failed to create room';
            setError(error);
            return { Err: error };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const joinRoom = useCallback(async (roomId: string): Promise<Result<Room, string>> => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await canisterService.joinRoom(roomId);
            if ('Ok' in result) {
                setCurrentRoom(result.Ok);
            }
            return result;
        } catch (err) {
            const error = err instanceof Error ? err.message : 'Failed to join room';
            setError(error);
            return { Err: error };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const leaveRoom = useCallback(async (roomId: string): Promise<Result<Room, string>> => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await canisterService.leaveRoom(roomId);
            if ('Ok' in result) {
                setCurrentRoom(null);
            }
            return result;
        } catch (err) {
            const error = err instanceof Error ? err.message : 'Failed to leave room';
            setError(error);
            return { Err: error };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const getRoom = useCallback(async (roomId: string): Promise<Room | null> => {
        try {
            setError(null);

            const room = await canisterService.getRoom(roomId);

            if (room) {
                // Validate room data before returning
                if (!room.id || !room.host || !room.participants) {
                    console.error('useRoom: Invalid room data structure', room);
                    setError('Invalid room data received');
                    return null;
                }

                // Ensure host has toText method
                if (typeof room.host.toText !== 'function') {
                    console.error('useRoom: Host principal invalid', room.host);
                    setError('Invalid host principal');
                    return null;
                }

                return room;
            } else {
                return null;
            }
        } catch (err) {
            console.error('useRoom: Error getting room:', err);
            setError(err instanceof Error ? err.message : 'Failed to get room');
            return null;
        }
    }, []);

    const sendSignal = useCallback(async (roomId: string, signal: Signal): Promise<void> => {
        try {
            setError(null);
            await canisterService.sendSignal(roomId, signal);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to send signal');
            throw err;
        }
    }, []);

    const getSignals = useCallback(async (roomId: string, to: Principal): Promise<Signal[]> => {
        try {
            setError(null);
            return await canisterService.getSignals(roomId, to);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to get signals');
            return [];
        }
    }, []);

    const clearSignals = useCallback(async (roomId: string): Promise<void> => {
        try {
            setError(null);
            await canisterService.clearSignals(roomId);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to clear signals');
            throw err;
        }
    }, []);

    return {
        currentRoom,
        isLoading,
        error,
        createRoom,
        joinRoom,
        leaveRoom,
        getRoom,
        sendSignal,
        getSignals,
        clearSignals,
    };
};