"use client";

import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input2";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Lock, Eye, EyeOff, CheckCircle, ArrowLeft } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import RightFormRotations from "./RightFormRotations";

const ResetPasswordForm = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Invalid reset link");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    // Validate password strength
    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
      console.error("Reset password error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <>
        <div className="min-h-screen relative overflow-hidden bg-[#fff2e0]">
          {/* Warm gradient wash */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#fffaf5] via-[#fff2e0] to-[#ffe0d3]" />

          {/* Color blobs + glass orbit */}
          <div className="pointer-events-none absolute inset-0 hidden sm:block">
            <div className="absolute -top-24 -left-20 h-80 w-80 rounded-full bg-[#e61f2a]/18 blur-3xl" />
            <div className="absolute -bottom-28 -right-16 h-80 w-80 rounded-full bg-[#0067ff]/16 blur-3xl" />
            <div className="absolute top-1/2 left-1/2 h-[22rem] w-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-[999px] border border-white/50 bg-white/10 backdrop-blur-3xl" />
          </div>

          {/* Main content */}
          <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10 sm:py-0">
            <motion.div
              layoutId="auth-container"
              className="w-full max-w-md"
            >
              <Card className="bg-white/60 backdrop-blur-xl border-0 shadow-xl rounded-[30px] p-8 text-center">
                <CardContent className="pt-6">
                  <div className="flex justify-center mb-6">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-10 h-10 text-green-600" />
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold text-neutral-900 mb-2">
                    Password Reset Successful!
                  </h2>
                  <p className="text-neutral-600">
                    Redirecting you to login...
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen relative overflow-hidden bg-[#fff2e0]">
        {/* Warm gradient wash */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#fffaf5] via-[#fff2e0] to-[#ffe0d3]" />

        {/* Color blobs + glass orbit */}
        <div className="pointer-events-none absolute inset-0 hidden sm:block">
          <div className="absolute -top-24 -left-20 h-80 w-80 rounded-full bg-[#e61f2a]/18 blur-3xl" />
          <div className="absolute -bottom-28 -right-16 h-80 w-80 rounded-full bg-[#0067ff]/16 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 h-[22rem] w-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-[999px] border border-white/50 bg-white/10 backdrop-blur-3xl" />
        </div>

        {/* Main content */}
        <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10 sm:py-0">
          <motion.div
            layoutId="auth-container"
            className="w-full max-w-5xl grid items-center lg:grid-cols-[minmax(0,1fr)_1.15fr]
        rounded-[30px] 
        bg-[url('https://cdn.gusion.omsoftwares.in/images/login-banner-bg.jpg')] bg-[linear-gradient(275deg,_rgb(205,214,229)_0%,_rgb(211,246,242)_100%)] bg-no-repeat bg-cover bg-center
        shadow-2xl overflow-hidden
        "
          >
            {/* Left: Reset Password card */}
            <Card
              className="relative w-full h-full flex flex-col justify-center bg-white/60 backdrop-blur-xl  border-0  shadow-xl rounded-[30px] p-6 sm:p-10
          order-2 lg:order-1
          "
            >
              <CardHeader className="space-y-4 pb-6 pt-0 px-0">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fff2e0] shadow-sm mb-2">
                  <Lock size={24} className="text-[#e61f2a]" />
                </div>

                <div className="space-y-1 text-center">
                  <h2 className="text-2xl font-semibold tracking-tight text-[#1a1a1a]">
                    Create New Password
                  </h2>
                  <p className="text-sm text-neutral-500">
                    Please enter your new password below
                  </p>
                </div>
              </CardHeader>

              <CardContent className="px-0 pb-0">
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Error Message */}
                  {error && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                      {error}
                    </div>
                  )}

                  {/* New Password */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-neutral-600">
                      New Password
                    </Label>
                    <div className="relative">
                      <Lock
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                        size={18}
                      />
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={(e) =>
                          setFormData({ ...formData, password: e.target.value })
                        }
                        required
                        disabled={isLoading || !token}
                        className="pl-10 pr-10 h-11 rounded-2xl border-neutral-200 bg-white text-sm 
                          focus-visible:ring-0 focus-visible:border-[#e61f2a] focus:shadow-[0_0_0_4px_rgba(230,31,42,0.05)]
                          transition-all duration-300 placeholder:text-neutral-400 opacity-100!"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">
                      Must be at least 8 characters
                    </p>
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-neutral-600">
                      Confirm Password
                    </Label>
                    <div className="relative">
                      <Lock
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                        size={18}
                      />
                      <Input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={formData.confirmPassword}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            confirmPassword: e.target.value,
                          })
                        }
                        required
                        disabled={isLoading || !token}
                        className="pl-10 pr-10 h-11 rounded-2xl border-neutral-200 bg-white text-sm 
                          focus-visible:ring-0 focus-visible:border-[#e61f2a] focus:shadow-[0_0_0_4px_rgba(230,31,42,0.05)]
                          transition-all duration-300 placeholder:text-neutral-400 opacity-100!"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
                      >
                        {showConfirmPassword ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    size="lg"
                    disabled={isLoading || !token}
                    className="mt-2 w-full h-[48px] rounded-2xl bg-[#e61f2a] text-white text-[15px] font-semibold
                      shadow-[0_10px_20px_rgba(230,31,42,0.25)] hover:bg-[#cf1a24] hover:shadow-[0_14px_28px_rgba(230,31,42,0.35)] 
                      active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="relative top-[-1px]">
                      {isLoading ? "Resetting..." : "Reset Password"}
                    </span>
                  </Button>

                  {/* Back to Login */}
                  <div className="pt-4 text-center">
                    <Link
                      href="/login"
                      className="inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-[#e61f2a] transition-colors"
                    >
                      <ArrowLeft size={16} />
                      Back to login
                    </Link>
                  </div>
                </form>
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

export default ResetPasswordForm;
