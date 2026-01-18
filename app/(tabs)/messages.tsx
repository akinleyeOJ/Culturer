import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '../../constants/color';
import { ChatBubbleLeftIcon, BellIcon, CheckIcon, TrashIcon, Cog6ToothIcon } from 'react-native-heroicons/outline';
import { ChatBubbleLeftIcon as ChatBubbleLeftSolid } from 'react-native-heroicons/solid';

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

export default function MessagesScreen() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<TabType>('messages');
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        if (user) {
            fetchData();
            subscribeToUpdates();
        }
    }, [user, activeTab]);

    const fetchData = async () => {
        if (activeTab === 'messages') {
            await fetchConversations();
        } else {
            await fetchNotifications();
        }
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

        // Fetch other user details and calculate unread count
        const enrichedConversations = await Promise.all(
            (data || []).map(async (conv: any) => {
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
                };
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

        setNotifications((data || []) as unknown as Notification[]);
    };

    const subscribeToUpdates = () => {
        if (!user) return;

        const channel = supabase
            .channel('inbox-updates')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: activeTab === 'messages' ? 'messages' : 'notifications',
                },
                () => {
                    fetchData();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    };

    const markAllAsRead = async () => {
        if (!user) return;

        if (activeTab === 'notifications') {
            await supabase
                .from('notifications' as any)
                .update({ is_read: true })
                .eq('user_id', user.id)
                .eq('is_read', false);

            fetchNotifications();
        }
    };

    const clearAll = async () => {
        if (!user) return;

        if (activeTab === 'notifications') {
            await supabase
                .from('notifications' as any)
                .delete()
                .eq('user_id', user.id);

            setNotifications([]);
        }
    };

    const getNotificationIcon = (type: string) => {
        const iconProps = { size: 20, color: Colors.primary[500] };
        switch (type) {
            case 'order':
                return '📦';
            case 'delivery':
                return '🚚';
            case 'message':
                return '💬';
            case 'activity':
                return '💭';
            default:
                return '🔔';
        }
    };

    const getNotificationBadgeColor = (type: string) => {
        switch (type) {
            case 'order':
                return Colors.primary[100];
            case 'delivery':
                return Colors.primary[100]; // Using primary since info doesn't exist
            case 'message':
                return Colors.secondary[100];
            case 'activity':
                return Colors.neutral[100];
            default:
                return Colors.neutral[100];
        }
    };

    const getNotificationBadgeText = (type: string) => {
        switch (type) {
            case 'order':
                return 'Order';
            case 'delivery':
                return 'Delivery';
            case 'message':
                return 'Message';
            case 'activity':
                return 'Activity';
            default:
                return 'Update';
        }
    };

    const formatTime = (timestamp: string) => {
        const now = new Date();
        const time = new Date(timestamp);
        const diff = now.getTime() - time.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m`;
        if (hours < 24) {
            if (now.getDate() === time.getDate()) {
                return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
            return 'Yesterday';
        }
        return time.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    const getDateGroup = (timestamp: string) => {
        const now = new Date();
        const date = new Date(timestamp);
        const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);

        if (diffDays === 0 && now.getDate() === date.getDate()) return 'Today';
        if (diffDays === 1 || (diffDays === 0 && now.getDate() !== date.getDate())) return 'Yesterday';
        if (diffDays < 7) return 'This Week';
        return 'Earlier';
    };

    const groupItemsByDate = (items: any[]) => {
        const groups: { title: string; data: any[] }[] = [];
        items.forEach(item => {
            const dateStr = item.last_message_at || item.created_at;
            const groupTitle = getDateGroup(dateStr);
            const group = groups.find(g => g.title === groupTitle);
            if (group) {
                group.data.push(item);
            } else {
                groups.push({ title: groupTitle, data: [item] });
            }
        });
        return groups;
    };

    const MessageSkeleton = () => (
        <View style={styles.skeletonItem}>
            <View style={styles.skeletonAvatar} />
            <View style={styles.skeletonContent}>
                <View style={styles.skeletonRow}>
                    <View style={[styles.skeletonLine, { width: '40%' }]} />
                    <View style={[styles.skeletonLine, { width: '15%' }]} />
                </View>
                <View style={[styles.skeletonLine, { width: '30%', marginTop: 8 }]} />
                <View style={[styles.skeletonLine, { width: '80%', marginTop: 8 }]} />
            </View>
        </View>
    );

    const renderConversationItem = ({ item }: { item: Conversation }) => (
        <TouchableOpacity
            style={styles.conversationItem}
            onPress={() => router.push(`/conversation/${item.id}`)}
            activeOpacity={0.7}
        >
            <View style={styles.avatarWrapper}>
                <Image
                    source={{ uri: item.other_user?.avatar_url || 'https://via.placeholder.com/50' }}
                    style={styles.avatar}
                />
                {item.product?.image_url && (
                    <View style={styles.productThumbnailBadge}>
                        <Image source={{ uri: item.product.image_url }} style={styles.productThumbnail} />
                    </View>
                )}
            </View>
            <View style={styles.conversationContent}>
                <View style={styles.conversationHeader}>
                    <Text style={styles.userName} numberOfLines={1}>
                        {item.other_user?.full_name || 'Unknown User'}
                    </Text>
                    <Text style={styles.timestamp}>{formatTime(item.last_message_at)}</Text>
                </View>
                <View style={styles.messagePreviewRow}>
                    <Text
                        style={[styles.lastMessage, item.unread_count > 0 && styles.unreadMessage]}
                        numberOfLines={1}
                    >
                        {item.last_message || 'Start a conversation...'}
                    </Text>
                    {item.unread_count > 0 && (
                        <View style={styles.unreadDotIndicator} />
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );

    const renderNotificationItem = ({ item }: { item: Notification }) => (
        <TouchableOpacity
            style={[styles.notificationItem, !item.is_read && styles.unreadNotification]}
            onPress={() => {
                // Mark as read and navigate based on type
                supabase
                    .from('notifications' as any)
                    .update({ is_read: true })
                    .eq('id', item.id)
                    .then(() => fetchNotifications());

                // Navigate based on notification type
                if (item.type === 'order' && item.data?.order_id) {
                    router.push(`/order/${item.data.order_id}` as any);
                } else if (item.type === 'message' && item.data?.conversation_id) {
                    router.push(`/conversation/${item.data.conversation_id}`);
                }
            }}
        >
            <View style={[styles.notificationIcon, { backgroundColor: getNotificationBadgeColor(item.type) }]}>
                <Text style={{ fontSize: 24 }}>{getNotificationIcon(item.type)}</Text>
            </View>
            <View style={styles.notificationContent}>
                <View style={styles.notificationHeader}>
                    <Text style={[styles.notificationTitle, !item.is_read && styles.unreadTitle]}>
                        {item.title}
                    </Text>
                    <Text style={styles.timestamp}>{formatTime(item.created_at)}</Text>
                </View>
                <Text style={styles.notificationBody} numberOfLines={2}>
                    {item.body}
                </Text>
                <View style={styles.notificationBadge}>
                    <Text style={[styles.badgeText, { color: Colors.primary[600] }]}>
                        {getNotificationBadgeText(item.type)}
                    </Text>
                </View>
            </View>
            {!item.is_read && <View style={styles.unreadDot} />}
        </TouchableOpacity>
    );

    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
                {activeTab === 'messages' ? (
                    <ChatBubbleLeftIcon size={60} color={Colors.primary[300]} />
                ) : (
                    <BellIcon size={60} color={Colors.primary[300]} />
                )}
            </View>
            <Text style={styles.emptyTitle}>
                {activeTab === 'messages' ? 'No conversations yet' : "You're all caught up!"}
            </Text>
            <Text style={styles.emptySubtitle}>
                {activeTab === 'messages'
                    ? 'Messages with sellers will appear here'
                    : 'New notifications will appear here'}
            </Text>
            {activeTab === 'messages' && (
                <TouchableOpacity
                    style={styles.discoverButton}
                    onPress={() => router.push('/browse' as any)}
                >
                    <Text style={styles.discoverButtonText}>🔍 Discover items</Text>
                </TouchableOpacity>
            )}
        </View>
    );

    const unreadNotificationsCount = notifications.filter((n) => !n.is_read).length;
    const groupedData = groupItemsByDate(activeTab === 'messages' ? conversations : notifications);

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <Text style={styles.headerTitle}>Inbox</Text>
                    <TouchableOpacity style={styles.headerIconBtn}>
                        <Cog6ToothIcon size={24} color={Colors.text.primary} />
                    </TouchableOpacity>
                </View>

                {/* Modern Segmented Control */}
                <View style={styles.segmentedControl}>
                    <TouchableOpacity
                        style={[styles.segment, activeTab === 'messages' && styles.activeSegment]}
                        onPress={() => setActiveTab('messages')}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.segmentText, activeTab === 'messages' && styles.activeSegmentText]}>
                            Messages
                        </Text>
                        {conversations.some(c => c.unread_count > 0) && (
                            <View style={[styles.dot, { backgroundColor: activeTab === 'messages' ? Colors.primary[500] : Colors.neutral[400] }]} />
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.segment, activeTab === 'notifications' && styles.activeSegment]}
                        onPress={() => setActiveTab('notifications')}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.segmentText, activeTab === 'notifications' && styles.activeSegmentText]}>
                            Notifications
                        </Text>
                        {unreadNotificationsCount > 0 && (
                            <View style={styles.countBadge}>
                                <Text style={styles.countBadgeText}>{unreadNotificationsCount}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {/* Content */}
            {loading && !refreshing ? (
                <ScrollView style={styles.listContent}>
                    {[1, 2, 3, 4, 5, 6].map(i => <MessageSkeleton key={i} />)}
                </ScrollView>
            ) : (
                <FlatList
                    data={groupedData}
                    keyExtractor={(group) => group.title}
                    renderItem={({ item: group }) => (
                        <View>
                            <View style={styles.dateHeader}>
                                <Text style={styles.dateHeaderText}>{group.title}</Text>
                            </View>
                            {group.data.map((item: any) => (
                                <View key={item.id}>
                                    {activeTab === 'messages'
                                        ? renderConversationItem({ item })
                                        : renderNotificationItem({ item })}
                                </View>
                            ))}
                        </View>
                    )}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={renderEmptyState}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={Colors.primary[500]}
                        />
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        paddingTop: 44,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: Colors.neutral[100],
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 8,
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: '800',
        color: Colors.text.primary,
        letterSpacing: -0.5,
    },
    headerIconBtn: {
        padding: 8,
    },
    segmentedControl: {
        flexDirection: 'row',
        backgroundColor: Colors.neutral[100],
        marginHorizontal: 20,
        marginBottom: 12,
        padding: 4,
        borderRadius: 12,
    },
    segment: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 8,
        gap: 6,
    },
    activeSegment: {
        backgroundColor: '#FFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    segmentText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.neutral[500],
    },
    activeSegmentText: {
        color: Colors.text.primary,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    countBadge: {
        backgroundColor: Colors.primary[500],
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    countBadgeText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '700',
    },
    dateHeader: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: Colors.neutral[50],
    },
    dateHeaderText: {
        fontSize: 12,
        fontWeight: '700',
        color: Colors.neutral[500],
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    listContent: {
        flexGrow: 1,
    },
    conversationItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20,
        backgroundColor: '#FFF',
    },
    avatarWrapper: {
        position: 'relative',
    },
    avatar: {
        width: 54,
        height: 54,
        borderRadius: 27,
        marginRight: 16,
        backgroundColor: Colors.neutral[100],
    },
    productThumbnailBadge: {
        position: 'absolute',
        bottom: 0,
        right: 12,
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#FFF',
        backgroundColor: '#FFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        overflow: 'hidden',
    },
    productThumbnail: {
        width: '100%',
        height: '100%',
    },
    conversationContent: {
        flex: 1,
    },
    conversationHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 2,
    },
    userName: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.text.primary,
        flex: 1,
        marginRight: 8,
    },
    timestamp: {
        fontSize: 12,
        color: Colors.neutral[500],
        fontWeight: '500',
    },
    messagePreviewRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    lastMessage: {
        fontSize: 14,
        color: Colors.neutral[500],
        lineHeight: 20,
        flex: 1,
    },
    unreadMessage: {
        fontWeight: '600',
        color: Colors.text.primary,
    },
    unreadDotIndicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.primary[500],
        marginLeft: 8,
    },
    notificationItem: {
        flexDirection: 'row',
        padding: 20,
        backgroundColor: '#FFF',
    },
    unreadNotification: {
        backgroundColor: Colors.primary[50] + '40', // Very light tint
    },
    notificationIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    notificationContent: {
        flex: 1,
    },
    notificationHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 4,
    },
    notificationTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.text.primary,
        flex: 1,
        marginRight: 8,
        lineHeight: 20,
    },
    unreadTitle: {
        fontWeight: '800',
    },
    notificationBody: {
        fontSize: 14,
        color: Colors.neutral[600],
        lineHeight: 20,
        marginBottom: 8,
    },
    notificationBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        backgroundColor: Colors.neutral[100],
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    unreadDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: Colors.primary[500],
        alignSelf: 'center',
        marginLeft: 12,
    },
    actionBar: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 12,
        gap: 16,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: Colors.neutral[100],
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    actionButtonText: {
        fontSize: 13,
        fontWeight: '700',
        color: Colors.primary[500],
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
        paddingVertical: 80,
    },
    emptyIconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: Colors.neutral[50],
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    emptyTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: Colors.text.primary,
        marginBottom: 12,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: 16,
        color: Colors.neutral[500],
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
    },
    discoverButton: {
        backgroundColor: Colors.primary[500],
        paddingHorizontal: 32,
        paddingVertical: 16,
        borderRadius: 30,
        shadowColor: Colors.primary[500],
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    discoverButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFF',
    },
    skeletonItem: {
        flexDirection: 'row',
        padding: 20,
        alignItems: 'center',
    },
    skeletonAvatar: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: Colors.neutral[100],
        marginRight: 16,
    },
    skeletonContent: {
        flex: 1,
    },
    skeletonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    skeletonLine: {
        height: 12,
        backgroundColor: Colors.neutral[100],
        borderRadius: 6,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
