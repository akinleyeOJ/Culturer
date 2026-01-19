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
            subscribeToMessages();
            markMessagesAsRead();
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
        if (!user) {
            Alert.alert('Error', 'You must be logged in to delete conversations');
            return;
        }

        try {
            console.log('Starting conversation deletion for ID:', id);

            // First delete all messages in the conversation
            console.log('Deleting messages...');
            const { data: deletedMessages, error: messagesError } = await supabase
                .from('messages' as any)
                .delete()
                .eq('conversation_id', id)
                .select();

            if (messagesError) {
                console.error('Error deleting messages:', messagesError);
                throw new Error(`Failed to delete messages: ${messagesError.message}`);
            }

            console.log('Deleted messages:', deletedMessages?.length || 0);

            // Then delete the conversation itself
            console.log('Deleting conversation...');
            const { data: deletedConversation, error: conversationError } = await supabase
                .from('conversations' as any)
                .delete()
                .eq('id', id)
                .select();

            if (conversationError) {
                console.error('Error deleting conversation:', conversationError);
                throw new Error(`Failed to delete conversation: ${conversationError.message}`);
            }

            console.log('Deleted conversation:', deletedConversation);

            // Check if deletion actually worked
            if (!deletedConversation || deletedConversation.length === 0) {
                throw new Error('Deletion failed. You may not have permission to delete this conversation. Please check your database Row Level Security policies.');
            }

            // Navigate back to inbox
            router.back();
        } catch (error: any) {
            console.error('Error in deleteConversation:', error);
            Alert.alert('Error', error.message || 'Failed to delete conversation. Please try again.');
        }
    };

    const uploadImage = async (uri: string): Promise<string | null> => {
        try {
            const response = await fetch(uri);
            const blob = await response.blob();
            const fileExt = uri.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            const filePath = `chat-images/${id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('chat-images')
                .upload(filePath, blob);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage
                .from('chat-images')
                .getPublicUrl(filePath);

            return data.publicUrl;
        } catch (error) {
            console.error('Error uploading image:', error);
            Alert.alert('Upload Failed', 'Could not upload image');
            return null;
        }
    };

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Please grant camera roll permissions');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            setUploadingImage(true);
            const imageUrl = await uploadImage(result.assets[0].uri);
            if (imageUrl) {
                await sendMessage(null, imageUrl);
            }
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
            .insert({
                conversation_id: id,
                sender_id: user.id,
                content: messageContent || null,
                image_url: imageUrl || null,
            })
            .select()
            .single();

        if (error) {
            console.error('Error sending message:', error);
            Alert.alert('Error', 'Failed to send message');
        } else if (data) {
            const newMessage = data as unknown as Message;
            setMessages((prev) => {
                if (prev.some(m => m.id === newMessage.id)) return prev;
                return [newMessage, ...prev];
            });
            setNewMessage('');
        }
        setSending(false);
    };

    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();

        if (isToday) {
            return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        }
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const renderMessage = ({ item, index }: { item: Message; index: number }) => {
        const isMyMessage = item.sender_id === user?.id;

        const messageAbove = index < messages.length - 1 ? messages[index + 1] : null;
        const messageBelow = index > 0 ? messages[index - 1] : null;

        const showTimestamp = index === 0 ||
            (messageBelow && new Date(item.created_at).getTime() - new Date(messageBelow.created_at).getTime() > 300000);

        return (
            <View
                key={item.id}
                style={[
                    styles.messageContainer,
                    isMyMessage ? styles.myMessageContainer : styles.theirMessageContainer,
                ]}
            >
                <View style={[
                    { maxWidth: '80%' },

                ]}>
                    <View style={[styles.messageBubble, isMyMessage ? styles.myMessageBubble : styles.theirMessageBubble]}>
                        {item.image_url && (
                            <Image
                                source={{ uri: item.image_url }}
                                style={styles.messageImage}
                                resizeMode="cover"
                            />
                        )}
                        {item.content && (
                            <Text style={[styles.messageText, isMyMessage && styles.myMessageText]}>
                                {item.content}
                            </Text>
                        )}
                    </View>
                    {showTimestamp && (
                        <Text style={[styles.messageTime, isMyMessage && styles.myMessageTime]}>
                            {formatTime(item.created_at)}
                            {isMyMessage && item.is_read && ' • Seen'}
                        </Text>
                    )}
                </View>
            </View>
        );
    };

    const renderHeader = () => (
        <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <ChevronLeftIcon size={24} color={Colors.text.primary} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
                <Text style={styles.headerTitle}>{conversationDetails?.other_user?.full_name}</Text>
            </View>
            <TouchableOpacity
                style={styles.moreButton}
                onPress={() => setMenuVisible(true)}
            >
                <EllipsisVerticalIcon size={24} color={Colors.text.primary} />
            </TouchableOpacity>
        </View>
    );

    const renderProductCard = () => (
        <TouchableOpacity
            style={styles.productCard}
            onPress={() => router.push(`/product/${conversationDetails?.product?.id}` as any)}
        >
            <View style={styles.productCardContent}>
                <Text style={styles.productCardLabel}>Listing • {conversationDetails?.other_user?.full_name || 'Seller'}</Text>
                <Image
                    source={{ uri: conversationDetails?.product?.image_url || 'https://via.placeholder.com/60' }}
                    style={styles.productImage}
                />
                <View style={styles.productInfo}>
                    <Text style={styles.productName} numberOfLines={1}>
                        {conversationDetails?.product?.name}
                    </Text>
                </View>
                <Text style={styles.productPrice}>${conversationDetails?.product?.price}</Text>
            </View>
        </TouchableOpacity>
    );

    const renderDateSeparator = () => (
        <View style={styles.dateSeparator}>
            <Text style={styles.dateSeparatorText}>Today</Text>
        </View>
    );

    const renderQuickReplies = () => (
        <View style={styles.quickRepliesContainer}>
            {QUICK_REPLIES.map((reply, index) => (
                <TouchableOpacity
                    key={index}
                    style={styles.quickReplyButton}
                    onPress={() => sendMessage(reply)}
                >
                    <Text style={styles.quickReplyText}>{reply}</Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary[500]} />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={0}
        >
            {renderHeader()}

            <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={(item) => item.id}
                inverted={true}
                contentContainerStyle={styles.messagesList}
                ListFooterComponent={
                    <>
                        {renderProductCard()}
                        {renderDateSeparator()}
                    </>
                }
                ListHeaderComponent={
                    messages.length === 0 ? (
                        <View style={styles.emptyMessages}>
                            <Text style={styles.emptyMessagesText}>Start the conversation!</Text>
                        </View>
                    ) : null
                }
            />

            {messages.length === 0 && renderQuickReplies()}

            <View style={styles.inputContainer}>
                <TouchableOpacity style={styles.cameraButton} onPress={pickImage} disabled={uploadingImage}>
                    {uploadingImage ? (
                        <ActivityIndicator size="small" color={Colors.neutral[600]} />
                    ) : (
                        <CameraIcon size={24} color={Colors.neutral[600]} />
                    )}
                </TouchableOpacity>
                <TextInput
                    style={styles.input}
                    placeholder="Write a message..."
                    placeholderTextColor={Colors.text.secondary}
                    value={newMessage}
                    onChangeText={setNewMessage}
                    multiline
                    maxLength={500}
                />
                <TouchableOpacity
                    style={[styles.sendButton, (!newMessage.trim() || sending) && styles.sendButtonDisabled]}
                    onPress={() => sendMessage()}
                    disabled={!newMessage.trim() || sending}
                >
                    {sending ? (
                        <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                        <PaperAirplaneIcon size={20} color="#FFF" />
                    )}
                </TouchableOpacity>
            </View>

            <Modal
                visible={menuVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setMenuVisible(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setMenuVisible(false)}
                >
                    <View style={styles.menuContainer}>
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => {
                                setMenuVisible(false);
                                router.push(`/profile/${conversationDetails?.other_user?.id}` as any);
                            }}
                        >
                            <Text style={styles.menuItemText}>View Profile</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => {
                                setMenuVisible(false);
                                if (conversationDetails?.product?.id) {
                                    router.push(`/item/${conversationDetails.product.id}` as any);
                                }
                            }}
                        >
                            <Text style={styles.menuItemText}>View Item</Text>
                        </TouchableOpacity>
                        <View style={styles.menuDivider} />
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => {
                                setMenuVisible(false);
                                Alert.alert("Block User", "Are you sure you want to block this user?", [
                                    { text: "Cancel", style: "cancel" },
                                    { text: "Block", style: "destructive" }
                                ]);
                            }}
                        >
                            <Text style={styles.menuItemText}>Block User</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => {
                                setMenuVisible(false);
                                Alert.alert("Report User", "User has been flagged for review.");
                            }}
                        >
                            <Text style={styles.menuItemText}>Report User</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => {
                                setMenuVisible(false);
                                Alert.alert("Delete Conversation", "Are you sure you want to delete this conversation? This action cannot be undone.", [
                                    { text: "Cancel", style: "cancel" },
                                    { text: "Delete", style: "destructive", onPress: deleteConversation }
                                ]);
                            }}
                        >
                            <Text style={[styles.menuItemText, styles.menuItemDestructive]}>Delete Conversation</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background.primary,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
        paddingTop: 60,
        paddingRight: 16,
    },
    menuContainer: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        width: 200,
        paddingVertical: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 5,
        marginTop: 40,
    },
    menuItem: {
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    menuItemText: {
        fontSize: 15,
        fontWeight: '500',
        color: Colors.text.primary,
    },
    menuItemDestructive: {
        color: '#EF4444',
    },
    menuDivider: {
        height: 1,
        backgroundColor: Colors.neutral[100],
        marginVertical: 4,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 60,
        paddingBottom: 16,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: Colors.neutral[200],
    },
    backButton: {
        padding: 4,
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: Colors.text.primary,
    },
    moreButton: {
        padding: 4,
    },
    productCard: {
        backgroundColor: '#FFF',
        marginHorizontal: 16,
        marginTop: 24,
        marginBottom: 8,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: Colors.neutral[200],
    },
    productCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    productCardLabel: {
        position: 'absolute',
        top: -30,
        left: 0,
        marginBottom: 4,
        fontSize: 11,
        fontWeight: '600',
        color: Colors.text.secondary,
    },
    productImage: {
        width: 60,
        height: 60,
        borderRadius: 8,
        marginRight: 12,
    },
    productInfo: {
        flex: 1,
    },
    productName: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.text.primary,
        marginBottom: 4,
    },
    productPrice: {
        fontSize: 17,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    dateSeparator: {
        alignItems: 'center',
        marginVertical: 16,
    },
    dateSeparatorText: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.primary[500],
        backgroundColor: Colors.primary[50],
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 12,
    },
    messagesList: {
        paddingHorizontal: 12,
        paddingTop: 10,
        paddingBottom: 4, // Reduced to minimize end-of-chat gap
    },
    messageContainer: {
        flexDirection: 'row',
        marginBottom: 4, // Tight gap for grouping
        alignItems: 'flex-end',
    },
    theirMessageContainer: {
        justifyContent: 'flex-start',
    },
    myMessageContainer: {
        justifyContent: 'flex-end',
    },
    messageAvatar: {
        height: 28,
        width: 28,
        borderRadius: 14,
        marginRight: 6,
    },
    avatarSpacer: {
        width: 28,
        marginRight: 6,
    },
    messageBubble: {
        maxWidth: '100%',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 18,
    },
    myMessageBubble: {
        backgroundColor: Colors.primary[500],
        borderBottomRightRadius: 4,
    },
    theirMessageBubble: {
        backgroundColor: Colors.neutral[100],
        borderBottomLeftRadius: 4,
    },
    messageText: {
        fontSize: 15,
        color: Colors.text.primary,
        lineHeight: 20,
    },
    myMessageText: {
        color: '#FFF',
    },
    messageImage: {
        width: 200,
        height: 200,
        borderRadius: 12,
        marginBottom: 8,
    },
    messageTime: {
        fontSize: 11,
        color: Colors.text.secondary,
        marginTop: 2, // Tighten status text to bubble
        marginBottom: 0, // Removed gap below Seen/Timestamp
        marginLeft: 0,
    },
    myMessageTime: {
        textAlign: 'right',
        marginRight: 4,
    },
    emptyMessages: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyMessagesText: {
        fontSize: 15,
        color: Colors.text.secondary,
    },
    quickRepliesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
    },
    quickReplyButton: {
        backgroundColor: Colors.neutral[100],
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.neutral[300],
        width: '48%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    quickReplyText: {
        fontSize: 13,
        color: Colors.text.primary,
        fontWeight: '500',
        textAlign: 'center',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        paddingBottom: Platform.OS === 'ios' ? 34 : 12,
        backgroundColor: '#FFF',
        borderTopWidth: 1,
        borderTopColor: Colors.neutral[200],
    },
    cameraButton: {
        padding: 8,
        marginRight: 8,
    },
    input: {
        flex: 1,
        backgroundColor: Colors.neutral[100],
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 15,
        color: Colors.text.primary,
        maxHeight: 100,
    },
    sendButton: {
        backgroundColor: Colors.primary[500],
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
    },
    sendButtonDisabled: {
        opacity: 0.5,
    },
});