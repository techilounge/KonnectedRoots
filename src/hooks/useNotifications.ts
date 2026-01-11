"use client";

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase/clients';
import {
    collection,
    query,
    where,
    onSnapshot,
    doc,
    updateDoc,
    deleteDoc,
    Timestamp
} from 'firebase/firestore';
import { useAuth } from './useAuth';

export interface AppNotification {
    id: string;
    userId: string;
    type: 'tree_invite' | 'invite_accepted' | 'general';
    title: string;
    message: string;
    data?: { treeId?: string; invitationId?: string };
    read: boolean;
    createdAt: Timestamp;
}

export function useNotifications() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);

    // Subscribe to notifications
    useEffect(() => {
        if (!user) {
            setNotifications([]);
            setUnreadCount(0);
            setLoading(false);
            return;
        }

        const notificationsRef = collection(db, 'notifications');
        // Note: Removed orderBy to avoid composite index requirement
        // Sorting is done client-side instead
        const q = query(
            notificationsRef,
            where('userId', '==', user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const notifs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as AppNotification[];

            // Sort by createdAt descending (client-side)
            notifs.sort((a, b) => {
                const aTime = a.createdAt?.toMillis?.() || 0;
                const bTime = b.createdAt?.toMillis?.() || 0;
                return bTime - aTime;
            });

            setNotifications(notifs);
            setUnreadCount(notifs.filter(n => !n.read).length);
            setLoading(false);
        }, (error) => {
            console.error('Error fetching notifications:', error);
            // Don't block UI on error
            setNotifications([]);
            setUnreadCount(0);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    // Mark a notification as read
    const markAsRead = useCallback(async (notificationId: string) => {
        try {
            await updateDoc(doc(db, 'notifications', notificationId), {
                read: true
            });
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }, []);

    // Mark all notifications as read
    const markAllAsRead = useCallback(async () => {
        const unreadNotifs = notifications.filter(n => !n.read);
        try {
            await Promise.all(
                unreadNotifs.map(n =>
                    updateDoc(doc(db, 'notifications', n.id), { read: true })
                )
            );
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    }, [notifications]);

    // Delete a notification
    const deleteNotification = useCallback(async (notificationId: string) => {
        try {
            await deleteDoc(doc(db, 'notifications', notificationId));
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    }, []);

    return {
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        deleteNotification
    };
}
