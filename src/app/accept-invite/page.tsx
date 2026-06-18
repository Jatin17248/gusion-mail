"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input2";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, Users, User, Lock, Phone, Mail, Eye, EyeOff } from "lucide-react";
import { AcceptInviteErrorCard, type InviteErrorType } from "@/_components/auth/AcceptInviteErrorCard";
import { toast } from "sonner";
import { FcGoogle } from "react-icons/fc";
import { FaMeta } from "react-icons/fa6";
import { motion } from "framer-motion";

function AcceptInviteContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { data: session } = useSession();
    const token = searchParams.get("token");

    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const [inviteData, setInviteData] = useState<{
        email: string;
        businessName: string;
        businessId: string;
    } | null>(null);

    const [userExists, setUserExists] = useState(false);
    const [errorType, setErrorType] = useState<InviteErrorType | null>(null);
    const [success, setSuccess] = useState(false);

    // Form data for new account
    const [formData, setFormData] = useState({
        name: "",
        password: "",
        phone: ""
    });

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

    useEffect(() => {
        if (token) {
            void fetchInviteDetails();
        } else {
            setErrorType("NOT_FOUND");
            setLoading(false);
        }
    }, [token]);

    // Re-fetch invite details when session appears (e.g., after OAuth login)
    // This ensures we get the updated userExists status for newly created OAuth accounts
    useEffect(() => {
        if (session && token && !loading) {
            void fetchInviteDetails();
        }
    }, [session?.user?.email]); // Re-fetch when session email changes

    // Auto-accept for logged-in existing users
    useEffect(() => {
        if (session && userExists && inviteData && !success) {
            void acceptInviteForExistingUser();
        }
    }, [session, userExists, inviteData, success]);

    const fetchInviteDetails = async () => {
        try {
            const response = await fetch(`/api/auth/accept-invite?token=${token}`);
            const data = await response.json();

            if (!response.ok) {
                setErrorType(data.code || "NOT_FOUND");
                setLoading(false);
                return;
            }

            setInviteData({
                email: data.invite.email,
                businessName: data.invite.businessName,
                businessId: data.invite.businessId
            });
            setUserExists(data.userExists);
            setLoading(false);
        } catch (err) {
            setErrorType("NOT_FOUND");
            setLoading(false);
        }
    };

    const acceptInviteForExistingUser = async () => {
        try {
            const response = await fetch("/api/auth/accept-invite", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token })
            });

            const data = await response.json();

            if (!response.ok) {
                if (data.code === 'REQUIRES_AUTH') {
                    return;
                }
                toast.error(data.error || "Failed to join team");
                return;
            }

            setSuccess(true);
            toast.success(`You've joined ${data.businessName}!`);
            setTimeout(() => router.push("/dashboard"), 1500);
        } catch (err) {
            toast.error("Failed to join team");
        }
    };

    const handleCreateAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);

        try {
            const response = await fetch("/api/auth/create-invite-account", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    token,
                    ...formData
                })
            });

            const data = await response.json();

            if (!response.ok) {
                toast.error(data.error || "Failed to create account");
                setCreating(false);
                return;
            }

            // Account created successfully, now login with NextAuth redirect
            toast.success("Account created! Logging you in...");

            // Use signIn with redirect: false to handle errors, then manually redirect
            await signIn("Gusion", {
                email: inviteData?.email,
                password: formData.password,
                redirect: true,
                callbackUrl: "/dashboard"
            });

            // Note: If redirect is true, code below won't execute
            // NextAuth will handle the redirect automatically
        } catch (err) {
            toast.error("Failed to create account");
            setCreating(false);
        }
    };

    const handleOAuthLogin = (provider: string) => {
        void signIn(provider, { callbackUrl: `/accept-invite?token=${token}` });
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-linear-to-b from-[#fffaf5] via-[#fff2e0] to-[#ffe0d3]">
                <Loader2 className="w-8 h-8 animate-spin text-[#e61f2a]" />
            </div>
        );
    }

    if (errorType) {
        return (
            <div className="min-h-screen relative overflow-hidden bg-[#fff2e0]">
                <div className="absolute inset-0 bg-linear-to-b from-[#fffaf5] via-[#fff2e0] to-[#ffe0d3]" />
                <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
                    <AcceptInviteErrorCard errorType={errorType} />
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen relative overflow-hidden bg-[#fff2e0]">
                <div className="absolute inset-0 bg-linear-to-b from-[#fffaf5] via-[#fff2e0] to-[#ffe0d3]" />
                <div className="relative z-10 flex items-center justify-center min-h-screen px-4">
                    <Card className="max-w-md w-full shadow-2xl">
                        <CardContent className="py-12 text-center">
                            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                                <CheckCircle2 className="w-8 h-8 text-green-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-900 mb-2">
                                Welcome to the Team!
                            </h2>
                            <p className="text-slate-600 mb-6">
                                You&apos;ve successfully joined <strong>{inviteData?.businessName}</strong>
                            </p>
                            <p className="text-sm text-slate-500">Redirecting to dashboard...</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    // User exists but not logged in - show login prompt
    if (userExists && !session) {
        return (
            <div className="min-h-screen relative overflow-hidden bg-[#fff2e0]">
                <div className="absolute inset-0 bg-linear-to-b from-[#fffaf5] via-[#fff2e0] to-[#ffe0d3]" />
                <div className="pointer-events-none absolute inset-0 hidden sm:block">
                    <div className="absolute -top-24 -right-20 h-80 w-80 rounded-full bg-[#e61f2a]/18 blur-3xl" />
                    <div className="absolute -bottom-28 -left-16 h-80 w-80 rounded-full bg-indigo-500/16 blur-3xl" />
                </div>

                <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-full max-w-md"
                    >
                        <Card className="shadow-2xl border-0">
                            <CardHeader className="text-center space-y-3 pb-6">
                                <div className="w-16 h-16 mx-auto bg-linear-to-br from-[#e61f2a] to-[#ff4444] rounded-2xl flex items-center justify-center shadow-lg">
                                    <Users className="w-8 h-8 text-white" />
                                </div>
                                <CardTitle className="text-2xl font-bold">You&apos;re Invited!</CardTitle>
                                <CardDescription className="text-base">
                                    Join <strong className="text-slate-900">{inviteData?.businessName}</strong>
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                    <p className="text-sm text-blue-900 mb-1.5 font-medium">
                                        Account found: <strong>{inviteData?.email}</strong>
                                    </p>
                                    <p className="text-xs text-blue-700">
                                        Please login to accept this invitation
                                    </p>
                                </div>

                                <Button
                                    onClick={() => router.push(`/login`)}
                                    className="w-full h-12 rounded-2xl bg-[#e61f2a] hover:bg-[#cf1a24] shadow-lg text-base font-semibold"
                                    size="lg"
                                >
                                    <Lock className="w-4 h-4 mr-2" />
                                    Login to Accept Invitation
                                </Button>

                                <div className="flex items-center gap-3 text-xs text-neutral-500">
                                    <div className="h-px flex-1 bg-neutral-200" />
                                    <span>Or login with</span>
                                    <div className="h-px flex-1 bg-neutral-200" />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <Button type="button" variant="outline" onClick={() => handleOAuthLogin("google")} className="h-12 rounded-2xl">
                                        <FcGoogle size={22} />
                                    </Button>
                                    <Button type="button" variant="outline" onClick={() => handleOAuthLogin("facebook")} className="h-12 rounded-2xl">
                                        <FaMeta size={22} className="text-[#0668E1]" />
                                    </Button>

                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
            </div>
        );
    }

    // New user - show registration form matching login page design
    return (
        <div className="min-h-screen relative overflow-hidden bg-[#fff2e0]">
            <div className="absolute inset-0 bg-linear-to-b from-[#fffaf5] via-[#fff2e0] to-[#ffe0d3]" />
            <div className="pointer-events-none absolute inset-0 hidden sm:block">
                <div className="absolute -top-24 -right-20 h-80 w-80 rounded-full bg-[#e61f2a]/18 blur-3xl" />
                <div className="absolute -bottom-28 -left-16 h-80 w-80 rounded-full bg-indigo-500/16 blur-3xl" />
                <div className="absolute top-1/2 left-1/2 h-88 w-160 -translate-x-1/2 -translate-y-1/2 rounded-[999px] border border-white/50 bg-white/10 backdrop-blur-3xl" />
            </div>

            <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-lg"
                >
                    <Card className="shadow-2xl border-0 bg-white/95 backdrop-blur">
                        <CardHeader className="text-center space-y-3 pb-6">
                            <div className="w-16 h-16 mx-auto bg-linear-to-br from-[#e61f2a] to-[#ff4444] rounded-2xl flex items-center justify-center shadow-lg">
                                <Users className="w-8 h-8 text-white" />
                            </div>
                            <CardTitle className="text-2xl font-bold">Complete Your Profile</CardTitle>
                            <CardDescription className="text-base">
                                You&apos;ve been invited to join <strong className="text-slate-900">{inviteData?.businessName}</strong>
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleCreateAccount} className="space-y-4">
                                {/* Email (read-only) */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-neutral-600">Email</Label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                                        <Input
                                            value={inviteData?.email}
                                            disabled
                                            className="pl-10 h-11 rounded-2xl bg-slate-100 border-neutral-200"
                                        />
                                    </div>
                                </div>

                                {/* Name */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-neutral-600">Full Name *</Label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                                        <Input
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            required
                                            placeholder="John Doe"
                                            className="pl-10 h-11 rounded-2xl border-neutral-200 focus-visible:ring-0 focus-visible:border-[#e61f2a] focus:shadow-[0_0_0_4px_rgba(230,31,42,0.05)]"
                                        />
                                    </div>
                                </div>

                                {/* Password */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-neutral-600">Password *</Label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                                        <Input
                                            type={showPassword ? "text" : "password"}
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            required
                                            placeholder="••••••••"
                                            className="pl-10 pr-10 h-11 rounded-2xl border-neutral-200 focus-visible:ring-0 focus-visible:border-[#e61f2a] focus:shadow-[0_0_0_4px_rgba(230,31,42,0.05)]"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>

                                {/* Phone */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-neutral-600">Phone *</Label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                                        <Input
                                            type="tel"
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            required
                                            placeholder="+1 (555) 000-0000"
                                            className="pl-10 h-11 rounded-2xl border-neutral-200 focus-visible:ring-0 focus-visible:border-[#e61f2a] focus:shadow-[0_0_0_4px_rgba(230,31,42,0.05)]"
                                        />
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    disabled={creating}
                                    className="mt-2 w-full h-12 rounded-2xl bg-[#e61f2a] text-white text-[15px] font-semibold shadow-[0_10px_20px_rgba(230,31,42,0.25)] hover:bg-[#cf1a24] hover:shadow-[0_14px_28px_rgba(230,31,42,0.35)] active:scale-[0.98] transition-all duration-200"
                                    size="lg"
                                >
                                    {creating ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Creating Account...
                                        </>
                                    ) : (
                                        "Create Account & Join Team"
                                    )}
                                </Button>

                                <div className="flex items-center gap-3 text-xs text-neutral-500 pt-2">
                                    <div className="h-px flex-1 bg-neutral-200" />
                                    <span>Or sign up with</span>
                                    <div className="h-px flex-1 bg-neutral-200" />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <Button type="button" variant="outline" onClick={() => handleOAuthLogin("google")} className="h-12 rounded-2xl">
                                        <FcGoogle size={22} />
                                    </Button>
                                    <Button type="button" variant="outline" onClick={() => handleOAuthLogin("facebook")} className="h-12 rounded-2xl">
                                        <FaMeta size={22} className="text-[#0668E1]" />
                                    </Button>

                                </div>

                                <p className="text-xs text-center text-slate-500 pt-2">
                                    By continuing, you agree to Gusion&apos;s Terms of Service
                                </p>
                            </form>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </div>
    );
}

export default function AcceptInvitePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-linear-to-b from-[#fffaf5] via-[#fff2e0] to-[#ffe0d3]">
                <Loader2 className="w-8 h-8 animate-spin text-[#e61f2a]" />
            </div>
        }>
            <AcceptInviteContent />
        </Suspense>
    );
}
