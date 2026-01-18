
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Zap, PlusCircle, AlertCircle } from "lucide-react";
import Link from 'next/link';

interface AICreditUsageCardProps {
    usage?: {
        aiActionsUsed: number;
        aiActionsAllowance: number;
    };
    className?: string;
}

export function AICreditUsageCard({ usage, className }: AICreditUsageCardProps) {
    const used = usage?.aiActionsUsed || 0;
    const total = usage?.aiActionsAllowance || 10; // Default/Fallback
    const percentage = Math.min(100, Math.round((used / total) * 100));
    const remaining = Math.max(0, total - used);

    // Determine color based on usage
    const isLow = remaining < 5 && percentage > 80;
    const isEmpty = remaining === 0;

    return (
        <Card className={`border-2 ${className}`}>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <div className={`p-2 rounded-full ${isLow ? 'bg-red-100 text-red-600' : 'bg-primary/10 text-primary'}`}>
                            <Zap className="h-5 w-5" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">AI Credits</CardTitle>
                            <CardDescription>Monthly usage</CardDescription>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-2xl font-bold">{remaining}</span>
                        <span className="text-muted-foreground text-sm ml-1">left</span>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Used: {used}</span>
                        <span className="font-medium">{percentage}%</span>
                    </div>
                    <Progress
                        value={percentage}
                        className={`h-2 ${isLow ? 'bg-red-100 [&>div]:bg-red-500' : ''}`}
                    />
                </div>

                {isLow && (
                    <div className="flex items-start space-x-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-md">
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>You're running low on credits. Enhancement features may be unavailable soon.</span>
                    </div>
                )}
            </CardContent>
            <CardFooter className="pt-0">
                <Button asChild className="w-full" variant={isEmpty ? "default" : "outline"}>
                    <Link href="/pricing">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Get More Credits
                    </Link>
                </Button>
            </CardFooter>
        </Card>
    );
}
