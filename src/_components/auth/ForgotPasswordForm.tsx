"use client";

import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input2";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";

import { motion } from "framer-motion";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import RightFormRotations from "./RightFormRotations";

const ForgotPasswordForm = () => {
  useEffect(() => {
    const htmlElement = document.documentElement;
    const hadDark = htmlElement.classList.contains("dark");
    if (hadDark) {
      htmlElement.classList.remove("dark");
    }
    return () => {
      if (hadDark) {
        htmlElement.classList.add("dark");
      }
    };
  }, []);

  return (
    <>
      <div className="min-h-screen relative overflow-hidden bg-[#fff2e0]">
        {/* Warm gradient wash */}
        <div className="absolute inset-0 bg-linear-to-b from-[#fffaf5] via-[#fff2e0] to-[#ffe0d3]" />

        {/* Color blobs + glass orbit */}
        <div className="pointer-events-none absolute inset-0 hidden sm:block">
          <div className="absolute -top-24 -left-20 h-80 w-80 rounded-full bg-[#e61f2a]/18 blur-3xl" />
          <div className="absolute -bottom-28 -right-16 h-80 w-80 rounded-full bg-indigo-500/16 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 h-88 w-160 -translate-x-1/2 -translate-y-1/2 rounded-[999px] border border-white/50 bg-white/10 backdrop-blur-3xl" />
        </div>

        {/* Main content */}
        <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10 sm:py-0">
          <motion.div
            layoutId="auth-container"
            className="w-full max-w-5xl grid items-center lg:grid-cols-[minmax(0,1fr)_1.15fr]
        rounded-[30px] 
        auth-banner-bg
        shadow-2xl overflow-hidden
        "
          >
            {/* Left: Register card */}
            <Card
              className="relative w-full h-full flex flex-col justify-center bg-white/60 backdrop-blur-xl  border-0  shadow-xl rounded-[30px] p-6 sm:p-10
          order-2 lg:order-1
          "
            >
              <CardHeader className="space-y-4 pb-6 pt-0 px-0">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fff2e0] shadow-sm mb-2">
                  <UserPlus size={24} className="text-[#e61f2a]" />
                </div>

                <div className="space-y-1 text-center">
                  <h2 className="text-2xl font-semibold tracking-tight text-[#1a1a1a]">
                    Forgot Password?
                  </h2>
                  <p className="text-sm text-neutral-500">
                    No worries! Enter your email and we&apos;ll send you reset
                    instructions.
                  </p>
                </div>
              </CardHeader>

              <CardContent className="px-0 pb-0">
                <ForgotPassword />
                <div className="pt-4 text-center">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-[#e61f2a] transition-colors mb-6"
                  >
                    <ArrowLeft size={16} />
                    Back to login
                  </Link>
                </div>
              </CardContent>
            </Card>

            <RightFormRotations
              ctaRoute="/register"
              ctaQuestion="Don't have an account yet?"
              ctaBtnText="Register now"
            />
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default ForgotPasswordForm;

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage(data.message);
        setEmail(""); // Clear form
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
      console.error("Forgot password error:", err);
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Success Message */}
        {message && (
          <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
            {message}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Email Input */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-neutral-600">
            Email Address
          </Label>
          <div className="relative">
            <Mail
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              size={18}
            />
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              className="pl-10 h-11 rounded-2xl border-neutral-200 bg-white text-sm 
                          focus-visible:ring-0 focus-visible:border-[#e61f2a] focus:shadow-[0_0_0_4px_rgba(230,31,42,0.05)]
                          transition-all duration-300 placeholder:text-neutral-400 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          size="lg"
          disabled={isLoading}
          className="mt-2 w-full h-12 rounded-2xl bg-[#e61f2a] text-white text-[15px] font-semibold
                      shadow-[0_10px_20px_rgba(230,31,42,0.25)] hover:bg-[#cf1a24] hover:shadow-[0_14px_28px_rgba(230,31,42,0.35)] 
                      active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="relative -top-px">
            {isLoading ? "Sending..." : "Send Reset Link"}
          </span>
        </Button>
      </form>
    </>
  );
};
