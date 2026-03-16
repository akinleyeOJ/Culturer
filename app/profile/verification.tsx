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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import {
    ChevronLeftIcon,
    CheckBadgeIcon,
    ShieldCheckIcon,
    IdentificationIcon,
    ExclamationCircleIcon,
    ClockIcon,
    CameraIcon,
} from 'react-native-heroicons/outline';
import { Colors } from '../../constants/color';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { requestVerification, cancelVerification } from '../../lib/services/profileService';

const VerificationScreen = () => {
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [profile, setProfile] = useState<any>(null);
    const [idImage, setIdImage] = useState<string | null>(null);

    // Keep track of base64 separately to avoid re-renders if needed, 
    // but state is fine for this simple flow.
    const [pendingBase64, setPendingBase64] = useState<string | null>(null);

    useEffect(() => {
        fetchProfile();
    }, [user]);

    const fetchProfile = async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('verification_status, is_verified, verification_document_url, verification_rejection_reason')
                .eq('id', user.id)
                .single();

            if (data) {
                setProfile(data);
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePickDocument = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [16, 9],
                quality: 0.7,
                base64: true,
            });

            if (!result.canceled && result.assets[0].uri) {
                setIdImage(result.assets[0].uri);
                setPendingBase64(result.assets[0].base64 || null);
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to pick image');
        }
    };

    const uploadDocument = async () => {
        if (!user || !pendingBase64) return null;
        
        try {
            const fileName = `id_${user.id}_${Date.now()}.jpg`;
            const filePath = `documents/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('verification-docs')
                .upload(filePath, decode(pendingBase64), {
                    contentType: 'image/jpeg',
                    upsert: true,
                });

            if (uploadError) throw uploadError;

            return filePath;
        } catch (error) {
            console.error('Error uploading document:', error);
            throw error;
        }
    };

    const handleRequestVerification = async () => {
        if (!user) return;
        if (!idImage) {
            Alert.alert("Required", "Please select a photo of your ID document first.");
            return;
        }
        
        setSubmitting(true);
        try {
            const documentUrl = await uploadDocument();
            if (!documentUrl) throw new Error("Upload failed");

            const result = await requestVerification(user.id, documentUrl);
            
            if (result.success) {
                Alert.alert(
                    "Request Submitted",
                    "Your identity documents have been uploaded and received. Our team will review them shortly.",
                    [{ text: "OK", onPress: () => fetchProfile() }]
                );
            } else {
                Alert.alert("Error", "Could not submit request. Please try again later.");
            }
        } catch (error: any) {
            console.error('Verification error:', error);
            Alert.alert("Error", error.message || "Something went wrong during submission.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancelVerification = async () => {
        if (!user) return;

        Alert.alert(
            "Cancel Verification?",
            "Are you sure you want to cancel your current verification request and start over?",
            [
                { text: "No", style: "cancel" },
                { 
                    text: "Yes, Cancel", 
                    style: "destructive",
                    onPress: async () => {
                        setSubmitting(true);
                        const result = await cancelVerification(user.id);
                        if (result.success) {
                            setIdImage(null);
                            setPendingBase64(null);
                            fetchProfile();
                        } else {
                            Alert.alert("Error", "Could not cancel request. Please try again.");
                        }
                        setSubmitting(false);
                    }
                }
            ]
        );
    };

    const getStatusConfig = () => {
        switch (profile?.verification_status) {
            case 'verified':
                return {
                    icon: ShieldCheckIcon,
                    color: Colors.success[500],
                    title: 'Verified Member',
                    description: 'Your identity has been confirmed. You now have the verified badge on your profile.',
                    bgColor: Colors.success[50],
                };
            case 'pending':
                return {
                    icon: ClockIcon,
                    color: Colors.warning[600],
                    title: 'Verification Pending',
                    description: 'We are currently reviewing your documents. This usually takes 24-48 hours.',
                    bgColor: Colors.warning[50],
                };
            case 'rejected':
                return {
                    icon: ExclamationCircleIcon,
                    color: Colors.danger[600],
                    title: 'Verification Rejected',
                    description: profile?.verification_rejection_reason 
                        ? `Reason: ${profile.verification_rejection_reason}. Please fix the issue and try again.`
                        : 'Your recent request was not approved. Please fix the photo and try again.',
                    bgColor: Colors.danger[50],
                };
            default:
                return {
                    icon: IdentificationIcon,
                    color: Colors.neutral[400],
                    title: 'Identity Verification',
                    description: 'Get verified to build trust and show buyers you are a real person.',
                    bgColor: Colors.neutral[50],
                };
        }
    };

    const status = getStatusConfig();
    const StatusIcon = status.icon;

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
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ChevronLeftIcon size={24} color={Colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Verification</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Status Hero */}
                <View style={[styles.statusHero, { backgroundColor: status.bgColor }]}>
                    <View style={[styles.iconContainer, { backgroundColor: '#FFF' }]}>
                        <StatusIcon size={40} color={status.color} />
                    </View>
                    <Text style={[styles.statusTitle, { color: status.color }]}>
                        {profile?.is_verified ? 'Verified Member' : status.title}
                    </Text>
                    <Text style={styles.statusDescription}>{status.description}</Text>
                </View>

                {/* Info Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Why get verified?</Text>
                    <View style={styles.benefitRow}>
                        <View style={styles.bullet}>
                            <CheckBadgeIcon size={20} color={Colors.primary[500]} />
                        </View>
                        <View style={styles.benefitText}>
                            <Text style={styles.benefitTitle}>Build Community Trust</Text>
                            <Text style={styles.benefitSub}>Verified members create a safer and more authentic environment for everyone.</Text>
                        </View>
                    </View>
                    <View style={styles.benefitRow}>
                        <View style={styles.bullet}>
                            <ShieldCheckIcon size={20} color={Colors.primary[500]} />
                        </View>
                        <View style={styles.benefitText}>
                            <Text style={styles.benefitTitle}>Enhanced Security</Text>
                            <Text style={styles.benefitSub}>Help us protect the platform from fraudulent accounts and bots.</Text>
                        </View>
                    </View>
                </View>

                {/* Requirements Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>How it works</Text>
                    <View style={styles.stepCard}>
                        <Text style={styles.stepNumber}>1</Text>
                        <View style={styles.stepInfo}>
                            <Text style={styles.stepTitle}>Prepare your ID</Text>
                            <Text style={styles.stepDescription}>Have a clear photo of your Government ID (Passport or Driver's License) ready.</Text>
                        </View>
                    </View>
                    <View style={styles.stepCard}>
                        <Text style={styles.stepNumber}>2</Text>
                        <View style={styles.stepInfo}>
                            <Text style={styles.stepTitle}>Submit Request</Text>
                            <Text style={styles.stepDescription}>Select your ID photo and click submit to notify our team for review.</Text>
                        </View>
                    </View>
                    <View style={styles.stepCard}>
                        <Text style={styles.stepNumber}>3</Text>
                        <View style={styles.stepInfo}>
                            <Text style={styles.stepTitle}>Review Period</Text>
                            <Text style={styles.stepDescription}>We will manually review your profile details within 48 hours.</Text>
                        </View>
                    </View>
                </View>

                {/* Action Button */}
                {profile?.verification_status !== 'verified' && profile?.verification_status !== 'pending' && (
                    <View style={styles.actionContainer}>
                        {!idImage ? (
                            <TouchableOpacity 
                                style={styles.uploadButton}
                                onPress={handlePickDocument}
                                disabled={submitting}
                            >
                                <CameraIcon size={24} color={Colors.primary[500]} />
                                <Text style={styles.uploadButtonText}>Select ID Photo</Text>
                            </TouchableOpacity>
                        ) : (
                            <View style={styles.previewContainer}>
                                <Image source={{ uri: idImage }} style={styles.previewImage} />
                                <TouchableOpacity 
                                    style={styles.changeButton} 
                                    onPress={handlePickDocument}
                                    disabled={submitting}
                                >
                                    <View style={styles.changeBadge}>
                                        <Text style={styles.changeText}>Change Photo</Text>
                                    </View>
                                </TouchableOpacity>
                            </View>
                        )}

                        <TouchableOpacity 
                            style={[
                                styles.primaryButton, 
                                (submitting || !idImage) && { opacity: 0.7 }
                            ]}
                            onPress={handleRequestVerification}
                            disabled={submitting || !idImage}
                        >
                            {submitting ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text style={styles.primaryButtonText}>Submit for Review</Text>
                            )}
                        </TouchableOpacity>
                        <Text style={styles.disclaimer}>
                            By requesting verification, you agree to provide accurate information for identity confirmation.
                        </Text>
                    </View>
                )}

                {profile?.verification_status === 'pending' && (
                    <View style={styles.actionContainer}>
                        <View style={styles.pendingBadge}>
                            <ClockIcon size={20} color={Colors.warning[600]} />
                            <Text style={styles.pendingBadgeText}>Verification in Progress</Text>
                        </View>
                        <Text style={styles.pendingNote}>
                            We'll notify you once our team has completed the review.
                        </Text>
                        
                        <TouchableOpacity 
                            style={styles.cancelLink}
                            onPress={handleCancelVerification}
                            disabled={submitting}
                        >
                            <Text style={styles.cancelLinkText}>Cancel & Start Over</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFF',
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
    scrollContent: {
        paddingBottom: 40,
    },
    statusHero: {
        padding: 32,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    statusTitle: {
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 8,
    },
    statusDescription: {
        fontSize: 15,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: 20,
    },
    section: {
        padding: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 20,
    },
    benefitRow: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    bullet: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.primary[50],
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    benefitText: {
        flex: 1,
    },
    benefitTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 2,
    },
    benefitSub: {
        fontSize: 13,
        color: '#6B7280',
    },
    stepCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
    },
    stepNumber: {
        fontSize: 24,
        fontWeight: '900',
        color: Colors.neutral[400],
        marginRight: 16,
        width: 30,
        textAlign: 'center',
    },
    stepInfo: {
        flex: 1,
    },
    stepTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 2,
    },
    stepDescription: {
        fontSize: 13,
        color: '#6B7280',
    },
    actionContainer: {
        padding: 24,
        alignItems: 'center',
    },
    primaryButton: {
        backgroundColor: Colors.primary[500],
        width: '100%',
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    primaryButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
    disclaimer: {
        fontSize: 12,
        color: '#9CA3AF',
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    uploadButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primary[50],
        width: '100%',
        height: 120,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: Colors.primary[200],
        borderStyle: 'dashed',
        marginBottom: 20,
        gap: 12,
    },
    uploadButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.primary[600],
    },
    previewContainer: {
        width: '100%',
        height: 200,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 20,
        backgroundColor: '#F3F4F6',
    },
    previewImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    changeButton: {
        position: 'absolute',
        bottom: 12,
        right: 12,
    },
    changeBadge: {
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
    },
    changeText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '600',
    },
    pendingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.warning[50],
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 30,
        borderWidth: 1,
        borderColor: Colors.warning[200],
        marginBottom: 12,
        gap: 8,
    },
    pendingBadgeText: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.warning[700],
    },
    pendingNote: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
    },
    cancelLink: {
        marginTop: 20,
        padding: 10,
    },
    cancelLinkText: {
        color: Colors.danger[500],
        fontSize: 14,
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
});

export default VerificationScreen;
