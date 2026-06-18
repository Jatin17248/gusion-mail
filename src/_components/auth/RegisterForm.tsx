"use client";
import React, { useState } from "react";
import { Input } from "@/components/ui/input2";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Eye, EyeOff, User, Phone } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { FaMeta } from "react-icons/fa6";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { formSchema } from "@/schemas/registerForm.schema";

type FormValues = z.infer<typeof formSchema>;

const RegisterForm = () => {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  const onSubmit = async (data: FormValues) => {
    try {
      setLoading(true);
      setServerError("");

      const res = await fetch("/api/user/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (res.status === 409) {
        setServerError("User already exists with this email or phone number");
        alert(
          "An account already exists with this email or phone number. Please log in to continue."
        );
        router.push("/login");
        return;
      }

      if (!res.ok) {
        const errorData = await res.json();
        setServerError(errorData?.message || "OOPS! Something Went Wrong");
        return;
      }

      await res.json();

      // Auto sign-in after successful registration
      const signInResult = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (signInResult?.ok) {
        try {
          const statusResponse = await fetch("/api/user/status");
          const statusData = await statusResponse.json();
          if (statusData.onboardingCompleted) {
            router.push("/");
          } else {
            router.push("/register/onboarding");
          }
        } catch {
          router.push("/");
        }
      } else {
        router.push("/login");
      }
    } catch {
      setServerError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Error Message */}
        {serverError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {serverError}
          </div>
        )}

        {/* Name */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-neutral-600">Full Name</Label>
          <div className="relative">
            <User
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              size={18}
            />
            <Input
              type="text"
              placeholder="John Doe"
              {...register("name")}
              disabled={loading}
              className={`pl-10 h-11 rounded-2xl border-neutral-200 bg-white text-sm 
                      focus-visible:ring-0 focus-visible:border-[#e61f2a] focus:shadow-[0_0_0_4px_rgba(230,31,42,0.05)]
                      transition-all duration-300 placeholder:text-neutral-400 disabled:opacity-50
                      ${errors.name ? "border-red-500" : ""}`}
            />
          </div>
          {errors.name && (
            <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>
          )}
        </div>

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
              {...register("email")}
              disabled={loading}
              className={`pl-10 h-11 rounded-2xl border-neutral-200 bg-white text-sm 
                      focus-visible:ring-0 focus-visible:border-[#e61f2a] focus:shadow-[0_0_0_4px_rgba(230,31,42,0.05)]
                      transition-all duration-300 placeholder:text-neutral-400 disabled:opacity-50
                      ${errors.email ? "border-red-500" : ""}`}
            />
          </div>
          {errors.email && (
            <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-neutral-600">Password</Label>
          <div className="relative">
            <Lock
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              size={18}
            />
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              {...register("password")}
              disabled={loading}
              className={`pl-10 pr-10 h-11 rounded-2xl border-neutral-200 bg-white text-sm 
                      focus-visible:ring-0 focus-visible:border-[#e61f2a] focus:shadow-[0_0_0_4px_rgba(230,31,42,0.05)]
                      transition-all duration-300 placeholder:text-neutral-400 disabled:opacity-50
                      ${errors.password ? "border-red-500" : ""}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && (
            <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
          )}
        </div>

        {/* Phone */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-neutral-600">Phone</Label>
          <div className="relative">
            <Phone
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              size={18}
            />
            <Input
              type="tel"
              placeholder="+1 (555) 000-0000"
              {...register("phone")}
              disabled={loading}
              className={`pl-10 h-11 rounded-2xl border-neutral-200 bg-white text-sm 
                      focus-visible:ring-0 focus-visible:border-[#e61f2a] focus:shadow-[0_0_0_4px_rgba(230,31,42,0.05)]
                      transition-all duration-300 placeholder:text-neutral-400 disabled:opacity-50
                      ${errors.phone ? "border-red-500" : ""}`}
            />
          </div>
          {errors.phone && (
            <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>
          )}
        </div>

        {/* Terms & Conditions */}
        <div className="flex items-start gap-2 text-xs">
          <p className="text-gray-600">
            By continuing, I agree to the{" "}
            <Link
              className="text-[#e61f2a] underline hover:text-[#cf1a24] transition-colors"
              href="/terms"
            >
              Terms of Service and Privacy Policy.
            </Link>
          </p>
        </div>

        {/* Primary CTA */}
        <Button
          type="submit"
          size="lg"
          disabled={loading}
          className="mt-2 w-full h-12 rounded-2xl bg-[#e61f2a] text-white text-[15px] font-semibold flex items-center justify-center gap-2
                  shadow-[0_10px_20px_rgba(230,31,42,0.25)] hover:bg-[#cf1a24] hover:shadow-[0_14px_28px_rgba(230,31,42,0.35)] 
                  active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="relative -top-px">
            {loading ? "Creating Account..." : "GET STARTED"}
          </span>
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
            aria-label="Sign up with Google"
          >
            <FcGoogle size={22} className="group-hover:scale-110 transition-transform duration-300" />
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => signIn("facebook", { callbackUrl: "/dashboard" })}
            className="h-12 w-full rounded-2xl border-neutral-200 bg-white hover:bg-neutral-50 hover:border-neutral-300 transition-all duration-300 active:scale-95 group"
            aria-label="Sign up with Meta"
          >
            <FaMeta size={22} className="text-[#0668E1] group-hover:scale-110 transition-transform duration-300" />
          </Button>
        </div>

        {/* Login Link */}
        <div className="pt-4 text-center">
          <p className="text-xs text-neutral-500">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-[#e61f2a] font-semibold hover:underline transition-all"
            >
              Login
            </Link>
          </p>
        </div>
      </form>
    </>
  );
};

export default RegisterForm;
