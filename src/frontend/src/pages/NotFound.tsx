import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

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

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white overflow-hidden">
            {/* Header */}
            <motion.header
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="bg-gray-900/50 backdrop-blur-md border-b border-gray-800 sticky top-0 z-10"
            >
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex justify-between items-center">
                        <motion.div
                            whileHover={{ scale: 1.05 }}
                            className="flex items-center space-x-3"
                        >
                            <span className="text-white font-bold text-lg">Pixeliy</span>
                        </motion.div>
                        
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleGoHome}
                            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                        >
                            Home
                        </motion.button>
                    </div>
                </div>
            </motion.header>

            {/* Main Content */}
            <div className="flex items-center justify-center min-h-[calc(100vh-80px)] px-6">
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8 }}
                    className="text-center max-w-2xl"
                >
                    {/* 404 Animation */}
                    <motion.div
                        initial={{ opacity: 0, y: -50 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.6 }}
                        className="mb-8"
                    >
                        <motion.h1
                            className="text-8xl md:text-9xl font-bold bg-gradient-to-r from-red-500 via-pink-500 to-purple-500 bg-clip-text text-transparent"
                            animate={{
                                backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"]
                            }}
                            transition={{
                                duration: 3,
                                repeat: Infinity,
                                ease: "linear"
                            }}
                            style={{
                                backgroundSize: "200% 200%"
                            }}
                        >
                            404
                        </motion.h1>
                    </motion.div>

                    {/* Error Message */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4, duration: 0.6 }}
                        className="mb-8"
                    >
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                            Page Not Found
                        </h2>
                        <p className="text-xl text-gray-300 mb-2">
                            Oops! The page you're looking for doesn't exist.
                        </p>
                        <p className="text-gray-400">
                            It might have been moved, deleted, or you entered the wrong URL.
                        </p>
                    </motion.div>

                    {/* Action Buttons */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.8, duration: 0.6 }}
                        className="space-y-4"
                    >
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Go Home */}
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleGoHome}
                                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-4 rounded-xl font-semibold transition-all transform"
                            >
                                Go Home
                            </motion.button>

                            {/* Go to Dashboard */}
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleGoDashboard}
                                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-4 rounded-xl font-semibold transition-all transform"
                            >
                                Dashboard
                            </motion.button>

                            {/* Go Back */}
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleGoBack}
                                className="bg-gray-700/50 hover:bg-gray-600 border border-gray-600 text-white px-6 py-4 rounded-xl font-semibold transition-all transform"
                            >
                                ← Go Back
                            </motion.button>
                        </div>
                    </motion.div>

                    {/* Helpful Links */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1.0, duration: 0.6 }}
                        className="mt-12"
                    >
                        <div className="bg-gray-800/30 backdrop-blur-md rounded-2xl p-6 border border-gray-700/30">
                            <h4 className="text-lg font-semibold text-white mb-4">Popular Pages</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    onClick={() => navigate('/')}
                                    className="bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 hover:text-white px-4 py-3 rounded-lg text-sm transition-all"
                                >
                                    Home
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    onClick={() => navigate('/profile')}
                                    className="bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 hover:text-white px-4 py-3 rounded-lg text-sm transition-all"
                                >
                                    Profile
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    onClick={() => navigate('/dashboard')}
                                    className="bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 hover:text-white px-4 py-3 rounded-lg text-sm transition-all"
                                >
                                    Dashboard
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    onClick={() => window.location.reload()}
                                    className="bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 hover:text-white px-4 py-3 rounded-lg text-sm transition-all"
                                >
                                    Refresh
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>
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
                className="fixed top-40 right-20 w-12 h-12 bg-purple-600/20 rounded-full"
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
                className="fixed bottom-32 left-1/4 w-8 h-8 bg-blue-600/20 rounded-full"
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

            {/* Background Effects */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-red-600/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-purple-600/10 rounded-full blur-3xl"></div>
                <div className="absolute top-3/4 left-1/2 w-72 h-72 bg-pink-600/10 rounded-full blur-3xl"></div>
                <div className="absolute top-1/2 right-1/3 w-48 h-48 bg-blue-600/10 rounded-full blur-2xl"></div>
            </div>
        </div>
    );
};

export default NotFound;