import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    Image,
    ActivityIndicator,
    Alert,
    Modal,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '../../constants/color';
import {
    ChevronLeftIcon,
    PaperAirplaneIcon,
    CameraIcon,
    EllipsisVerticalIcon,
} from 'react-native-heroicons/outline';

type Message = {
    id: string;
    conversation_id: string;
    sender_id: string;
    content: string | null;
    image_url: string | null;
    is_read: boolean;
    created_at: string;
};

type ConversationDetails = {
    id: string;
    product: {
        id: string;
        name: string;
        image_url: string;
        price: number;
        seller_id: string;
    };
    other_user: {
        id: string;
        full_name: string;
        avatar_url: string;
    };
};

const QUICK_REPLIES = [
    'Is pickup possible?',
    'Any bundle discount?',
    'When can you ship?',
    'Is this still available?',
];

export default function ConversationScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [conversationDetails, setConversationDetails] = useState<ConversationDetails | null>(null);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [menuVisible, setMenuVisible] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        if (id && user) {
            fetchConversationDetails();
            fetchMessages();
            const unsubscribe = subscribeToMessages();
            markMessagesAsRead();

            return unsubscribe; 9
        }
    }, [id, user]);

    const fetchConversationDetails = async () => {
        const { data, error } = await supabase
            .from('conversations' as any)
            .select(`
                id,
                buyer_id,
                seller_id,
                product:products(id, name, image_url, price, user_id)
            `)
            .eq('id', id)
            .single();

        if (error || !data) {
            console.error('Error fetching conversation:', error);
            return;
        }

        const conversationData = data as any;
        const otherUserId = conversationData.buyer_id === user?.id ? conversationData.seller_id : conversationData.buyer_id;
        const { data: otherUser } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .eq('id', otherUserId)
            .single();

        setConversationDetails({
            ...conversationData,
            other_user: otherUser,
        } as any);
        setLoading(false);
    };

    const fetchMessages = async () => {
        const { data, error } = await supabase
            .from('messages' as any)
            .select('*')
            .eq('conversation_id', id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching messages:', error);
            return;
        }

        setMessages((data || []) as unknown as Message[]);
    };

    const subscribeToMessages = () => {
        const channel = supabase
            .channel(`conversation-${id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${id}`,
                },
                (payload) => {
                    setMessages((prev) => {
                        if (prev.some(m => m.id === payload.new.id)) return prev;
                        return [payload.new as Message, ...prev];
                    });
                    markMessagesAsRead();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    };

    const markMessagesAsRead = async () => {
        if (!user) return;
        await supabase
            .from('messages' as any)
            .update({ is_read: true })
            .eq('conversation_id', id)
            .neq('sender_id', user.id)
            .eq('is_read', false);
    };

    const deleteConversation = async () => {
        if (!user) return;
        try {
            await supabase.from('messages' as any).delete().eq('conversation_id', id);
            await supabase.from('conversations' as any).delete().eq('id', id);
            router.back();
        } catch (error) {
            console.error('Error deleting conversation:', error);
            Alert.alert('Error', 'Failed to delete conversation');
        }
    };

    const blockUser = async () => {
        if (!user || !conversationDetails?.other_user?.id) return;
        try {
            const { error } = await supabase
                .from('blocked_users' as any)
                .insert({ blocker_id: user.id, blocked_id: conversationDetails.other_user.id });
            if (error) throw error;
            Alert.alert('User Blocked', 'You will no longer see messages from this user.');
            router.back();
        } catch (error) {
            Alert.alert('Error', 'Failed to block user');
        }
    };

    const reportUser = async () => {
        if (!user || !conversationDetails?.other_user?.id) return;
        Alert.prompt("Report User", "Why are you reporting this user?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Report",
                onPress: async (reason?: string) => {
                    if (!reason) return;
                    await supabase.from('reports' as any).insert({
                        reporter_id: user.id,
                        reported_user_id: conversationDetails.other_user.id,
                        reason: 'User Report',
                        details: reason,
                        content_id: id
                    });
                    Alert.alert('Report Sent', 'We will review this shortly.');
                }
            }
        ]);
    };

    const uploadImage = async (uri: string): Promise<string | null> => {
        try {
            const fileExt = uri.split('.').pop() || 'jpg';
            const fileName = `${Date.now()}.${fileExt}`;
            const filePath = `chat-images/${id}/${fileName}`;
            const response = await fetch(uri);
            const arrayBuffer = await response.arrayBuffer();
            const { error: uploadError } = await supabase.storage
                .from('chat-images')
                .upload(filePath, arrayBuffer, { contentType: `image/${fileExt}` });
            if (uploadError) throw uploadError;
            const { data } = supabase.storage.from('chat-images').getPublicUrl(filePath);
            return data.publicUrl;
        } catch (error) {
            return null;
        }
    };

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return;
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
        if (!result.canceled && result.assets[0]) {
            setUploadingImage(true);
            const imageUrl = await uploadImage(result.assets[0].uri);
            if (imageUrl) await sendMessage(null, imageUrl);
            setUploadingImage(false);
        }
    };

    const sendMessage = async (content?: string | null, imageUrl?: string | null) => {
        const messageContent = content !== undefined ? content : newMessage.trim();
        if (!messageContent && !imageUrl) return;
        if (!user) return;
        setSending(true);
        const { data, error } = await supabase
            .from('messages' as any)
            .insert({ conversation_id: id, sender_id: user.id, content: messageContent || null, image_url: imageUrl || null })
            .select().single();
        if (!error && data) {
            setMessages(prev => {
                const newMessageObj = data as any;
                if (prev.some(m => m.id === newMessageObj.id)) return prev;
                return [newMessageObj as Message, ...prev];
            });
            setNewMessage('');
        }
        setSending(false);
    };

    const renderMessage = ({ item, index }: { item: Message; index: number }) => {
        const isMyMessage = item.sender_id === user?.id;
        const messageAbove = index < messages.length - 1 ? messages[index + 1] : null;
        const showDateSeparator = !messageAbove || new Date(item.created_at).toDateString() !== new Date(messageAbove.created_at).toDateString();

        return (
            <View key={item.id}>
                {showDateSeparator && (
                    <View style={styles.dateSeparator}>
                        <Text style={styles.dateSeparatorText}>
                            {new Date(item.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                        </Text>
                    </View>
                )}
                <View style={[styles.messageContainer, isMyMessage ? styles.myMessageContainer : styles.theirMessageContainer]}>
                    <View style={{ maxWidth: '80%' }}>
                        <View style={[
                            styles.messageBubble,
                            isMyMessage ? styles.myMessageBubble : styles.theirMessageBubble,
                            item.image_url && !item.content && { padding: 0, backgroundColor: 'transparent' }
                        ]}>
                            {item.image_url && (
                                <Image
                                    source={{ uri: item.image_url }}
                                    style={[
                                        styles.messageImage,
                                        item.content ? { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 } : { borderRadius: 18 }
                                    ]}
                                    resizeMode="cover"
                                />
                            )}
                            {item.content && <Text style={[styles.messageText, isMyMessage && styles.myMessageText, item.image_url && { paddingHorizontal: 12, paddingVertical: 10 }]}>{item.content}</Text>}
                        </View>
                        <Text style={[styles.messageTime, isMyMessage && styles.myMessageTime]}>
                            {new Date(item.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                            {isMyMessage && item.is_read && index === 0 && ' • Seen'}
                        </Text>
                    </View>
                </View>
            </View>
        );
    };

    if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={Colors.primary[500]} /></View>;

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}><ChevronLeftIcon size={24} color={Colors.text.primary} /></TouchableOpacity>
                <View style={styles.headerCenter}><Text style={styles.headerTitle}>{conversationDetails?.other_user?.full_name}</Text></View>
                <TouchableOpacity onPress={() => setMenuVisible(true)}><EllipsisVerticalIcon size={24} color={Colors.text.primary} /></TouchableOpacity>
            </View>

            {/* Product Context Bar */}
            {conversationDetails?.product && (
                <TouchableOpacity
                    style={styles.productBanner}
                    onPress={() => router.push(`/item/${conversationDetails.product.id}` as any)}
                >
                    <Image
                        source={{ uri: conversationDetails.product.image_url }}
                        style={styles.productBannerImage}
                    />
                    <View style={styles.productBannerInfo}>
                        <Text style={styles.productBannerName} numberOfLines={1}>
                            {conversationDetails.product.name}
                        </Text>
                        <Text style={styles.productBannerPrice}>
                            ${conversationDetails.product.price.toFixed(2)}
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={styles.buyShortButton}
                        onPress={() => router.push({
                            pathname: '/checkout',
                            params: { productId: conversationDetails.product.id, quantity: 1 }
                        })}
                    >
                        <Text style={styles.buyShortButtonText}>Buy</Text>
                    </TouchableOpacity>
                </TouchableOpacity>
            )}

            <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={(item) => item.id}
                inverted={true}
                contentContainerStyle={styles.messagesList}
            />

            {messages.length === 0 && (
                <View style={styles.quickRepliesContainer}>
                    {QUICK_REPLIES.map((reply, i) => (
                        <TouchableOpacity key={i} style={styles.quickReplyButton} onPress={() => sendMessage(reply)}>
                            <Text style={styles.quickReplyText}>{reply}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            <View style={styles.inputContainer}>
                <TouchableOpacity onPress={pickImage} disabled={uploadingImage}>
                    {uploadingImage ? <ActivityIndicator size="small" /> : <CameraIcon size={24} color={Colors.neutral[600]} />}
                </TouchableOpacity>
                <TextInput style={styles.input} placeholder="Write a message..." value={newMessage} onChangeText={setNewMessage} multiline />
                <TouchableOpacity style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]} onPress={() => sendMessage()} disabled={!newMessage.trim() || sending}>
                    {sending ? <ActivityIndicator size="small" color="#FFF" /> : <PaperAirplaneIcon size={20} color="#FFF" />}
                </TouchableOpacity>
            </View>

            <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
                    <View style={styles.menuContainer}>
                        <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); router.push(`/profile/${conversationDetails?.other_user?.id}` as any); }}>
                            <Text style={styles.menuItemText}>View Profile</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); if (conversationDetails?.product?.id) router.push(`/item/${conversationDetails.product.id}` as any); }}>
                            <Text style={styles.menuItemText}>View Item</Text>
                        </TouchableOpacity>
                        <View style={styles.menuDivider} />
                        <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); Alert.alert("Block User", "Stop seeing and receiving messages from this user?", [{ text: "Cancel" }, { text: "Block", style: "destructive", onPress: blockUser }]); }}>
                            <Text style={styles.menuItemText}>Block User</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); reportUser(); }}>
                            <Text style={styles.menuItemText}>Report User</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); Alert.alert("Delete Conversation", "This cannot be undone.", [{ text: "Cancel" }, { text: "Delete", style: "destructive", onPress: deleteConversation }]); }}>
                            <Text style={[styles.menuItemText, styles.menuItemDestructive]}>Delete Conversation</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#EEE' },
    backButton: { padding: 4 },
    headerCenter: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: 17, fontWeight: '600' },
    productBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#F9F9F9',
        borderBottomWidth: 1,
        borderBottomColor: '#EEE',
    },
    productBannerImage: {
        width: 40,
        height: 40,
        borderRadius: 6,
        marginRight: 10,
    },
    productBannerInfo: {
        flex: 1,
    },
    productBannerName: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.text.primary,
    },
    productBannerPrice: {
        fontSize: 13,
        fontWeight: '700',
        color: Colors.primary[500],
        marginTop: 1,
    },
    buyShortButton: {
        backgroundColor: Colors.primary[500],
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    buyShortButtonText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '700',
    },
    messagesList: { paddingHorizontal: 16, paddingBottom: 20 },
    messageContainer: { marginVertical: 4, flexDirection: 'row' },
    myMessageContainer: { justifyContent: 'flex-end' },
    theirMessageContainer: { justifyContent: 'flex-start' },
    messageBubble: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, maxWidth: '100%' },
    myMessageBubble: { backgroundColor: Colors.primary[500], borderBottomRightRadius: 4 },
    theirMessageBubble: { backgroundColor: '#F0F0F0', borderBottomLeftRadius: 4 },
    messageTime: { fontSize: 11, color: '#999', marginTop: 4, alignSelf: 'flex-end' },
    myMessageTime: { marginRight: 4 },
    messageImage: { width: 240, height: 180, borderRadius: 12 },
    dateSeparator: { alignItems: 'center', marginVertical: 16 },
    dateSeparatorText: { fontSize: 12, color: '#999', fontWeight: '600', textTransform: 'uppercase' },
    quickRepliesContainer: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, borderTopWidth: 1, borderTopColor: '#EEE' },
    quickReplyButton: { backgroundColor: '#F0F0F0', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, marginRight: 8, marginBottom: 8 },
    quickReplyText: { fontSize: 13, color: '#555' },
    inputContainer: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: Platform.OS === 'ios' ? 34 : 16, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#EEE' },
    input: { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 8, marginHorizontal: 12, maxHeight: 100 },
    sendButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary[500], alignItems: 'center', justifyContent: 'center' },
    sendButtonDisabled: { backgroundColor: '#CCC' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 100, paddingRight: 16 },
    menuContainer: { backgroundColor: '#FFF', borderRadius: 12, width: 180, paddingVertical: 8, shadowColor: '#000', shadowRadius: 8, shadowOpacity: 0.1, elevation: 5 },
    menuItem: { paddingVertical: 12, paddingHorizontal: 16 },
    menuItemText: { fontSize: 15, fontWeight: '500' },
    menuDivider: { height: 1, backgroundColor: '#EEE', marginVertical: 4 },
    menuItemDestructive: { color: '#EF4444' },
    messageText: { fontSize: 16, color: '#000' },
    myMessageText: { color: '#FFF' },
    theirMessageText: { color: '#000' },
});