import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const Home: React.FC = () => {
    const navigate = useNavigate();

    const handleGetStarted = () => {
        navigate('/profile');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white overflow-hidden">
            {/* Header */}
            <motion.header
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="relative z-10 p-6"
            >
                <div className="flex justify-between items-center max-w-7xl mx-auto">
                    <motion.div
                        whileHover={{ scale: 1.05 }}
                        className="flex items-center space-x-3"
                    >
                        <span className="text-2xl font-bold">Pixeliy</span>
                    </motion.div>
                    
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleGetStarted}
                        className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-semibold transition-all"
                    >
                        Get Started
                    </motion.button>
                </div>
            </motion.header>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Hero Section */}
                <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="text-center mb-16"
                >
                    <motion.h1
                        className="text-6xl md:text-8xl font-bold mb-6 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent"
                        whileHover={{
                            scale: 1.05,
                            filter: "brightness(1.2)"
                        }}
                        transition={{ type: "spring", stiffness: 300 }}
                    >
                        PIXELIY
                    </motion.h1>
                    
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3, duration: 0.6 }}
                        className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto"
                    >
                        The future of <span className="text-blue-400 font-semibold">decentralized real-time communication</span> with 
                        AI-powered collaboration and seamless WebRTC technology
                    </motion.p>

                    <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.6, duration: 0.6 }}
                        whileHover={{
                            scale: 1.1,
                            boxShadow: "0px 0px 40px rgba(59, 130, 246, 0.6)"
                        }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleGetStarted}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-12 py-4 rounded-xl font-bold text-lg transition-all transform"
                    >
                        Experience dRTC →
                    </motion.button>
                </motion.div>

                {/* Bento Grid Features */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8, duration: 0.8 }}
                    className="grid grid-cols-12 gap-6 mb-16"
                >
                    {/* Decentralized Real-Time Communication (dRTC) - Main Feature */}
                    <motion.div
                        whileHover={{ scale: 1.02, y: -5 }}
                        className="col-span-12 lg:col-span-8 bg-gradient-to-br from-blue-600/20 to-cyan-600/20 rounded-2xl p-8 border border-blue-500/30 backdrop-blur-md relative overflow-hidden"
                    >
                        <div className="absolute top-4 right-4 bg-blue-600/20 px-3 py-1 rounded-full text-xs font-semibold text-blue-300">
                            🚀 Core Technology
                        </div>
                        <div className="flex items-center space-x-4 mb-6">
                            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center">
                                <span className="text-3xl">🌐</span>
                            </div>
                            <div>
                                <h3 className="text-3xl font-bold">Decentralized Real-Time Communication</h3>
                                <p className="text-blue-200">Revolutionary dRTC protocol on Internet Computer</p>
                            </div>
                        </div>
                        <p className="text-gray-300 text-lg mb-4">
                            Experience true peer-to-peer communication without centralized servers. Built on Internet Computer 
                            Protocol for maximum privacy, censorship resistance, and global accessibility.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {['Zero Servers', 'End-to-End Encryption', 'Global P2P Network', 'Unstoppable Communication'].map((feature) => (
                                <span key={feature} className="bg-blue-600/20 text-blue-300 px-3 py-1 rounded-lg text-sm">
                                    {feature}
                                </span>
                            ))}
                        </div>
                    </motion.div>

                    {/* AI Translation */}
                    <motion.div
                        whileHover={{ scale: 1.02, y: -5 }}
                        className="col-span-12 lg:col-span-4 bg-gradient-to-br from-emerald-600/20 to-green-600/20 rounded-2xl p-8 border border-emerald-500/30 backdrop-blur-md"
                    >
                        <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mb-6">
                            <span className="text-3xl">🌍</span>
                        </div>
                        <h3 className="text-2xl font-bold mb-4">AI Translation</h3>
                        <p className="text-gray-300 mb-4">
                            Break language barriers with real-time AI-powered translation for global collaboration.
                        </p>
                    </motion.div>

                    {/* AI Agent */}
                    <motion.div
                        whileHover={{ scale: 1.02, y: -5 }}
                        className="col-span-12 md:col-span-6 lg:col-span-6 bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-2xl p-6 border border-purple-500/30 backdrop-blur-md"
                    >
                        <div className="flex items-center space-x-4 mb-4">
                            <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center">
                                <span className="text-2xl">🤖</span>
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold">AI Agent Assistant</h3>
                                <p className="text-purple-200">Smart collaboration companion</p>
                            </div>
                        </div>
                        <p className="text-gray-300 mb-4">
                            Intelligent AI agent that helps manage meetings, takes notes, and provides contextual assistance.
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <span className="bg-purple-600/20 text-purple-300 px-2 py-1 rounded">Meeting Summaries</span>
                            <span className="bg-purple-600/20 text-purple-300 px-2 py-1 rounded">Smart Scheduling</span>
                            <span className="bg-purple-600/20 text-purple-300 px-2 py-1 rounded">Action Items</span>
                            <span className="bg-purple-600/20 text-purple-300 px-2 py-1 rounded">Context Analysis</span>
                        </div>
                    </motion.div>

                    {/* Smart Rooms */}
                    <motion.div
                        whileHover={{ scale: 1.02, y: -5 }}
                        className="col-span-12 md:col-span-6 lg:col-span-3 bg-gradient-to-br from-orange-600/20 to-red-600/20 rounded-2xl p-6 border border-orange-500/30 backdrop-blur-md"
                    >
                        <div className="w-12 h-12 bg-orange-600 rounded-xl flex items-center justify-center mb-4">
                            <span className="text-2xl">🚀</span>
                        </div>
                        <h3 className="text-xl font-bold mb-3">Smart Rooms</h3>
                        <p className="text-gray-300 text-sm">
                            Create or join rooms instantly with automatic participant management and adaptive quality.
                        </p>
                    </motion.div>

                    {/* Cross-Platform */}
                    <motion.div
                        whileHover={{ scale: 1.02, y: -5 }}
                        className="col-span-12 md:col-span-6 lg:col-span-3 bg-gradient-to-br from-indigo-600/20 to-purple-600/20 rounded-2xl p-6 border border-indigo-500/30 backdrop-blur-md"
                    >
                        <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mb-4">
                            <span className="text-2xl">📱</span>
                        </div>
                        <h3 className="text-xl font-bold mb-3">Cross-Platform</h3>
                        <p className="text-gray-300 text-sm">
                            Works seamlessly across all devices and browsers without installation.
                        </p>
                    </motion.div>

                    {/* Privacy First */}
                    <motion.div
                        whileHover={{ scale: 1.02, y: -5 }}
                        className="col-span-12 lg:col-span-12 bg-gradient-to-br from-cyan-600/20 to-blue-600/20 rounded-2xl p-6 border border-cyan-500/30 backdrop-blur-md"
                    >
                        <div className="flex items-center space-x-4 mb-4">
                            <div className="w-12 h-12 bg-cyan-600 rounded-xl flex items-center justify-center">
                                <span className="text-2xl">🔒</span>
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold">Privacy First</h3>
                                <p className="text-cyan-200">Zero-knowledge architecture</p>
                            </div>
                        </div>
                        <p className="text-gray-300">
                            Your data never touches central servers. True end-to-end encryption with Internet Identity authentication 
                            ensures complete privacy and security.
                        </p>
                    </motion.div>
                </motion.div>

                {/* Call to Action */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1.6, duration: 0.8 }}
                    className="text-center bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-2xl p-12 border border-blue-500/30 backdrop-blur-md"
                >
                    <h2 className="text-4xl font-bold mb-4">Ready for the Future?</h2>
                    <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
                        Join the revolution of decentralized communication. Experience true privacy, 
                        AI-powered collaboration, and unstoppable connectivity.
                    </p>
                    <motion.button
                        whileHover={{
                            scale: 1.1,
                            boxShadow: "0px 0px 40px rgba(59, 130, 246, 0.6)"
                        }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleGetStarted}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-12 py-4 rounded-xl font-bold text-lg transition-all transform"
                    >
                        Start Building on dRTC →
                    </motion.button>
                </motion.div>
            </div>

            {/* Footer */}
            <motion.footer
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2, duration: 0.6 }}
                className="border-t border-gray-800 mt-16 py-8"
            >
                <div className="max-w-7xl mx-auto px-6 text-center">
                    <p className="text-gray-400">
                        © 2025 Pixeliy. Pioneering dRTC on the Internet Computer. Built with ❤️ for a decentralized future.
                    </p>
                </div>
            </motion.footer>

            {/* Background Effects */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-purple-600/10 rounded-full blur-3xl"></div>
                <div className="absolute top-3/4 left-1/2 w-72 h-72 bg-pink-600/10 rounded-full blur-3xl"></div>
                <div className="absolute top-1/2 right-1/3 w-48 h-48 bg-emerald-600/10 rounded-full blur-2xl"></div>
            </div>
        </div>
    );
};

export default Home;