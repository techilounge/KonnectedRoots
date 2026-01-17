'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Lock, Zap } from 'lucide-react';

interface UpgradePromptProps {
    isOpen: boolean;
    onClose: () => void;
    feature: 'trees' | 'people' | 'collaborators' | 'exports' | 'ai' | 'storage' | 'gedcom' | 'roles';
    currentUsage?: number;
    limit?: number;
}

const featureMessages: Record<string, { title: string; description: string; icon: React.ReactNode }> = {
    trees: {
        title: 'Tree Limit Reached',
        description: 'You\'ve reached the maximum of 3 trees on the Free plan. Upgrade to Pro for unlimited family trees.',
        icon: <Lock className="h-6 w-6" />,
    },
    people: {
        title: 'People Limit Reached',
        description: 'This tree has reached 500 people on the Free plan. Upgrade to Pro to add unlimited family members.',
        icon: <Lock className="h-6 w-6" />,
    },
    collaborators: {
        title: 'Collaborator Limit Reached',
        description: 'You\'ve invited the maximum 2 collaborators on Free. Upgrade to Pro for up to 10 collaborators.',
        icon: <Lock className="h-6 w-6" />,
    },
    exports: {
        title: 'Export Limit Reached',
        description: 'You\'ve used your 2 free exports this month. Upgrade to Pro for unlimited, watermark-free exports.',
        icon: <Lock className="h-6 w-6" />,
    },
    ai: {
        title: 'AI Credits Exhausted',
        description: 'You\'ve used all your AI actions this month. Upgrade to Pro for 200 actions, or add the AI Pack for 1,000 more.',
        icon: <Zap className="h-6 w-6 text-violet-500" />,
    },
    storage: {
        title: 'Storage Limit Reached',
        description: 'You\'ve used your 1GB of storage. Upgrade to Pro for 50GB to store more photos and media.',
        icon: <Lock className="h-6 w-6" />,
    },
    gedcom: {
        title: 'GEDCOM Export - Pro Feature',
        description: 'GEDCOM export is available on Pro and Family plans. Upgrade to backup and transfer your family tree.',
        icon: <Sparkles className="h-6 w-6 text-primary" />,
    },
    roles: {
        title: 'Role Upgrade Required',
        description: 'Editor and Manager roles are Pro features. Free users can only invite Viewers. Upgrade for full collaboration.',
        icon: <Lock className="h-6 w-6" />,
    },
};

export function UpgradePrompt({ isOpen, onClose, feature, currentUsage, limit }: UpgradePromptProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const { title, description, icon } = featureMessages[feature] || featureMessages.trees;

    const handleUpgrade = () => {
        setLoading(true);
        router.push('/pricing');
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                        {icon}
                    </div>
                    <DialogTitle className="text-center">{title}</DialogTitle>
                    <DialogDescription className="text-center">
                        {description}
                        {currentUsage !== undefined && limit !== undefined && (
                            <Badge variant="secondary" className="mt-2 block mx-auto w-fit">
                                {currentUsage} / {limit} used
                            </Badge>
                        )}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
                        Maybe Later
                    </Button>
                    <Button onClick={handleUpgrade} disabled={loading} className="w-full sm:w-auto">
                        {loading ? 'Redirecting...' : 'View Plans'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Hook to show upgrade prompt
 */
export function useUpgradePrompt() {
    const [promptState, setPromptState] = useState<{
        isOpen: boolean;
        feature: UpgradePromptProps['feature'];
        currentUsage?: number;
        limit?: number;
    }>({
        isOpen: false,
        feature: 'trees',
    });

    const showUpgradePrompt = (
        feature: UpgradePromptProps['feature'],
        options?: { currentUsage?: number; limit?: number }
    ) => {
        setPromptState({
            isOpen: true,
            feature,
            ...options,
        });
    };

    const closeUpgradePrompt = () => {
        setPromptState(prev => ({ ...prev, isOpen: false }));
    };

    return {
        ...promptState,
        showUpgradePrompt,
        closeUpgradePrompt,
    };
}
