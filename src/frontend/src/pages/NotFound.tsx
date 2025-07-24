"use client"

import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { cn } from "@/lib/utils";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { InteractiveGridPattern } from "@/components/ui/interactive-grid";
import TargetCursor from "../components/target-cursor";
import {
    Home,
    ArrowLeft,
    Search,
    AlertTriangle,
    RefreshCw,
    Navigation
} from "lucide-react";

// Animation variants
const fadeInUpVariants = {
    initial: { opacity: 0, y: 60 },
    animate: { opacity: 1, y: 0 },
};

const scaleInVariants = {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
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

const smoothTransition = {
    duration: 0.8,
    ease: "easeOut" as const,
};

const NotFound: React.FC = () => {
    const navigate = useNavigate();

    const handleGoHome = () => {
        navigate('/');
    };

    const handleGoDashboard = () => {
        navigate('/dashboard');
    };

    const handleGoBack = () => {
        window.history.back();
    };

    const handleRefresh = () => {
        window.location.reload();
    };

    return (
        <div className="min-h-screen bg-black text-white overflow-hidden">
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
                        onClick={handleGoHome}
                    >
                        <h1 className="font-logo text-2xl text-lime-400 m-0">
                            PIXELIY
                        </h1>
                    </motion.div>
                    
                    <motion.div
                        className="flex items-center space-x-4"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        <Button 
                            className="bg-lime-400 text-black hover:bg-lime-500 cursor-target" 
                            onClick={handleGoHome}
                        >
                            Home
                        </Button>
                    </motion.div>
                </div>
            </motion.header>

            {/* Main Section */}
            <section className="pt-24 pb-16 px-4 relative overflow-hidden min-h-screen flex items-center">
                {/* Interactive Grid Background */}
                <InteractiveGridPattern
                    className={cn(
                        "[mask-image:radial-gradient(800px_circle_at_center,white,transparent)]",
                        "absolute inset-0 h-full w-full z-0",
                        "fill-red-500/10 stroke-red-500/10"
                    )}
                    width={20}
                    height={20}
                    squares={[80, 80]}
                    squaresClassName="hover:fill-red-500/20"
                />

                {/* Overlay for better text readability */}
                <div className="absolute inset-0 z-[1] pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/60" />
                    <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 via-transparent to-orange-500/5" />
                </div>

                <div className="container mx-auto text-center relative z-10">
                    {/* 404 Badge */}
                    <motion.div
                        variants={fadeInUpVariants}
                        initial="initial"
                        animate="animate"
                        transition={smoothTransition}
                    >
                        <Badge className="mb-6 bg-red-400/10 text-red-400 border-red-400/20 cursor-target">
                            <AlertTriangle className="w-4 h-4 mr-2" />
                            Page Not Found
                        </Badge>
                    </motion.div>

                    {/* 404 Number */}
                    <motion.h1
                        className="text-8xl md:text-9xl font-bold mb-6 bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                    >
                        404
                    </motion.h1>

                    {/* Error Message */}
                    <motion.div
                        variants={fadeInUpVariants}
                        initial="initial"
                        animate="animate"
                        transition={{ ...smoothTransition, delay: 0.4 }}
                    >
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                            Oops! You're Lost in Space
                        </h2>
                        <p className="text-xl text-gray-300 mb-4 max-w-2xl mx-auto">
                            The page you're looking for doesn't exist in our universe.
                        </p>
                        <p className="text-gray-400 mb-8 max-w-xl mx-auto">
                            It might have been moved, deleted, or you entered the wrong URL. Let's get you back on track.
                        </p>
                    </motion.div>

                    {/* Action Buttons */}
                    <motion.div
                        className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12"
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
                                onClick={handleGoHome} 
                                size="lg" 
                                className="bg-lime-400 text-black hover:bg-lime-500 px-8 py-3 text-lg cursor-target"
                            >
                                <Home className="mr-2 h-5 w-5" />
                                Go Home
                            </Button>
                        </motion.div>
                        
                        <motion.div
                            whileHover={{ scale: 1.05, y: -2 }}
                            whileTap={{ scale: 0.95 }}
                            transition={{ type: "spring", stiffness: 400, damping: 17 }}
                        >
                            <Button
                                onClick={handleGoBack}
                                size="lg"
                                variant="outline"
                                className="border-lime-400 text-lime-400 hover:bg-lime-400 hover:text-black px-8 py-3 text-lg bg-transparent cursor-target"
                            >
                                <ArrowLeft className="mr-2 h-5 w-5" />
                                Go Back
                            </Button>
                        </motion.div>
                    </motion.div>

                    {/* Quick Navigation */}
                    <motion.div
                        className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto"
                        variants={staggerContainerVariants}
                        initial="initial"
                        animate="animate"
                    >
                        {[
                            { icon: Home, text: "Home", action: handleGoHome },
                            { icon: Search, text: "Dashboard", action: handleGoDashboard },
                            { icon: RefreshCw, text: "Refresh", action: handleRefresh },
                            { icon: Navigation, text: "Go Back", action: handleGoBack },
                        ].map((item, index) => (
                            <motion.div
                                key={index}
                                variants={scaleInVariants}
                                transition={{ ...smoothTransition, delay: index * 0.1 }}
                                className="text-center cursor-target"
                                onClick={item.action}
                            >
                                <motion.div 
                                    className="w-16 h-16 bg-gray-800/50 hover:bg-lime-400/10 rounded-xl flex items-center justify-center mx-auto mb-3 border border-gray-700/50 hover:border-lime-400/30 transition-all"
                                    whileHover={{ scale: 1.1, y: -4 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <item.icon className="h-8 w-8 text-gray-400 hover:text-lime-400 transition-colors" />
                                </motion.div>
                                <p className="text-sm text-gray-400 font-medium">{item.text}</p>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>

                {/* Floating Elements */}
                <motion.div
                    className="fixed top-20 left-10 w-16 h-16 bg-red-600/20 rounded-full"
                    animate={{
                        y: [0, -20, 0],
                        rotate: [0, 180, 360]
                    }}
                    transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                />
                
                <motion.div
                    className="fixed top-40 right-20 w-12 h-12 bg-orange-600/20 rounded-full"
                    animate={{
                        y: [0, 20, 0],
                        x: [0, -10, 0]
                    }}
                    transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                />

                <motion.div
                    className="fixed bottom-32 left-1/4 w-8 h-8 bg-lime-600/20 rounded-full"
                    animate={{
                        scale: [1, 1.5, 1],
                        opacity: [0.3, 0.7, 0.3]
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                />
            </section>

            {/* Helpful Section */}
            <section className="py-16 px-4 bg-gradient-to-r from-gray-900/50 to-black">
                <div className="container mx-auto">
                    <motion.div
                        className="text-center mb-12"
                        variants={fadeInUpVariants}
                        initial="initial"
                        whileInView="animate"
                        viewport={{ once: true }}
                        transition={smoothTransition}
                    >
                        <h3 className="text-2xl md:text-3xl font-bold mb-4">
                            While You're Here, Try These <span className="text-lime-400">Popular Pages</span>
                        </h3>
                        <p className="text-gray-400 max-w-xl mx-auto">
                            Explore our platform and discover what makes Pixeliy special
                        </p>
                    </motion.div>

                    <motion.div
                        className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto"
                        variants={staggerContainerVariants}
                        initial="initial"
                        whileInView="animate"
                        viewport={{ once: true }}
                    >
                        {[
                            {
                                title: "Dashboard",
                                description: "Access your communication hub",
                                icon: Search,
                                action: handleGoDashboard,
                                color: "lime"
                            },
                            {
                                title: "Home",
                                description: "Learn about our technology",
                                icon: Home,
                                action: handleGoHome,
                                color: "blue"
                            },
                            {
                                title: "Start Fresh",
                                description: "Refresh and try again",
                                icon: RefreshCw,
                                action: handleRefresh,
                                color: "purple"
                            }
                        ].map((item, index) => (
                            <motion.div
                                key={index}
                                variants={scaleInVariants}
                                transition={{ delay: index * 0.1 }}
                                className={cn(
                                    "bg-gray-900/50 backdrop-blur-md rounded-2xl p-6 border border-gray-700/30 cursor-target hover:border-lime-400/30 transition-all",
                                    "hover:bg-gray-800/50"
                                )}
                                whileHover={{ scale: 1.02, y: -4 }}
                                onClick={item.action}
                            >
                                <div className={cn(
                                    "w-12 h-12 rounded-lg flex items-center justify-center mb-4",
                                    item.color === "lime" && "bg-lime-400/10",
                                    item.color === "blue" && "bg-blue-400/10", 
                                    item.color === "purple" && "bg-purple-400/10"
                                )}>
                                    <item.icon className={cn(
                                        "h-6 w-6",
                                        item.color === "lime" && "text-lime-400",
                                        item.color === "blue" && "text-blue-400",
                                        item.color === "purple" && "text-purple-400"
                                    )} />
                                </div>
                                <h4 className="text-lg font-semibold text-white mb-2">{item.title}</h4>
                                <p className="text-gray-400 text-sm">{item.description}</p>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* Footer */}
            <motion.footer
                className="py-8 px-4 border-t border-lime-400/20"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
            >
                <div className="container mx-auto text-center">
                    <div className="flex flex-col md:flex-row justify-between items-center">
                        <motion.div
                            className="flex items-center space-x-2 cursor-target mb-4 md:mb-0"
                            whileHover={{ scale: 1.05 }}
                            onClick={handleGoHome}
                        >
                            <h3 className="font-logo text-xl text-lime-400">PIXELIY</h3>
                            <span className="text-gray-400 text-sm">• Lost? We'll guide you home</span>
                        </motion.div>
                        
                        <div className="flex items-center space-x-6 text-sm text-gray-400">
                            <motion.a 
                                href="#" 
                                className="hover:text-lime-400 transition-colors cursor-target"
                                whileHover={{ scale: 1.05 }}
                            >
                                Support
                            </motion.a>
                            <motion.a 
                                href="#" 
                                className="hover:text-lime-400 transition-colors cursor-target"
                                whileHover={{ scale: 1.05 }}
                            >
                                Contact
                            </motion.a>
                            <motion.span 
                                className="text-gray-500"
                                whileHover={{ scale: 1.05 }}
                            >
                                © 2025 Pixeliy
                            </motion.span>
                        </div>
                    </div>
                </div>
            </motion.footer>
        </div>
    );
};

export default NotFound;