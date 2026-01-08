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
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/color';
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
            .from('conversations')
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
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            console.error('Error fetching notifications:', error);
            return;
        }

        setNotifications(data || []);
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
                .from('notifications')
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
                .from('notifications')
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
                return Colors.info[100];
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
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days}d ago`;
        return time.toLocaleDateString();
    };

    const renderConversationItem = ({ item }: { item: Conversation }) => (
        <TouchableOpacity
            style={styles.conversationItem}
            onPress={() => router.push(`/conversation/${item.id}`)}
        >
            <Image
                source={{ uri: item.other_user?.avatar_url || 'https://via.placeholder.com/50' }}
                style={styles.avatar}
            />
            <View style={styles.conversationContent}>
                <View style={styles.conversationHeader}>
                    <Text style={styles.userName}>{item.other_user?.full_name || 'Unknown User'}</Text>
                    <Text style={styles.timestamp}>{formatTime(item.last_message_at)}</Text>
                </View>
                <Text style={styles.productName} numberOfLines={1}>
                    {item.product?.name}
                </Text>
                <Text
                    style={[styles.lastMessage, item.unread_count > 0 && styles.unreadMessage]}
                    numberOfLines={1}
                >
                    {item.last_message || 'Start a conversation...'}
                </Text>
            </View>
            {item.unread_count > 0 && (
                <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{item.unread_count}</Text>
                </View>
            )}
            <ChatBubbleLeftIcon size={20} color={Colors.neutral[400]} />
        </TouchableOpacity>
    );

    const renderNotificationItem = ({ item }: { item: Notification }) => (
        <TouchableOpacity
            style={[styles.notificationItem, !item.is_read && styles.unreadNotification]}
            onPress={() => {
                // Mark as read and navigate based on type
                supabase
                    .from('notifications')
                    .update({ is_read: true })
                    .eq('id', item.id)
                    .then(() => fetchNotifications());

                // Navigate based on notification type
                if (item.type === 'order' && item.data?.order_id) {
                    router.push(`/order/${item.data.order_id}`);
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
                    onPress={() => router.push('/(tabs)/browse')}
                >
                    <Text style={styles.discoverButtonText}>🔍 Discover items</Text>
                </TouchableOpacity>
            )}
        </View>
    );

    const unreadNotificationsCount = notifications.filter((n) => !n.is_read).length;

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Inbox</Text>
            </View>

            {/* Tabs */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'messages' && styles.activeTab]}
                    onPress={() => setActiveTab('messages')}
                >
                    <ChatBubbleLeftSolid size={20} color={activeTab === 'messages' ? '#FFF' : Colors.primary[500]} />
                    <Text style={[styles.tabText, activeTab === 'messages' && styles.activeTabText]}>
                        Messages
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'notifications' && styles.activeTab]}
                    onPress={() => setActiveTab('notifications')}
                >
                    <BellIcon size={20} color={activeTab === 'notifications' ? Colors.primary[500] : Colors.neutral[400]} />
                    <Text style={[styles.tabText, activeTab === 'notifications' && styles.activeTabText]}>
                        Notifications
                    </Text>
                    {unreadNotificationsCount > 0 && (
                        <View style={styles.tabBadge}>
                            <Text style={styles.tabBadgeText}>{unreadNotificationsCount}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {/* Section Header */}
            <View style={styles.sectionHeader}>
                <View>
                    <Text style={styles.sectionTitle}>All notifications</Text>
                    <Text style={styles.sectionSubtitle}>
                        {activeTab === 'messages'
                            ? 'Showing messages and system updates in one place. Simple and clean.'
                            : 'Stay updated on orders, deliveries, and activity'}
                    </Text>
                </View>
                <Text style={styles.todayLabel}>Today</Text>
            </View>

            {/* Action Buttons (for notifications) */}
            {activeTab === 'notifications' && notifications.length > 0 && (
                <View style={styles.actionBar}>
                    <TouchableOpacity style={styles.actionButton} onPress={markAllAsRead}>
                        <CheckIcon size={16} color={Colors.primary[500]} />
                        <Text style={styles.actionButtonText}>Mark all read</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionButton} onPress={clearAll}>
                        <TrashIcon size={16} color={Colors.danger[500]} />
                        <Text style={[styles.actionButtonText, { color: Colors.danger[500] }]}>Clear</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.preferencesButton}>
                        <Cog6ToothIcon size={16} color={Colors.neutral[600]} />
                        <Text style={styles.actionButtonText}>Preferences</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Content */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.primary[500]} />
                </View>
            ) : (
                <FlatList
                    data={activeTab === 'messages' ? conversations : notifications}
                    renderItem={activeTab === 'messages' ? renderConversationItem : renderNotificationItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={renderEmptyState}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 16,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: Colors.neutral[200],
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    tabContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 16,
        gap: 12,
        backgroundColor: '#FFF',
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 24,
        gap: 8,
        backgroundColor: Colors.neutral[100],
    },
    activeTab: {
        backgroundColor: Colors.primary[500],
    },
    tabText: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.neutral[600],
    },
    activeTabText: {
        color: '#FFF',
    },
    tabBadge: {
        backgroundColor: Colors.danger[500],
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 2,
        marginLeft: 4,
    },
    tabBadgeText: {
        color: '#FFF',
        fontSize: 11,
        fontWeight: '700',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#FFF',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.text.primary,
        marginBottom: 4,
    },
    sectionSubtitle: {
        fontSize: 13,
        color: Colors.text.secondary,
        lineHeight: 18,
        maxWidth: '80%',
    },
    todayLabel: {
        fontSize: 13,
        color: Colors.text.secondary,
        fontWeight: '500',
    },
    actionBar: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 12,
        gap: 12,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: Colors.neutral[200],
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    actionButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.primary[500],
    },
    preferencesButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginLeft: 'auto',
    },
    listContent: {
        flexGrow: 1,
    },
    conversationItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: Colors.neutral[100],
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 12,
    },
    conversationContent: {
        flex: 1,
    },
    conversationHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    userName: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text.primary,
    },
    timestamp: {
        fontSize: 12,
        color: Colors.text.secondary,
    },
    productName: {
        fontSize: 13,
        color: Colors.text.secondary,
        marginBottom: 2,
    },
    lastMessage: {
        fontSize: 14,
        color: Colors.text.secondary,
    },
    unreadMessage: {
        fontWeight: '600',
        color: Colors.text.primary,
    },
    unreadBadge: {
        backgroundColor: Colors.primary[500],
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginRight: 8,
    },
    unreadText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '700',
    },
    notificationItem: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: Colors.neutral[100],
    },
    unreadNotification: {
        backgroundColor: Colors.primary[50],
    },
    notificationIcon: {
        width: 50,
        height: 50,
        borderRadius: 25,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    notificationContent: {
        flex: 1,
    },
    notificationHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    notificationTitle: {
        fontSize: 15,
        fontWeight: '500',
        color: Colors.text.primary,
        flex: 1,
    },
    unreadTitle: {
        fontWeight: '700',
    },
    notificationBody: {
        fontSize: 14,
        color: Colors.text.secondary,
        marginBottom: 8,
    },
    notificationBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        backgroundColor: Colors.primary[100],
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '600',
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.primary[500],
        marginLeft: 8,
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
        paddingVertical: 60,
    },
    emptyIconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: Colors.primary[50],
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: Colors.text.primary,
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 15,
        color: Colors.text.secondary,
        textAlign: 'center',
        marginBottom: 24,
    },
    discoverButton: {
        backgroundColor: Colors.primary[50],
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 24,
    },
    discoverButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.primary[500],
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
