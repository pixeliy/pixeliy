import { Principal } from '@dfinity/principal';

export interface User {
    id: Principal;
    username: string;
    name: string | null;
    createdAt: bigint;
    profilePicture: string | null;
}

export interface UserUpdateData {
    username?: string;
    name?: string;
    profilePicture?: string;
}

export interface Room {
    id: string;
    host: Principal;
    participants: Principal[];
    createdAt: bigint;
}

export interface SafeRoom {
    id?: string;
    host?: any; // Allow any type initially
    participants?: any[]; // Allow any type initially
    createdAt?: bigint | string | number;
}

export interface Signal {
    from: Principal;
    to: Principal;
    kind: string; // "offer", "answer", "ice"
    data: string;
}

export type Result<T, E> = { Ok: T } | { Err: E };