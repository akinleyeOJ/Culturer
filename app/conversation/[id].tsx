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
    ScrollView,
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

        // Get other user details
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
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching messages:', error);
            return;
        }

        setMessages((data || []) as unknown as Message[]);
        setTimeout(() => scrollToBottom(), 100);
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
                        // Prevent duplicates from subscription if we already added it locally
                        if (prev.some(m => m.id === payload.new.id)) return prev;
                        return [...prev, payload.new as Message];
                    });
                    setTimeout(() => scrollToBottom(), 100);
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
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
            // Optimistically add message to list if subscription handles duplicates or logic allows
            // In many cases, we might duplicate if subscription is fast. 
            // A safer way is to rely on subscription, OR append here and filter duplicates in state.
            // For now, let's append here because user reported "doesn't show".
            // We can prevent duplicates by checking ID in setMessages.
            const newMessage = data as unknown as Message;
            setMessages((prev) => {
                if (prev.some(m => m.id === newMessage.id)) return prev;
                return [...prev, newMessage];
            });
            setNewMessage('');
            setTimeout(() => scrollToBottom(), 100);
        }
        setSending(false);
    };

    const scrollToBottom = () => {
        flatListRef.current?.scrollToEnd({ animated: true });
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
        const previousMessage = index > 0 ? messages[index - 1] : null;
        const showAvatar = !isMyMessage && (!previousMessage || previousMessage.sender_id !== item.sender_id);
        const showTimestamp = index === messages.length - 1 ||
            (messages[index + 1] && new Date(messages[index + 1].created_at).getTime() - new Date(item.created_at).getTime() > 300000);

        return (
            <View
                key={item.id} // Use item.id for key
                style={[
                    styles.messageContainer,
                    isMyMessage ? styles.myMessageContainer : null,
                ] as any}
            >
                {showAvatar ? (
                    <Image
                        source={{ uri: conversationDetails?.other_user?.avatar_url || 'https://via.placeholder.com/30' }}
                        style={styles.messageAvatar}
                    />
                ) : (
                    <View style={styles.messageAvatar} />
                )}
                <View style={{ maxWidth: '75%' }}>
                    <View style={[styles.messageBubble, isMyMessage ? styles.myMessageBubble : styles.theirMessageBubble]}>
                        {item.image_url && (
                            <Image
                                source={{ uri: item.image_url }}
                                style={styles.messageImage}
                                resizeMode="cover"
                            />
                        )}
                        {item.content && (
                            <Text style={[styles.messageText, isMyMessage && styles.myMessageText] as any}>
                                {item.content}
                            </Text>
                        )}
                    </View>
                    {showTimestamp && (
                        <Text style={[styles.messageTime, isMyMessage && styles.myMessageTime] as any}>
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
            <TouchableOpacity style={styles.moreButton}>
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
                contentContainerStyle={styles.messagesList as any}
                ListHeaderComponent={
                    <>
                        {renderProductCard()}
                        {renderDateSeparator()}
                    </>
                }
                ListFooterComponent={
                    messages.length === 0 ? (
                        <View style={styles.emptyMessages}>
                            <Text style={styles.emptyMessagesText}>Start the conversation!</Text>
                        </View>
                    ) : null
                }
                onContentSizeChange={() => scrollToBottom()}
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
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background.primary,
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
        marginTop: 16,
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
        top: -8,
        left: 12,
        backgroundColor: '#FFF',
        paddingHorizontal: 8,
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
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    messageContainer: {
        flexDirection: 'row',
        marginBottom: 4,
        alignItems: 'flex-end',
    },
    myMessageContainer: {
        justifyContent: 'flex-end',
    },
    messageAvatar: {
        width: 30,
        height: 30,
        borderRadius: 15,
        marginRight: 8,
    },
    messageBubble: {
        maxWidth: '100%',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
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
        marginTop: 4,
        marginLeft: 38,
    },
    myMessageTime: {
        textAlign: 'right',
        marginLeft: 0,
        marginRight: 8,
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
        paddingVertical: 12, // Taller button for easier tap
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.neutral[300],
        width: '48%', // 2 by 2 grid (approx >48% to fit gap)
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
