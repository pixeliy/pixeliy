import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRoom } from '../hooks/useRoom';
import { useNavigate } from 'react-router-dom';

const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    
    const {
        isAuthenticated,
        user,
        principalId,
        login,
        logout,
        refreshUser,
        isLoading: authLoading,
        error: authError
    } = useAuth();

    const {
        createRoom,
        joinRoom,
        getRoom,
        isLoading: roomLoading,
        error: roomError
    } = useRoom();

    const [roomId, setRoomId] = useState('');
    const [loading, setLoading] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showJoinForm, setShowJoinForm] = useState(false);

    // Dummy data for featured hubs
    const featuredHubs = [
        { id: 'ART-001', name: 'Digital Canvas', participants: 12, type: 'Creative' },
        { id: 'MEET-02', name: 'Team Sync', participants: 8, type: 'Meeting' },
        { id: 'GAME-03', name: 'Fun Zone', participants: 15, type: 'Gaming' },
        { id: 'STUDY-04', name: 'Study Group', participants: 6, type: 'Education' }
    ];

    const handleCreateRoom = async () => {
        if (!roomId.trim()) {
            alert('Please enter a room ID');
            return;
        }

        if (roomId.length < 3) {
            alert('Room ID must be at least 3 characters');
            return;
        }

        setLoading(true);
        try {
            const result = await createRoom(roomId.trim());

            if ('Err' in result) {
                alert(`Failed to create room: ${result.Err}`);
            } else {
                navigate(`/room/${roomId.trim()}`);
            }
        } catch (error) {
            alert('Failed to create room');
        } finally {
            setLoading(false);
        }
    };

    const handleJoinRoom = async (targetRoomId?: string) => {
        const targetId = targetRoomId || roomId.trim();
        
        if (!targetId) {
            alert('Please enter a room ID');
            return;
        }

        setLoading(true);
        try {
            const room = await getRoom(targetId);
            if (!room) {
                alert(`Room "${targetId}" does not exist`);
                setLoading(false);
                return;
            }

            const result = await joinRoom(targetId);

            if ('Err' in result) {
                alert(`Failed to join room: ${result.Err}`);
            } else {
                navigate(`/room/${targetId}`);
            }
        } catch (error) {
            alert('Failed to join room');
        } finally {
            setLoading(false);
        }
    };

    const generateRandomRoomId = () => {
        const randomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        setRoomId(`ROOM-${randomId}`);
    };

    useEffect(() => {
        if (isAuthenticated && !user && !authLoading) {
            refreshUser();
        }
    }, [isAuthenticated, user, authLoading, refreshUser]);

    // Show loading state
    if (authLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
                    <div className="text-white text-xl">Loading...</div>
                </div>
            </div>
        );
    }

    // Show login required
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
                <div className="text-center bg-gray-800/50 backdrop-blur-md rounded-2xl p-8 border border-gray-700">
                    <h1 className="text-white text-3xl font-bold mb-4">Welcome to Pixeliy</h1>
                    <p className="text-gray-400 mb-8 max-w-md">Connect, collaborate, and create together in real-time video spaces</p>
                    <button
                        onClick={login}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 rounded-xl font-semibold transition-all transform hover:scale-105"
                    >
                        Get Started
                    </button>
                </div>
            </div>
        );
    }

    // Show registration required
    if (!user || !user.username) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
                <div className="text-center bg-gray-800/50 backdrop-blur-md rounded-2xl p-8 border border-gray-700">
                    <div className="text-6xl mb-4">👤</div>
                    <h1 className="text-white text-3xl font-bold mb-4">
                        {authLoading ? 'Loading...' : 'Complete Setup'}
                    </h1>
                    <p className="text-gray-400 mb-8 max-w-md">
                        {authLoading
                            ? 'Checking your profile...'
                            : 'Please complete your profile to start using Meet'
                        }
                    </p>
                    {!authLoading && (
                        <div className="space-y-4">
                            <button
                                onClick={() => navigate('/profile')}
                                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-8 py-4 rounded-xl font-semibold transition-all transform hover:scale-105 block w-full"
                            >
                                Complete Profile
                            </button>
                            <button
                                onClick={refreshUser}
                                className="bg-gray-600 hover:bg-gray-700 text-white px-8 py-4 rounded-xl font-semibold transition-all block w-full"
                            >
                                Refresh Status
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white">
            {/* Header */}
            <header className="bg-gray-900/50 backdrop-blur-md border-b border-gray-800 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-4">
                            <div>
                                <h1 className="text-xl font-bold">Pixeliy</h1>
                                <p className="text-gray-400 text-sm">Welcome back, {user.username}</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-4">
                            <div className="text-sm text-gray-400 bg-gray-800 px-3 py-1 rounded-lg">
                                {principalId.substring(0, 8)}...{principalId.substring(principalId.length - 8)}
                            </div>
                            <button
                                onClick={logout}
                                className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white px-4 py-2 rounded-lg text-sm transition-all"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Error Display */}
                {(authError || roomError) && (
                    <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-6 backdrop-blur-md">
                        <p className="text-red-300">
                            ⚠️ {authError || roomError}
                        </p>
                    </div>
                )}

                {/* Bento Grid Layout */}
                <div className="grid grid-cols-12 gap-6">
                    {/* Create Room - Large Card */}
                    <div className="col-span-12 lg:col-span-6 bg-gradient-to-br from-green-600/20 to-emerald-600/20 rounded-2xl p-6 border border-green-500/30 backdrop-blur-md">
                        <div className="flex items-center space-x-3 mb-4">
                            <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center">
                                <span className="text-2xl">🚀</span>
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold">Create Room</h2>
                                <p className="text-gray-300">Start a new meeting space</p>
                            </div>
                        </div>

                        {!showCreateForm ? (
                            <button
                                onClick={() => setShowCreateForm(true)}
                                className="bg-green-600 hover:bg-green-700 w-full py-4 rounded-xl font-semibold transition-all transform hover:scale-105"
                            >
                                Create New Room
                            </button>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">Room ID</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={roomId}
                                            onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                                            placeholder="Enter room ID"
                                            className="flex-1 px-4 py-3 bg-gray-800/50 rounded-xl border border-gray-600 text-white backdrop-blur-md focus:outline-none focus:border-green-500"
                                            maxLength={20}
                                        />
                                        <button
                                            onClick={generateRandomRoomId}
                                            className="bg-gray-700 hover:bg-gray-600 px-4 py-3 rounded-xl transition-all"
                                            title="Generate random ID"
                                        >
                                            🎲
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-2">
                                        3-20 characters, letters and numbers only
                                    </p>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={handleCreateRoom}
                                        disabled={loading || roomLoading}
                                        className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 py-3 rounded-xl font-semibold transition-all"
                                    >
                                        {loading ? 'Creating...' : 'Create'}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowCreateForm(false);
                                            setRoomId('');
                                        }}
                                        className="bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-xl transition-all"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Join Room - Large Card */}
                    <div className="col-span-12 lg:col-span-6 bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-2xl p-6 border border-blue-500/30 backdrop-blur-md">
                        <div className="flex items-center space-x-3 mb-4">
                            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                                <span className="text-2xl">🚪</span>
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold">Join Room</h2>
                                <p className="text-gray-300">Enter an existing room</p>
                            </div>
                        </div>

                        {!showJoinForm ? (
                            <button
                                onClick={() => setShowJoinForm(true)}
                                className="bg-blue-600 hover:bg-blue-700 w-full py-4 rounded-xl font-semibold transition-all transform hover:scale-105"
                            >
                                Join Existing Room
                            </button>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">Room ID</label>
                                    <input
                                        type="text"
                                        value={roomId}
                                        onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                                        placeholder="Enter room ID to join"
                                        className="w-full px-4 py-3 bg-gray-800/50 rounded-xl border border-gray-600 text-white backdrop-blur-md focus:outline-none focus:border-blue-500"
                                        maxLength={20}
                                    />
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => handleJoinRoom()}
                                        disabled={loading || roomLoading}
                                        className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 py-3 rounded-xl font-semibold transition-all"
                                    >
                                        {loading ? 'Joining...' : 'Join'}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowJoinForm(false);
                                            setRoomId('');
                                        }}
                                        className="bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-xl transition-all"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Featured Hubs */}
                    <div className="col-span-12 lg:col-span-8 bg-gray-800/50 rounded-2xl p-6 border border-gray-700 backdrop-blur-md">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-2xl font-bold">Featured Hubs</h2>
                                <p className="text-gray-400">Popular rooms you can join</p>
                            </div>
                            <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center">
                                <span className="text-xl">⭐</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {featuredHubs.map((hub) => (
                                <div
                                    key={hub.id}
                                    className="bg-gray-700/50 rounded-xl p-4 border border-gray-600 hover:border-purple-500/50 transition-all cursor-pointer group"
                                    onClick={() => handleJoinRoom(hub.id)}
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h3 className="font-semibold text-white group-hover:text-purple-300 transition-colors">
                                                {hub.name}
                                            </h3>
                                            <p className="text-sm text-gray-400">{hub.id}</p>
                                        </div>
                                        <span className="bg-purple-600/20 text-purple-400 px-2 py-1 rounded-lg text-xs">
                                            {hub.type}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2 text-sm text-gray-400">
                                            <span>👥</span>
                                            <span>{hub.participants} participants</span>
                                        </div>
                                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="col-span-12 lg:col-span-4 space-y-4">
                        {/* Active Users */}
                        <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700 backdrop-blur-md">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-lg font-semibold">Active Users</h3>
                                    <p className="text-gray-400 text-sm">Currently online</p>
                                </div>
                                <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
                                    <span className="text-xl">👤</span>
                                </div>
                            </div>
                            <div className="text-3xl font-bold text-green-400">1,247</div>
                            <div className="text-sm text-gray-400">+12% from yesterday</div>
                        </div>

                        {/* Recent Activity */}
                        <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700 backdrop-blur-md">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-lg font-semibold">Recent Activity</h3>
                                    <p className="text-gray-400 text-sm">Last 24 hours</p>
                                </div>
                                <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center">
                                    <span className="text-xl">📊</span>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center space-x-3">
                                    <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                    <span className="text-sm text-gray-300">23 new rooms created</span>
                                </div>
                                <div className="flex items-center space-x-3">
                                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                    <span className="text-sm text-gray-300">156 meetings joined</span>
                                </div>
                                <div className="flex items-center space-x-3">
                                    <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                                    <span className="text-sm text-gray-300">89 collaborations started</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* System Status */}
                    <div className="col-span-12 md:col-span-6 lg:col-span-3 bg-gray-800/50 rounded-2xl p-6 border border-gray-700 backdrop-blur-md">
                        <div className="flex items-center space-x-3 mb-4">
                            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                                <span className="text-xl">⚡</span>
                            </div>
                            <div>
                                <h3 className="font-semibold">System Status</h3>
                                <p className="text-gray-400 text-sm">All systems operational</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                            <span className="text-sm text-green-400">Healthy</span>
                        </div>
                    </div>

                    {/* Storage Usage */}
                    <div className="col-span-12 md:col-span-6 lg:col-span-3 bg-gray-800/50 rounded-2xl p-6 border border-gray-700 backdrop-blur-md">
                        <div className="flex items-center space-x-3 mb-4">
                            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
                                <span className="text-xl">💾</span>
                            </div>
                            <div>
                                <h3 className="font-semibold">Storage</h3>
                                <p className="text-gray-400 text-sm">Usage overview</p>
                            </div>
                        </div>
                        <div className="text-2xl font-bold text-indigo-400">67%</div>
                        <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                            <div className="bg-indigo-400 h-2 rounded-full" style={{ width: '67%' }}></div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="col-span-12 md:col-span-6 lg:col-span-3 bg-gray-800/50 rounded-2xl p-6 border border-gray-700 backdrop-blur-md">
                        <div className="flex items-center space-x-3 mb-4">
                            <div className="w-10 h-10 bg-pink-600 rounded-xl flex items-center justify-center">
                                <span className="text-xl">⚙️</span>
                            </div>
                            <div>
                                <h3 className="font-semibold">Quick Actions</h3>
                                <p className="text-gray-400 text-sm">Manage your account</p>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <button className="w-full bg-gray-700 hover:bg-gray-600 py-2 rounded-lg text-sm transition-all">
                                Settings
                            </button>
                            <button className="w-full bg-gray-700 hover:bg-gray-600 py-2 rounded-lg text-sm transition-all">
                                Support
                            </button>
                        </div>
                    </div>

                    {/* Network Info */}
                    <div className="col-span-12 md:col-span-6 lg:col-span-3 bg-gray-800/50 rounded-2xl p-6 border border-gray-700 backdrop-blur-md">
                        <div className="flex items-center space-x-3 mb-4">
                            <div className="w-10 h-10 bg-cyan-600 rounded-xl flex items-center justify-center">
                                <span className="text-xl">🌐</span>
                            </div>
                            <div>
                                <h3 className="font-semibold">Network</h3>
                                <p className="text-gray-400 text-sm">Connection quality</p>
                            </div>
                        </div>
                        <div className="text-2xl font-bold text-cyan-400">Excellent</div>
                        <div className="text-sm text-gray-400">45ms latency</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;