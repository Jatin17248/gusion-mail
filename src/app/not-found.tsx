"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { signIn } from "next-auth/react";

// Floating star component
const FloatingStar = ({ delay, x, y, size }: { delay: number; x: number; y: number; size: number }) => (
    <motion.div
        className="absolute"
        initial={{ opacity: 0, scale: 0 }}
        animate={{
            opacity: [0, 1, 0],
            scale: [0, 1, 0],
            y: [y, y - 20, y],
        }}
        transition={{
            duration: 3,
            delay,
            repeat: Infinity,
            ease: "easeInOut",
        }}
        style={{ left: `${x}%`, top: `${y}%` }}
    >
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            className="text-[#0067ff]"
        >
            <path
                d="M12 2L14.09 8.26L21 9.27L16 14.14L17.18 21.02L12 17.77L6.82 21.02L8 14.14L3 9.27L9.91 8.26L12 2Z"
                fill="currentColor"
                opacity="0.6"
            />
        </svg>
    </motion.div>
);

// Animated gradient orb
const GradientOrb = ({ className }: { className?: string }) => (
    <motion.div
        className={`absolute rounded-full blur-3xl opacity-30 ${className}`}
        animate={{
            scale: [1, 1.2, 1],
            opacity: [0.2, 0.4, 0.2],
        }}
        transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
        }}
    />
);

export default function NotFound() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Generate random stars positions
    const stars = Array.from({ length: 12 }, (_, i) => ({
        id: i,
        x: Math.random() * 90 + 5,
        y: Math.random() * 80 + 10,
        size: Math.random() * 16 + 12,
        delay: Math.random() * 2,
    }));

    return (
        <div className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#f8f9ff] via-[#e8f4ff] to-[#fff8f0] dark:from-[#0a0a0f] dark:via-[#0f1419] dark:to-[#0a0a0f]">
            {/* Animated background orbs */}
            <GradientOrb className="w-96 h-96 bg-[#0067ff] -top-20 -left-20" />
            <GradientOrb className="w-80 h-80 bg-[#00d4ff] -bottom-10 -right-10" />
            <GradientOrb className="w-64 h-64 bg-[#ff6b6b] top-1/3 right-1/4" />

            {/* Grid pattern overlay */}
            <div className="absolute inset-0 bg-grid-pattern opacity-[0.03] dark:opacity-[0.05]" />

            {/* Floating stars */}
            {mounted && stars.map((star) => (
                <FloatingStar
                    key={star.id}
                    x={star.x}
                    y={star.y}
                    size={star.size}
                    delay={star.delay}
                />
            ))}

            {/* Main content */}
            <motion.div
                className="relative z-10 flex flex-col items-center text-center px-6 max-w-2xl"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
            >
                {/* 404 Number with gradient */}
                <motion.div
                    className="relative mb-4"
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                >
                    <h1 className="text-[140px] sm:text-[180px] md:text-[220px] font-black leading-none tracking-tighter bg-gradient-to-br from-[#0067ff] via-[#00a3ff] to-[#00d4ff] bg-clip-text text-transparent select-none">
                        404
                    </h1>

                    {/* Glowing effect behind 404 */}
                    <div className="absolute inset-0 text-[140px] sm:text-[180px] md:text-[220px] font-black leading-none tracking-tighter text-[#0067ff] opacity-20 blur-2xl -z-10">
                        404
                    </div>
                </motion.div>

                {/* Lost star illustration */}
                <motion.div
                    className="relative mb-6"
                    initial={{ opacity: 0, rotate: -10 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                >
                    <div className="flex items-center gap-2 px-5 py-2 bg-white/80 dark:bg-white/10 backdrop-blur-sm rounded-full border border-[#0067ff]/20 shadow-lg shadow-[#0067ff]/5">
                        <motion.svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            className="text-[#ffb800]"
                            animate={{ rotate: [0, 10, -10, 0] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        >
                            <path
                                d="M12 2L14.09 8.26L21 9.27L16 14.14L17.18 21.02L12 17.77L6.82 21.02L8 14.14L3 9.27L9.91 8.26L12 2Z"
                                fill="currentColor"
                            />
                        </motion.svg>
                        <span className="text-sm font-medium text-[#012b57] dark:text-white/90">
                            This star got lost in the galaxy
                        </span>
                    </div>
                </motion.div>

                {/* Message */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.5 }}
                    className="space-y-4 mb-10"
                >
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#012b57] dark:text-white">
                        Page Not Found
                    </h2>
                    <p className="text-base sm:text-lg text-[#012b57]/70 dark:text-white/60 max-w-md mx-auto leading-relaxed">
                        Oops! It looks like this page has drifted away into the digital cosmos.
                        Let&apos;s get you back on track.
                    </p>
                </motion.div>

                {/* Action buttons */}
                <motion.div
                    className="flex flex-col sm:flex-row items-center gap-4"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.6 }}
                >
                    <Link href="/">
                        <motion.button
                            className="group relative px-8 py-4 bg-gradient-to-r from-[#0067ff] to-[#0052cc] text-white font-semibold rounded-xl shadow-xl shadow-[#0067ff]/25 hover:shadow-2xl hover:shadow-[#0067ff]/30 transition-all duration-300 overflow-hidden cursor-pointer"
                            whileHover={{ scale: 1.02, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            {/* Shimmer effect */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />

                            <span className="relative flex items-center gap-2">
                                <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                    <polyline points="9 22 9 12 15 12 15 22" />
                                </svg>
                                Go to Homepage
                            </span>
                        </motion.button>
                    </Link>

                    <motion.button
                        onClick={() => signIn("google")}
                        className="px-8 py-4 bg-white/80 dark:bg-white/10 backdrop-blur-sm text-[#012b57] dark:text-white font-semibold rounded-xl border border-[#0067ff]/20 hover:border-[#0067ff]/40 hover:bg-white dark:hover:bg-white/20 transition-all duration-300 cursor-pointer"
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <span className="flex items-center gap-2">
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                                <polyline points="10 17 15 12 10 7" />
                                <line x1="15" y1="12" x2="3" y2="12" />
                            </svg>
                            Sign In
                        </span>
                    </motion.button>
                </motion.div>

                {/* Fun suggestion */}
                <motion.p
                    className="mt-10 text-sm text-[#012b57]/50 dark:text-white/40"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.8 }}
                >
                    Or maybe try checking the URL? 🔍
                </motion.p>
            </motion.div>

            {/* Bottom wave decoration */}
            <div className="absolute bottom-0 left-0 right-0 h-32 overflow-hidden">
                <svg
                    viewBox="0 0 1440 120"
                    fill="none"
                    className="absolute bottom-0 w-full h-auto"
                    preserveAspectRatio="none"
                >
                    <motion.path
                        d="M0,60 C360,120 720,0 1080,60 C1260,90 1380,30 1440,60 L1440,120 L0,120 Z"
                        fill="url(#wave-gradient)"
                        initial={{ d: "M0,80 C360,40 720,100 1080,60 C1260,40 1380,80 1440,60 L1440,120 L0,120 Z" }}
                        animate={{
                            d: [
                                "M0,60 C360,120 720,0 1080,60 C1260,90 1380,30 1440,60 L1440,120 L0,120 Z",
                                "M0,80 C360,40 720,100 1080,60 C1260,40 1380,80 1440,60 L1440,120 L0,120 Z",
                                "M0,60 C360,120 720,0 1080,60 C1260,90 1380,30 1440,60 L1440,120 L0,120 Z",
                            ],
                        }}
                        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <defs>
                        <linearGradient id="wave-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#0067ff" stopOpacity="0.1" />
                            <stop offset="50%" stopColor="#00a3ff" stopOpacity="0.15" />
                            <stop offset="100%" stopColor="#00d4ff" stopOpacity="0.1" />
                        </linearGradient>
                    </defs>
                </svg>
            </div>

            {/* Noise texture overlay */}
            <div className="absolute inset-0 opacity-[0.015] pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbHRlcj0idXJsKCNhKSIvPjwvc3ZnPg==')]" />
        </div>
    );
}
