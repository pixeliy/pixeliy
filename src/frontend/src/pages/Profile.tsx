import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Profile: React.FC = () => {
    const navigate = useNavigate();
    
    const {
        isAuthenticated,
        user,
        principalId,
        login,
        logout,
        authenticateUser,
        whoami,
        checkUserExists,
        refreshUser,
        isLoading: authLoading,
        error: authError
    } = useAuth();

    const [username, setUsername] = useState('');
    const [whoamiResult, setWhoamiResult] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [userExists, setUserExists] = useState<boolean | null>(null);

    // Check if user exists in backend after authentication
    useEffect(() => {
        if (isAuthenticated && !authLoading) {
            checkUserExistence();
        }
    }, [isAuthenticated, authLoading, user]);

    const checkUserExistence = async () => {
        setLoading(true);
        try {
            // If user is already loaded, consider it exists
            if (user && user.username) {
                setUserExists(true);
                return;
            }
            
            const exists = await checkUserExists();
            setUserExists(exists);
        } catch (error) {
            console.error('❌ Error checking user existence:', error);
            setUserExists(false);
        } finally {
            setLoading(false);
        }
    };

    const handleAuth = async () => {
        if (username.length < 3) {
            alert('Username must be at least 3 characters');
            return;
        }

        setLoading(true);
        try {
            const result = await authenticateUser(username);
            if ('Err' in result) {
                alert(`Error: ${result.Err}`);
            } else {
                setUserExists(true);
                // Refresh user data after successful authentication
                await refreshUser();
                // Auto redirect to dashboard after successful registration
                setTimeout(() => {
                    navigate('/dashboard');
                }, 1500);
            }
        } catch (error) {
            console.error('❌ Auth error:', error);
            alert('Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    const handleWhoami = async () => {
        setLoading(true);
        try {
            const principal = await whoami();

            if (principal && typeof principal.toText === 'function') {
                const text = principal.toText();
                setWhoamiResult(text);
            } else {
                throw new Error('Invalid principal returned from whoami');
            }
        } catch (error) {
            console.error('❌ Whoami error:', error);
            alert('Whoami failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async () => {
        setLoading(true);
        try {
            const success = await login();
            if (!success) {
                alert('Login failed');
            }
        } catch (error) {
            console.error('❌ Login error:', error);
            alert('Login failed');
        } finally {
            setLoading(false);
        }
    };

    const handleGoToDashboard = () => {
        navigate('/dashboard');
    };

    const handleBackToHome = () => {
        navigate('/');
    };

    // Loading state
    if (authLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center"
                >
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-400 mx-auto mb-6"></div>
                    <div className="text-white text-xl">Loading authentication...</div>
                </motion.div>
            </div>
        );
    }

    // Not authenticated state
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
                <motion.div 
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="max-w-md w-full mx-4"
                >
                    <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-8 border border-gray-700 text-center">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                            className="w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6"
                        >
                            <span className="text-3xl">🔐</span>
                        </motion.div>

                        <h1 className="text-white text-3xl font-bold mb-4">Welcome to Pixeliy</h1>
                        <p className="text-gray-400 mb-8">Connect with Internet Identity to get started</p>

                        {authError && (
                            <motion.div 
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-6"
                            >
                                <p className="text-red-300 text-sm">⚠️ {authError}</p>
                            </motion.div>
                        )}

                        <div className="space-y-4">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleLogin}
                                disabled={loading}
                                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 text-white px-6 py-4 rounded-xl font-semibold transition-all transform"
                            >
                                {loading ? (
                                    <div className="flex items-center justify-center space-x-2">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        <span>Connecting...</span>
                                    </div>
                                ) : 'Connect with Internet Identity'}
                            </motion.button>

                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleBackToHome}
                                className="w-full bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-xl font-semibold transition-all"
                            >
                                ← Back to Home
                            </motion.button>
                        </div>
                    </div>
                </motion.div>
            </div>
        );
    }

    // Main authenticated view
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white">
            {/* Header */}
            <motion.header
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="bg-gray-900/50 backdrop-blur-md border-b border-gray-800 sticky top-0 z-10"
            >
                <div className="max-w-4xl mx-auto px-6 py-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-4">
                            <div>
                                <h1 className="text-xl font-bold">Profile</h1>
                                <p className="text-gray-400 text-sm">Setup your account</p>
                            </div>
                        </div>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleBackToHome}
                            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition-all"
                        >
                            ← Home
                        </motion.button>
                    </div>
                </div>
            </motion.header>

            <div className="max-w-4xl mx-auto px-6 py-8">
                {/* Error Display */}
                {authError && (
                    <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-6"
                    >
                        <p className="text-red-300">⚠️ {authError}</p>
                    </motion.div>
                )}

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Authentication Status - Main Card */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                        className="lg:col-span-2 bg-gray-800/50 backdrop-blur-md rounded-2xl p-6 border border-gray-700"
                    >
                        <div className="flex items-center space-x-3 mb-6">
                            <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center">
                                <span className="text-2xl">✅</span>
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold">Authentication Status</h2>
                                <p className="text-gray-400">Your connection details</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-gray-700/50 rounded-xl p-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">Internet Identity</span>
                                    <span className="text-green-400 font-semibold">✅ Connected</span>
                                </div>
                            </div>
                            
                            <div className="bg-gray-700/50 rounded-xl p-4">
                                <div className="flex justify-between items-start">
                                    <span className="text-gray-400">Principal ID</span>
                                    <div className="text-right">
                                        <span className="font-mono text-sm text-white">
                                            {principalId.substring(0, 12)}...{principalId.substring(principalId.length - 8)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gray-700/50 rounded-xl p-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">Registration</span>
                                    {userExists === null ? (
                                        <div className="flex items-center space-x-2">
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-400"></div>
                                            <span className="text-yellow-400">Checking...</span>
                                        </div>
                                    ) : userExists ? (
                                        <span className="text-green-400 font-semibold">✅ Registered</span>
                                    ) : (
                                        <span className="text-red-400 font-semibold">❌ Not Registered</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Quick Actions */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 }}
                        className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-6 border border-gray-700"
                    >
                        <div className="flex items-center space-x-3 mb-6">
                            <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center">
                                <span className="text-xl">⚡</span>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold">Quick Actions</h3>
                                <p className="text-gray-400 text-sm">Manage your account</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleWhoami}
                                disabled={loading}
                                className="w-full bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 py-3 rounded-xl transition-all disabled:opacity-50"
                            >
                                {loading ? 'Loading...' : 'Whoami'}
                            </motion.button>

                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={checkUserExistence}
                                disabled={loading}
                                className="w-full bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 py-3 rounded-xl transition-all disabled:opacity-50"
                            >
                                {loading ? 'Checking...' : 'Refresh Status'}
                            </motion.button>

                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={logout}
                                disabled={loading}
                                className="w-full bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 py-3 rounded-xl transition-all disabled:opacity-50"
                            >
                                Disconnect
                            </motion.button>
                        </div>

                        {whoamiResult && (
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="mt-4 p-3 bg-gray-700/50 rounded-xl border border-gray-600"
                            >
                                <p className="text-xs text-gray-400 mb-1">Connection Test Result:</p>
                                <p className="font-mono text-xs text-green-400 break-all">{whoamiResult}</p>
                            </motion.div>
                        )}
                    </motion.div>

                    {/* Registration Form */}
                    {userExists === false && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                            className="lg:col-span-3 bg-gradient-to-br from-yellow-600/20 to-orange-600/20 backdrop-blur-md rounded-2xl p-8 border border-yellow-500/30"
                        >
                            <div className="flex items-center space-x-4 mb-6">
                                <div className="w-16 h-16 bg-yellow-600 rounded-2xl flex items-center justify-center">
                                    <span className="text-3xl">📝</span>
                                </div>
                                <div>
                                    <h2 className="text-3xl font-bold text-yellow-400">Complete Registration</h2>
                                    <p className="text-gray-300">Create your Pixeliy profile to get started</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-2 text-yellow-300">Choose Username</label>
                                        <input
                                            type="text"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            placeholder="Enter your username"
                                            className="w-full px-4 py-3 bg-gray-800/50 rounded-xl border border-gray-600 text-white backdrop-blur-md focus:outline-none focus:border-yellow-500 transition-all"
                                            maxLength={20}
                                        />
                                        <p className="text-xs text-gray-400 mt-2">
                                            3-20 characters, letters and numbers only
                                        </p>
                                    </div>

                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={handleAuth}
                                        disabled={loading || username.length < 3}
                                        className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 disabled:opacity-50 text-white py-4 rounded-xl font-semibold transition-all transform"
                                    >
                                        {loading ? (
                                            <div className="flex items-center justify-center space-x-2">
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                <span>Creating Profile...</span>
                                            </div>
                                        ) : 'Create Profile'}
                                    </motion.button>
                                </div>

                                <div className="bg-gray-800/30 rounded-xl p-6">
                                    <h4 className="font-semibold mb-3 text-yellow-300">What happens next?</h4>
                                    <ul className="space-y-2 text-sm text-gray-300">
                                        <li className="flex items-center space-x-2">
                                            <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                                            <span>Your profile will be created on Internet Computer</span>
                                        </li>
                                        <li className="flex items-center space-x-2">
                                            <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                                            <span>You'll get access to create and join rooms</span>
                                        </li>
                                        <li className="flex items-center space-x-2">
                                            <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                                            <span>Start collaborating with dRTC technology</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Profile Complete */}
                    {userExists === true && user && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                            className="lg:col-span-3 bg-gradient-to-br from-green-600/20 to-emerald-600/20 backdrop-blur-md rounded-2xl p-8 border border-green-500/30"
                        >
                            <div className="flex items-center space-x-4 mb-6">
                                <div className="w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center">
                                    <span className="text-3xl">🎉</span>
                                </div>
                                <div>
                                    <h2 className="text-3xl font-bold text-green-400">Profile Complete!</h2>
                                    <p className="text-gray-300">Welcome to Pixeliy, {user.username}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div className="bg-gray-800/30 rounded-xl p-4">
                                        <div className="space-y-3">
                                            <div>
                                                <span className="text-gray-400 text-sm">Username</span>
                                                <p className="text-white font-semibold">{user.username}</p>
                                            </div>
                                            <div>
                                                <span className="text-gray-400 text-sm">Display Name</span>
                                                <p className="text-white">{user.name || 'Not set'}</p>
                                            </div>
                                            <div>
                                                <span className="text-gray-400 text-sm">User ID</span>
                                                <p className="font-mono text-xs text-gray-300">
                                                    {user.id ? (typeof user.id.toText === 'function' ? user.id.toText() : 'Invalid principal') : 'No principal'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={handleGoToDashboard}
                                        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-4 rounded-xl font-semibold transition-all transform"
                                    >
                                        🚀 Go to Dashboard
                                    </motion.button>
                                </div>

                                <div className="bg-gray-800/30 rounded-xl p-6">
                                    <h4 className="font-semibold mb-3 text-green-300">Ready to start!</h4>
                                    <ul className="space-y-2 text-sm text-gray-300">
                                        <li className="flex items-center space-x-2">
                                            <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                                            <span>Create or join video rooms</span>
                                        </li>
                                        <li className="flex items-center space-x-2">
                                            <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                                            <span>Experience decentralized WebRTC</span>
                                        </li>
                                        <li className="flex items-center space-x-2">
                                            <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                                            <span>Collaborate with AI assistance</span>
                                        </li>
                                        <li className="flex items-center space-x-2">
                                            <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                                            <span>Enjoy privacy-first communication</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </div>
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

export default Profile;