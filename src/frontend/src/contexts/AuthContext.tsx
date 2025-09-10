import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Principal } from '@dfinity/principal';
import { AuthClient } from '@dfinity/auth-client';
import { canisterService } from '../services/canisterService';
import { User, UserUpdateData, Result } from '../types/backend';

interface AuthContextType {
    isAuthenticated: boolean;
    user: User | null;
    principalId: string;
    isLoading: boolean;
    error: string | null;
    identity: import('@dfinity/agent').Identity | null;
    login: () => Promise<boolean>;
    logout: () => Promise<void>;
    authenticateUser: (username: string) => Promise<Result<User, string>>;
    updateProfile: (data: UserUpdateData) => Promise<Result<User, string>>;
    whoami: () => Promise<Principal>;
    checkUserExists: () => Promise<boolean>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [authClient, setAuthClient] = useState<AuthClient | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState<User | null>(null);
    const [principalId, setPrincipalId] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const initAuthClient = useCallback(async () => {
        try {
            const client = await AuthClient.create({
                idleOptions: {
                    disableIdle: true,
                    disableDefaultIdleCallback: true
                }
            });
            setAuthClient(client);
            return client;
        } catch (err) {
            setError('Failed to initialize auth client');
            throw err;
        }
    }, []);

    const checkUserExists = useCallback(async (): Promise<boolean> => {
        if (!isAuthenticated || !principalId) {
            return false;
        }

        try {
            const principal = Principal.fromText(principalId);
            const userData = await canisterService.getUserByPrincipal(principal);
            
            if (!userData) {
                setUser(null);
                return false;
            }

            // Handle different response formats from Motoko
            let processedUser: User | null = null;

            if (Array.isArray(userData)) {
                if (userData.length > 0) {
                    processedUser = userData[0] as User;
                }
            } else if (typeof userData === 'object') {
                processedUser = userData as User;
            }

            if (!processedUser) {
                setUser(null);
                return false;
            }

            // Convert Principal if needed
            if (typeof processedUser.id === 'string') {
                try {
                    processedUser.id = Principal.fromText(processedUser.id);
                } catch (e) {
                    console.error('Invalid principal string:', processedUser.id);
                    setUser(null);
                    return false;
                }
            }

            setUser(processedUser);
            return true;
        } catch (error) {
            setUser(null);
            return false;
        }
    }, [isAuthenticated, principalId]);

    const refreshUser = useCallback(async () => {
        if (!isAuthenticated || !principalId) return;
        
        try {
            await checkUserExists();
        } catch (error) {
            console.error('Failed to refresh user data:', error);
        }
    }, [isAuthenticated, principalId, checkUserExists]);

    const checkAuthState = useCallback(async (client: AuthClient) => {
        try {
            const authenticated = await client.isAuthenticated();

            if (authenticated) {
                const identity = client.getIdentity();
                
                if (!identity) {
                    throw new Error("Identity is null or undefined");
                }

                const principal = identity.getPrincipal();
                
                if (!principal || typeof principal.toText !== 'function') {
                    throw new Error("Principal is invalid or doesn't have toText method");
                }

                const principalText = principal.toText();

                await canisterService.init(identity);
                setPrincipalId(principalText);
                setIsAuthenticated(true);

                // Auto-check if user exists after authentication
                setTimeout(async () => {
                    try {
                        const userExists = await checkUserExists();
                        console.log('Auto user check result:', userExists);
                    } catch (error) {
                        console.log('Auto user check failed:', error);
                    }
                }, 1000); // Small delay to ensure state is updated

            } else {
                await canisterService.init();
            }
        } catch (err) {
            console.error('Auth check error:', err);
            setError(err instanceof Error ? err.message : 'Auth check failed');
        } finally {
            setIsLoading(false);
        }
    }, [checkUserExists]);

    // Initialize auth on mount
    useEffect(() => {
        const initialize = async () => {
            try {
                const client = await initAuthClient();
                await checkAuthState(client);
            } catch (err) {
                console.error('Auth initialization failed:', err);
                setIsLoading(false);
            }
        };
        initialize();
    }, [initAuthClient, checkAuthState]);

    const login = useCallback(async (): Promise<boolean> => {
        setIsLoading(true);
        setError(null);
        setUser(null);

        try {
            const client = authClient || await initAuthClient();

            return new Promise((resolve) => {
                const dfxNetwork = process.env.DFX_NETWORK;
                const internetIdentityCanisterId = process.env.CANISTER_ID_INTERNET_IDENTITY;

                let identityProvider: string;
                const isSubdomain = window.location.hostname.endsWith('.localhost');

                if (dfxNetwork === 'local') {
                    if (isSubdomain) {
                        identityProvider = `http://${internetIdentityCanisterId}.localhost:4943`;
                    } else {
                        identityProvider = `http://localhost:4943/?canisterId=${internetIdentityCanisterId}`;
                    }
                } else {
                    identityProvider = 'https://id.ai';
                }

                client.login({
                    identityProvider,
                    onSuccess: async () => {
                        try {
                            const identity = client.getIdentity();
                            if (!identity) {
                                throw new Error("Identity is null after login");
                            }

                            await canisterService.updateIdentity(identity);

                            const principal = identity.getPrincipal();
                            const principalText = principal.toText();

                            setPrincipalId(principalText);
                            setIsAuthenticated(true);

                            // Check if user exists after login
                            setTimeout(async () => {
                                try {
                                    await checkUserExists();
                                } catch (error) {
                                    console.log('User check after login failed:', error);
                                }
                            }, 500);

                            resolve(true);
                        } catch (err) {
                            console.error('Post-login error:', err);
                            setError(err instanceof Error ? err.message : 'Post-login processing failed');
                            resolve(false);
                        }
                    },
                    onError: (err) => {
                        console.error('Login error:', err);
                        setError('Login failed');
                        resolve(false);
                    }
                });
            });
        } catch (err) {
            console.error('Login setup error:', err);
            setError(err instanceof Error ? err.message : 'Login failed');
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [authClient, initAuthClient, checkUserExists]);

    const logout = useCallback(async () => {
        try {
            if (authClient) {
                await authClient.logout();
            }
            await canisterService.init();
            setIsAuthenticated(false);
            setUser(null);
            setPrincipalId('');
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Logout failed');
        }
    }, [authClient]);

    const authenticateUser = useCallback(async (username: string): Promise<Result<User, string>> => {
        try {
            setError(null);
            const result = await canisterService.authenticateUser(username);

            if ('Ok' in result) {
                setUser(result.Ok);
            }

            return result;
        } catch (err) {
            const error = err instanceof Error ? err.message : 'Authentication failed';
            setError(error);
            return { Err: error };
        }
    }, []);

    const updateProfile = useCallback(async (data: UserUpdateData): Promise<Result<User, string>> => {
        try {
            setError(null);
            const result = await canisterService.updateUserProfile(data);

            if ('Ok' in result) {
                setUser(result.Ok);
            }

            return result;
        } catch (err) {
            const error = err instanceof Error ? err.message : 'Profile update failed';
            setError(error);
            return { Err: error };
        }
    }, []);

    const whoami = useCallback(async (): Promise<Principal> => {
        return await canisterService.whoami();
    }, []);

    const value: AuthContextType = {
        isAuthenticated,
        user,
        principalId,
        isLoading,
        error,
        identity: authClient ? authClient.getIdentity() : null,
        login,
        logout,
        authenticateUser,
        updateProfile,
        whoami,
        checkUserExists,
        refreshUser,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};