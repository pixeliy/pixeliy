"use client"

import React from 'react';
import { motion } from 'framer-motion';
import { InteractiveGridPattern } from '@/components/ui/interactive-grid';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Lock, Shield, Globe, Zap, ArrowRight, Sparkles } from 'lucide-react';
import TargetCursor from '../target-cursor'; 

interface LoginRequiredProps {
    onLogin: () => void;
    isLoading?: boolean;
    title?: string;
    subtitle?: string;
    description?: string;
    showFeatures?: boolean;
}

// Animation variants 
const fadeInUpVariants = {
    initial: { opacity: 0, y: 60 },
    animate: { opacity: 1, y: 0 },
};

const staggerContainerVariants = {
    initial: {},
    animate: {
        transition: {
            staggerChildren: 0.15,
            delayChildren: 0.1,
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

export const LoginRequired: React.FC<LoginRequiredProps> = ({
    onLogin,
    isLoading = false,
    title = "Welcome to Pixeliy",
    subtitle = "Decentralized Real-Time Communication",
    description = "Connect, collaborate, and create together in real-time video spaces on Internet Computer",
    showFeatures = true
}) => {
    const features = [
        { icon: Lock, text: "Secure Identity" },
        { icon: Shield, text: "Privacy First" },
        { icon: Globe, text: "Global Network" },
        { icon: Zap, text: "Instant Connect" },
    ];

    return (
        <div className="min-h-screen bg-black text-white overflow-hidden relative z-[1000]">
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

            {/* Floating Background Elements */}
            <div className="absolute inset-0 z-[1] pointer-events-none overflow-hidden">
                <motion.div
                    className="absolute top-10 sm:top-20 left-10 sm:left-20 w-20 h-20 sm:w-32 sm:h-32 bg-lime-500/10 rounded-full blur-xl"
                    animate={{
                        y: [0, -30, 0],
                        x: [0, 20, 0],
                        scale: [1, 1.1, 1],
                    }}
                    transition={{
                        duration: 8,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                />
                <motion.div
                    className="absolute top-1/4 sm:top-1/3 right-16 sm:right-32 w-16 h-16 sm:w-24 sm:h-24 bg-purple-500/10 rounded-full blur-xl"
                    animate={{
                        y: [0, 40, 0],
                        x: [0, -15, 0],
                        scale: [1, 0.9, 1],
                    }}
                    transition={{
                        duration: 6,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 1
                    }}
                />
                <motion.div
                    className="absolute bottom-20 sm:bottom-32 left-1/4 sm:left-1/3 w-14 h-14 sm:w-20 sm:h-20 bg-blue-500/10 rounded-full blur-xl"
                    animate={{
                        y: [0, -25, 0],
                        scale: [1, 1.2, 1],
                        opacity: [0.3, 0.7, 0.3],
                    }}
                    transition={{
                        duration: 5,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 2
                    }}
                />
            </div>

            {/* Main Content */}
            <div className="relative z-20 flex items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8 py-8 sm:py-0 pointer-events-none">
                <motion.div
                    className="max-w-5xl mx-auto text-center w-full"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1 }}
                >
                    {/* Badge - Mobile Responsive */}
                    <motion.div
                        variants={fadeInUpVariants}
                        initial="initial"
                        animate="animate"
                        transition={quickTransition}
                        className="mb-4 sm:mb-6"
                    >
                        <Badge className="bg-lime-400/10 text-lime-400 border-lime-400/20 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm">
                            <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                            <span className="hidden sm:inline">{subtitle}</span>
                            <span className="sm:hidden">Decentralized Communication</span>
                        </Badge>
                    </motion.div>

                    {/* Main Title - Mobile Responsive */}
                    <motion.div
                        className="mb-6 sm:mb-8"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                    >
                        <h1 className="font-logo text-4xl sm:text-6xl md:text-7xl lg:text-8xl mb-2 sm:mb-4 text-lime-400 tracking-wider">
                            PIXELIY
                        </h1>
                        <h2 className="text-lg sm:text-2xl md:text-3xl text-white font-semibold mb-2 sm:mb-4 px-2 sm:px-0">
                            {title}
                        </h2>
                    </motion.div>

                    {/* Description - Mobile Responsive */}
                    <motion.p
                        className="text-sm sm:text-lg md:text-xl text-gray-300 mb-6 sm:mb-8 max-w-xs sm:max-w-2xl mx-auto leading-relaxed px-2 sm:px-0"
                        variants={fadeInUpVariants}
                        initial="initial"
                        animate="animate"
                        transition={{ ...smoothTransition, delay: 0.4 }}
                    >
                        <span className="hidden sm:inline">{description}</span>
                        <span className="sm:hidden">Connect and collaborate in real-time video spaces on Internet Computer</span>
                    </motion.p>

                    {/* Login Button - Mobile Responsive */}
                    <motion.div
                        className="mb-8 sm:mb-12"
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                    >
                        <motion.div
                            whileHover={{ scale: 1.05, y: -2 }}
                            whileTap={{ scale: 0.95 }}
                            transition={{ type: "spring", stiffness: 400, damping: 17 }}
                        >
                            <Button
                                onClick={onLogin}
                                disabled={isLoading}
                                size="lg"
                                className="bg-lime-400 text-black hover:bg-lime-500 px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-lg font-bold cursor-target transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto max-w-sm sm:max-w-none mx-auto pointer-events-auto"
                            >
                                {isLoading ? (
                                    <div className="flex items-center justify-center space-x-2">
                                        <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                                        <span>Connecting...</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center space-x-2">
                                        <Lock className="w-4 h-4 sm:w-5 sm:h-5" />
                                        <span className="hidden sm:inline">Connect with Internet Identity</span>
                                        <span className="sm:hidden">Connect Identity</span>
                                        <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                                    </div>
                                )}
                            </Button>
                        </motion.div>
                    </motion.div>

                    {/* Features Grid - Mobile Responsive */}
                    {showFeatures && (
                        <motion.div
                            className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 max-w-xs sm:max-w-4xl mx-auto px-2 sm:px-0"
                            variants={staggerContainerVariants}
                            initial="initial"
                            animate="animate"
                        >
                            {features.map((feature, index) => (
                                <motion.div
                                    key={index}
                                    variants={scaleInVariants}
                                    transition={{ ...quickTransition, delay: 0.8 + index * 0.1 }}
                                    className="text-center "
                                >
                                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-lime-400/10 rounded-lg sm:rounded-xl flex items-center justify-center mx-auto mb-2 sm:mb-3 border border-lime-400/20 cursor-target pointer-events-auto">
                                        <feature.icon className="h-6 w-6 sm:h-8 sm:w-8 text-lime-400" />
                                    </div>
                                    <p className="text-xs sm:text-sm text-gray-400 font-medium leading-tight">
                                        <span className="hidden sm:inline">{feature.text}</span>
                                        <span className="sm:hidden">
                                            {feature.text === "Secure Identity" && "Secure"}
                                            {feature.text === "Privacy First" && "Private"}
                                            {feature.text === "Global Network" && "Global"}
                                            {feature.text === "Instant Connect" && "Instant"}
                                        </span>
                                    </p>
                                </motion.div>
                            ))}
                        </motion.div>
                    )}

                    {/* Additional Info - Mobile Responsive */}
                    <motion.div
                        className="mt-8 sm:mt-12 text-center px-4 sm:px-0"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1.2 }}
                    >
                        <p className="text-gray-500 text-xs sm:text-sm mb-2">
                            Powered by Internet Computer Protocol
                        </p>
                        <div className="flex items-center justify-center space-x-2 sm:space-x-4 text-xs text-gray-600 flex-wrap gap-y-1">
                            <span>• Decentralized</span>
                            <span>• Private</span>
                            <span>• Unstoppable</span>
                        </div>
                    </motion.div>
                </motion.div>
            </div>

            {/* Bottom Gradient Overlay */}
            <div className="absolute bottom-0 left-0 right-0 h-20 sm:h-32 bg-gradient-to-t from-black to-transparent z-[15] pointer-events-none" />
        </div>
    );
};

export default LoginRequired;