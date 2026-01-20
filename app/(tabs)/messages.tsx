import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Image,
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    Alert,
    Pressable,
    SectionList,
    TouchableWithoutFeedback,
} from 'react-native';
import Animated, { useAnimatedReaction, SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '../../constants/color';
import {
    ChatBubbleLeftIcon,
    BellIcon,
    CheckIcon,
    TrashIcon,
    Cog6ToothIcon,
    CheckCircleIcon
} from 'react-native-heroicons/outline';
import { CheckCircleIcon as CheckCircleSolid } from 'react-native-heroicons/solid';

type TabType = 'messages' | 'notifications';

type Conversation = {
    id: string;
    product_id: string;
    buyer_id: string;
    seller_id: string;
    last_message: string;
    last_message_at: string;
    product: {
        name: string;
        image_url: string;
        price: number;
    };
    other_user: {
        id: string;
        full_name: string;
        avatar_url: string;
    };
    unread_count: number;
};

type Notification = {
    id: string;
    type: 'order' | 'delivery' | 'message' | 'activity' | 'system';
    title: string;
    body: string;
    data: any;
    is_read: boolean;
    created_at: string;
    user_avatar?: string;
};

// Sub-components moved outside or defined clearly with types
const DeleteAction = ({ conversationId, dragX, deleteConversation }: { conversationId: string; dragX: SharedValue<number>, deleteConversation: (id: string) => void }) => {
    useAnimatedReaction(
        () => dragX.value,
        (currentDragX) => {
            if (currentDragX < -140) {
                scheduleOnRN(deleteConversation, conversationId);
            }
        }
    );

    return (
        <View style={styles.deleteAction}>
            <TrashIcon color="#FFF" size={24} />
            <Text style={styles.deleteActionText}>Delete</Text>
        </View>
    );
};

export default function MessagesScreen() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<TabType>('messages');
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Selection state
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());

    const currentlyOpenSwipeable = useRef<any>(null);

    useEffect(() => {
        if (user) {
            fetchData();
            subscribeToUpdates();
        }
    }, [user]);

    const closeCurrentSwipeable = () => {
        if (currentlyOpenSwipeable.current) {
            currentlyOpenSwipeable.current.close();
            currentlyOpenSwipeable.current = null;
        }
    };

    useEffect(() => {
        closeCurrentSwipeable();
        if (activeTab === 'messages') {
            setSelectionMode(false);
            setSelectedNotifications(new Set());
        }
    }, [activeTab]);

    const fetchData = async () => {
        if (refreshing) return;
        setRefreshing(true);
        await Promise.all([
            fetchConversations(),
            fetchNotifications()
        ]);
        setRefreshing(false);
        setLoading(false);
    };

    const fetchConversations = async () => {
        if (!user) return;
        const { data, error } = await supabase
            .from('conversations' as any)
            .select(`
                *,
                product:products(name, image_url, price),
                messages(id, is_read, sender_id)
            `)
            .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
            .order('last_message_at', { ascending: false });

        if (error) {
            console.error('Error fetching conversations:', error);
            return;
        }

        const enrichedConversations = await Promise.all(
            ((data as any) || []).map(async (conv: any) => {
                const otherUserId = conv.buyer_id === user.id ? conv.seller_id : conv.buyer_id;
                const { data: otherUser } = await supabase
                    .from('profiles')
                    .select('id, full_name, avatar_url')
                    .eq('id', otherUserId)
                    .single();

                const unreadCount = conv.messages?.filter(
                    (msg: any) => !msg.is_read && msg.sender_id !== user.id
                ).length || 0;

                return {
                    ...conv,
                    other_user: otherUser,
                    unread_count: unreadCount,
                } as Conversation;
            })
        );
        setConversations(enrichedConversations);
    };

    const fetchNotifications = async () => {
        if (!user) return;
        const { data, error } = await supabase
            .from('notifications' as any)
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            console.error('Error fetching notifications:', error);
            return;
        }
        setNotifications((data as any) || []);
    };

    const subscribeToUpdates = () => {
        const conversationSub = supabase
            .channel('public:conversations')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => fetchConversations())
            .subscribe();

        const notificationSub = supabase
            .channel('public:notifications')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => fetchNotifications())
            .subscribe();

        return () => {
            supabase.removeChannel(conversationSub);
            supabase.removeChannel(notificationSub);
        };
    };

    const markAllAsRead = async () => {
        if (!user) return;
        try {
            const { error } = await supabase
                .from('notifications' as any)
                .update({ is_read: true })
                .eq('user_id', user.id)
                .eq('is_read', false);

            if (error) throw error;
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    };

    const markSelectedAsRead = async () => {
        if (selectedNotifications.size === 0) return;
        try {
            const ids = Array.from(selectedNotifications);
            const { error } = await supabase
                .from('notifications' as any)
                .update({ is_read: true })
                .in('id', ids);

            if (error) throw error;
            setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, is_read: true } : n));
            exitSelectionMode();
        } catch (error) {
            console.error('Error marking selected as read:', error);
        }
    };

    const deleteSelectedNotifications = async () => {
        if (selectedNotifications.size === 0) return;
        Alert.alert('Delete Notifications', `Delete ${selectedNotifications.size} item(s)?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    const ids = Array.from(selectedNotifications);
                    const { error } = await supabase
                        .from('notifications' as any)
                        .delete()
                        .in('id', ids);
                    if (!error) {
                        setNotifications(prev => prev.filter(n => !ids.includes(n.id)));
                        exitSelectionMode();
                    }
                }
            }
        ]);
    };

    const deleteConversation = (id: string) => {
        Alert.alert('Delete Conversation', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    setConversations(prev => prev.filter(c => c.id !== id));
                    await supabase.from('conversations' as any).delete().eq('id', id);
                }
            }
        ]);
    };

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedNotifications);
        if (newSet.has(id)) {
            newSet.delete(id);
            if (newSet.size === 0) setSelectionMode(false);
        } else {
            newSet.add(id);
        }
        setSelectedNotifications(newSet);
    };

    const exitSelectionMode = () => {
        setSelectionMode(false);
        setSelectedNotifications(new Set());
    };

    const formatTime = (ts: string) => {
        const date = new Date(ts);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'order': return '📦';
            case 'delivery': return '🚚';
            case 'message': return '💬';
            case 'activity': return '✨';
            default: return '🔔';
        }
    };

    const onSwipeableWillOpen = (ref: any) => {
        if (currentlyOpenSwipeable.current && currentlyOpenSwipeable.current !== ref) {
            currentlyOpenSwipeable.current.close();
        }
        currentlyOpenSwipeable.current = ref;
    };

    const ConversationItem = ({ item }: { item: Conversation }) => {
        const rowRef = useRef<any>(null);

        return (
            <Swipeable
                ref={rowRef}
                renderRightActions={(progress, dragX) => (
                    <DeleteAction conversationId={item.id} dragX={dragX} deleteConversation={deleteConversation} />
                )}
                onSwipeableWillOpen={() => {
                    if (rowRef.current) onSwipeableWillOpen(rowRef.current);
                }}
                rightThreshold={40}
            >
                <TouchableOpacity
                    style={styles.conversationItem}
                    onPress={() => {
                        closeCurrentSwipeable();
                        router.push(`/conversation/${item.id}`);
                    }}
                    activeOpacity={0.7}
                >
                    <View style={styles.avatarWrapper}>
                        <Image source={{ uri: item.other_user?.avatar_url || 'https://via.placeholder.com/50' }} style={styles.avatar} />
                        {item.product?.image_url && (
                            <View style={styles.productThumbnailBadge}>
                                <Image source={{ uri: item.product.image_url }} style={styles.productThumbnail} />
                            </View>
                        )}
                    </View>
                    <View style={styles.conversationContent}>
                        <View style={styles.conversationHeader}>
                            <Text style={styles.userName} numberOfLines={1}>{item.other_user?.full_name}</Text>
                            <Text style={styles.timestamp}>{formatTime(item.last_message_at)}</Text>
                        </View>
                        <View style={styles.messagePreviewRow}>
                            <Text style={[styles.lastMessage, item.unread_count > 0 && styles.unreadMessage]} numberOfLines={1}>
                                {item.last_message || 'Start a conversation...'}
                            </Text>
                            {item.unread_count > 0 && <View style={styles.unreadDotIndicator} />}
                        </View>
                    </View>
                </TouchableOpacity>
            </Swipeable>
        );
    };

    const getGroupedData = () => {
        const data = activeTab === 'messages' ? conversations : notifications;
        const groups: { [key: string]: any[] } = {};

        data.forEach((item: any) => {
            const timestamp = activeTab === 'messages' ? item.last_message_at : item.created_at;
            if (!timestamp) return;

            const date = new Date(timestamp);
            const today = new Date();
            const yesterday = new Date();
            yesterday.setDate(today.getDate() - 1);

            let title = '';
            if (date.toDateString() === today.toDateString()) {
                title = 'TODAY';
            } else if (date.toDateString() === yesterday.toDateString()) {
                title = 'YESTERDAY';
            } else {
                title = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }).toUpperCase();
            }

            if (!groups[title]) groups[title] = [];
            groups[title].push(item);
        });

        return Object.keys(groups).map(title => ({
            title,
            data: groups[title],
        }));
    };

    const NotificationItem = ({ item, isSelected }: { item: Notification, isSelected: boolean }) => {
        return (
            <TouchableOpacity
                style={[
                    styles.notificationItem,
                    !item.is_read && styles.unreadNotification,
                    isSelected && styles.selectedNotification
                ]}
                onLongPress={() => {
                    setSelectionMode(true);
                    toggleSelection(item.id);
                }}
                onPress={() => {
                    if (selectionMode) {
                        toggleSelection(item.id);
                    } else {
                        if (!item.is_read) {
                            supabase.from('notifications' as any).update({ is_read: true }).eq('id', item.id);
                            setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, is_read: true } : n));
                        }
                        if (item.type === 'message') router.push(`/conversation/${item.data?.conversation_id}`);
                        else if (item.type === 'activity' && item.data?.product_id) router.push(`/product/${item.data.product_id}` as any);
                    }
                }}
            >
                {selectionMode && (
                    <View style={styles.checkboxContainer}>
                        {isSelected ? (
                            <CheckCircleSolid size={24} color={Colors.primary[500]} />
                        ) : (
                            <CheckCircleIcon size={24} color={Colors.neutral[300]} />
                        )}
                    </View>
                )}
                <View style={[styles.notificationIcon, { backgroundColor: Colors.neutral[50] }]}>
                    <Text style={{ fontSize: 22 }}>{getNotificationIcon(item.type)}</Text>
                </View>
                <View style={styles.notificationContent}>
                    <View style={styles.notificationHeader}>
                        <Text style={[styles.notificationTitle, !item.is_read && styles.unreadTitle]}>{item.title}</Text>
                        <Text style={styles.timestamp}>{formatTime(item.created_at)}</Text>
                    </View>
                    <Text style={styles.notificationBody} numberOfLines={2}>{item.body}</Text>
                </View>
                {!item.is_read && !selectionMode && <View style={styles.unreadDot} />}
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                {selectionMode ? (
                    <>
                        <TouchableOpacity onPress={exitSelectionMode} style={styles.headerIconButton}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>{selectedNotifications.size} selected</Text>
                        <View style={styles.headerRightActions}>
                            <TouchableOpacity onPress={markSelectedAsRead} style={styles.headerIconButton}>
                                <CheckIcon size={22} color={Colors.primary[600]} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={deleteSelectedNotifications} style={styles.headerIconButton}>
                                <TrashIcon size={22} color="#EF4444" />
                            </TouchableOpacity>
                        </View>
                    </>
                ) : (
                    <>
                        <Text style={styles.logoText}>Inbox</Text>
                        <View style={styles.headerRightActions}>
                            {activeTab === 'notifications' && notifications.some(n => !n.is_read) && (
                                <TouchableOpacity onPress={markAllAsRead} style={styles.headerIconButton}>
                                    <CheckIcon size={22} color={Colors.neutral[600]} />
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity onPress={() => router.push('/profile/notifications' as any)} style={styles.headerIconButton}>
                                <Cog6ToothIcon size={24} color={Colors.neutral[600]} />
                            </TouchableOpacity>
                        </View>
                    </>
                )}
            </View>

            <View style={styles.segmentedTabContainer}>
                <TouchableOpacity
                    style={[styles.segmentedTab, activeTab === 'messages' && styles.activeSegmentedTab]}
                    onPress={() => setActiveTab('messages')}
                >
                    <Text style={[styles.segmentedTabText, activeTab === 'messages' && styles.activeSegmentedTabText]}>Messages</Text>
                    {conversations.reduce((acc, c) => acc + c.unread_count, 0) > 0 && (
                        <View style={styles.segmentedTabBadge}>
                            <Text style={styles.segmentedTabBadgeText}>
                                {conversations.reduce((acc, c) => acc + c.unread_count, 0)}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.segmentedTab, activeTab === 'notifications' && styles.activeSegmentedTab]}
                    onPress={() => setActiveTab('notifications')}
                >
                    <Text style={[styles.segmentedTabText, activeTab === 'notifications' && styles.activeSegmentedTabText]}>Notifications</Text>
                    {notifications.filter(n => !n.is_read).length > 0 && (
                        <View style={styles.segmentedTabBadge}>
                            <Text style={styles.segmentedTabBadgeText}>
                                {notifications.filter(n => !n.is_read).length}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.centerContainer}><ActivityIndicator color={Colors.primary[500]} /></View>
            ) : (
                <SectionList
                    sections={getGroupedData()}
                    renderSectionHeader={({ section: { title } }) => (
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionHeaderText}>{title}</Text>
                        </View>
                    )}
                    renderItem={({ item }) => (
                        activeTab === 'messages' ?
                            <ConversationItem item={item as Conversation} /> :
                            <NotificationItem item={item as Notification} isSelected={selectedNotifications.has(item.id)} />
                    )}
                    keyExtractor={(item) => item.id}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={fetchData}
                            tintColor={Colors.primary[500]}
                            colors={[Colors.primary[500]]}
                        />
                    }
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyTitle}>Nothing here yet</Text>
                            <Text style={styles.emptySubtitle}>You're all caught up!</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 15,
        backgroundColor: '#FFF',
    },
    logoText: {
        fontSize: 32,
        fontWeight: '800',
        color: Colors.text.primary,
        letterSpacing: -1
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text.primary },
    headerRightActions: { flexDirection: 'row', alignItems: 'center' },
    headerIconButton: { marginLeft: 16, padding: 4 },
    cancelText: { color: Colors.primary[600], fontWeight: '600', fontSize: 16 },
    segmentedTabContainer: {
        flexDirection: 'row',
        backgroundColor: '#F2F2F7',
        borderRadius: 12,
        padding: 4,
        marginHorizontal: 20,
        marginBottom: 16,
    },
    segmentedTab: {
        flex: 1,
        flexDirection: 'row',
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 10,
        position: 'relative'
    },
    activeSegmentedTab: {
        backgroundColor: '#FFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    segmentedTabText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.neutral[500]
    },
    activeSegmentedTabText: {
        color: Colors.text.primary
    },
    segmentedTabBadge: {
        backgroundColor: '#FF7F50',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        paddingHorizontal: 4,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 6
    },
    segmentedTabBadgeText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '800'
    },
    sectionHeader: {
        paddingHorizontal: 20,
        paddingBottom: 10,
        paddingTop: 8,
        backgroundColor: '#FFF',
    },
    sectionHeaderText: {
        fontSize: 13,
        fontWeight: '700',
        color: Colors.neutral[400],
        letterSpacing: 1.2,
    },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { flexGrow: 1, paddingBottom: 20 },
    conversationItem: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: '#FFF' },
    avatarWrapper: { position: 'relative' },
    avatar: { width: 56, height: 56, borderRadius: 28, marginRight: 16, backgroundColor: Colors.neutral[100] },
    productThumbnailBadge: { position: 'absolute', bottom: 0, right: 12, width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#FFF', overflow: 'hidden' },
    productThumbnail: { width: '100%', height: '100%' },
    conversationContent: { flex: 1 },
    conversationHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    userName: { fontSize: 16, fontWeight: '700', color: Colors.text.primary },
    timestamp: { fontSize: 12, color: Colors.neutral[500] },
    messagePreviewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    lastMessage: { fontSize: 14, color: Colors.neutral[500], flex: 1 },
    unreadMessage: { fontWeight: '600', color: Colors.text.primary },
    unreadDotIndicator: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary[500], marginLeft: 8 },
    deleteAction: { backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', width: 90, height: '100%' },
    deleteActionText: { color: '#FFF', fontSize: 12, fontWeight: '600', marginTop: 4 },
    notificationItem: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: '#FFF' },
    unreadNotification: { backgroundColor: Colors.primary[50] + '30' },
    selectedNotification: { backgroundColor: Colors.primary[50] },
    checkboxContainer: { marginRight: 15 },
    notificationIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
    notificationContent: { flex: 1 },
    notificationHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    notificationTitle: { fontSize: 15, fontWeight: '600', color: Colors.text.primary, flex: 1, marginRight: 8 },
    unreadTitle: { fontWeight: '800' },
    notificationBody: { fontSize: 14, color: Colors.neutral[600], lineHeight: 20 },
    unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary[500], marginLeft: 10 },
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.neutral[400], marginBottom: 8 },
    emptySubtitle: { fontSize: 14, color: Colors.neutral[400] },
});
