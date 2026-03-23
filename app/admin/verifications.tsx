import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    Image,
    FlatList,
    Dimensions,
    Modal,
    TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
    ChevronLeftIcon,
    CheckIcon,
    XMarkIcon,
    UserCircleIcon,
    EyeIcon,
} from 'react-native-heroicons/outline';
import { Colors } from '../../constants/color';
import { fetchPendingVerifications, updateVerificationStatus, getSignedImageUrl } from '../../lib/services/profileService';

const { width } = Dimensions.get('window');

const AdminVerificationsScreen = () => {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [requests, setRequests] = useState<any[]>([]);
    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const [signedUrl, setSignedUrl] = useState<string | null>(null);
    const [rejectionReason, setRejectionReason] = useState("");
    const [isViewerVisible, setIsViewerVisible] = useState(false);

    useEffect(() => {
        loadRequests();
    }, []);

    const handleSelectRequest = async (request: any) => {
        setSelectedRequest(request);
        setSignedUrl(null); // Reset while loading

        if (request.verification_document_url) {
            let path = request.verification_document_url;
            
            // Handle legacy full URLs if they exist
            if (path.includes('verification-docs/')) {
                path = path.split('verification-docs/')[1];
            }
            
            const url = await getSignedImageUrl('verification-docs', path);
            setSignedUrl(url);
        }
    };

    const loadRequests = async () => {
        setLoading(true);
        const result = await fetchPendingVerifications();
        if (result.success) {
            setRequests(result.data || []);
        } else {
            Alert.alert("Error", "Failed to load pending verifications.");
        }
        setLoading(false);
    };

    const handleAction = async (userId: string, action: 'approve' | 'reject') => {
        const isApprove = action === 'approve';
        const status = isApprove ? 'verified' : 'rejected';
        
        if (!isApprove && !rejectionReason.trim()) {
            Alert.alert("Reason Required", "Please provide a reason for rejection so the user knows what to fix.");
            return;
        }

        setSubmitting(true);
        const result = await updateVerificationStatus(userId, status, isApprove, isApprove ? undefined : rejectionReason);
        
        if (result.success) {
            Alert.alert(
                isApprove ? "Approved" : "Rejected",
                `User verification has been ${status}.`,
                [{ text: "OK", onPress: () => {
                    setSelectedRequest(null);
                    setRejectionReason("");
                    loadRequests();
                }}]
            );
        } else {
            Alert.alert("Error", `Failed to ${action} verification.`);
        }
        setSubmitting(false);
    };

    const renderRequestItem = ({ item }: { item: any }) => (
        <TouchableOpacity 
            style={styles.requestItem}
            onPress={() => handleSelectRequest(item)}
        >
            <View style={styles.userInfo}>
                {item.avatar_url ? (
                    <Image source={{ uri: item.avatar_url }} style={styles.userAvatar} />
                ) : (
                    <View style={[styles.userAvatar, styles.placeholderAvatar]}>
                        <UserCircleIcon size={32} color={Colors.neutral[400]} />
                    </View>
                )}
                <View style={styles.userText}>
                    <Text style={styles.userName}>{item.full_name || 'Unnamed User'}</Text>
                    <Text style={styles.userHandle}>@{item.username || 'user'}</Text>
                </View>
            </View>
            <EyeIcon size={20} color={Colors.primary[500]} />
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.primary[500]} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ChevronLeftIcon size={24} color={Colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Verification Review</Text>
                <View style={{ width: 40 }} />
            </View>

            {requests.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No pending verification requests.</Text>
                </View>
            ) : (
                <FlatList
                    data={requests}
                    renderItem={renderRequestItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                />
            )}

            {/* Review Modal-like overlay */}
            {selectedRequest && (
                <View style={styles.overlay}>
                    <View style={styles.reviewCard}>
                        <View style={styles.reviewHeader}>
                            <Text style={styles.reviewTitle}>Review ID Document</Text>
                            <TouchableOpacity onPress={() => setSelectedRequest(null)}>
                                <XMarkIcon size={24} color={Colors.text.primary} />
                            </TouchableOpacity>
                        </View>
                        
                        <ScrollView contentContainerStyle={styles.reviewScroll} keyboardDismissMode="on-drag">
                            <View style={styles.reviewUserInfo}>
                                <Text style={styles.reviewLabel}>User</Text>
                                <Text style={styles.reviewValue}>{selectedRequest.full_name} (@{selectedRequest.username})</Text>
                                <Text style={styles.reviewLabel}>Submitted At</Text>
                                <Text style={styles.reviewValue}>{new Date(selectedRequest.created_at).toLocaleString()}</Text>
                            </View>

                            <Text style={styles.reviewLabel}>ID Document Photo</Text>
                            <TouchableOpacity 
                                style={styles.documentContainer}
                                onPress={() => setIsViewerVisible(true)}
                                activeOpacity={0.9}
                            >
                                {signedUrl ? (
                                    <Image 
                                        source={{ uri: signedUrl }} 
                                        style={styles.documentImage} 
                                        resizeMode="contain"
                                    />
                                ) : selectedRequest.verification_document_url ? (
                                    <View style={{ alignItems: 'center' }}>
                                        <ActivityIndicator size="small" color={Colors.primary[500]} />
                                        <Text style={[styles.reviewLabel, { marginTop: 8 }]}>Loading secure photo...</Text>
                                    </View>
                                ) : (
                                    <Text style={styles.errorText}>No document found.</Text>
                                )}
                            </TouchableOpacity>

                            <View style={styles.rejectionContainer}>
                                <Text style={styles.reviewLabel}>Rejection Reason (if rejecting)</Text>
                                <TextInput
                                    style={styles.reasonInput}
                                    placeholder="e.g. ID is expired, blurry photo, name mismatch..."
                                    value={rejectionReason}
                                    onChangeText={setRejectionReason}
                                    multiline
                                    numberOfLines={3}
                                />
                            </View>
                        </ScrollView>

                        <View style={styles.buttonRow}>
                            <TouchableOpacity 
                                style={[styles.actionButton, styles.rejectButton]}
                                onPress={() => handleAction(selectedRequest.id, 'reject')}
                                disabled={submitting}
                            >
                                <XMarkIcon size={20} color="#FFF" />
                                <Text style={styles.actionButtonText}>Reject</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.actionButton, styles.approveButton]}
                                onPress={() => handleAction(selectedRequest.id, 'approve')}
                                disabled={submitting}
                            >
                                <CheckIcon size={20} color="#FFF" />
                                <Text style={styles.actionButtonText}>Approve</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}

            {submitting && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#FFF" />
                </View>
            )}

            {/* Full Screen Image Viewer Modal */}
            <Modal
                visible={isViewerVisible}
                transparent={false}
                animationType="fade"
                onRequestClose={() => setIsViewerVisible(false)}
            >
                <SafeAreaView style={styles.viewerContainer}>
                    <View style={styles.viewerHeader}>
                        <TouchableOpacity 
                            style={styles.viewerCloseButton}
                            onPress={() => setIsViewerVisible(false)}
                        >
                            <XMarkIcon size={24} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.viewerImageContainer}>
                        {signedUrl && (
                            <Image 
                                source={{ uri: signedUrl }} 
                                style={styles.fullImage} 
                                resizeMode="contain"
                            />
                        )}
                    </View>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    listContent: {
        padding: 16,
    },
    requestItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        padding: 12,
        borderRadius: 12,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 1,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    userAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        marginRight: 12,
    },
    placeholderAvatar: {
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    userText: {
        flex: 1,
    },
    userName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    userHandle: {
        fontSize: 14,
        color: '#6B7280',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyText: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    reviewCard: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: '85%',
        paddingBottom: 40,
    },
    reviewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    reviewTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#111827',
    },
    reviewScroll: {
        padding: 20,
    },
    reviewUserInfo: {
        marginBottom: 20,
    },
    reviewLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#9CA3AF',
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    reviewValue: {
        fontSize: 16,
        color: '#111827',
        fontWeight: '600',
        marginBottom: 16,
    },
    documentContainer: {
        width: '100%',
        height: 300,
        backgroundColor: '#F3F4F6',
        borderRadius: 16,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
    },
    documentImage: {
        width: '100%',
        height: '100%',
    },
    errorText: {
        color: Colors.danger[500],
        fontSize: 14,
    },
    buttonRow: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        gap: 12,
        marginTop: 20,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    btnShadow: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    rejectButton: {
        backgroundColor: Colors.danger[500],
    },
    approveButton: {
        backgroundColor: Colors.success[500],
    },
    actionButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    rejectionContainer: {
        marginTop: 24,
    },
    reasonInput: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 12,
        fontSize: 14,
        color: '#111827',
        textAlignVertical: 'top',
        minHeight: 80,
    },
    viewerContainer: {
        flex: 1,
        backgroundColor: '#000',
    },
    viewerHeader: {
        height: 100,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'flex-end',
        paddingHorizontal: 20,
        paddingBottom: 15,
    },
    viewerCloseButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    viewerImageContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullImage: {
        width: '100%',
        height: '100%',
    },
});

export default AdminVerificationsScreen;
