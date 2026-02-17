import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    Image,
    ScrollView,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    AlertButton,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/color';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { ChevronLeftIcon, CameraIcon, CheckIcon, XMarkIcon, PlusIcon, UserCircleIcon } from 'react-native-heroicons/outline';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { Colors as ThemeColors } from '../../constants/color';
import { useNavigation } from '@react-navigation/native';

interface Profile {
    id: string;
    full_name: string | null;
    username: string | null;
    bio: string | null;
    location: string | null;
    avatar_url: string | null;
    cover_url: string | null;
    cultures: string[] | null;
    instagram_handle: string | null;
    facebook_handle: string | null;
    updated_at?: string;
}

const EditProfileScreen = () => {
    const router = useRouter();
    const { user } = useAuth();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form State
    const [fullName, setFullName] = useState('');
    const [username, setUsername] = useState('');
    const [location, setLocation] = useState('');
    const [bio, setBio] = useState('');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [coverUrl, setCoverUrl] = useState<string | null>(null);
    const [cultures, setCultures] = useState<string[]>([]);
    const [newCulture, setNewCulture] = useState('');

    // Socials
    const [instagramHandle, setInstagramHandle] = useState('');
    const [facebookHandle, setFacebookHandle] = useState('');

    // Username Check
    const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null);
    const [isCheckingUsername, setIsCheckingUsername] = useState(false);

    // Track original data for "Unsaved Changes"
    const [initialData, setInitialData] = useState<any>(null);
    const navigation = useNavigation();

    // Initial Data Loading
    useEffect(() => {
        if (user) {
            loadProfile();
        }
    }, [user]);

    const loadProfile = async () => {
        if (!user) return;
        try {
            setLoading(true);

            // 1. Load from Profiles table
            const { data, error } = await supabase
                .from('profiles')
                .select('*') // using * to avoid specific column linting if they are missing from types
                .eq('id', user.id)
                .single();

            if (data) {
                const profile = data as any;
                setFullName(profile.full_name || user?.user_metadata?.full_name || '');
                setUsername(profile.username || '');
                setAvatarUrl(profile.avatar_url || user?.user_metadata?.avatar_url || '');
                setCoverUrl(profile.cover_url || '');
                setBio(profile.bio || '');
                setLocation(profile.location || user?.user_metadata?.location || '');
                setCultures(profile.cultures || []);
                setInstagramHandle(profile.instagram_handle || '');
                setFacebookHandle(profile.facebook_handle || '');

                setInitialData({
                    fullName: profile.full_name || user?.user_metadata?.full_name || '',
                    username: profile.username || '',
                    bio: profile.bio || '',
                    location: profile.location || user?.user_metadata?.location || '',
                    cultures: profile.cultures || [],
                    avatarUrl: profile.avatar_url || user?.user_metadata?.avatar_url || '',
                    coverUrl: profile.cover_url || '',
                    instagramHandle: profile.instagram_handle || '',
                    facebookHandle: profile.facebook_handle || '',
                });
            } else {
                // Fallback to Auth Metadata if profile row missing/error
                setFullName(user?.user_metadata?.full_name || '');
                setAvatarUrl(user?.user_metadata?.avatar_url || '');
                setInitialData({
                    fullName: user?.user_metadata?.full_name || '',
                    avatarUrl: user?.user_metadata?.avatar_url || '',
                });
            }
        } catch (e) {
            console.error('Error loading profile:', e);
        } finally {
            setLoading(false);
        }
    };

    // 2. Live Username Check
    useEffect(() => {
        if (!username || username === initialData?.username) {
            setIsUsernameAvailable(null);
            setIsCheckingUsername(false);
            return;
        }

        const timer = setTimeout(async () => {
            if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
                setIsUsernameAvailable(false);
                return;
            }

            setIsCheckingUsername(true);
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('username', username)
                    .neq('id', user?.id || '')
                    .maybeSingle();

                setIsUsernameAvailable(!data);
            } catch (err) {
                console.error('Check username error:', err);
            } finally {
                setIsCheckingUsername(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [username, initialData?.username]);

    // 3. Unsaved Changes Prevention
    const hasChanges = () => {
        if (!initialData) return false;
        return (
            fullName !== initialData.fullName ||
            username !== initialData.username ||
            bio !== initialData.bio ||
            location !== initialData.location ||
            avatarUrl !== initialData.avatarUrl ||
            coverUrl !== initialData.coverUrl ||
            instagramHandle !== initialData.instagramHandle ||
            facebookHandle !== initialData.facebookHandle ||
            JSON.stringify(cultures) !== JSON.stringify(initialData.cultures)
        );
    };

    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e) => {
            if (!hasChanges() || saving) {
                return;
            }

            // Prevent default behavior of leaving the screen
            e.preventDefault();

            // Prompt the user before leaving
            Alert.alert(
                'Unsaved Changes',
                'You have unsaved changes. Are you sure you want to leave and discard them?',
                [
                    { text: "Don't leave", style: 'cancel', onPress: () => { } },
                    {
                        text: 'Discard',
                        style: 'destructive',
                        onPress: () => navigation.dispatch(e.data.action),
                    },
                ]
            );
        });

        return unsubscribe;
    }, [navigation, fullName, username, bio, location, avatarUrl, coverUrl, cultures, instagramHandle, facebookHandle, initialData, saving]);

    const handlePickImage = async (type: 'avatar' | 'cover') => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: type === 'avatar' ? [1, 1] : [16, 9],
                quality: 0.5,
                base64: true,
            });

            if (!result.canceled && result.assets[0].base64) {
                uploadImage(result.assets[0].base64, type);
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to pick image');
        }
    };

    const showImageOptions = (type: 'avatar' | 'cover') => {
        const hasImage = type === 'avatar' ? !!avatarUrl : !!coverUrl;

        const options: AlertButton[] = [
            { text: 'Choose from Library', onPress: () => { handlePickImage(type); } },
        ];

        if (hasImage) {
            options.push({
                text: 'Remove Current Photo',
                style: 'destructive',
                onPress: () => {
                    Alert.alert(
                        `Remove ${type === 'avatar' ? 'Profile' : 'Cover'} Photo`,
                        `Are you sure you want to remove your ${type === 'avatar' ? 'profile' : 'cover'} photo?`,
                        [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Remove', style: 'destructive', onPress: () => type === 'avatar' ? setAvatarUrl(null) : setCoverUrl(null) }
                        ]
                    );
                }
            });
        }

        options.push({ text: 'Cancel', style: 'cancel' });

        Alert.alert(
            `Edit ${type === 'avatar' ? 'Profile' : 'Cover'} Photo`,
            undefined,
            options
        );
    };

    const uploadImage = async (base64Image: string, type: 'avatar' | 'cover') => {
        if (!user) return;
        try {
            setSaving(true);
            const fileName = `${Date.now()}.jpg`;
            const filePath = `${user.id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from(type === 'avatar' ? 'avatars' : 'covers')
                .upload(filePath, decode(base64Image), {
                    contentType: 'image/jpeg',
                    upsert: true,
                });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from(type === 'avatar' ? 'avatars' : 'covers').getPublicUrl(filePath);
            if (type === 'avatar') {
                setAvatarUrl(data.publicUrl);
            } else {
                setCoverUrl(data.publicUrl);
            }
            setSaving(false);
        } catch (error: any) {
            console.error(`Error uploading ${type}:`, error);
            Alert.alert('Error', `Failed to upload ${type}. ${error.message}`);
            setSaving(false);
        }
    };

    const handleSave = async () => {
        if (!user) return;

        const nameToSave = fullName || '';
        if (!nameToSave.trim()) {
            Alert.alert('Required', 'Name is required.');
            return;
        }

        // Basic username validation
        if (username && !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
            Alert.alert('Invalid Username', 'Username must be 3-20 characters long and can only contain letters, numbers, and underscores.');
            return;
        }

        try {
            setSaving(true);

            // 1. Update Profile Table
            const updates: Profile = {
                id: user.id,
                full_name: fullName,
                username,
                bio,
                location,
                avatar_url: avatarUrl,
                cover_url: coverUrl,
                cultures: cultures,
                instagram_handle: instagramHandle,
                facebook_handle: facebookHandle,
                updated_at: new Date().toISOString(),
            };

            const { error } = await supabase
                .from('profiles')
                .upsert(updates as any);

            if (error) throw error;

            // Sync initialData so hasChanges() returns false for navigation
            setInitialData({
                fullName,
                username,
                bio,
                location,
                cultures: [...cultures],
                avatarUrl,
                coverUrl,
                instagramHandle,
                facebookHandle,
            });

            // 2. Sync with Auth Metadata (Optional but good for fallback)
            await supabase.auth.updateUser({
                data: {
                    full_name: fullName,
                    avatar_url: avatarUrl,
                    cover_url: coverUrl,
                    location: location,
                }
            });

            Alert.alert('Success', 'Profile updated successfully!', [
                { text: 'OK', onPress: () => router.back() }
            ]);

        } catch (error: any) {
            console.error('Error updating profile:', error);

            // Log detailed error for developers
            if (__DEV__) {
                console.warn('Profile sync failed. Details:', error.message || error);
            }

            // Provide professional user-facing error message
            if (error?.message?.includes('column') || error?.code === '42703') {
                const devHint = __DEV__ ? ' (Dev Hint: Run update_profiles_v2.sql)' : '';
                Alert.alert(
                    'Profile Update Unavailable',
                    `We encountered a technical issue updating your profile features.${devHint}`,
                    [{ text: 'OK' }]
                );
            } else if (error?.message?.includes('profiles_username_key') || error?.code === '23505') {
                Alert.alert('Username Taken', 'This username is already in use. Please choose another one.');
            } else {
                Alert.alert('Error', 'We could not save your changes right now. Please try again.');
            }
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary[500]} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.circleBtn}>
                        <ChevronLeftIcon size={24} color={Colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Edit Profile</Text>
                    <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.circleBtn}>
                        {saving ? <ActivityIndicator color={Colors.primary[500]} size="small" /> : <CheckIcon size={24} color={Colors.primary[500]} />}
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    {/* Cover Section */}
                    <View style={styles.coverSection}>
                        {coverUrl ? (
                            <Image
                                source={{ uri: coverUrl }}
                                style={styles.coverImage}
                            />
                        ) : (
                            <View style={[styles.coverImage, { backgroundColor: ThemeColors.primary[50] }]} />
                        )}
                        <TouchableOpacity
                            style={styles.editCoverBtn}
                            onPress={() => showImageOptions('cover')}
                        >
                            <CameraIcon size={20} color="#FFF" />
                            <Text style={styles.editCoverText}>Edit cover</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Avatar Section */}
                    <View style={styles.avatarRow}>
                        <View style={styles.avatarContainer}>
                            {avatarUrl ? (
                                <Image
                                    source={{ uri: avatarUrl }}
                                    style={styles.avatar}
                                />
                            ) : (
                                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                    <UserCircleIcon size={80} color="#9CA3AF" />
                                </View>
                            )}
                            <TouchableOpacity style={styles.editBadge} onPress={() => showImageOptions('avatar')}>
                                <CameraIcon size={16} color="#FFF" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.avatarMain}>
                            <Text style={styles.usernameId}>{username ? `@${username}` : 'Set a username'}</Text>
                        </View>
                    </View>

                    <View style={styles.formContainer}>
                        {/* Basic Info */}
                        <View style={styles.section}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Name</Text>
                                <TextInput
                                    style={styles.input}
                                    value={fullName}
                                    onChangeText={setFullName}
                                    placeholder="Your name or shop name"
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Username</Text>
                                <View style={styles.inputWithIcon}>
                                    <TextInput
                                        style={[styles.input, { flex: 1 }]}
                                        value={username}
                                        onChangeText={setUsername}
                                        placeholder="@username"
                                        autoCapitalize="none"
                                    />
                                    <View style={styles.availabilityIndicator}>
                                        {isCheckingUsername ? (
                                            <ActivityIndicator size="small" color={Colors.primary[500]} />
                                        ) : isUsernameAvailable === true ? (
                                            <CheckIcon size={20} color="#10B981" />
                                        ) : isUsernameAvailable === false ? (
                                            <XMarkIcon size={20} color="#EF4444" />
                                        ) : null}
                                    </View>
                                </View>
                                {isUsernameAvailable === false && (
                                    <Text style={styles.errorText}>Username is taken or invalid</Text>
                                )}
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Bio</Text>
                                <View style={styles.textAreaContainer}>
                                    <TextInput
                                        style={[styles.input, styles.textArea]}
                                        value={bio}
                                        onChangeText={setBio}
                                        placeholder="Tell buyers about yourself, your shop, or cultural focus..."
                                        multiline
                                        maxLength={150}
                                        numberOfLines={4}
                                        textAlignVertical="top"
                                    />
                                    <Text style={styles.charCount}>{bio.length}/150</Text>
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Location</Text>
                                <TextInput
                                    style={styles.input}
                                    value={location}
                                    onChangeText={setLocation}
                                    placeholder="City, Country"
                                />
                            </View>
                        </View>

                        {/* Cultures Represented */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Cultures Represented</Text>
                            <Text style={styles.sectionHelper}>Helps buyers find you by cultural heritage</Text>

                            <View style={styles.culturesList}>
                                {cultures.map((culture, index) => (
                                    <View key={index} style={styles.cultureTag}>
                                        <Text style={styles.cultureTagText}>{culture}</Text>
                                        <TouchableOpacity
                                            onPress={() => setCultures(cultures.filter((_, i) => i !== index))}
                                            style={styles.removeCulture}
                                        >
                                            <XMarkIcon size={14} color="#4F46E5" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>

                            <TouchableOpacity
                                style={styles.addCultureBtn}
                                onPress={() => {
                                    Alert.prompt(
                                        "Add Culture",
                                        "Enter a culture you represent",
                                        [
                                            { text: "Cancel", style: "cancel" },
                                            {
                                                text: "Add",
                                                onPress: (val?: string) => {
                                                    if (val && !cultures.includes(val)) {
                                                        setCultures([...cultures, val]);
                                                    }
                                                }
                                            }
                                        ]
                                    );
                                }}
                            >
                                <PlusIcon size={18} color="#9CA3AF" />
                                <Text style={styles.addCultureText}>Add culture</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Social Links */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Social Links</Text>
                            <Text style={styles.sectionHelper}>Connect your other profiles</Text>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Instagram</Text>
                                <View style={styles.inputWithLeftIcon}>
                                    <View style={styles.prefixContainer}>
                                        <Text style={styles.prefix}>@</Text>
                                    </View>
                                    <TextInput
                                        style={styles.plainInput}
                                        value={instagramHandle}
                                        onChangeText={setInstagramHandle}
                                        placeholder="username"
                                        autoCapitalize="none"
                                    />
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Facebook</Text>
                                <View style={styles.inputWithLeftIcon}>
                                    <View style={styles.prefixContainer}>
                                        <Text style={styles.prefixText}>facebook.com/</Text>
                                    </View>
                                    <TextInput
                                        style={styles.plainInput}
                                        value={facebookHandle}
                                        onChangeText={setFacebookHandle}
                                        placeholder="username"
                                        autoCapitalize="none"
                                    />
                                </View>
                            </View>

                        </View>
                    </View>

                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFF',
    },
    loadingContainer: {
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
    circleBtn: {
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
    content: {
        flexGrow: 1,
    },
    coverSection: {
        height: 180,
        backgroundColor: '#F3F4F6',
        position: 'relative',
    },
    coverImage: {
        width: '100%',
        height: '100%',
    },
    editCoverBtn: {
        position: 'absolute',
        top: 16,
        right: 16,
        backgroundColor: 'rgba(0,0,0,0.6)',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 6,
    },
    editCoverText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
    removeCoverBtn: {
        position: 'absolute',
        top: 16,
        left: 16,
        backgroundColor: 'rgba(0,0,0,0.6)',
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 16,
        marginTop: -30,
        marginBottom: 20,
    },
    avatarContainer: {
        position: 'relative',
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#F3F4F6',
        borderWidth: 4,
        borderColor: '#FFF',
    },
    avatarPlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    editBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: ThemeColors.primary[500],
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    removeAvatarBadge: {
        position: 'absolute',
        top: 0,
        right: 0,
        backgroundColor: '#EF4444',
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    avatarMain: {
        marginLeft: 12,
        marginBottom: 10,
    },
    usernameId: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    formContainer: {
        padding: 16,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 8,
    },
    sectionHelper: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 16,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '700',
        color: '#374151',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        color: '#111827',
    },
    textAreaContainer: {
        position: 'relative',
    },
    textArea: {
        minHeight: 100,
        paddingBottom: 24,
    },
    charCount: {
        position: 'absolute',
        bottom: 12,
        right: 12,
        fontSize: 12,
        color: '#9CA3AF',
    },
    culturesList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
    },
    cultureTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EEF2FF',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        gap: 6,
    },
    cultureTagText: {
        color: '#4F46E5',
        fontSize: 14,
        fontWeight: '600',
    },
    removeCulture: {
        padding: 2,
    },
    addCultureBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderStyle: 'dashed',
        gap: 8,
    },
    addCultureText: {
        color: '#6B7280',
        fontSize: 14,
        fontWeight: '600',
    },
    inputWithIcon: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    inputWithLeftIcon: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        overflow: 'hidden',
    },
    prefixContainer: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 12,
        height: 48,
        justifyContent: 'center',
        borderRightWidth: 1,
        borderRightColor: '#E5E7EB',
    },
    plainInput: {
        flex: 1,
        height: 48,
        paddingHorizontal: 16,
        fontSize: 16,
        color: '#111827',
        backgroundColor: 'transparent',
    },
    prefix: {
        fontSize: 16,
        color: '#6B7280',
        fontWeight: '600',
    },
    prefixText: {
        fontSize: 14,
        color: '#6B7280',
        fontWeight: '600',
    },
    availabilityIndicator: {
        width: 30,
        alignItems: 'center',
    },
    errorText: {
        color: '#EF4444',
        fontSize: 12,
        marginTop: 4,
        marginLeft: 4,
    },
});

export default EditProfileScreen;
