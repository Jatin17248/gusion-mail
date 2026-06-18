import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Users, Crown, User, Trash2, Mail, Clock, UserPlus, Loader2
} from "lucide-react";
import { toast } from "sonner";

export interface TeamMember {
    id: string;
    email: string;
    fullName: string;
    role: 'owner' | 'member';
    joinedAt?: Date;
}

export interface PendingInvite {
    id: string;
    email: string;
    createdAt?: Date;
    expiresAt: Date | string;
}

export interface TeamData {
    owner: TeamMember;
    members: TeamMember[];
    pendingInvites: PendingInvite[];
}

interface TeamSettingsTabProps {
    team: TeamData;
    userRole: 'owner' | 'member';
    onInvite: (email: string) => Promise<void>;
    onRemove: (email: string) => Promise<void>;
    onCancelInvite: (inviteId: string) => Promise<void>;
}

export function TeamSettingsTab({ team, userRole, onInvite, onRemove, onCancelInvite }: TeamSettingsTabProps) {
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviting, setInviting] = useState(false);
    const maxMembers = 5;

    const currentMemberCount = team.members.length;
    const isOwner = userRole === 'owner';

    const handleInvite = async () => {
        if (!inviteEmail.trim()) return;
        setInviting(true);
        try {
            await onInvite(inviteEmail);
            toast.success(`Invitation sent to ${inviteEmail}`);
            setInviteEmail("");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to send invite');
        } finally {
            setInviting(false);
        }
    };

    const handleRemove = async (email: string) => {
        if (!confirm(`Remove ${email} from the team?`)) return;
        try {
            await onRemove(email);
            toast.success('Member removed');
        } catch (error) {
            toast.error('Failed to remove member');
        }
    };

    const handleCancelInvite = async (inviteId: string) => {
        if (!confirm(`Cancel this invitation?`)) return;
        try {
            await onCancelInvite(inviteId);
            toast.success('Invite cancelled');
        } catch (error) {
            toast.error('Failed to cancel invite');
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span>Team Members</span>
                        <Badge variant="outline">
                            {currentMemberCount + 1} / {maxMembers + 1} members
                        </Badge>
                    </CardTitle>
                    <CardDescription>
                        Manage who has access to your business dashboard
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Owner */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between p-4 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-amber-200 dark:bg-amber-800 flex items-center justify-center">
                                <Crown className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                                <p className="font-medium text-slate-900 dark:text-white">{team.owner.fullName || 'Owner'}</p>
                                <p className="text-sm text-slate-500">{team.owner.email}</p>
                            </div>
                        </div>
                        <Badge className="bg-amber-500">Owner</Badge>
                    </div>

                    {/* Team members */}
                    {team.members.map((member) => (
                        <div key={member.id} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                                    <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-medium text-slate-900 dark:text-white truncate">{member.fullName || member.email}</p>
                                    <p className="text-sm text-slate-500 truncate">{member.email}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary">Member</Badge>
                                {isOwner && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleRemove(member.email)}
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Pending invites */}
                    {team.pendingInvites.map((invite) => (
                        <div key={invite.id} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                            <div className="flex items-center gap-3 flex-1">
                                <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
                                    <Mail className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-slate-900 dark:text-white truncate">{invite.email}</p>
                                    <p className="text-sm text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        Pending • Expires {new Date(invite.expiresAt).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                                    Pending
                                </Badge>
                                {isOwner && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleCancelInvite(invite.id)}
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                        title="Cancel invitation"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}

                    {team.members.length === 0 && team.pendingInvites.length === 0 && (
                        <div className="text-center py-8 text-slate-500">
                            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>No team members yet</p>
                            {isOwner && <p className="text-sm">Invite colleagues to help manage your business</p>}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Invite Section */}
            {isOwner && currentMemberCount < maxMembers && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <UserPlus className="w-5 h-5" />
                            Invite Team Member
                        </CardTitle>
                        <CardDescription>
                            Send an invitation email to add a new team member (max {maxMembers} members)
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Input
                                type="email"
                                placeholder="Enter email address"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                                className="flex-1"
                            />
                            <Button
                                onClick={handleInvite}
                                disabled={inviting || !inviteEmail.trim()}
                                className="bg-[#0067ff] hover:bg-[#0052cc]"
                            >
                                {inviting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                        <UserPlus className="w-4 h-4 mr-2" />
                                        Send Invite
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {isOwner && currentMemberCount >= maxMembers && (
                <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
                    <CardContent className="py-4">
                        <p className="text-amber-700 dark:text-amber-300">
                            Maximum team size reached ({maxMembers} members). Remove a member to add someone new.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
