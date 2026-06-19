"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    XCircle,
    Clock,
    CheckCircle2,
    AlertTriangle,
    LogOut,
    ArrowLeft
} from "lucide-react";
import Link from "next/link";

export type InviteErrorType =
    | "SESSION_MISMATCH"
    | "EXPIRED"
    | "INVITE_CANCELLED"
    | "ALREADY_MEMBER"
    | "ALREADY_OWNER"
    | "BUSINESS_NOT_FOUND"
    | "NOT_FOUND";

interface AcceptInviteErrorCardProps {
    errorType: InviteErrorType;
    currentEmail?: string;
    requiredEmail?: string;
    expiresAt?: Date;
    onLogout?: () => void;
}

export function AcceptInviteErrorCard({
    errorType,
    currentEmail,
    requiredEmail,
    expiresAt,
    onLogout
}: AcceptInviteErrorCardProps) {
    const renderContent = () => {
        switch (errorType) {
            case "SESSION_MISMATCH":
                return (
                    <>
                        <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 dark:bg-amber-900 rounded-full flex items-center justify-center">
                            <AlertTriangle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                            Wrong Email Account
                        </h2>
                        <div className="text-slate-600 dark:text-slate-400 mb-6 space-y-2">
                            <p>You&apos;re currently logged in as:</p>
                            <p className="font-semibold text-slate-900 dark:text-white">{currentEmail}</p>
                            <p className="mt-3">But this invitation was sent to:</p>
                            <p className="font-semibold text-slate-900 dark:text-white">{requiredEmail}</p>
                            <p className="mt-3 text-sm">Please logout and login with the correct email address to accept this invitation.</p>
                        </div>
                        <div className="flex gap-3 justify-center">
                            <Link href="/">
                                <Button variant="ghost">
                                    <ArrowLeft className="w-4 h-4 mr-2" />
                                    Back to Dashboard
                                </Button>
                            </Link>
                            {onLogout && (
                                <Button
                                    onClick={onLogout}
                                    variant="default"
                                    className="bg-indigo-500 hover:bg-[#0052cc]"
                                >
                                    <LogOut className="w-4 h-4 mr-2" />
                                    Logout and Continue
                                </Button>
                            )}
                        </div>
                    </>
                );

            case "EXPIRED":
                return (
                    <>
                        <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 dark:bg-amber-900 rounded-full flex items-center justify-center">
                            <Clock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                            Invitation Expired
                        </h2>
                        <p className="text-slate-600 dark:text-slate-400 mb-6">
                            This invitation expired on{" "}
                            {expiresAt ? new Date(expiresAt).toLocaleDateString() : "a previous date"}.
                            <br />
                            Please ask the business owner to send a new invitation.
                        </p>
                        <Link href="/login">
                            <Button className="bg-indigo-500 hover:bg-[#0052cc]">
                                Back to Login
                            </Button>
                        </Link>
                    </>
                );

            case "INVITE_CANCELLED":
                return (
                    <>
                        <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                            <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                            Invitation Cancelled
                        </h2>
                        <p className="text-slate-600 dark:text-slate-400 mb-6">
                            This invitation has been cancelled by the business owner or is no longer valid.
                        </p>
                        <Link href="/login">
                            <Button className="bg-indigo-500 hover:bg-[#0052cc]">
                                Back to Login
                            </Button>
                        </Link>
                    </>
                );

            case "ALREADY_MEMBER":
                return (
                    <>
                        <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                            Already a Member
                        </h2>
                        <p className="text-slate-600 dark:text-slate-400 mb-6">
                            You&apos;re already a member of this business team.
                        </p>
                        <Link href="/">
                            <Button className="bg-indigo-500 hover:bg-[#0052cc]">
                                Go to Dashboard
                            </Button>
                        </Link>
                    </>
                );

            case "ALREADY_OWNER":
                return (
                    <>
                        <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                            You Own This Business
                        </h2>
                        <p className="text-slate-600 dark:text-slate-400 mb-6">
                            You&apos;re already the owner of this business. No invitation needed!
                        </p>
                        <Link href="/">
                            <Button className="bg-indigo-500 hover:bg-[#0052cc]">
                                Go to Dashboard
                            </Button>
                        </Link>
                    </>
                );

            case "BUSINESS_NOT_FOUND":
            case "NOT_FOUND":
            default:
                return (
                    <>
                        <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                            <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                            Invalid Invitation
                        </h2>
                        <p className="text-slate-600 dark:text-slate-400 mb-6">
                            This invitation link is invalid or has expired.
                        </p>
                        <Link href="/login">
                            <Button className="bg-indigo-500 hover:bg-[#0052cc]">
                                Back to Login
                            </Button>
                        </Link>
                    </>
                );
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
            <Card className="max-w-md w-full">
                <CardContent className="py-12 text-center">
                    {renderContent()}
                </CardContent>
            </Card>
        </div>
    );
}
