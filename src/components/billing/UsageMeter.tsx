'use client';

import { useEntitlements } from '@/hooks/useEntitlements';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Zap, HardDrive, Download } from 'lucide-react';
import { formatBytes } from '@/lib/billing/constants';

interface UsageMeterProps {
    variant?: 'compact' | 'full';
}

export function UsageMeter({ variant = 'full' }: UsageMeterProps) {
    const {
        loading,
        aiRemaining,
        limits,
        exportsRemaining,
        storageUsedBytes,
        storageQuotaBytes,
    } = useEntitlements();

    if (loading) {
        return <div className="animate-pulse h-20 bg-muted rounded-lg" />;
    }

    const aiPercentUsed = 100 - (aiRemaining / limits.aiActionsAllowance) * 100;
    const storagePercentUsed = (storageUsedBytes / storageQuotaBytes) * 100;

    if (variant === 'compact') {
        return (
            <TooltipProvider>
                <div className="flex items-center gap-4 text-sm">
                    <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1">
                            <Zap className="h-4 w-4 text-violet-500" />
                            <span>{aiRemaining}</span>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{aiRemaining} AI actions remaining this month</p>
                        </TooltipContent>
                    </Tooltip>

                    {exportsRemaining !== null && (
                        <Tooltip>
                            <TooltipTrigger className="flex items-center gap-1">
                                <Download className="h-4 w-4 text-blue-500" />
                                <span>{exportsRemaining}</span>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{exportsRemaining} exports remaining this month</p>
                            </TooltipContent>
                        </Tooltip>
                    )}
                </div>
            </TooltipProvider>
        );
    }

    return (
        <div className="space-y-4">
            {/* AI Actions */}
            <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-violet-500" />
                        <span>AI Actions</span>
                    </div>
                    <span className="text-muted-foreground">
                        {aiRemaining} / {limits.aiActionsAllowance}
                    </span>
                </div>
                <Progress value={aiPercentUsed} className="h-2" />
            </div>

            {/* Exports (only for Free tier) */}
            {exportsRemaining !== null && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                            <Download className="h-4 w-4 text-blue-500" />
                            <span>Exports</span>
                        </div>
                        <span className="text-muted-foreground">
                            {exportsRemaining} / {limits.exportLimitPerMonth}
                        </span>
                    </div>
                    <Progress
                        value={100 - (exportsRemaining / (limits.exportLimitPerMonth || 1)) * 100}
                        className="h-2"
                    />
                </div>
            )}

            {/* Storage */}
            <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                        <HardDrive className="h-4 w-4 text-green-500" />
                        <span>Storage</span>
                    </div>
                    <span className="text-muted-foreground">
                        {formatBytes(storageUsedBytes)} / {formatBytes(storageQuotaBytes)}
                    </span>
                </div>
                <Progress value={storagePercentUsed} className="h-2" />
            </div>
        </div>
    );
}
