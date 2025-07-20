import { Actor, ActorSubclass, HttpAgent, Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { idlFactory } from '../../../declarations/backend';
import { User, UserUpdateData, Room, Signal, Result } from '../types/backend';

export interface BackendActor {
    // User functions
    whoami(): Promise<Principal>;
    authenticateUser(username: string): Promise<Result<User, string>>;
    updateUserProfile(updateData: UserUpdateData): Promise<Result<User, string>>;
    getUserByUsername(username: string): Promise<User | null>;
    getUserByPrincipal(userId: Principal): Promise<User | null>;

    // Room functions
    createRoom(roomId: string): Promise<Result<Room, string>>;
    joinRoom(roomId: string): Promise<Result<Room, string>>;
    getRoom(roomId: string): Promise<Room | null>;
    leaveRoom(roomId: string): Promise<Result<Room, string>>;

    // Signal functions
    sendSignal(roomId: string, signal: Signal): Promise<void>;
    getSignals(roomId: string, to: Principal): Promise<Signal[]>;
    clearSignals(roomId: string): Promise<void>;

    // Helper functions
    listAllRooms(): Promise<Room[]>;
    listAllSignals(): Promise<Signal[]>;
    debugSignals(roomId: string): Promise<Signal[]>;
    // resetAllRooms(): Promise<void>;
    // resetAllSignals(): Promise<void>;
}

class CanisterService {
    private agent: HttpAgent | null = null;
    private actor: ActorSubclass<BackendActor> | null = null;
    private canisterId: string;

    constructor() {
        this.canisterId = process.env.CANISTER_ID_BACKEND || '';
    }

    // Initialize actor with identity
    async init(identity?: Identity): Promise<void> {
        try {
            const host = this.getHost();

            this.agent = new HttpAgent({
                host,
                identity,
            });

            // Fetch root key for local development (both formats)
            if (this.isLocal() || this.isLocalhostSubdomain()) {
                await this.agent.fetchRootKey();
            }

            // Create Actor using IDL Factory
            this.actor = Actor.createActor<BackendActor>(idlFactory, {
                agent: this.agent,
                canisterId: this.canisterId,
            });
        } catch (error) {
            console.error('Failed to initialize canister service:', error);
            throw new Error('Canister initialization failed');
        }
    }

    // Update identity for authenticated calls
    async updateIdentity(identity: Identity): Promise<void> {
        if (this.agent) {
            await this.agent.replaceIdentity(identity);
        }
        await this.init(identity);
    }

    // private getHost(): string {
    //     return this.isDevelopment() 
    //         ? 'http://localhost:4943' 
    //         : 'https://ic0.app';
    // }

    private getHost(): string {
        // Check DFX_NETWORK first, then fallback to other indicators
        const dfxNetwork = process.env.DFX_NETWORK;

        // Check if we're using localhost subdomain format
        if (this.isLocalhostSubdomain()) {
            // For localhost subdomain, use ic0.app API format but with localhost
            return 'http://localhost:4943';
        }

        if (dfxNetwork === 'local') {
            return 'http://localhost:4943';
        } else if (dfxNetwork === 'ic' || dfxNetwork === 'playground') {
            return 'https://ic0.app';
        }

        // Fallback: check if we're running locally
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:4943';
        }

        return 'https://ic0.app';
    }

    private isLocal(): boolean {
        const dfxNetwork = process.env.DFX_NETWORK;

        // Primary check: DFX_NETWORK environment variable
        if (dfxNetwork === 'local') {
            return true;
        }

        // Secondary check: hostname
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return true;
        }

        return false;
    }

    private isLocalhostSubdomain(): boolean {
        // Check if hostname matches pattern: canister-id.localhost
        return window.location.hostname.endsWith('.localhost');
    }

    // private isDevelopment(): boolean {
    //     return process.env.NODE_ENV === 'development';
    // }

    private ensureActor(): ActorSubclass<BackendActor> {
        if (!this.actor) {
            throw new Error('Actor not initialized. Call init() first.');
        }
        return this.actor;
    }

    // USER METHODS
    async whoami(): Promise<Principal> {
        const actor = this.ensureActor();
        return await actor.whoami();
    }

    async authenticateUser(username: string): Promise<Result<User, string>> {
        const actor = this.ensureActor();
        return await actor.authenticateUser(username);
    }

    async updateUserProfile(updateData: UserUpdateData): Promise<Result<User, string>> {
        const actor = this.ensureActor();
        return await actor.updateUserProfile(updateData);
    }

    async getUserByUsername(username: string): Promise<User | null> {
        const actor = this.ensureActor();
        return await actor.getUserByUsername(username);
    }

    async getUserByPrincipal(userId: Principal): Promise<User | null> {
        const actor = this.ensureActor();
        try {
            const result = await actor.getUserByPrincipal(userId);

            // Check if result is array (Motoko optional returns as array)
            if (Array.isArray(result)) {
                if (result.length > 0) {
                    return result[0] as User;
                } else {
                    return null;
                }
            }

            // Check if result is object with user data
            if (result && typeof result === 'object') {
                return result as User;
            }

            return null;
        } catch (error) {
            console.error('Error in getUserByPrincipal:', error);
            throw error;
        }
    }

    // ROOM METHODS
    async createRoom(roomId: string): Promise<Result<Room, string>> {
        const actor = this.ensureActor();
        return await actor.createRoom(roomId);
    }

    async joinRoom(roomId: string): Promise<Result<Room, string>> {
        const actor = this.ensureActor();
        return await actor.joinRoom(roomId);
    }

    // async getRoom(roomId: string): Promise<Room | null> {
    //     const actor = this.ensureActor();
    //     return await actor.getRoom(roomId);
    // }

    async getRoom(roomId: string): Promise<Room | null> {
        const actor = this.ensureActor();
        try {
            const result = await actor.getRoom(roomId);

            if (!result) {
                return null;
            }

            // Handle array response (Motoko optional)
            let roomData = Array.isArray(result) ? result[0] : result;

            if (!roomData) {
                return null;
            }

            // Process room data to ensure Principal objects are properly formatted
            const processedRoom: Room = {
                id: roomData.id || '',
                host: this.ensurePrincipal(roomData.host),
                participants: roomData.participants?.map((p: unknown) => this.ensurePrincipal(p)).filter(Boolean) || [],
                createdAt: roomData.createdAt || BigInt(0)
            };

            return processedRoom;

        } catch (error) {
            console.error('Error in getRoom:', error);
            throw error;
        }
    }

    // Helper method to ensure Principal objects are valid
    private ensurePrincipal(principalData: any): Principal {
        try {
            if (!principalData) {
                throw new Error('Principal data is null or undefined');
            }

            // If it's already a Principal with toText method
            if (typeof principalData.toText === 'function') {
                return principalData;
            }

            // If it's a string, convert to Principal
            if (typeof principalData === 'string') {
                return Principal.fromText(principalData);
            }

            // If it's an object with _arr property (internal Principal representation)
            if (principalData._arr) {
                return principalData;
            }

            throw new Error('Invalid principal format');
        } catch (error) {
            console.error('Error ensuring principal:', error, principalData);
            // Return anonymous principal as fallback
            return Principal.anonymous();
        }
    }

    async leaveRoom(roomId: string): Promise<Result<Room, string>> {
        const actor = this.ensureActor();
        return await actor.leaveRoom(roomId);
    }

    // SIGNAL METHODS
    async sendSignal(roomId: string, signal: Signal): Promise<void> {
        const actor = this.ensureActor();
        return await actor.sendSignal(roomId, signal);
    }

    async getSignals(roomId: string, to: Principal): Promise<Signal[]> {
        const actor = this.ensureActor();
        return await actor.getSignals(roomId, to);
    }

    async clearSignals(roomId: string): Promise<void> {
        const actor = this.ensureActor();
        return await actor.clearSignals(roomId);
    }

    // HELPER METHODS
    async listAllRooms(): Promise<Room[]> {
        const actor = this.ensureActor();
        return await actor.listAllRooms();
    }

    async debugSignals(roomId: string): Promise<Signal[]> {
        const actor = this.ensureActor();
        return await actor.debugSignals(roomId);
    }
}

export const canisterService = new CanisterService();