'use client';

import { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import {
    X, Settings, Link2, Check, ChevronDown, UserPlus,
    Loader2, Globe, Lock, Trash2, Crown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
    getCollaborators,
    inviteCollaborator,
    updateCollaboratorRole,
    removeCollaborator,
    setPublicAccess,
} from '@/app/study/[deckId]/sharing';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    deckId: string;
    deckTitle: string;
    currentUserId: string;
}

interface Collaborator {
    id: string;
    userId: string;
    email: string;
    role: 'VIEWER' | 'EDITOR';
}

export default function ShareModal({
    isOpen,
    onClose,
    deckId,
    deckTitle,
    currentUserId,
}: ShareModalProps) {
    const [email, setEmail] = useState('');
    const [selectedRole, setSelectedRole] = useState<'VIEWER' | 'EDITOR'>('EDITOR');
    const [isLoading, setIsLoading] = useState(false);
    const [isInviting, setIsInviting] = useState(false);
    const [showRoleDropdown, setShowRoleDropdown] = useState(false);
    const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
    const [owner, setOwner] = useState<{ id: string; email: string } | null>(null);
    const [isPublic, setIsPublic] = useState(false);
    const [copied, setCopied] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

    // Load collaborators when modal opens
    useEffect(() => {
        if (isOpen) {
            loadCollaborators();
        }
    }, [isOpen, deckId]);

    const loadCollaborators = async () => {
        setIsLoading(true);
        const result = await getCollaborators(deckId);
        if (result.success && result.data) {
            setOwner(result.data.owner);
            setCollaborators(result.data.collaborators);
            setIsPublic(result.data.isPublic);
        }
        setIsLoading(false);
    };

    const handleInvite = async () => {
        if (!email.trim()) return;

        setIsInviting(true);
        const result = await inviteCollaborator(currentUserId, deckId, email, selectedRole);

        if (result.success) {
            toast.success(`Invited ${email} as ${selectedRole.toLowerCase()}`);
            setEmail('');
            await loadCollaborators();
        } else {
            toast.error(result.error);
        }
        setIsInviting(false);
    };

    const handleRoleChange = async (collaboratorId: string, newRole: 'VIEWER' | 'EDITOR') => {
        const result = await updateCollaboratorRole(currentUserId, collaboratorId, newRole);
        if (result.success) {
            toast.success('Role updated');
            await loadCollaborators();
        } else {
            toast.error(result.error);
        }
        setActiveDropdown(null);
    };

    const handleRemove = async (collaboratorId: string, email: string) => {
        const result = await removeCollaborator(currentUserId, collaboratorId);
        if (result.success) {
            toast.success(`Removed ${email}`);
            await loadCollaborators();
        } else {
            toast.error(result.error);
        }
        setActiveDropdown(null);
    };

    const handlePublicToggle = async () => {
        const newValue = !isPublic;
        const result = await setPublicAccess(currentUserId, deckId, newValue);
        if (result.success) {
            setIsPublic(newValue);
            toast.success(newValue ? 'Anyone with the link can now view' : 'Access restricted to invited users');
        } else {
            toast.error(result.error);
        }
    };

    const handleCopyLink = async () => {
        const url = `${window.location.origin}/study/${deckId}`;
        await navigator.clipboard.writeText(url);
        setCopied(true);
        toast.success('Link copied to clipboard');
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-[95vw] sm:max-w-lg transform rounded-2xl bg-background border border-border p-4 sm:p-6 text-left align-middle shadow-xl transition-all">
                                {/* Header */}
                                <div className="flex items-center justify-between mb-4 sm:mb-6">
                                    <Dialog.Title className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2 truncate pr-2">
                                        Share "{deckTitle.length > 20 ? deckTitle.slice(0, 20) + '...' : deckTitle}"
                                    </Dialog.Title>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={onClose}
                                            className="p-1.5 sm:p-2 hover:bg-muted rounded-lg transition-colors"
                                        >
                                            <X className="w-5 h-5 text-muted-foreground" />
                                        </button>
                                    </div>
                                </div>

                                {/* Add People Input */}
                                <div className="relative mb-6 z-20">
                                    <div className="flex items-center bg-muted/50 border border-input rounded-xl focus-within:ring-2 focus-within:ring-violet-500/50 focus-within:border-violet-500/50 transition-all">
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="Add by email..."
                                            className="flex-1 px-3 py-2 sm:px-4 sm:py-3 bg-transparent text-foreground text-sm placeholder:text-muted-foreground focus:outline-none rounded-l-xl min-w-0"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleInvite();
                                            }}
                                        />

                                        {/* Role Selector */}
                                        <div className="relative border-l border-border shrink-0">
                                            <button
                                                onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                                                className="flex items-center gap-1 px-2 py-2 sm:px-3 sm:py-3 text-xs sm:text-sm text-foreground/80 hover:text-foreground transition-colors"
                                            >
                                                {selectedRole === 'EDITOR' ? 'Editor' : 'Viewer'}
                                                <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4" />
                                            </button>

                                            {showRoleDropdown && (
                                                <div className="absolute right-0 top-full mt-2 w-32 bg-popover border border-border rounded-lg shadow-xl z-50 overflow-hidden">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedRole('EDITOR');
                                                            setShowRoleDropdown(false);
                                                        }}
                                                        className="w-full px-4 py-2 text-left text-sm text-popover-foreground hover:bg-muted transition-colors"
                                                    >
                                                        Editor
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setSelectedRole('VIEWER');
                                                            setShowRoleDropdown(false);
                                                        }}
                                                        className="w-full px-4 py-2 text-left text-sm text-popover-foreground hover:bg-muted transition-colors"
                                                    >
                                                        Viewer
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Send Button */}
                                        <div className="p-1 shrink-0">
                                            <Button
                                                onClick={handleInvite}
                                                disabled={!email.trim() || isInviting}
                                                className="bg-primary hover:bg-primary/90 text-primary-foreground px-3 sm:px-4 h-[34px] sm:h-[42px] rounded-lg text-xs sm:text-sm"
                                            >
                                                {isInviting ? (
                                                    <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                                                ) : (
                                                    'Send'
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {/* People with access */}
                                <div className="mb-6 relative z-10">
                                    <h3 className="text-sm font-medium text-muted-foreground mb-3">People with access</h3>

                                    {isLoading ? (
                                        <div className="flex justify-center py-4">
                                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {/* Owner */}
                                            {owner && (
                                                <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-medium text-sm">
                                                            {owner.email.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium text-foreground">{owner.email}</p>
                                                            <p className="text-xs text-muted-foreground">You</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-amber-500">
                                                        <Crown className="w-4 h-4" />
                                                        <span className="text-sm font-medium">Owner</span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Collaborators */}
                                            {collaborators.map((collab) => (
                                                <div
                                                    key={collab.id}
                                                    className="flex items-center justify-between p-3 rounded-xl bg-card border border-border"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-medium text-sm">
                                                            {collab.email.charAt(0).toUpperCase()}
                                                        </div>
                                                        <p className="text-sm font-medium text-foreground">{collab.email}</p>
                                                    </div>

                                                    {/* Role Dropdown */}
                                                    <div className="relative">
                                                        <button
                                                            onClick={() => setActiveDropdown(activeDropdown === collab.id ? null : collab.id)}
                                                            className="flex items-center gap-1 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                                                        >
                                                            {collab.role === 'EDITOR' ? 'Editor' : 'Viewer'}
                                                            <ChevronDown className="w-4 h-4" />
                                                        </button>

                                                        {activeDropdown === collab.id && (
                                                            <div className="absolute right-0 top-full mt-1 w-48 bg-popover border border-border rounded-lg shadow-xl z-50 overflow-hidden">
                                                                <button
                                                                    onClick={() => handleRoleChange(collab.id, 'EDITOR')}
                                                                    className="w-full px-4 py-3 text-left text-sm text-popover-foreground hover:bg-muted transition-colors flex items-center justify-between"
                                                                >
                                                                    <span className="font-medium">Editor</span>
                                                                    {collab.role === 'EDITOR' && <Check className="w-4 h-4 text-green-500" />}
                                                                </button>
                                                                <button
                                                                    onClick={() => handleRoleChange(collab.id, 'VIEWER')}
                                                                    className="w-full px-4 py-3 text-left text-sm text-popover-foreground hover:bg-muted transition-colors flex items-center justify-between"
                                                                >
                                                                    <span className="font-medium">Viewer</span>
                                                                    {collab.role === 'VIEWER' && <Check className="w-4 h-4 text-green-500" />}
                                                                </button>
                                                                <div className="border-t border-border" />
                                                                <button
                                                                    onClick={() => handleRemove(collab.id, collab.email)}
                                                                    className="w-full px-4 py-3 text-left text-sm text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-2"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                    Remove access
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}

                                            {collaborators.length === 0 && (
                                                <p className="text-sm text-muted-foreground text-center py-4">
                                                    No collaborators yet. Invite someone by email above.
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* General Access */}
                                <div className="border-t border-border pt-6">
                                    <h3 className="text-sm font-medium text-muted-foreground mb-3">General access</h3>

                                    <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border bg-muted/20">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isPublic ? 'bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                                                {isPublic ? <Globe className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-foreground">
                                                    {isPublic ? 'Anyone with the link' : 'Restricted'}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {isPublic ? 'Anyone on the internet with the link can view' : 'Only people added can access'}
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            onClick={handlePublicToggle}
                                            className="flex items-center gap-1 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                                        >
                                            <ChevronDown className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Copy Link */}
                                    <Button
                                        onClick={handleCopyLink}
                                        variant="outline"
                                        className="w-full mt-4 border-border text-foreground hover:bg-muted gap-2"
                                    >
                                        {copied ? (
                                            <>
                                                <Check className="w-4 h-4 text-green-500" />
                                                Copied!
                                            </>
                                        ) : (
                                            <>
                                                <Link2 className="w-4 h-4" />
                                                Copy link
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}
