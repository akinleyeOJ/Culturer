import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface InboxContextType {
    unreadMessages: number;
    unreadNotifications: number;
    totalUnread: number;
    refreshUnreadCounts: () => Promise<void>;
}

const InboxContext = createContext<InboxContextType | undefined>(undefined);

export const InboxProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [unreadMessages, setUnreadMessages] = useState(0);
    const [unreadNotifications, setUnreadNotifications] = useState(0);

    const fetchUnreadCounts = useCallback(async () => {
        if (!user) {
            setUnreadMessages(0);
            setUnreadNotifications(0);
            return;
        }

        try {
            // 1. Fetch unread notification count
            const { count: notifCount } = await supabase
                .from('notifications' as any)
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('is_read', false);

            setUnreadNotifications(notifCount || 0);

            // 2. Fetch unread message count 
            // Optimized: Count unread messages where sender is NOT the current user
            // We first need the IDs of conversations the user is part of
            const { data: convIds } = await supabase
                .from('conversations' as any)
                .select('id')
                .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);

            if (!convIds || convIds.length === 0) {
                setUnreadMessages(0);
                return;
            }

            const ids = convIds.map(c => c.id);
            const { count: msgCount } = await supabase
                .from('messages' as any)
                .select('*', { count: 'exact', head: true })
                .in('conversation_id', ids)
                .eq('is_read', false)
                .neq('sender_id', user.id);

            setUnreadMessages(msgCount || 0);
        } catch (error) {
            console.error('Error fetching unread counts:', error);
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            fetchUnreadCounts();

            // Real-time subscriptions - refresh on any change to messages or notifications
            const msgSub = supabase
                .channel('public:messages_count')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'messages'
                }, () => fetchUnreadCounts())
                .subscribe();

            const notifSub = supabase
                .channel('public:notifications_count')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`
                }, () => fetchUnreadCounts())
                .subscribe();

            return () => {
                supabase.removeChannel(msgSub);
                supabase.removeChannel(notifSub);
            };
        }
    }, [user, fetchUnreadCounts]);

    const totalUnread = unreadMessages + unreadNotifications;

    return (
        <InboxContext.Provider
            value={{
                unreadMessages,
                unreadNotifications,
                totalUnread,
                refreshUnreadCounts: fetchUnreadCounts,
            }}
        >
            {children}
        </InboxContext.Provider>
    );
};

export const useInbox = () => {
    const context = useContext(InboxContext);
    if (context === undefined) {
        throw new Error('useInbox must be used within an InboxProvider');
    }
    return context;
};
