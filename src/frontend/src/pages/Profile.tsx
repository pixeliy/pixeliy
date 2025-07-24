"use client"

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { InteractiveGridPattern } from '@/components/ui/interactive-grid';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
    User, Shield, Settings, UserCheck, ArrowRight,
    Edit3, Save, LogOut, Home, Play,
    CheckCircle, Eye, X, Camera,
} from 'lucide-react';
import TargetCursor from '../components/target-cursor';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

// Animation variants 
const fadeInUpVariants = {
    initial: { opacity: 0, y: 60 },
    animate: { opacity: 1, y: 0 },
};

const fadeInLeftVariants = {
    initial: { opacity: 0, x: -60 },
    animate: { opacity: 1, x: 0 },
};

// Smooth transition settings
const smoothTransition = {
    duration: 0.8,
    ease: "easeOut" as const,
};

const Profile: React.FC = () => {
    const navigate = useNavigate();

    const {
        isAuthenticated,
        user,
        principalId,
        login,
        logout,
        authenticateUser,
        updateProfile,
        whoami,
        checkUserExists,
        refreshUser,
        isLoading: authLoading,
        error: authError
    } = useAuth();

    // Form states
    const [username, setUsername] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [profilePicture, setProfilePicture] = useState('');

    // UI states
    const [isEditing, setIsEditing] = useState(false);
    const [whoamiResult, setWhoamiResult] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [userExists, setUserExists] = useState<boolean | null>(null);
    const [updateSuccess, setUpdateSuccess] = useState(false);

    // Setup steps
    const setupSteps = [
        { id: 1, title: "Identity Verification", completed: isAuthenticated, icon: Shield },
        { id: 2, title: "Profile Creation", completed: userExists === true, icon: User },
    ];

    // Profile stats
    const profileStats = [
        { label: "Status", value: isAuthenticated ? "Online" : "Offline", color: isAuthenticated ? "lime" : "red" },
        { label: "Security", value: "Enterprise", color: "lime" },
        { label: "Network", value: "Internet Computer", color: "blue" },
        { label: "Privacy", value: "Maximum", color: "purple" },
    ];

    useEffect(() => {
        if (isAuthenticated && !authLoading) {
            checkUserExistence();
        }
    }, [isAuthenticated, authLoading, user]);

    useEffect(() => {
        if (user) {
            setUsername(user.username || '');
            setDisplayName(user.name || '');
            setProfilePicture(user.profilePicture || '');
        }
    }, [user]);

    const checkUserExistence = async () => {
        setLoading(true);
        try {
            if (user && user.username) {
                setUserExists(true);
                return;
            }
            const exists = await checkUserExists();
            setUserExists(exists);
        } catch (error) {
            console.error('Error checking user existence:', error);
            setUserExists(false);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateProfile = async () => {
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
                await refreshUser();
            }
        } catch (error) {
            console.error('Auth error:', error);
            alert('Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateProfile = async () => {
        setLoading(true);
        try {
            // Safe string handling with type checks
            const safeUsername = typeof username === 'string' ? username.trim() : '';
            const safeDisplayName = typeof displayName === 'string' ? displayName.trim() : '';
            const safeProfilePicture = typeof profilePicture === 'string' ? profilePicture.trim() : '';

            const updateData: any = {
                username: safeUsername !== '' ? [safeUsername] : [],
                name: safeDisplayName !== '' ? [safeDisplayName] : [],
                profilePicture: safeProfilePicture !== '' ? [safeProfilePicture] : []
            };

            const result = await updateProfile(updateData);
            if ('Err' in result) {
                alert(`Error: ${result.Err}`);
            } else {
                setUpdateSuccess(true);
                setIsEditing(false);
                await refreshUser();
                setTimeout(() => setUpdateSuccess(false), 3000);
            }
        } catch (error) {
            console.error('Update error:', error);
            alert('Profile update failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
            setLoading(false);
        }
    };

    const handleCancelEdit = () => {
        if (user) {
            setUsername(user.username || '');
            setDisplayName(user.name || '');
            setProfilePicture(user.profilePicture || '');
        }
        setIsEditing(false);
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
            console.error('Whoami error:', error);
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
            console.error('Login error:', error);
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
            <div className="min-h-screen bg-black flex items-center justify-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center"
                >
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-lime-400 mx-auto mb-6"></div>
                    <div className="text-white text-xl">Loading authentication...</div>
                </motion.div>
            </div>
        );
    }

    // Not authenticated state
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-black text-white overflow-hidden relative">
                {/* Target Cursor */}
                <TargetCursor targetSelector=".cursor-target" spinDuration={2} hideDefaultCursor={true} />

                {/* Interactive Grid Background */}
                <InteractiveGridPattern
                    className={cn(
                        "[mask-image:radial-gradient(1000px_circle_at_center,white,transparent)]",
                        "absolute inset-0 h-full w-full z-10",
                        "fill-lime-500/15 stroke-lime-500/15"
                    )}
                    width={20}
                    height={20}
                    squares={[100, 100]}
                    squaresClassName="hover:fill-lime-500 transition-all duration-300"
                />

                {/* Overlay */}
                <div className="absolute inset-0 z-[1] pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/50" />
                    <div className="absolute inset-0 bg-gradient-to-r from-lime-500/3 via-transparent to-green-500/3" />
                </div>

                {/* Main Content */}
                <div className="relative z-20 flex items-center justify-center min-h-screen px-4">
                    <motion.div
                        className="max-w-md w-full"
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <div className="bg-gray-800/20 backdrop-blur-md rounded-2xl p-8 border border-lime-400/20 text-center">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                                className="w-20 h-20 bg-lime-400/10 rounded-2xl flex items-center justify-center mx-auto mb-6 cursor-target"
                            >
                                <Shield className="h-10 w-10 text-lime-400" />
                            </motion.div>

                            <h1 className="text-white text-3xl font-bold mb-4">Access Required</h1>
                            <p className="text-gray-400 mb-8">Connect with Internet Identity to continue</p>

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
                                <Button
                                    onClick={handleLogin}
                                    disabled={loading}
                                    className="w-full bg-lime-400 text-black hover:bg-lime-500 cursor-target"
                                >
                                    {loading ? (
                                        <div className="flex items-center justify-center space-x-2">
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div>
                                            <span>Connecting...</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center space-x-2">
                                            <Shield className="w-4 h-4" />
                                            <span>Connect Identity</span>
                                            <ArrowRight className="w-4 h-4" />
                                        </div>
                                    )}
                                </Button>

                                <Button
                                    onClick={handleBackToHome}
                                    variant="outline"
                                    className="w-full border-lime-400/20 text-lime-400 hover:bg-lime-400/10 cursor-target"
                                >
                                    <Home className="w-4 h-4 mr-2" />
                                    Back to Home
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        );
    }

    // Main authenticated view
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
                        className="flex items-center space-x-2 cursor-target"
                        whileHover={{ scale: 1.05 }}
                        transition={{ type: "spring", stiffness: 400, damping: 17 }}
                        onClick={handleBackToHome}
                    >
                        <h1 className="font-logo text-2xl text-lime-400 m-0">
                            PIXELIY
                        </h1>
                    </motion.div>
                    <nav className="hidden md:flex items-center space-x-8">
                        <span className="text-lime-400 font-medium">Profile Setup</span>
                    </nav>
                    <motion.div
                        className="flex items-center space-x-4"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        <Button
                            variant="outline"
                            className="border-lime-400/20 text-lime-400 hover:bg-lime-400/10 cursor-target"
                            onClick={handleGoToDashboard}
                        >
                            <Play className="w-4 h-4 mr-2" />
                            Dashboard
                        </Button>
                    </motion.div>
                </div>
            </motion.header>

            {/* Hero Section */}
            <section className="pt-24 pb-12 px-4 relative overflow-hidden">
                {/* Interactive Grid Background */}
                <InteractiveGridPattern
                    className={cn(
                        "[mask-image:radial-gradient(1000px_circle_at_center,white,transparent)]",
                        "absolute inset-0 h-full w-full z-0",
                        "fill-lime-500/15 stroke-lime-500/15"
                    )}
                    width={20}
                    height={20}
                    squares={[100, 100]}
                    squaresClassName="hover:fill-lime-500"
                />

                {/* Overlay */}
                <div className="absolute inset-0 z-[1] pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/50" />
                    <div className="absolute inset-0 bg-gradient-to-r from-lime-500/3 via-transparent to-green-500/3" />
                </div>

                <div className="container mx-auto text-center relative z-10">
                    <motion.div
                        variants={fadeInUpVariants}
                        initial="initial"
                        animate="animate"
                        transition={smoothTransition}
                    >
                        <Badge className="mb-6 bg-lime-400/10 text-lime-400 border-lime-400/20 cursor-target">
                            Character Management
                        </Badge>
                    </motion.div>

                    <motion.h1
                        className="font-logo text-4xl md:text-5xl mb-4 text-lime-400 cursor-target"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                    >
                        YOUR DIGITAL IDENTITY
                    </motion.h1>

                    <motion.p
                        className="text-lg text-gray-300 mb-2 max-w-xl mx-auto"
                        variants={fadeInUpVariants}
                        initial="initial"
                        animate="animate"
                        transition={{ ...smoothTransition, delay: 0.4 }}
                    >
                        Manage your profile and unlock the full potential of decentralized communication
                    </motion.p>
                </div>
            </section>

            {/* Main Content - Clean Layout */}
            <section className="py-8 px-4">
                <div className="container mx-auto max-w-6xl">
                    {/* Success Message */}
                    {updateSuccess && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-6 bg-green-500/20 border border-green-500/50 rounded-xl p-4 text-center"
                        >
                            <p className="text-green-300">Profile updated successfully!</p>
                        </motion.div>
                    )}

                    <div className="grid lg:grid-cols-3 gap-8">
                        {/* Profile Card */}
                        <motion.div
                            className="lg:col-span-1"
                            variants={fadeInLeftVariants}
                            initial="initial"
                            animate="animate"
                            transition={smoothTransition}
                        >
                            <Card className="bg-gray-900/50 border-lime-400/20 backdrop-blur-md">
                                <CardContent className="p-6">
                                    {/* Avatar */}
                                    <div className="text-center mb-6">
                                        <motion.div
                                            className="w-24 h-24 bg-gradient-to-br from-lime-400/20 to-green-400/20 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-lime-400/30 cursor-target relative"
                                            whileHover={{ scale: 1.05 }}
                                        >
                                            {String(profilePicture || '').trim() ? (
                                                <img
                                                    src={profilePicture}
                                                    alt="Profile"
                                                    className="w-full h-full rounded-full object-cover"
                                                />
                                            ) : (
                                                <User className="h-12 w-12 text-lime-400" />
                                            )}
                                            {isEditing && (
                                                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                                                    <Camera className="h-6 w-6 text-white" />
                                                </div>
                                            )}
                                        </motion.div>

                                        <h3 className="text-xl font-bold text-white mb-1">
                                            {user?.name || user?.username || 'Anonymous'}
                                        </h3>
                                        <Badge className="bg-lime-400/10 text-lime-400 border-lime-400/20">
                                            Level {userExists ? '1' : '0'}
                                        </Badge>
                                    </div>

                                    {/* Quick Stats */}
                                    <div className="grid grid-cols-2 gap-3 mb-6">
                                        {profileStats.map((stat, index) => (
                                            <div
                                                key={index}
                                                className="bg-gray-800/30 rounded-lg p-3 cursor-target"
                                            >
                                                <div className={`text-xs text-${stat.color}-400 font-medium mb-1`}>
                                                    {stat.label}
                                                </div>
                                                <div className="text-sm font-semibold text-white">
                                                    {stat.value}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Principal ID */}
                                    <div className="bg-gray-800/30 rounded-lg p-3 mb-6">
                                        <div className="text-xs text-gray-400 mb-1">Principal ID</div>
                                        <div className="font-mono text-xs text-lime-400 break-all">
                                            {principalId.substring(0, 20)}...
                                        </div>
                                    </div>

                                    {/* Quick Actions */}
                                    <div className="space-y-2">
                                        <Button
                                            onClick={handleWhoami}
                                            disabled={loading}
                                            variant="outline"
                                            size="sm"
                                            className="w-full border-lime-400/20 text-lime-400 hover:bg-lime-400/10 cursor-target"
                                        >
                                            <Eye className="w-4 h-4 mr-2" />
                                            Principal ID
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Principal ID Result */}
                            {whoamiResult && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mt-4"
                                >
                                    <Card className="bg-gray-900/50 border-lime-400/20">
                                        <CardContent className="p-4">
                                            <div className="text-xs text-gray-400 mb-2">Principal ID:</div>
                                            <div className="font-mono text-xs text-lime-400 break-all">
                                                {whoamiResult}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            )}
                        </motion.div>

                        {/* Main Content */}
                        <motion.div
                            className="lg:col-span-2"
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.6 }}
                        >
                            {/* Setup Progress */}
                            <Card className="bg-gray-900/50 border-lime-400/20 backdrop-blur-md mb-6">
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-10 h-10 bg-lime-400/10 rounded-lg flex items-center justify-center">
                                                <Settings className="h-5 w-5 text-lime-400" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-white">Setup Progress</h3>
                                                <p className="text-gray-400 text-sm">Complete all steps to unlock full access</p>
                                            </div>
                                        </div>
                                        <div className="text-lime-400 text-sm font-medium">
                                            {setupSteps.filter(step => step.completed).length}/{setupSteps.length}
                                        </div>
                                    </div>

                                    <div className="grid md:grid-cols-2 gap-4">
                                        {setupSteps.map((step, index) => (
                                            <motion.div
                                                key={step.id}
                                                className={`flex items-center space-x-3 p-3 rounded-lg border cursor-target ${step.completed
                                                    ? 'bg-lime-400/5 border-lime-400/20'
                                                    : 'bg-gray-800/20 border-gray-600/20'
                                                    }`}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: index * 0.1 }}
                                                whileHover={{ scale: 1.02 }}
                                            >
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${step.completed
                                                    ? 'bg-lime-400/20 text-lime-400'
                                                    : 'bg-gray-600/20 text-gray-400'
                                                    }`}>
                                                    {step.completed ? (
                                                        <CheckCircle className="h-4 w-4" />
                                                    ) : (
                                                        <step.icon className="h-4 w-4" />
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <div className={`font-medium text-sm ${step.completed ? 'text-lime-400' : 'text-white'
                                                        }`}>
                                                        {step.title}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Profile Setup Form */}
                            {userExists === false && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                >
                                    <Card className="bg-gray-900/50 border-yellow-400/20 backdrop-blur-md">
                                        <CardContent className="p-6">
                                            <div className="flex items-center space-x-3 mb-6">
                                                <div className="w-12 h-12 bg-yellow-400/20 rounded-lg flex items-center justify-center">
                                                    <Edit3 className="h-6 w-6 text-yellow-400" />
                                                </div>
                                                <div>
                                                    <h2 className="text-xl font-bold text-yellow-400">Create Character</h2>
                                                    <p className="text-gray-300 text-sm">Choose your identity for the decentralized realm</p>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <div>
                                                    <Label className="text-yellow-300 text-sm font-medium">
                                                        Choose Username
                                                    </Label>
                                                    <Input
                                                        type="text"
                                                        value={username}
                                                        onChange={(e) => setUsername(e.target.value.toLowerCase())}
                                                        placeholder="Enter your username"
                                                        className="mt-2 bg-gray-800/50 border-gray-600 text-white cursor-target lowercase"
                                                        maxLength={20}
                                                    />
                                                    <p className="text-xs text-gray-400 mt-1">
                                                        3-20 characters, letters and numbers only
                                                    </p>
                                                </div>

                                                <Button
                                                    onClick={handleCreateProfile}
                                                    disabled={loading || username.length < 3}
                                                    className="w-full bg-yellow-400 text-black hover:bg-yellow-500 cursor-target"
                                                    size="lg"
                                                >
                                                    {loading ? (
                                                        <div className="flex items-center justify-center space-x-2">
                                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div>
                                                            <span>Creating Character...</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-center space-x-2">
                                                            <Save className="w-5 h-5" />
                                                            <span>Create Character</span>
                                                            <ArrowRight className="w-5 h-5" />
                                                        </div>
                                                    )}
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            )}

                            {/* Profile Management */}
                            {userExists === true && user && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                >
                                    <Card className="bg-gray-900/50 border-green-400/20 backdrop-blur-md">
                                        <CardContent className="p-6">
                                            <div className="flex items-center justify-between mb-6">
                                                <div className="flex items-center space-x-3">
                                                    <div className="w-12 h-12 bg-green-400/20 rounded-lg flex items-center justify-center">
                                                        <UserCheck className="h-6 w-6 text-green-400" />
                                                    </div>
                                                    <div>
                                                        <h2 className="text-xl font-bold text-green-400">Profile Management</h2>
                                                        <p className="text-gray-300 text-sm">Update your profile information</p>
                                                    </div>
                                                </div>
                                                {!isEditing && (
                                                    <Button
                                                        onClick={() => setIsEditing(true)}
                                                        variant="outline"
                                                        size="sm"
                                                        className="border-green-400/20 text-green-400 hover:bg-green-400/10 cursor-target"
                                                    >
                                                        <Edit3 className="w-4 h-4 mr-2" />
                                                        Edit
                                                    </Button>
                                                )}
                                            </div>

                                            <div className="grid md:grid-cols-2 gap-6">
                                                <div className="space-y-4">
                                                    <div>
                                                        <Label className="text-green-300 text-sm font-medium">
                                                            Username
                                                        </Label>
                                                        {isEditing ? (
                                                            <Input
                                                                type="text"
                                                                value={username}
                                                                onChange={(e) => setUsername(e.target.value)}
                                                                className="mt-2 bg-gray-800/50 border-gray-600 text-white cursor-target"
                                                                maxLength={20}
                                                            />
                                                        ) : (
                                                            <div className="mt-2 text-white font-medium">{user.username}</div>
                                                        )}
                                                    </div>

                                                    <div>
                                                        <Label className="text-green-300 text-sm font-medium">
                                                            Display Name
                                                        </Label>
                                                        {isEditing ? (
                                                            <Input
                                                                type="text"
                                                                value={displayName}
                                                                onChange={(e) => setDisplayName(e.target.value)}
                                                                placeholder="Enter display name"
                                                                className="mt-2 bg-gray-800/50 border-gray-600 text-white cursor-target"
                                                                maxLength={50}
                                                            />
                                                        ) : (
                                                            <div className="mt-2 text-white">{String(user.name || '').trim() || 'Not set'}</div>
                                                        )}
                                                    </div>

                                                    <div>
                                                        <Label className="text-green-300 text-sm font-medium">
                                                            Profile Picture URL
                                                        </Label>
                                                        {isEditing ? (
                                                            <Input
                                                                type="url"
                                                                value={profilePicture}
                                                                onChange={(e) => setProfilePicture(e.target.value)}
                                                                placeholder="https://example.com/image.jpg"
                                                                className="mt-2 bg-gray-800/50 border-gray-600 text-white cursor-target"
                                                            />
                                                        ) : (
                                                            <div className="mt-2 text-white truncate max-w-xs">
                                                                {String(user.profilePicture || '').trim() || 'Not set'}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {isEditing && (
                                                        <div className="flex space-x-3 pt-2">
                                                            <Button
                                                                onClick={handleUpdateProfile}
                                                                disabled={loading}
                                                                className="flex-1 bg-green-400 text-black hover:bg-green-500 cursor-target"
                                                            >
                                                                {loading ? (
                                                                    <div className="flex items-center justify-center space-x-2">
                                                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div>
                                                                        <span>Saving...</span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center justify-center space-x-2">
                                                                        <Save className="w-4 h-4" />
                                                                        <span>Save</span>
                                                                    </div>
                                                                )}
                                                            </Button>
                                                            <Button
                                                                onClick={handleCancelEdit}
                                                                variant="outline"
                                                                className="border-gray-400/20 text-gray-400 hover:bg-gray-400/10 cursor-target"
                                                            >
                                                                <X className="w-4 h-4 mr-2" />
                                                                Cancel
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="bg-gray-800/30 rounded-xl p-4">
                                                    <h4 className="font-semibold mb-3 text-green-300">Character Stats</h4>
                                                    <div className="space-y-3 text-sm">
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-400">Created</span>
                                                            <span className="text-white">
                                                                {user.createdAt ? new Date(Number(user.createdAt / 1_000_000n)).toLocaleDateString() : 'Unknown'}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-400">Character ID</span>
                                                            <span className="font-mono text-xs text-gray-300">
                                                                {user.id ? (typeof user.id.toText === 'function' ? user.id.toText().substring(0, 8) + '...' : 'Invalid') : 'Unknown'}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-400">Profile Complete</span>
                                                            <span className="text-green-400">
                                                                {user.username && user.name ? '✓ Complete' : '○ Partial'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="mt-4 pt-4 border-t border-gray-700">
                                                        <Button
                                                            onClick={handleGoToDashboard}
                                                            className="w-full bg-green-400 text-black hover:bg-green-500 cursor-target"
                                                            size="sm"
                                                        >
                                                            <Play className="w-4 h-4 mr-2" />
                                                            Enter Dashboard
                                                            <ArrowRight className="w-4 h-4 ml-2" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            )}
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
                <div className="container mx-auto max-w-6xl">
                    <div className="flex flex-col md:flex-row justify-between items-center">
                        <div className="flex items-center space-x-6 mb-4 md:mb-0">
                            <h3 className="font-logo text-xl text-lime-400 cursor-target">
                                PIXELIY
                            </h3>
                            <p className="text-gray-400 text-sm">
                                Decentralized real-time communication platform
                            </p>
                        </div>
                        <div className="flex items-center space-x-4">
                            <Button
                                onClick={logout}
                                variant="outline"
                                size="sm"
                                className="border-red-400/20 text-red-400 hover:bg-red-400/10 cursor-target"
                            >
                                <LogOut className="w-4 h-4 mr-2" />
                                Disconnect
                            </Button>
                        </div>
                    </div>
                </div>
            </motion.footer>
        </div>
    );
};

export default Profile;