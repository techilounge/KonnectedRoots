"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, Trash2, TreeDeciduous, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useNotifications, AppNotification } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

export default function NotificationBell() {
    const router = useRouter();
    const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
    const [open, setOpen] = useState(false);

    const handleNotificationClick = (notification: AppNotification) => {
        markAsRead(notification.id);

        if (notification.type === 'tree_invite' && notification.data?.invitationId) {
            router.push(`/invite/${notification.data.invitationId}`);
            setOpen(false);
        } else if (notification.data?.treeId) {
            router.push(`/tree/${notification.data.treeId}`);
            setOpen(false);
        }
    };

    const getNotificationIcon = (type: AppNotification['type']) => {
        switch (type) {
            case 'tree_invite':
                return <TreeDeciduous className="h-4 w-4 text-primary" />;
            case 'invite_accepted':
                return <Check className="h-4 w-4 text-green-500" />;
            default:
                return <Bell className="h-4 w-4" />;
        }
    };

    const formatTime = (timestamp: any) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return formatDistanceToNow(date, { addSuffix: true });
    };

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <Badge
                            variant="destructive"
                            className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                        >
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </Badge>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="flex items-center justify-between">
                    <span>Notifications</span>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.preventDefault(); markAllAsRead(); }}
                            className="h-6 text-xs"
                        >
                            <CheckCheck className="h-3 w-3 mr-1" />
                            Mark all read
                        </Button>
                    )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {notifications.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground text-sm">
                        No notifications yet
                    </div>
                ) : (
                    <div className="max-h-80 overflow-y-auto">
                        {notifications.slice(0, 10).map((notification) => (
                            <DropdownMenuItem
                                key={notification.id}
                                className={cn(
                                    "flex items-start gap-3 p-3 cursor-pointer",
                                    !notification.read && "bg-primary/5"
                                )}
                                onClick={() => handleNotificationClick(notification)}
                            >
                                <div className="mt-0.5">
                                    {getNotificationIcon(notification.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{notification.title}</p>
                                    <p className="text-xs text-muted-foreground line-clamp-2">{notification.message}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{formatTime(notification.createdAt)}</p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        deleteNotification(notification.id);
                                    }}
                                >
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </DropdownMenuItem>
                        ))}
                    </div>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
