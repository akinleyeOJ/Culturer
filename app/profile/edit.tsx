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

interface Profile {
    id: string;
    full_name: string | null;
    username: string | null;
    bio: string | null;
    location: string | null;
    avatar_url: string | null;
    cover_url: string | null;
    cultures: string[] | null;
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
            } else {
                // Fallback to Auth Metadata if profile row missing/error
                setFullName(user?.user_metadata?.full_name || '');
                setAvatarUrl(user?.user_metadata?.avatar_url || '');
            }
        } catch (e) {
            console.error('Error loading profile:', e);
        } finally {
            setLoading(false);
        }
    };

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
        if (!fullName.trim()) {
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
                updated_at: new Date().toISOString(),
            };

            const { error } = await supabase
                .from('profiles')
                .upsert(updates as any);

            if (error) throw error;

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
                            onPress={() => handlePickImage('cover')}
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
                            <TouchableOpacity style={styles.editBadge} onPress={() => handlePickImage('avatar')}>
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
                                <TextInput
                                    style={styles.input}
                                    value={username}
                                    onChangeText={setUsername}
                                    placeholder="@username"
                                    autoCapitalize="none"
                                />
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
                                                onPress: (val) => {
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
});

export default EditProfileScreen;
