"use client";

import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input2";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Features } from "@/data/landing-features";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";


interface RightFormRotationsProps {
  ctaRoute?: string;
  ctaBtnText?: string;
  ctaQuestion?: string;
  isRight?: boolean;
}

const RightFormRotations = ({
  ctaRoute = "/login",
  ctaBtnText = "Login now",
  ctaQuestion = "Already have an account?",
  isRight = true
}: RightFormRotationsProps) => {
  const router = useRouter();
  const [currentFeature, setCurrentFeature] = useState(0);
 
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentFeature((prev) => (prev + 1) % Features.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const feature = Features[currentFeature];

  return (
    <>
      <div className={`hidden lg:flex flex-col justify-center items-center text-center h-full min-h-125 p-12

          ${isRight ?"order-1 lg:order-2" : ""}`}>  
            {/* Static Header */}
            <div className="mb-8 space-y-3">
              <h1 className="text-4xl font-bold tracking-tight text-indigo-500">
                Your AI Email Assistant
              </h1>
              <p className="text-sm text-neutral-600 max-w-xs mx-auto">
                Automate replies, summarize threads, schedule meetings, and master your emails with Gusion.
              </p>
            </div>

            <div className="relative w-full max-w-md flex flex-col items-center justify-center h-55">
              <AnimatePresence mode="wait">
                {feature && (
                  <motion.div
                    key={currentFeature}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="flex flex-col items-center space-y-4"
                  >
                    {/* Icon */}
                    <div
                      className="flex items-center justify-center w-20 h-20 rounded-2xl bg-white/60 shadow-sm backdrop-blur-sm"
                      style={{
                        color: currentFeature % 2 === 0 ? "#e61f2a" : "#0067ff",
                      }}
                    >
                      {(() => {
                        const Icon = feature.icon;
                        return <Icon size={40} />;
                      })()}
                    </div>

                    {/* Text Content */}
                    <div className="space-y-2">
                      <h2 className="text-xl font-semibold text-[#1a1a1a]">
                        {feature.title}
                      </h2>
                      <p className="text-sm text-neutral-500 max-w-65 mx-auto leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

              {/* Login Now CTA */}
              <div className="mt-12 flex flex-col items-center gap-3">
                <p className="text-sm font-medium text-neutral-600">
                  {ctaQuestion}
                </p>
                <button
                  type="button"
                  onClick={() => router.push(ctaRoute)}
                  className="group relative inline-flex h-10 items-center justify-center overflow-hidden rounded-xl bg-white/80 px-6 py-2 font-medium text-indigo-500 shadow-sm transition-all duration-300 hover:bg-white hover:shadow-md hover:scale-105"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {ctaBtnText}
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </span>
                </button>
              </div>
            </div>
    </>
  )
}

export default RightFormRotations
