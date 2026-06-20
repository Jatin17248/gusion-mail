"use client";
import React, { useState } from "react";
import { Input } from "@/components/ui/input2";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { FaMeta } from "react-icons/fa6";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

const LoginForm = () => {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        setError(result.error);
      } else if (result?.ok) {
        // Check if user has completed onboarding
        try {
          const statusResponse = await fetch('/api/user/status');
          const statusData = await statusResponse.json();

          // Redirect based on onboarding status
          if (statusData.onboardingCompleted) {
            router.push('/dashboard');
          } else {
            router.push('/onboarding');
          }
        } catch (err) {
          console.error('Error checking onboarding status:', err);
          router.push('/dashboard');
        }
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
      console.error("Login error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Error Message */}
        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Email */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-neutral-600">Email</Label>
          <div className="relative">
            <Mail
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              size={18}
            />
            <Input
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              disabled={isLoading}
              className="pl-10 h-11 rounded-2xl border-neutral-200 bg-white text-sm 
                      focus-visible:ring-0 focus-visible:border-[#e61f2a] focus:shadow-[0_0_0_4px_rgba(230,31,42,0.05)]
                      transition-all duration-300 placeholder:text-neutral-400 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium text-neutral-600">
            <Label>Password</Label>
            <Link
              href="/forgot-password"
              className="text-[11px] font-medium text-indigo-500 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              size={18}
            />
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              disabled={isLoading}
              className="pl-10 pr-10 h-11 rounded-2xl border-neutral-200 bg-white text-sm 
                      focus-visible:ring-0 focus-visible:border-[#e61f2a] focus:shadow-[0_0_0_4px_rgba(230,31,42,0.05)]
                      transition-all duration-300 placeholder:text-neutral-400 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* Primary CTA */}
        <Button
          type="submit"
          size="lg"
          disabled={isLoading}
          className="mt-2 w-full h-12 rounded-2xl bg-[#e61f2a] text-white text-[15px] font-semibold flex items-center justify-center gap-2
                  shadow-[0_10px_20px_rgba(230,31,42,0.25)] hover:bg-[#cf1a24] hover:shadow-[0_14px_28px_rgba(230,31,42,0.35)] 
                  active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="relative -top-px">{isLoading ? "Signing in..." : "Sign in"}</span>
        </Button>

        {/* Divider */}
        <div className="flex items-center gap-3 text-[11px] text-neutral-500 pt-2 pb-1">
          <div className="h-px flex-1 bg-neutral-200" />
          <span>Or continue with</span>
          <div className="h-px flex-1 bg-neutral-200" />
        </div>

        {/* Social providers */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            className="h-12 w-full rounded-2xl border-neutral-200 bg-white hover:bg-neutral-50 hover:border-neutral-300 transition-all duration-300 active:scale-95 group"
            aria-label="Sign in with Google"
          >
            <FcGoogle size={22} className="group-hover:scale-110 transition-transform duration-300" />
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => signIn("facebook", { callbackUrl: "/dashboard" })}
            className="h-12 w-full rounded-2xl border-neutral-200 bg-white hover:bg-neutral-50 hover:border-neutral-300 transition-all duration-300 active:scale-95 group"
            aria-label="Sign in with Meta"
          >
            <FaMeta size={22} className="text-[#0668E1] group-hover:scale-110 transition-transform duration-300" />
          </Button>
        </div>

        {/* Register Link (Mobile Friendly) */}
        <div className="pt-4 text-center">
          <p className="text-xs text-neutral-500">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-[#e61f2a] font-semibold hover:underline transition-all">
              Register now
            </Link>
          </p>
        </div>
      </form>
    </>
  );
};

export default LoginForm;
