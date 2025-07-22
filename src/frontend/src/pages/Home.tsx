"use client"

import { cn } from "@/lib/utils";
import { Button } from "../components/ui/button"
import { Card, CardContent } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { InteractiveGridPattern } from "@/components/ui/interactive-grid"
import {
    Globe,
    Shield,
    Users,
    Brain,
    Video,
    Lock,
    Smartphone,
    Zap,
    Network,
    ArrowRight,
    CheckCircle,
    Play,
    Languages,
    Calendar,
    FileText,
    Eye,
    Server,
    Wifi,
} from "lucide-react"
import { motion } from "framer-motion"
import SpotlightCard from "../components/spotlight-card"
import TargetCursor from "../components/target-cursor"
import { useNavigate } from "react-router-dom"

// Smooth animation variants
const fadeInUpVariants = {
    initial: { opacity: 0, y: 60 },
    animate: { opacity: 1, y: 0 },
}

const fadeInLeftVariants = {
    initial: { opacity: 0, x: -60 },
    animate: { opacity: 1, x: 0 },
}

const staggerContainerVariants = {
    initial: {},
    animate: {
        transition: {
            staggerChildren: 0.15,
            delayChildren: 0.1,
        },
    },
}

const scaleInVariants = {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
}

const slideInFromBottomVariants = {
    initial: { opacity: 0, y: 100 },
    animate: { opacity: 1, y: 0 },
}

// Smooth transition settings
const smoothTransition = {
    duration: 0.8,
    ease: "easeOut" as const,
}

const quickTransition = {
    duration: 0.6,
    ease: "easeOut" as const,
}


export default function PixeliyLanding() {

    const navigate = useNavigate();

    const handleGetStarted = () => {
        navigate('/dashboard');
    };

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
                    >
                        <h1 className="font-logo text-2xl font-bold text-lime-400 m-0">
                            PIXELIY
                        </h1>
                    </motion.div>
                    <nav className="hidden md:flex items-center space-x-8">
                        {["Features", "Technology", "Pricing", "Roadmap"].map((item, index) => (
                            <motion.div
                                key={item}
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 + 0.3 }}
                            >
                                <a
                                    href={`#${item.toLowerCase()}`}
                                    className="text-gray-300 hover:text-lime-400 transition-colors cursor-target"
                                >
                                    {item}
                                </a>
                            </motion.div>
                        ))}
                    </nav>
                    <motion.div
                        className="flex items-center space-x-4"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        <Button className="bg-lime-400 text-black hover:bg-lime-500 cursor-target" onClick={handleGetStarted}>Get Started</Button>
                    </motion.div>
                </div>
            </motion.header>

            {/* Hero Section */}
            <section className="pt-24 pb-16 px-4 relative overflow-hidden">
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

                {/* Overlay for better text readability */}
                <div className="absolute inset-0 z-[1] pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/50" />
                    <div className="absolute inset-0 bg-gradient-to-r from-lime-500/3 via-transparent to-green-500/3" />
                </div>

                <div className="container mx-auto text-center relative z-10 pointer-events-none">
                    <motion.div
                        variants={fadeInUpVariants}
                        initial="initial"
                        animate="animate"
                        transition={smoothTransition}
                        className="pointer-events-auto"
                    >
                        <Badge className="mb-6 bg-lime-400/10 text-lime-400 border-lime-400/20">
                            Decentralized Real-Time Communication
                        </Badge>
                    </motion.div>

                    <motion.h1
                        className="font-logo text-5xl md:text-7xl mb-6 text-lime-400"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                    >
                        PIXELIY
                    </motion.h1>

                    <motion.p
                        className="text-xl md:text-2xl text-gray-300 mb-4 max-w-4xl mx-auto"
                        variants={fadeInUpVariants}
                        initial="initial"
                        animate="animate"
                        transition={{ ...smoothTransition, delay: 0.4 }}
                    >
                        Revolutionary dRTC protocol on Internet Computer
                    </motion.p>

                    <motion.p
                        className="text-lg text-gray-400 mb-8 max-w-2xl mx-auto"
                        variants={fadeInUpVariants}
                        initial="initial"
                        animate="animate"
                        transition={{ ...smoothTransition, delay: 0.6 }}
                    >
                        Experience true peer-to-peer communication without centralized servers. Built on Internet Computer Protocol
                        for maximum privacy, censorship resistance, and global accessibility.
                    </motion.p>

                    <motion.div
                        className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12 pointer-events-auto"
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.8 }}
                    >
                        <motion.div
                            whileHover={{ scale: 1.05, y: -2 }}
                            whileTap={{ scale: 0.95 }}
                            transition={{ type: "spring", stiffness: 400, damping: 17 }}
                        >
                            <Button onClick={handleGetStarted} size="lg" className="bg-lime-400 text-black hover:bg-lime-500 px-8 py-3 text-lg cursor-target">
                                <Play className="mr-2 h-5 w-5" />
                                Start Building on dRTC
                            </Button>
                        </motion.div>
                        <motion.div
                            whileHover={{ scale: 1.05, y: -2 }}
                            whileTap={{ scale: 0.95 }}
                            transition={{ type: "spring", stiffness: 400, damping: 17 }}
                        >
                            <Button
                                size="lg"
                                variant="outline"
                                className="border-lime-400 text-lime-400 hover:bg-lime-400 hover:text-black px-8 py-3 text-lg bg-transparent cursor-target"
                            >
                                Watch Demo
                            </Button>
                        </motion.div>
                    </motion.div>

                    {/* Hero Features */}
                    <motion.div
                        className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto pointer-events-auto"
                        variants={staggerContainerVariants}
                        initial="initial"
                        animate="animate"
                    >
                        {[
                            { icon: Server, text: "Zero Servers" },
                            { icon: Lock, text: "End-to-End Encryption" },
                            { icon: Globe, text: "Global P2P Network" },
                            { icon: Zap, text: "Unstoppable Communication" },
                        ].map((item, index) => (
                            <motion.div
                                key={index}
                                variants={scaleInVariants}
                                transition={{ ...quickTransition, delay: index * 0.1 }}
                                className="text-center"
                            >
                                <div className="w-16 h-16 bg-lime-400/10 rounded-xl flex items-center justify-center mx-auto mb-3 border border-lime-400/20 cursor-target">
                                    <item.icon className="h-8 w-8 text-lime-400" />
                                </div>
                                <p className="text-sm text-gray-400 font-medium">{item.text}</p>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* Stats Section */}
            <section className="py-16 px-4 bg-gradient-to-r from-lime-400/5 to-green-400/5">
                <div className="container mx-auto">
                    <div className="grid grid-cols-3 gap-8 text-center">
                        <motion.div
                            variants={scaleInVariants}
                            initial="initial"
                            whileInView="animate"
                            viewport={{ once: true }}
                            transition={quickTransition}
                            className="cursor-target"
                        >
                            <div className="text-3xl md:text-4xl font-bold text-lime-400 mb-2">99.9%</div>
                            <div className="text-gray-400">Uptime</div>
                        </motion.div>
                        <motion.div
                            variants={scaleInVariants}
                            initial="initial"
                            whileInView="animate"
                            viewport={{ once: true }}
                            transition={{ ...quickTransition, delay: 0.1 }}
                            className="cursor-target"
                        >
                            <div className="text-3xl md:text-4xl font-bold text-lime-400 mb-2">{"<"}10ms</div>
                            <div className="text-gray-400">Latency</div>
                        </motion.div>
                        <motion.div
                            variants={scaleInVariants}
                            initial="initial"
                            whileInView="animate"
                            viewport={{ once: true }}
                            transition={{ ...quickTransition, delay: 0.3 }}
                            className="cursor-target"
                        >
                            <div className="text-3xl md:text-4xl font-bold text-lime-400 mb-2">256-bit</div>
                            <div className="text-gray-400">Encryption</div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-20 px-4">
                <div className="container mx-auto">
                    <motion.div
                        className="text-center mb-16"
                        variants={fadeInUpVariants}
                        initial="initial"
                        whileInView="animate"
                        viewport={{ once: true }}
                        transition={smoothTransition}
                    >
                        <h2 className="text-4xl md:text-5xl font-bold mb-4">
                            Revolutionary <span className="text-lime-400">Features</span>
                        </h2>
                        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                            Experience the cutting-edge capabilities that make Pixeliy the ultimate communication platform
                        </p>
                    </motion.div>

                    <motion.div
                        className="grid lg:grid-cols-2 xl:grid-cols-3 gap-8"
                        variants={staggerContainerVariants}
                        initial="initial"
                        whileInView="animate"
                        viewport={{ once: true }}
                    >
                        {/* AI Translation */}
                        <motion.div variants={scaleInVariants} transition={quickTransition}>
                            <SpotlightCard spotlightColor="rgba(163, 230, 53, 0.3)">
                                <div className="flex items-center mb-6">
                                    <div className="w-12 h-12 bg-lime-400/10 rounded-lg flex items-center justify-center mr-4">
                                        <Languages className="h-6 w-6 text-lime-400" />
                                    </div>
                                    <h3 className="text-xl font-semibold text-white">AI Translation</h3>
                                </div>
                                <p className="text-gray-400 mb-4">
                                    Break language barriers with real-time AI-powered translation for global collaboration.
                                </p>
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center space-x-2 text-gray-300">
                                        <CheckCircle className="h-4 w-4 text-lime-400" />
                                        <span>100+ Languages</span>
                                    </div>
                                    <div className="flex items-center space-x-2 text-gray-300">
                                        <CheckCircle className="h-4 w-4 text-lime-400" />
                                        <span>Real-time Processing</span>
                                    </div>
                                    <div className="flex items-center space-x-2 text-gray-300">
                                        <CheckCircle className="h-4 w-4 text-lime-400" />
                                        <span>Context Aware</span>
                                    </div>
                                </div>
                            </SpotlightCard>
                        </motion.div>

                        {/* AI Agent Assistant */}
                        <motion.div variants={scaleInVariants} transition={quickTransition}>
                            <SpotlightCard spotlightColor="rgba(163, 230, 53, 0.3)">
                                <div className="flex items-center mb-6">
                                    <div className="w-12 h-12 bg-lime-400/10 rounded-lg flex items-center justify-center mr-4">
                                        <Brain className="h-6 w-6 text-lime-400" />
                                    </div>
                                    <h3 className="text-xl font-semibold text-white">AI Agent Assistant</h3>
                                </div>
                                <p className="text-gray-400 mb-4">
                                    Smart collaboration companion that helps manage meetings, takes notes, and provides contextual
                                    assistance.
                                </p>
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center space-x-2 text-gray-300">
                                        <FileText className="h-4 w-4 text-lime-400" />
                                        <span>Meeting Summaries</span>
                                    </div>
                                    <div className="flex items-center space-x-2 text-gray-300">
                                        <Calendar className="h-4 w-4 text-lime-400" />
                                        <span>Smart Scheduling</span>
                                    </div>
                                    <div className="flex items-center space-x-2 text-gray-300">
                                        <CheckCircle className="h-4 w-4 text-lime-400" />
                                        <span>Action Items</span>
                                    </div>
                                </div>
                            </SpotlightCard>
                        </motion.div>

                        {/* Smart Rooms */}
                        <motion.div variants={scaleInVariants} transition={quickTransition}>
                            <SpotlightCard spotlightColor="rgba(163, 230, 53, 0.3)">
                                <div className="flex items-center mb-6">
                                    <div className="w-12 h-12 bg-lime-400/10 rounded-lg flex items-center justify-center mr-4">
                                        <Users className="h-6 w-6 text-lime-400" />
                                    </div>
                                    <h3 className="text-xl font-semibold text-white">Smart Rooms</h3>
                                </div>
                                <p className="text-gray-400 mb-4">
                                    Create or join rooms instantly with automatic participant management and adaptive quality.
                                </p>
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center space-x-2 text-gray-300">
                                        <Zap className="h-4 w-4 text-lime-400" />
                                        <span>Instant Creation</span>
                                    </div>
                                    <div className="flex items-center space-x-2 text-gray-300">
                                        <Users className="h-4 w-4 text-lime-400" />
                                        <span>Auto Management</span>
                                    </div>
                                    <div className="flex items-center space-x-2 text-gray-300">
                                        <Video className="h-4 w-4 text-lime-400" />
                                        <span>Adaptive Quality</span>
                                    </div>
                                </div>
                            </SpotlightCard>
                        </motion.div>

                        {/* Cross-Platform */}
                        <motion.div variants={scaleInVariants} transition={quickTransition}>
                            <SpotlightCard spotlightColor="rgba(163, 230, 53, 0.3)">
                                <div className="flex items-center mb-6">
                                    <div className="w-12 h-12 bg-lime-400/10 rounded-lg flex items-center justify-center mr-4">
                                        <Smartphone className="h-6 w-6 text-lime-400" />
                                    </div>
                                    <h3 className="text-xl font-semibold text-white">Cross-Platform</h3>
                                </div>
                                <p className="text-gray-400 mb-4">
                                    Works seamlessly across all devices and browsers without installation.
                                </p>
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center space-x-2 text-gray-300">
                                        <CheckCircle className="h-4 w-4 text-lime-400" />
                                        <span>No Installation</span>
                                    </div>
                                    <div className="flex items-center space-x-2 text-gray-300">
                                        <CheckCircle className="h-4 w-4 text-lime-400" />
                                        <span>Universal Access</span>
                                    </div>
                                    <div className="flex items-center space-x-2 text-gray-300">
                                        <Smartphone className="h-4 w-4 text-lime-400" />
                                        <span>All Devices</span>
                                    </div>
                                </div>
                            </SpotlightCard>
                        </motion.div>

                        {/* Privacy First */}
                        <motion.div variants={scaleInVariants} transition={quickTransition}>
                            <SpotlightCard spotlightColor="rgba(163, 230, 53, 0.3)">
                                <div className="flex items-center mb-6">
                                    <div className="w-12 h-12 bg-lime-400/10 rounded-lg flex items-center justify-center mr-4">
                                        <Eye className="h-6 w-6 text-lime-400" />
                                    </div>
                                    <h3 className="text-xl font-semibold text-white">Privacy First</h3>
                                </div>
                                <p className="text-gray-400 mb-4">
                                    Zero-knowledge architecture. Your data never touches central servers. True end-to-end encryption.
                                </p>
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center space-x-2 text-gray-300">
                                        <Lock className="h-4 w-4 text-lime-400" />
                                        <span>End-to-End Encryption</span>
                                    </div>
                                    <div className="flex items-center space-x-2 text-gray-300">
                                        <Shield className="h-4 w-4 text-lime-400" />
                                        <span>No Central Servers</span>
                                    </div>
                                    <div className="flex items-center space-x-2 text-gray-300">
                                        <Eye className="h-4 w-4 text-lime-400" />
                                        <span>Zero Knowledge</span>
                                    </div>
                                </div>
                            </SpotlightCard>
                        </motion.div>

                        {/* Decentralized Network */}
                        <motion.div variants={scaleInVariants} transition={quickTransition}>
                            <SpotlightCard spotlightColor="rgba(163, 230, 53, 0.3)">
                                <div className="flex items-center mb-6">
                                    <div className="w-12 h-12 bg-lime-400/10 rounded-lg flex items-center justify-center mr-4">
                                        <Network className="h-6 w-6 text-lime-400" />
                                    </div>
                                    <h3 className="text-xl font-semibold text-white">Decentralized Network</h3>
                                </div>
                                <p className="text-gray-400 mb-4">
                                    Built on Internet Computer Protocol for unstoppable, censorship-resistant communication.
                                </p>
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center space-x-2 text-gray-300">
                                        <Globe className="h-4 w-4 text-lime-400" />
                                        <span>Global P2P Network</span>
                                    </div>
                                    <div className="flex items-center space-x-2 text-gray-300">
                                        <Server className="h-4 w-4 text-lime-400" />
                                        <span>No Single Point of Failure</span>
                                    </div>
                                    <div className="flex items-center space-x-2 text-gray-300">
                                        <Wifi className="h-4 w-4 text-lime-400" />
                                        <span>Direct P2P Connections</span>
                                    </div>
                                </div>
                            </SpotlightCard>
                        </motion.div>
                    </motion.div>
                </div>
            </section>

            {/* Technology Showcase */}
            <section id="technology" className="py-20 px-4 bg-gradient-to-b from-gray-900/50 to-black">
                <div className="container mx-auto">
                    <motion.div
                        className="text-center mb-16"
                        variants={fadeInUpVariants}
                        initial="initial"
                        whileInView="animate"
                        viewport={{ once: true }}
                        transition={smoothTransition}
                    >
                        <h2 className="text-4xl md:text-5xl font-bold mb-4">
                            Built on <span className="text-lime-400">Internet Computer</span>
                        </h2>
                        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                            Revolutionary dRTC protocol leveraging the power of decentralized infrastructure
                        </p>
                    </motion.div>

                    <motion.div
                        className="grid lg:grid-cols-2 gap-12 items-center"
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8 }}
                    >
                        <motion.div
                            variants={fadeInLeftVariants}
                            initial="initial"
                            whileInView="animate"
                            viewport={{ once: true }}
                            transition={smoothTransition}
                        >
                            <Badge className="mb-4 bg-lime-400/10 text-lime-400 border-lime-400/20">Advanced Technology</Badge>
                            <h3 className="text-3xl md:text-4xl font-bold mb-6">
                                Decentralized <span className="text-lime-400">Real-Time</span> Communication
                            </h3>
                            <p className="text-xl text-gray-400 mb-8">
                                Experience true peer-to-peer communication without centralized servers, built for maximum privacy and
                                global accessibility.
                            </p>

                            <div className="space-y-6">
                                {[
                                    {
                                        title: "Internet Computer Protocol",
                                        description: "Built on the world's most advanced blockchain network for unstoppable applications.",
                                    },
                                    {
                                        title: "Zero-Knowledge Architecture",
                                        description: "Your communications remain completely private with no central authority.",
                                    },
                                    {
                                        title: "Global P2P Network",
                                        description: "Direct peer-to-peer connections for maximum speed and reliability.",
                                    },
                                ].map((item, index) => (
                                    <motion.div
                                        key={index}
                                        className="flex items-start space-x-4 cursor-target"
                                        initial={{ opacity: 0, y: 20 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: index * 0.1 }}
                                    >
                                        <div className="w-8 h-8 bg-lime-400/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                                            <CheckCircle className="h-4 w-4 text-lime-400" />
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-semibold text-white mb-2">{item.title}</h4>
                                            <p className="text-gray-400">{item.description}</p>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>

                        <motion.div
                            className="relative"
                            initial={{ opacity: 0, x: 50 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                        >
                            <div className="grid grid-cols-2 gap-6">
                                {[
                                    { icon: Network, title: "dRTC Protocol", subtitle: "Decentralized RTC" },
                                    { icon: Shield, title: "Zero Trust", subtitle: "Maximum Security" },
                                    { icon: Globe, title: "Global Scale", subtitle: "Worldwide Access" },
                                    { icon: Wifi, title: "P2P Direct", subtitle: "No Intermediaries" },
                                ].map((item, index) => (
                                    <motion.div
                                        key={index}
                                        className="bg-gradient-to-br from-lime-400/20 to-green-400/20 rounded-2xl p-6 backdrop-blur-sm border border-lime-400/20 text-center cursor-target"
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        whileInView={{ opacity: 1, scale: 1 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: index * 0.1, type: "spring", stiffness: 400, damping: 17 }}
                                        whileHover={{ scale: 1.05, y: -5 }}
                                    >
                                        <item.icon className="h-8 w-8 text-lime-400 mx-auto mb-3" />
                                        <div className="text-lg font-bold text-white">{item.title}</div>
                                        <div className="text-sm text-gray-400">{item.subtitle}</div>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    </motion.div>
                </div>
            </section>

            {/* Benefits Section */}
            <section className="py-20 px-4">
                <div className="container mx-auto">
                    <motion.div
                        className="text-center mb-16"
                        variants={fadeInUpVariants}
                        initial="initial"
                        whileInView="animate"
                        viewport={{ once: true }}
                        transition={smoothTransition}
                    >
                        <h2 className="text-4xl md:text-5xl font-bold mb-4">
                            Why Choose <span className="font-logo text-lime-400 cursor-target text-[0.85em] align-baseline transform translate-y-[-0.25em] inline-block">Pixeliy</span>?
                        </h2>

                        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                            Experience the advantages of next-generation communication technology
                        </p>
                    </motion.div>

                    <motion.div
                        className="grid md:grid-cols-3 gap-8"
                        variants={staggerContainerVariants}
                        initial="initial"
                        whileInView="animate"
                        viewport={{ once: true }}
                    >
                        <motion.div variants={scaleInVariants} transition={quickTransition} className="text-center cursor-target">
                            <div className="w-16 h-16 bg-lime-400/10 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Zap className="h-8 w-8 text-lime-400" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-4">10x Faster</h3>
                            <p className="text-gray-400">
                                Revolutionary optimization delivers communication speeds 10 times faster than traditional platforms.
                            </p>
                        </motion.div>

                        <motion.div variants={scaleInVariants} transition={quickTransition} className="text-center cursor-target">
                            <div className="w-16 h-16 bg-lime-400/10 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Shield className="h-8 w-8 text-lime-400" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-4">100% Secure</h3>
                            <p className="text-gray-400">
                                Zero-knowledge architecture ensures your data remains completely private and secure at all times.
                            </p>
                        </motion.div>

                        <motion.div variants={scaleInVariants} transition={quickTransition} className="text-center cursor-target">
                            <div className="w-16 h-16 bg-lime-400/10 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Brain className="h-8 w-8 text-lime-400" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-4">AI Enhanced</h3>
                            <p className="text-gray-400">
                                Intelligent features that learn from your communication patterns to enhance productivity.
                            </p>
                        </motion.div>
                    </motion.div>
                </div>
            </section>

            {/* Roadmap */}
            <section id="roadmap" className="py-20 px-4 bg-gradient-to-r from-lime-400/5 to-green-400/5">
                <div className="container mx-auto">
                    <motion.div
                        className="text-center mb-16"
                        variants={fadeInUpVariants}
                        initial="initial"
                        whileInView="animate"
                        viewport={{ once: true }}
                        transition={smoothTransition}
                    >
                        <h2 className="text-4xl md:text-5xl font-bold mb-4">
                            Product <span className="text-lime-400">Roadmap</span>
                        </h2>
                        <p className="text-xl text-gray-400">Building the future of decentralized communication, one step at a time.</p>
                    </motion.div>

                    <motion.div
                        className="grid lg:grid-cols-2 gap-8"
                        variants={staggerContainerVariants}
                        initial="initial"
                        whileInView="animate"
                        viewport={{ once: true }}
                    >
                        {/* Q3 2025 - Completed */}
                        <motion.div variants={scaleInVariants} transition={quickTransition} className="cursor-target">
                            <Card className="bg-gray-900 border-lime-400/20 overflow-hidden">
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <Badge className="bg-lime-400 text-black px-3 py-1 font-semibold">Q3 2025</Badge>
                                        <div className="text-sm text-lime-400 font-medium">COMPLETED</div>
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-4">dRTC Protocol Foundation</h3>
                                    <div className="space-y-3">
                                        <div className="flex items-center space-x-3">
                                            <CheckCircle className="h-4 w-4 text-lime-400" />
                                            <span className="text-gray-300">Core P2P Communication</span>
                                        </div>
                                        <div className="flex items-center space-x-3">
                                            <CheckCircle className="h-4 w-4 text-lime-400" />
                                            <span className="text-gray-300">End-to-End Encryption</span>
                                        </div>
                                        <div className="flex items-center space-x-3">
                                            <CheckCircle className="h-4 w-4 text-lime-400" />
                                            <span className="text-gray-300">Smart Rooms Creation</span>
                                        </div>
                                        <div className="flex items-center space-x-3">
                                            <CheckCircle className="h-4 w-4 text-lime-400" />
                                            <span className="text-gray-300">Cross-Platform Support</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>

                        {/* Q3 2025 - In Progress */}
                        <motion.div variants={scaleInVariants} transition={quickTransition} className="cursor-target">
                            <Card className="bg-gray-900 border-lime-400/20 overflow-hidden">
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <Badge className="bg-lime-400/20 text-lime-400 border border-lime-400/40 px-3 py-1 font-semibold">Q3 2025</Badge>
                                        <div className="text-sm text-yellow-400 font-medium">IN PROGRESS</div>
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-4">AI Integration & Translation</h3>
                                    <div className="space-y-3">
                                        <div className="flex items-center space-x-3">
                                            <Languages className="h-4 w-4 text-lime-400" />
                                            <span className="text-gray-300">Real-time AI Translation (100+ Languages)</span>
                                        </div>
                                        <div className="flex items-center space-x-3">
                                            <Brain className="h-4 w-4 text-lime-400" />
                                            <span className="text-gray-300">AI Agent Assistant</span>
                                        </div>
                                        <div className="flex items-center space-x-3">
                                            <FileText className="h-4 w-4 text-lime-400" />
                                            <span className="text-gray-300">Smart Meeting Summaries</span>
                                        </div>
                                        <div className="flex items-center space-x-3">
                                            <Calendar className="h-4 w-4 text-lime-400" />
                                            <span className="text-gray-300">Intelligent Scheduling</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>

                        {/* Q3 2025 - Planned */}
                        <motion.div variants={scaleInVariants} transition={quickTransition} className="cursor-target">
                            <Card className="bg-gray-900 border-gray-600/20 overflow-hidden">
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <Badge className="bg-gray-700 text-gray-300 px-3 py-1 font-semibold">Q3 2025</Badge>
                                        <div className="text-sm text-gray-400 font-medium">PLANNED</div>
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-4">Tokenization & Marketplace</h3>
                                    <div className="space-y-3">
                                        <div className="flex items-center space-x-3">
                                            <div className="h-4 w-4 rounded-full bg-gray-600"></div>
                                            <span className="text-gray-300">PIXL Token</span>
                                        </div>
                                        <div className="flex items-center space-x-3">
                                            <div className="h-4 w-4 rounded-full bg-gray-600"></div>
                                            <span className="text-gray-300">User Rewards</span>
                                        </div>
                                        <div className="flex items-center space-x-3">
                                            <div className="h-4 w-4 rounded-full bg-gray-600"></div>
                                            <span className="text-gray-300">Decentralized Storage Integration</span>
                                        </div>
                                        <div className="flex items-center space-x-3">
                                            <div className="h-4 w-4 rounded-full bg-gray-600"></div>
                                            <span className="text-gray-300">NFT Marketplace for Digital Assets</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>

                        {/* Q4 2025 */}
                        <motion.div variants={scaleInVariants} transition={quickTransition} className="cursor-target">
                            <Card className="bg-gray-900 border-gray-600/20 overflow-hidden">
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <Badge className="bg-gray-700 text-gray-300 px-3 py-1 font-semibold">Q4 2025</Badge>
                                        <div className="text-sm text-gray-400 font-medium">PLANNED</div>
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-4">Immersive Experience & AI Personalization</h3>
                                    <div className="space-y-3">
                                        <div className="flex items-center space-x-3">
                                            <div className="h-4 w-4 rounded-full bg-gray-600"></div>
                                            <span className="text-gray-300">Virtual Meeting Rooms</span>
                                        </div>
                                        <div className="flex items-center space-x-3">
                                            <div className="h-4 w-4 rounded-full bg-gray-600"></div>
                                            <span className="text-gray-300">Custom AI Avatars</span>
                                        </div>
                                        <div className="flex items-center space-x-3">
                                            <div className="h-4 w-4 rounded-full bg-gray-600"></div>
                                            <span className="text-gray-300">Personal AI Agents Creation</span>
                                        </div>
                                        <div className="flex items-center space-x-3">
                                            <div className="h-4 w-4 rounded-full bg-gray-600"></div>
                                            <span className="text-gray-300">Advanced Avatar Customization</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>

                        {/* Q1 2026 */}
                        <motion.div variants={scaleInVariants} transition={quickTransition} className="cursor-target">
                            <Card className="bg-gray-900 border-gray-600/20 overflow-hidden">
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <Badge className="bg-gray-700 text-gray-300 px-3 py-1 font-semibold">Q1 2026</Badge>
                                        <div className="text-sm text-gray-400 font-medium">FUTURE</div>
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-4">Enterprise & Analytics</h3>
                                    <div className="space-y-3">
                                        <div className="flex items-center space-x-3">
                                            <div className="h-4 w-4 rounded-full bg-gray-600"></div>
                                            <span className="text-gray-300">Enterprise Solutions Suite</span>
                                        </div>
                                        <div className="flex items-center space-x-3">
                                            <div className="h-4 w-4 rounded-full bg-gray-600"></div>
                                            <span className="text-gray-300">Advanced Analytics Dashboard</span>
                                        </div>
                                        <div className="flex items-center space-x-3">
                                            <div className="h-4 w-4 rounded-full bg-gray-600"></div>
                                            <span className="text-gray-300">Third-party Integrations</span>
                                        </div>
                                        <div className="flex items-center space-x-3">
                                            <div className="h-4 w-4 rounded-full bg-gray-600"></div>
                                            <span className="text-gray-300">Real-time Performance Monitoring</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>

                        {/* 2026+ Vision */}
                        <motion.div variants={scaleInVariants} transition={quickTransition} className="cursor-target">
                            <Card className="bg-gradient-to-br from-lime-400/10 to-green-400/10 border-lime-400/30 overflow-hidden">
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <Badge className="bg-gradient-to-r from-lime-400 to-green-400 text-black px-3 py-1 font-semibold">2026+</Badge>
                                        <div className="text-sm text-lime-400 font-medium">VISION</div>
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-4">The Future of Communication</h3>
                                    <div className="space-y-3">
                                        <div className="flex items-center space-x-3">
                                            <Globe className="h-4 w-4 text-lime-400" />
                                            <span className="text-gray-300">Global Metaverse Integration</span>
                                        </div>
                                        <div className="flex items-center space-x-3">
                                            <Brain className="h-4 w-4 text-lime-400" />
                                            <span className="text-gray-300">Advanced AI Consciousness</span>
                                        </div>
                                        <div className="flex items-center space-x-3">
                                            <Shield className="h-4 w-4 text-lime-400" />
                                            <span className="text-gray-300">Quantum-resistant Security</span>
                                        </div>
                                        <div className="flex items-center space-x-3">
                                            <Network className="h-4 w-4 text-lime-400" />
                                            <span className="text-gray-300">Interplanetary Network Protocol</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </motion.div>

                    {/* Timeline Indicator */}
                    <motion.div
                        className="mt-12 text-center"
                        variants={fadeInUpVariants}
                        initial="initial"
                        whileInView="animate"
                        viewport={{ once: true }}
                        transition={{ ...smoothTransition, delay: 0.3 }}
                    >
                        <div className="inline-flex items-center space-x-4 bg-gray-900/50 rounded-full px-6 py-3 border border-lime-400/20">
                            <div className="flex items-center space-x-2">
                                <div className="w-3 h-3 bg-lime-400 rounded-full"></div>
                                <span className="text-sm text-gray-300">Completed</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                                <span className="text-sm text-gray-300">In Progress</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <div className="w-3 h-3 bg-gray-600 rounded-full"></div>
                                <span className="text-sm text-gray-300">Planned</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <div className="w-3 h-3 bg-lime-400/60 rounded-full"></div>
                                <span className="text-sm text-gray-300">Vision</span>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 px-4">
                <div className="container mx-auto text-center">
                    <motion.div
                        className="max-w-4xl mx-auto"
                        variants={fadeInUpVariants}
                        initial="initial"
                        whileInView="animate"
                        viewport={{ once: true }}
                        transition={smoothTransition}
                    >
                        <h2 className="text-4xl md:text-6xl font-bold mb-6">
                            Ready for the <span className="text-lime-400">Future</span>?
                        </h2>
                        <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
                            Join the revolution of decentralized communication. Experience true privacy, AI-powered collaboration, and
                            unstoppable connectivity.
                        </p>
                        <motion.div
                            className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8"
                            variants={slideInFromBottomVariants}
                            initial="initial"
                            whileInView="animate"
                            viewport={{ once: true }}
                            transition={{ ...smoothTransition, delay: 0.2 }}
                        >
                            <motion.div
                                whileHover={{ scale: 1.05, y: -2 }}
                                whileTap={{ scale: 0.95 }}
                                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                            >
                                <Button size="lg" className="bg-lime-400 text-black hover:bg-lime-500 px-8 py-4 text-lg cursor-target" onClick={handleGetStarted}>
                                    Start Building on dRTC
                                    <ArrowRight className="ml-2 h-5 w-5" />
                                </Button>
                            </motion.div>
                            <motion.div
                                whileHover={{ scale: 1.05, y: -2 }}
                                whileTap={{ scale: 0.95 }}
                                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                            >
                                <Button
                                    size="lg"
                                    variant="outline"
                                    className="border-lime-400 text-lime-400 hover:bg-lime-400 hover:text-black px-8 py-4 text-lg bg-transparent cursor-target"
                                >
                                    Learn More
                                </Button>
                            </motion.div>
                        </motion.div>
                        <p className="text-sm text-gray-500">Decentralized • Private • Unstoppable</p>
                    </motion.div>
                </div>
            </section>

            {/* Footer */}
            <motion.footer
                className="py-12 px-4 border-t border-lime-400/20"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
            >
                <div className="container mx-auto">
                    <div className="grid md:grid-cols-4 gap-8">
                        <div>
                            <h3 className="font-logo text-2xl text-lime-400 mb-4 cursor-target inline-block">
                                PIXELIY
                            </h3>
                            <p className="text-gray-400 mb-4">
                                The future of decentralized real-time communication with AI-powered collaboration.
                            </p>
                        </div>

                        <div>
                            <h3 className="font-semibold text-white mb-4">Product</h3>
                            <ul className="space-y-2 text-gray-400">
                                <li>
                                    <a href="#" className="hover:text-lime-400 transition-colors cursor-target">
                                        Features
                                    </a>
                                </li>
                                <li>
                                    <a href="#" className="hover:text-lime-400 transition-colors cursor-target">
                                        dRTC Protocol
                                    </a>
                                </li>
                                <li>
                                    <a href="#" className="hover:text-lime-400 transition-colors cursor-target">
                                        Security
                                    </a>
                                </li>
                                <li>
                                    <a href="#" className="hover:text-lime-400 transition-colors cursor-target">
                                        Canister
                                    </a>
                                </li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="font-semibold text-white mb-4">Company</h3>
                            <ul className="space-y-2 text-gray-400">
                                <li>
                                    <a href="#" className="hover:text-lime-400 transition-colors cursor-target">
                                        About
                                    </a>
                                </li>
                                <li>
                                    <a href="#" className="hover:text-lime-400 transition-colors cursor-target">
                                        Careers
                                    </a>
                                </li>
                                <li>
                                    <a href="#" className="hover:text-lime-400 transition-colors cursor-target">
                                        Blog
                                    </a>
                                </li>
                                <li>
                                    <a href="#" className="hover:text-lime-400 transition-colors cursor-target">
                                        Contact
                                    </a>
                                </li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="font-semibold text-white mb-4">Developers</h3>
                            <ul className="space-y-2 text-gray-400">
                                <li>
                                    <a href="#" className="hover:text-lime-400 transition-colors cursor-target">
                                        Documentation
                                    </a>
                                </li>
                                <li>
                                    <a href="#" className="hover:text-lime-400 transition-colors cursor-target">
                                        GitHub
                                    </a>
                                </li>
                                <li>
                                    <a href="#" className="hover:text-lime-400 transition-colors cursor-target">
                                        Community
                                    </a>
                                </li>
                                <li>
                                    <a href="#" className="hover:text-lime-400 transition-colors cursor-target">
                                        Support
                                    </a>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div className="border-t border-lime-400/20 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
                        <p className="text-gray-400 text-sm">© 2025 Pixeliy. Built on Internet Computer.</p>
                        <div className="flex space-x-6 mt-4 md:mt-0">
                            <a href="#" className="text-gray-400 hover:text-lime-400 transition-colors text-sm cursor-target">
                                Privacy Policy
                            </a>
                            <a href="#" className="text-gray-400 hover:text-lime-400 transition-colors text-sm cursor-target">
                                Terms of Service
                            </a>
                            <a href="#" className="text-gray-400 hover:text-lime-400 transition-colors text-sm cursor-target">
                                Cookie Policy
                            </a>
                        </div>
                    </div>
                </div>
            </motion.footer>
        </div>
    )
}
