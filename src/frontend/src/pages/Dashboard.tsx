"use client"

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { InteractiveGridPattern } from '@/components/ui/interactive-grid';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
    Settings, LogOut, Plus, Users, ArrowRight,
    Video, Shield, Globe, Zap, Activity, Bell,
    CheckCircle, AlertTriangle, Edit3, Sparkles,
} from 'lucide-react';
import TargetCursor from '../components/target-cursor';
import SpotlightCard from '../components/spotlight-card';
import { useAuth } from '../contexts/AuthContext';
import { useRoom } from '../hooks/useRoom';
import { useNavigate } from 'react-router-dom';
import LoginRequired from '../components/auth/LoginRequired';
import ProfileSetupRequired from '../components/auth/ProfileSetupRequired';

// Animation variants 
const fadeInUpVariants = {
    initial: { opacity: 0, y: 60 },
    animate: { opacity: 1, y: 0 },
};

const fadeInLeftVariants = {
    initial: { opacity: 0, x: -60 },
    animate: { opacity: 1, x: 0 },
};

const staggerContainerVariants = {
    initial: {},
    animate: {
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.05,
        },
    },
};

const scaleInVariants = {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
};

// Smooth transition settings
const smoothTransition = {
    duration: 0.8,
    ease: "easeOut" as const,
};

const quickTransition = {
    duration: 0.6,
    ease: "easeOut" as const,
};

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
        {
            id: 'PIXELIY',
            name: 'Pixeliy HQ',
            participants: 0,
            type: 'Collaboration',
            status: 'active',
            description: 'Team collaboration and project management',
            tags: ['Work', 'Team', 'Productivity']
        },
        {
            id: 'WCHL',
            name: 'World Computer Hacker League',
            participants: 0,
            type: 'Meeting',
            status: 'active',
            description: 'Weekly sync for global hackers',
            tags: ['Hackathon', 'Hackers', 'Team',]
        },
        {
            id: 'CAFFEINE',
            name: 'Caffeine AI',
            participants: 0,
            type: 'Development',
            status: 'active',
            description: 'AI development and brainstorming',
            tags: ['Code', 'Review', 'Dev']
        },
        {
            id: 'COMMIT',
            name: 'Commit Community',
            participants: 0,
            type: 'Education',
            status: 'active',
            description: 'Learn about blockchain technology together',
            tags: ['Learning', 'Blockchain', 'Tech']
        },
        {
            id: 'MUSIC',
            name: 'Music Lounge',
            participants: 0,
            type: 'Social',
            status: 'active',
            description: 'Chill and chat about music',
            tags: ['Social', 'Chat', 'Networking']
        },
        {
            id: 'WORLD',
            name: 'Global P2P',
            participants: 0,
            type: 'Networking',
            status: 'active',
            description: 'Connect with peers worldwide',
            tags: ['Networking', 'Global', 'Peers']
        }
    ];

    // Dummy live activity logs
    const liveActivities = [
        {
            id: 1,
            type: 'room_created',
            user: 'alex_dev',
            action: 'created room',
            target: 'TECH-TALK-001',
            time: '2 minutes ago',
            icon: Plus,
            color: 'green'
        },
        {
            id: 2,
            type: 'user_joined',
            user: 'sarah_design',
            action: 'joined room',
            target: 'Creative Studio',
            time: '5 minutes ago',
            icon: Users,
            color: 'blue'
        },
        {
            id: 3,
            type: 'room_ended',
            user: 'mike_pm',
            action: 'ended room',
            target: 'Daily Standup',
            time: '12 minutes ago',
            icon: CheckCircle,
            color: 'gray'
        },
        {
            id: 4,
            type: 'user_connected',
            user: 'jenny_marketing',
            action: 'connected to network',
            target: 'Global P2P',
            time: '18 minutes ago',
            icon: Globe,
            color: 'purple'
        },
        {
            id: 5,
            type: 'security_check',
            user: 'system',
            action: 'security scan completed',
            target: 'Network Security',
            time: '25 minutes ago',
            icon: Shield,
            color: 'lime'
        }
    ];

    // Dummy system updates Pixeliy
    const systemUpdates = [
        {
            id: 1,
            type: 'feature',
            title: 'New AI Translation Feature',
            message: 'Real-time language translation now available in all rooms',
            time: '1 hour ago',
            icon: Sparkles,
            color: 'yellow',
            priority: 'high'
        },
        {
            id: 2,
            type: 'improvement',
            title: 'Enhanced Video Quality',
            message: 'Improved video compression for better performance',
            time: '3 hours ago',
            icon: Video,
            color: 'blue',
            priority: 'medium'
        },
        {
            id: 3,
            type: 'security',
            title: 'Security Update',
            message: 'Enhanced encryption protocols deployed',
            time: '6 hours ago',
            icon: Shield,
            color: 'green',
            priority: 'high'
        },
        {
            id: 4,
            type: 'maintenance',
            title: 'Scheduled Maintenance',
            message: 'Network optimization scheduled for tonight 2-4 AM UTC',
            time: '12 hours ago',
            icon: Settings,
            color: 'orange',
            priority: 'low'
        }
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

    const getActivityColor = (color: string) => {
        const colors = {
            green: 'text-green-400 bg-green-400/10',
            blue: 'text-blue-400 bg-blue-400/10',
            gray: 'text-gray-400 bg-gray-400/10',
            purple: 'text-purple-400 bg-purple-400/10',
            lime: 'text-lime-400 bg-lime-400/10',
            yellow: 'text-yellow-400 bg-yellow-400/10',
            orange: 'text-orange-400 bg-orange-400/10'
        };
        return colors[color as keyof typeof colors] || colors.gray;
    };

    const getPriorityColor = (priority: string) => {
        const priorities = {
            high: 'border-red-400/30 bg-red-400/5',
            medium: 'border-yellow-400/30 bg-yellow-400/5',
            low: 'border-blue-400/30 bg-blue-400/5'
        };
        return priorities[priority as keyof typeof priorities] || priorities.low;
    };

    useEffect(() => {
        if (isAuthenticated && !user && !authLoading) {
            refreshUser();
        }
    }, [isAuthenticated, user, authLoading, refreshUser]);

    // Show loading state
    if (authLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center"
                >
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-lime-400 mx-auto mb-6"></div>
                    <div className="text-white text-xl">Loading dashboard...</div>
                </motion.div>
            </div>
        );
    }

    // Show login required
    if (!isAuthenticated) {
        return (
            <LoginRequired
                onLogin={login}
                isLoading={authLoading}
                title="Welcome to Pixeliy Dashboard"
                subtitle="Decentralized Video Communication"
                description="Join or create video rooms, collaborate in real-time, and experience the future of decentralized communication on Internet Computer"
                showFeatures={true}
            />
        );
    }

    // Show registration required
    if (!user || !user.username) {
        return (
            <ProfileSetupRequired
                onComplete={() => navigate('/profile')}
                isLoading={authLoading}
            />
        );
    }

    return (
        <div className="min-h-screen bg-black text-white overflow-x-hidden">
            {/* Target Cursor */}
            <TargetCursor targetSelector=".cursor-target" spinDuration={2} hideDefaultCursor={true} />

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
                        onClick={() => navigate('/')}
                    >
                        <h1 className="font-logo text-2xl text-lime-400 m-0">
                            PIXELIY
                        </h1>
                        <div className="hidden md:block h-6 w-px bg-lime-400/0"></div>
                        <div className="hidden md:block">
                            <p className="text-sm text-gray-400">Welcome back,</p>
                            <p className="text-sm font-semibold text-white">
                                {String(user?.name || '').trim() || String(user?.username || '').trim()}
                            </p>
                        </div>
                    </motion.div>

                    <nav className="hidden lg:flex items-center space-x-6">
                        <span className="text-lime-400 font-medium">Dashboard</span>
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-400 text-sm">
                            {principalId.substring(0, 8)}...{principalId.substring(principalId.length - 8)}
                        </span>
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
                            onClick={() => navigate('/profile')}
                        >
                            <Edit3 className="w-4 h-4 mr-2" />
                            Profile
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="border-red-400/20 text-red-400 hover:bg-red-400/10 cursor-target"
                            onClick={logout}
                        >
                            <LogOut className="w-4 h-4 mr-2" />
                            Logout
                        </Button>
                    </motion.div>
                </div>
            </motion.header>

            {/* Hero Section */}
            <section className="pt-24 pb-8 px-4 relative overflow-hidden">
                {/* Interactive Grid Background */}
                <InteractiveGridPattern
                    className={cn(
                        "[mask-image:radial-gradient(800px_circle_at_center,white,transparent)]",
                        "absolute inset-0 h-full w-full z-0",
                        "fill-lime-500/10 stroke-lime-500/10"
                    )}
                    width={20}
                    height={20}
                    squares={[80, 80]}
                    squaresClassName="hover:fill-lime-500/20"
                />

                {/* Overlay */}
                <div className="absolute inset-0 z-[1] pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/50" />
                    <div className="absolute inset-0 bg-gradient-to-r from-lime-500/5 via-transparent to-green-500/5" />
                </div>

                <div className="container mx-auto text-center relative z-10">
                    <motion.div
                        variants={fadeInUpVariants}
                        initial="initial"
                        animate="animate"
                        transition={smoothTransition}
                    >
                        <Badge className="mb-4 bg-lime-400/10 text-lime-400 border-lime-400/20 cursor-target">
                            <Activity className="w-4 h-4 mr-2" />
                            Your Command Center
                        </Badge>
                    </motion.div>

                    <motion.h1
                        className="text-3xl md:text-4xl font-bold mb-4 text-white"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                    >
                        Ready to Connect, <span className="text-lime-400">{String(user?.name || '').trim() || String(user?.username || '').trim()}</span>?
                    </motion.h1>

                    <motion.p
                        className="text-lg text-gray-300 mb-6 max-w-2xl mx-auto"
                        variants={fadeInUpVariants}
                        initial="initial"
                        animate="animate"
                        transition={{ ...smoothTransition, delay: 0.4 }}
                    >
                        Create rooms, join conversations, and experience decentralized communication at its finest
                    </motion.p>
                </div>
            </section>

            {/* Error Display */}
            {(authError || roomError) && (
                <motion.div
                    className="container mx-auto px-4 mb-6"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 backdrop-blur-md">
                        <p className="text-red-300 flex items-center">
                            <AlertTriangle className="w-5 h-5 mr-2" />
                            {authError || roomError}
                        </p>
                    </div>
                </motion.div>
            )}

            {/* Main Content */}
            <section className="py-8 px-4">
                <div className="container mx-auto">
                    {/* Quick Actions */}
                    <motion.div
                        className="grid lg:grid-cols-2 gap-8 mb-12"
                        variants={staggerContainerVariants}
                        initial="initial"
                        animate="animate"
                    >
                        {/* Create Room */}
                        <motion.div variants={scaleInVariants} transition={quickTransition}>
                            <SpotlightCard spotlightColor="rgba(34, 197, 94, 0.3)">
                                <div className="p-6">
                                    <div className="flex items-center space-x-4 mb-6">
                                        <div className="w-14 h-14 bg-green-400/20 rounded-2xl flex items-center justify-center">
                                            <Plus className="h-7 w-7 text-green-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-bold text-green-400">Create Room</h3>
                                            <p className="text-gray-300">Start a new meeting space</p>
                                        </div>
                                    </div>

                                    {!showCreateForm ? (
                                        <Button
                                            onClick={() => setShowCreateForm(true)}
                                            className="w-full bg-green-400 text-black hover:bg-green-500 py-4 text-lg font-semibold cursor-target"
                                        >
                                            <Plus className="w-5 h-5 mr-2" />
                                            Create New Room
                                        </Button>
                                    ) : (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-2 text-green-300">Room ID</label>
                                                <div className="flex gap-2">
                                                    <Input
                                                        type="text"
                                                        value={roomId}
                                                        onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                                                        placeholder="Enter room ID"
                                                        className="flex-1 bg-gray-800/50 border-gray-600 text-white cursor-target"
                                                        maxLength={20}
                                                    />
                                                    <Button
                                                        onClick={generateRandomRoomId}
                                                        variant="outline"
                                                        className="border-gray-600 text-gray-300 hover:bg-gray-700 cursor-target"
                                                        title="Generate random ID"
                                                    >
                                                        🎲
                                                    </Button>
                                                </div>
                                                <p className="text-xs text-gray-400 mt-2">
                                                    3-20 characters, letters and numbers only
                                                </p>
                                            </div>

                                            <div className="flex gap-3">
                                                <Button
                                                    onClick={handleCreateRoom}
                                                    disabled={loading || roomLoading}
                                                    className="flex-1 bg-green-400 text-black hover:bg-green-500 cursor-target"
                                                >
                                                    {loading ? 'Creating...' : 'Create'}
                                                </Button>
                                                <Button
                                                    onClick={() => {
                                                        setShowCreateForm(false);
                                                        setRoomId('');
                                                    }}
                                                    variant="outline"
                                                    className="border-gray-600 text-gray-300 hover:bg-gray-700 cursor-target"
                                                >
                                                    Cancel
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </SpotlightCard>
                        </motion.div>

                        {/* Join Room */}
                        <motion.div variants={scaleInVariants} transition={quickTransition}>
                            <SpotlightCard spotlightColor="rgba(59, 130, 246, 0.3)">
                                <div className="p-6">
                                    <div className="flex items-center space-x-4 mb-6">
                                        <div className="w-14 h-14 bg-blue-400/20 rounded-2xl flex items-center justify-center">
                                            <Users className="h-7 w-7 text-blue-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-bold text-blue-400">Join Room</h3>
                                            <p className="text-gray-300">Enter an existing room</p>
                                        </div>
                                    </div>

                                    {!showJoinForm ? (
                                        <Button
                                            onClick={() => setShowJoinForm(true)}
                                            className="w-full bg-blue-400 text-black hover:bg-blue-500 py-4 text-lg font-semibold cursor-target"
                                        >
                                            <Users className="w-5 h-5 mr-2" />
                                            Join Existing Room
                                        </Button>
                                    ) : (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-2 text-blue-300">Room ID</label>
                                                <Input
                                                    type="text"
                                                    value={roomId}
                                                    onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                                                    placeholder="Enter room ID to join"
                                                    className="w-full bg-gray-800/50 border-gray-600 text-white cursor-target"
                                                    maxLength={20}
                                                />
                                            </div>

                                            <div className="flex gap-3">
                                                <Button
                                                    onClick={() => handleJoinRoom()}
                                                    disabled={loading || roomLoading}
                                                    className="flex-1 bg-blue-400 text-black hover:bg-blue-500 cursor-target"
                                                >
                                                    {loading ? 'Joining...' : 'Join Room'}
                                                </Button>
                                                <Button
                                                    onClick={() => {
                                                        setShowJoinForm(false);
                                                        setRoomId('');
                                                    }}
                                                    variant="outline"
                                                    className="border-gray-600 text-gray-300 hover:bg-gray-700 cursor-target"
                                                >
                                                    Cancel
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </SpotlightCard>
                        </motion.div>
                    </motion.div>

                    {/* Main Dashboard Content */}
                    <div className="grid lg:grid-cols-3 gap-8">
                        {/* Left Column - Featured Hubs + Shop */}
                        <motion.div
                            className="lg:col-span-2 space-y-8"
                            variants={fadeInLeftVariants}
                            initial="initial"
                            animate="animate"
                            transition={smoothTransition}
                        >
                            {/* Featured Hubs */}
                            <Card className="bg-gray-900/50 border-lime-400/20 backdrop-blur-md cursor-target">
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-10 h-10 bg-purple-400/20 rounded-lg flex items-center justify-center">
                                                <Sparkles className="h-6 w-6 text-purple-400" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-xl text-white">Featured Hubs</CardTitle>
                                                <p className="text-gray-400 text-sm">Popular rooms you can join</p>
                                            </div>
                                        </div>
                                        <Badge className="bg-purple-400/10 text-purple-400 border-purple-400/20">
                                            {featuredHubs.length} Active
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <div className="grid md:grid-cols-2 gap-4">
                                        {featuredHubs.map((hub) => (
                                            <motion.div
                                                key={hub.id}
                                                className="bg-gray-800/50 rounded-xl p-4 border border-gray-600/50 hover:border-purple-400/50 transition-all cursor-pointer group"
                                                onClick={() => handleJoinRoom(hub.id)}
                                                whileHover={{ scale: 1.02, y: -2 }}
                                                transition={{ type: "spring", stiffness: 300 }}
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                            >
                                                <div className="flex items-start justify-between mb-3">
                                                    <div>
                                                        <h4 className="font-semibold text-white group-hover:text-purple-400 transition-colors">
                                                            {hub.name}
                                                        </h4>
                                                        <p className="text-xs text-gray-400">{hub.id}</p>
                                                    </div>
                                                    <div className="flex items-center space-x-1 text-xs">
                                                        <Users className="w-3 h-3 text-gray-400" />
                                                        <span className="text-gray-400">{hub.participants}</span>
                                                    </div>
                                                </div>

                                                <p className="text-sm text-gray-300 mb-3">{hub.description}</p>

                                                <div className="flex items-center justify-between">
                                                    <div className="flex flex-wrap gap-1">
                                                        {hub.tags.slice(0, 2).map((tag, tagIndex) => (
                                                            <span
                                                                key={tagIndex}
                                                                className="px-2 py-1 bg-gray-700/50 text-xs text-gray-300 rounded-md cursor-target"
                                                            >
                                                                {tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <Badge variant="outline" className="text-xs border-green-400/30 text-green-400">
                                                            {hub.type}
                                                        </Badge>
                                                        <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-purple-400 transition-colors" />
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Shop Coming Soon - Bento Grid Style */}
                            <motion.div
                                initial={{ opacity: 0, y: 40 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.8, delay: 0.6 }}
                            >
                                <Card className="bg-gradient-to-br from-orange-900/20 via-yellow-900/20 to-amber-900/20 border-orange-400/30 backdrop-blur-md overflow-hidden relative cursor-target">
                                    {/* Animated Background Elements */}
                                    <div className="absolute inset-0 opacity-10">
                                        <div className="absolute top-4 right-4 w-32 h-32 bg-gradient-to-br from-orange-400 to-yellow-400 rounded-full blur-3xl animate-pulse"></div>
                                        <div className="absolute bottom-4 left-4 w-24 h-24 bg-gradient-to-br from-yellow-400 to-amber-400 rounded-full blur-2xl animate-pulse delay-1000"></div>
                                    </div>

                                    <CardHeader className="relative z-10">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-12 h-12 bg-gradient-to-br from-orange-400/20 to-yellow-400/20 rounded-xl flex items-center justify-center border border-orange-400/30">
                                                    <motion.div
                                                        animate={{ rotate: [0, 10, -10, 0] }}
                                                        transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
                                                    >
                                                        🛒
                                                    </motion.div>
                                                </div>
                                                <div>
                                                    <CardTitle className="text-2xl text-transparent bg-gradient-to-r from-orange-400 via-yellow-400 to-amber-400 bg-clip-text">
                                                        Marketplace
                                                    </CardTitle>
                                                    <p className="text-orange-300/80 text-sm">Digital assets & premium features</p>
                                                </div>
                                            </div>
                                            <Badge className="bg-gradient-to-r from-orange-500/20 to-yellow-500/20 text-orange-300 border-orange-400/30 animate-pulse">
                                                Coming Soon
                                            </Badge>
                                        </div>
                                    </CardHeader>

                                    <CardContent className="p-6 relative z-10">
                                        {/* Bento Grid Layout */}
                                        <div className="grid grid-cols-4 grid-rows-3 gap-3 h-64">
                                            {/* Large Featured Item - Premium Avatars */}
                                            <motion.div
                                                className="col-span-2 row-span-2 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-400/30 rounded-xl p-4 flex flex-col justify-between cursor-pointer group relative overflow-hidden"
                                                whileHover={{ scale: 1.02, y: -2 }}
                                                transition={{ type: "spring", stiffness: 300 }}
                                            >
                                                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                                <div className="relative z-10">
                                                    <h4 className="font-semibold text-white text-sm mb-1">Premium Avatars</h4>
                                                    <p className="text-xs text-gray-400">Custom AI avatars for your identity</p>
                                                </div>
                                                <div className="relative z-10">
                                                    <Badge variant="outline" className="text-xs border-purple-400/30 text-purple-400">
                                                        Digital Assets
                                                    </Badge>
                                                </div>
                                            </motion.div>

                                            {/* Room Themes */}
                                            <motion.div
                                                className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-400/30 rounded-xl p-3 flex flex-col justify-between cursor-pointer group"
                                                whileHover={{ scale: 1.02, y: -2 }}
                                                transition={{ type: "spring", stiffness: 300 }}
                                            >
                                                <div>
                                                    <h4 className="font-medium text-white text-xs mb-1">Room Themes</h4>
                                                    <p className="text-xs text-gray-400">Custom backgrounds</p>
                                                </div>
                                            </motion.div>

                                            {/* AI Voice Packs */}
                                            <motion.div
                                                className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-400/30 rounded-xl p-3 flex flex-col justify-between cursor-pointer group"
                                                whileHover={{ scale: 1.02, y: -2 }}
                                                transition={{ type: "spring", stiffness: 300 }}
                                            >
                                                <div>
                                                    <h4 className="font-medium text-white text-xs mb-1">Voice Packs</h4>
                                                    <p className="text-xs text-gray-400">AI voice effects</p>
                                                </div>
                                            </motion.div>

                                            {/* Premium Features */}
                                            <motion.div
                                                className="col-span-2 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-400/30 rounded-xl p-3 flex items-center space-x-3 cursor-pointer group"
                                                whileHover={{ scale: 1.02, y: -2 }}
                                                transition={{ type: "spring", stiffness: 300 }}
                                            >
                                                <div className="text-xl">⭐</div>
                                                <div>
                                                    <h4 className="font-medium text-white text-sm">Premium Features</h4>
                                                    <p className="text-xs text-gray-400">Enhanced capabilities & tools</p>
                                                </div>
                                            </motion.div>

                                            {/* NFT Collectibles */}
                                            <motion.div
                                                className="bg-gradient-to-br from-pink-500/10 to-rose-500/10 border border-pink-400/30 rounded-xl p-3 flex flex-col justify-between cursor-pointer group"
                                                whileHover={{ scale: 1.02, y: -2 }}
                                                transition={{ type: "spring", stiffness: 300 }}
                                            >
                                                <div>
                                                    <h4 className="font-medium text-white text-xs mb-1">NFT Items</h4>
                                                    <p className="text-xs text-gray-400">Collectible assets</p>
                                                </div>
                                            </motion.div>

                                            {/* Subscription Plans */}
                                            <motion.div
                                                className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-400/30 rounded-xl p-3 flex flex-col justify-between cursor-pointer group"
                                                whileHover={{ scale: 1.02, y: -2 }}
                                                transition={{ type: "spring", stiffness: 300 }}
                                            >
                                                <div>
                                                    <h4 className="font-medium text-white text-xs mb-1">Pro Plans</h4>
                                                    <p className="text-xs text-gray-400">Monthly subscriptions</p>
                                                </div>
                                            </motion.div>
                                        </div>

                                        {/* Coming Soon Message */}
                                        <motion.div
                                            className="mt-6 text-center cursor-target"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: 1 }}
                                        >
                                            <div className="bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-400/30 rounded-xl p-4">
                                                <div className="flex items-center justify-center space-x-3 mb-3">
                                                    <motion.div
                                                        animate={{ scale: [1, 1.1, 1] }}
                                                        transition={{ duration: 2, repeat: Infinity }}
                                                        className="text-2xl"
                                                    >
                                                        ⏰
                                                    </motion.div>
                                                    <h3 className="text-lg font-semibold text-transparent bg-gradient-to-r from-orange-400 to-yellow-400 bg-clip-text">
                                                        Launching Soon
                                                    </h3>
                                                </div>
                                                <p className="text-orange-300/80 text-sm mb-4">
                                                    Get ready for premium digital assets, custom themes, and exclusive features powered by Internet Computer
                                                </p>
                                                <div className="flex items-center justify-center space-x-4">
                                                    <Badge variant="outline" className="border-orange-400/30 text-orange-300">
                                                        Q3 2025
                                                    </Badge>
                                                    <Badge variant="outline" className="border-yellow-400/30 text-yellow-300">
                                                        IC-Powered
                                                    </Badge>
                                                    <Badge variant="outline" className="border-purple-400/30 text-purple-300">
                                                        NFT Ready
                                                    </Badge>
                                                </div>
                                            </div>
                                        </motion.div>
                                    </CardContent>

                                    {/* Decorative Elements */}
                                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-yellow-400/20 to-transparent rounded-bl-full"></div>
                                    <div className="absolute bottom-0 left-0 w-16 h-16 bg-gradient-to-tr from-orange-400/20 to-transparent rounded-tr-full"></div>
                                </Card>
                            </motion.div>
                        </motion.div>

                        {/* Right Sidebar */}
                        <motion.div
                            className="space-y-6"
                            initial={{ opacity: 0, x: 60 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.6, delay: 0.3 }}
                        >
                            {/* Live Activity */}
                            <Card className="bg-gray-900/50 border-lime-400/20 backdrop-blur-md">
                                <CardHeader>
                                    <div className="flex items-center space-x-3">
                                        <div className="w-8 h-8 bg-green-400/20 rounded-lg flex items-center justify-center">
                                            <Activity className="h-5 w-5 text-green-400" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg text-white">Live Activity</CardTitle>
                                            <p className="text-gray-400 text-xs">Real-time network updates</p>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-4">
                                    <div className="space-y-3 max-h-64 overflow-y-auto overflow-x-hidden scrollbar-hidden">
                                        {liveActivities.map((activity, index) => (
                                            <motion.div
                                                key={activity.id}
                                                className="flex items-start space-x-3 p-2 rounded-lg hover:bg-gray-800/30 transition-colors cursor-target"
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: index * 0.05 }}
                                            >
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getActivityColor(activity.color)}`}>
                                                    <activity.icon className="w-4 h-4" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm text-white">
                                                        <span className="font-medium">{activity.user}</span>
                                                        <span className="text-gray-400 mx-1">{activity.action}</span>
                                                        <span className="text-lime-400">{activity.target}</span>
                                                    </p>
                                                    <p className="text-xs text-gray-500">{activity.time}</p>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* System Updates */}
                            <Card className="bg-gray-900/50 border-lime-400/20 backdrop-blur-md">
                                <CardHeader>
                                    <div className="flex items-center space-x-3">
                                        <div className="w-8 h-8 bg-blue-400/20 rounded-lg flex items-center justify-center">
                                            <Bell className="h-5 w-5 text-blue-400" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg text-white">System Updates</CardTitle>
                                            <p className="text-gray-400 text-xs">Latest from Pixeliy</p>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-4">
                                    <div className="space-y-3 max-h-64 overflow-y-auto overflow-x-hidden scrollbar-hidden">
                                        {systemUpdates.map((update, index) => (
                                            <motion.div
                                                key={update.id}
                                                className={`p-3 rounded-lg border ${getPriorityColor(update.priority)} cursor-target`}
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: index * 0.1 }}
                                                whileHover={{ scale: 1.02 }}
                                            >
                                                <div className="flex items-start space-x-3">
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${getActivityColor(update.color)}`}>
                                                        <update.icon className="w-3 h-3" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="text-sm font-medium text-white">{update.title}</h4>
                                                        <p className="text-xs text-gray-400 mt-1">{update.message}</p>
                                                        <div className="flex items-center justify-between mt-2">
                                                            <p className="text-xs text-gray-500">{update.time}</p>
                                                            <Badge variant="outline" className={`text-xs ${update.priority === 'high' ? 'border-red-400/30 text-red-400' :
                                                                update.priority === 'medium' ? 'border-yellow-400/30 text-yellow-400' :
                                                                    'border-blue-400/30 text-blue-400'
                                                                }`}>
                                                                {update.priority}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Quick Stats */}
                            <Card className="bg-gray-900/50 border-lime-400/20 backdrop-blur-md cursor-target">
                                <CardHeader>
                                    <div className="flex items-center space-x-3">
                                        <div className="w-8 h-8 bg-lime-400/20 rounded-lg flex items-center justify-center">
                                            <Zap className="h-5 w-5 text-lime-400" />
                                        </div>
                                        <CardTitle className="text-lg text-white">Network Status</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-4">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-400">Connection</span>
                                            <div className="flex items-center space-x-2">
                                                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                                <span className="text-sm text-green-400 font-medium">Excellent</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-400">Active Users</span>
                                            <span className="text-sm text-white font-medium">1,247</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-400">Active Rooms</span>
                                            <span className="text-sm text-white font-medium">89</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-400">Latency</span>
                                            <span className="text-sm text-white font-medium">10ms</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <motion.footer
                className="py-8 px-4 border-t border-lime-400/20 mt-12"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
            >
                <div className="container mx-auto">
                    <div className="grid md:grid-cols-4 gap-8">
                        <div>
                            <h3 className="font-logo text-xl text-lime-400 mb-4 cursor-target">
                                PIXELIY
                            </h3>
                            <p className="text-gray-400 text-sm mb-4">
                                Decentralized real-time communication platform built on Internet Computer.
                            </p>
                        </div>

                        <div>
                            <h3 className="font-semibold text-white mb-4">Quick Actions</h3>
                            <ul className="space-y-2 text-gray-400 text-sm">
                                <li><a href="#" className="hover:text-lime-400 transition-colors cursor-target">Create Room</a></li>
                                <li><a href="#" className="hover:text-lime-400 transition-colors cursor-target">Join Room</a></li>
                                <li><a href="#" className="hover:text-lime-400 transition-colors cursor-target">Browse Hubs</a></li>
                                <li><a href="/profile" className="hover:text-lime-400 transition-colors cursor-target">Edit Profile</a></li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="font-semibold text-white mb-4">Features</h3>
                            <ul className="space-y-2 text-gray-400 text-sm">
                                <li><a href="#" className="hover:text-lime-400 transition-colors cursor-target">Video Calling</a></li>
                                <li><a href="#" className="hover:text-lime-400 transition-colors cursor-target">AI Translation</a></li>
                                <li><a href="#" className="hover:text-lime-400 transition-colors cursor-target">P2P Network</a></li>
                                <li><a href="#" className="hover:text-lime-400 transition-colors cursor-target">Privacy First</a></li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="font-semibold text-white mb-4">Support</h3>
                            <ul className="space-y-2 text-gray-400 text-sm">
                                <li><a href="#" className="hover:text-lime-400 transition-colors cursor-target">Documentation</a></li>
                                <li><a href="#" className="hover:text-lime-400 transition-colors cursor-target">Community</a></li>
                                <li><a href="#" className="hover:text-lime-400 transition-colors cursor-target">Help Center</a></li>
                                <li><a href="#" className="hover:text-lime-400 transition-colors cursor-target">Contact</a></li>
                            </ul>
                        </div>
                    </div>

                    <div className="border-t border-lime-400/20 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
                        <p className="text-gray-400 text-sm">© 2025 Pixeliy. Built on Internet Computer Protocol.</p>
                        <div className="flex space-x-6 mt-4 md:mt-0">
                            <a href="#" className="text-gray-400 hover:text-lime-400 transition-colors text-sm cursor-target">Privacy Policy</a>
                            <a href="#" className="text-gray-400 hover:text-lime-400 transition-colors text-sm cursor-target">Terms of Service</a>
                            <a href="#" className="text-gray-400 hover:text-lime-400 transition-colors text-sm cursor-target">Network Status</a>
                        </div>
                    </div>
                </div>
            </motion.footer>
        </div>
    );
};

export default Dashboard;