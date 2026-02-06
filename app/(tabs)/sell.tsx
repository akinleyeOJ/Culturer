import React, { useState, useCallback } from 'react';
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
    FlatList,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import DraggableFlatList, {
    ScaleDecorator,
    RenderItemParams,
} from 'react-native-draggable-flatlist';
import {
    ChevronLeftIcon,
    CameraIcon,
    XMarkIcon,
    PlusIcon,
    InformationCircleIcon
} from 'react-native-heroicons/outline';
import { Colors } from '../../constants/color';
import { CATEGORIES } from '../../constants/categories';
import { useAuth } from '../../contexts/AuthContext';
import { createListing, uploadProductImages } from '../../lib/services/productService';

interface ImageFile {
    uri: string;
    base64?: string;
}

const CONDITIONS = [
    { id: 'new', label: 'New' },
    { id: 'like_new', label: 'Like New' },
    { id: 'good', label: 'Good' },
    { id: 'fair', label: 'Fair' },
];

const SellScreen = () => {
    const router = useRouter();
    const { user } = useAuth();

    const [loading, setLoading] = useState(false);

    // Form State
    const [images, setImages] = useState<ImageFile[]>([]);
    const [title, setTitle] = useState('');
    const [price, setPrice] = useState('');
    const [category, setCategory] = useState('');
    const [condition, setCondition] = useState('new');
    const [culturalOrigin, setCulturalOrigin] = useState('');
    const [culturalStory, setCulturalStory] = useState('');
    const [description, setDescription] = useState('');
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [isPickingImage, setIsPickingImage] = useState(false);

    const handlePickImage = async () => {
        if (isPickingImage) return;

        if (images.length >= 5) {
            Alert.alert('Limit reached', 'You can only upload up to 5 images.');
            return;
        }

        try {
            setIsPickingImage(true);
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: true,
                selectionLimit: 5 - images.length,
                quality: 0.7,
                base64: true,
            });

            if (!result.canceled) {
                const newImages = await Promise.all(result.assets.map(async (asset) => {
                    // Compress and resize
                    const manipulated = await ImageManipulator.manipulateAsync(
                        asset.uri,
                        [{ resize: { width: 1200 } }], // Reasonable size for marketplace
                        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
                    );
                    return {
                        uri: manipulated.uri,
                        base64: manipulated.base64
                    };
                }));

                setImages(prev => {
                    const combined = [...prev, ...newImages];
                    return combined.slice(0, 5); // Safety cap
                });
            }
        } catch (error) {
            console.error('Error picking image:', error);
            Alert.alert('Error', 'Failed to pick image');
        } finally {
            setIsPickingImage(false);
        }
    };

    const removeImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    const handlePublish = async (status: 'active' | 'draft' = 'active') => {
        if (!user) return;
        if (images.length === 0) {
            Alert.alert('Missing Photos', 'Please add at least one photo of your item.');
            return;
        }
        if (!title.trim() || !price || !category) {
            Alert.alert('Missing Info', 'Please fill in the title, price, and category.');
            return;
        }

        if (status === 'active' && !description.trim()) {
            Alert.alert('Missing Description', 'Please provide a general description for your item.');
            return;
        }

        try {
            setLoading(true);

            // 1. Upload Images
            const uploadData = images.map(img => ({ base64: img.base64!, uri: img.uri }));
            const imageUrls = await uploadProductImages(user.id, uploadData);

            // 2. Create Listing in DB
            await createListing({
                user_id: user.id,
                name: title,
                description,
                price: parseFloat(price),
                category,
                condition,
                cultural_origin: culturalOrigin,
                cultural_story: culturalStory,
                images: imageUrls,
                status,
            });

            Alert.alert('Success!', status === 'active' ? 'Your listing is live.' : 'Draft saved.', [
                { text: 'OK', onPress: () => router.push('/(tabs)/profile' as any) }
            ]);

        } catch (error) {
            console.error('Error publishing:', error);
            Alert.alert('Error', 'Failed to publish listing. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const FormLabel = ({ label, required = false }: { label: string, required?: boolean }) => (
        <View style={styles.labelRow}>
            <Text style={styles.label}>{label}</Text>
            {required && <Text style={styles.required}>*</Text>}
        </View>
    );

    const CategoryPicker = () => {
        const selectedCat = CATEGORIES.find(c => c.id === category);
        return (
            <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setShowCategoryModal(true)}
            >
                <Text
                    style={[styles.dropdownText, !selectedCat && { color: Colors.neutral[400] }]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                >
                    {selectedCat ? selectedCat.name : 'Select a category'}
                </Text>
                <ChevronLeftIcon size={20} color={Colors.neutral[500]} style={styles.dropdownIcon} />
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
                        <XMarkIcon size={24} color={Colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>New Listing</Text>
                    <TouchableOpacity
                        onPress={() => handlePublish('draft')}
                        disabled={loading}
                        style={styles.draftButton}
                    >
                        <Text style={styles.draftText}>Draft</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                    {/* Image Collection */}
                    <View style={styles.imageSection}>
                        <View style={styles.horizontalScrollContainer}>
                            <TouchableOpacity style={styles.addIconButton} onPress={handlePickImage}>
                                <CameraIcon size={32} color={Colors.primary[500]} />
                                <Text style={styles.addPhotoText}>Add Photo</Text>
                                <Text style={styles.photoCount}>{images.length}/5</Text>
                            </TouchableOpacity>

                            <DraggableFlatList
                                data={images}
                                onDragEnd={({ data }) => setImages(data)}
                                keyExtractor={(_, index) => `img-${index}`}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.imageList}
                                renderItem={({ item, drag, isActive, getIndex }: RenderItemParams<ImageFile>) => {
                                    const index = getIndex();
                                    return (
                                        <ScaleDecorator>
                                            <TouchableOpacity
                                                onLongPress={drag}
                                                disabled={isActive}
                                                activeOpacity={1}
                                                style={[
                                                    styles.imageWrapper,
                                                    isActive && { zIndex: 10 }
                                                ]}
                                            >
                                                <Image source={{ uri: item.uri }} style={styles.imagePreview} />
                                                <TouchableOpacity
                                                    style={styles.removeBadge}
                                                    onPress={() => removeImage(index!)}
                                                >
                                                    <XMarkIcon size={14} color="#FFF" />
                                                </TouchableOpacity>
                                                {index === 0 && (
                                                    <View style={styles.mainBadge}>
                                                        <Text style={styles.mainBadgeText}>Main</Text>
                                                    </View>
                                                )}
                                            </TouchableOpacity>
                                        </ScaleDecorator>
                                    );
                                }}
                            />
                        </View>
                        <Text style={styles.helperText}>First photo is your cover image. Long press to rearrange</Text>
                    </View>

                    {/* Details Section */}
                    <View style={styles.section}>
                        <View style={styles.inputGroup}>
                            <FormLabel label="Item Title" required />
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. Vintage Hand-woven Rug"
                                value={title}
                                onChangeText={setTitle}
                                maxLength={80}
                            />
                        </View>

                        <View style={styles.row}>
                            <View style={[styles.inputGroup, { flex: 1, marginRight: 12 }]}>
                                <FormLabel label="Price ($)" required />
                                <TextInput
                                    style={styles.input}
                                    placeholder="0.00"
                                    keyboardType="decimal-pad"
                                    value={price}
                                    onChangeText={setPrice}
                                />
                            </View>
                            <View style={[styles.inputGroup, { flex: 1 }]}>
                                <FormLabel label="Category" required />
                                <CategoryPicker />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <FormLabel label="Condition" required />
                            <View style={styles.conditionRow}>
                                {CONDITIONS.map(c => (
                                    <TouchableOpacity
                                        key={c.id}
                                        style={[styles.conditionBtn, condition === c.id && styles.conditionBtnActive]}
                                        onPress={() => setCondition(c.id)}
                                    >
                                        <Text style={[styles.conditionText, condition === c.id && styles.conditionTextActive]}>
                                            {c.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </View>

                    {/* Culture Section */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeaderRow}>
                            <Text style={styles.sectionTitle}>Cultural Story</Text>
                            <TouchableOpacity>
                                <InformationCircleIcon size={20} color={Colors.neutral[400]} />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.sectionSub}>Sharing the heritage behind your item helps buyers appreciate its value.</Text>

                        <View style={styles.inputGroup}>
                            <FormLabel label="Origin / Culture" />
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. Ottoman Empire, Moroccan Berber"
                                value={culturalOrigin}
                                onChangeText={setCulturalOrigin}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <FormLabel label="The Story" />
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                placeholder="Tell us how it was made, its significance, or your family connection..."
                                multiline
                                numberOfLines={4}
                                value={culturalStory}
                                onChangeText={setCulturalStory}
                                textAlignVertical="top"
                            />
                        </View>
                    </View>

                    {/* Description Section */}
                    <View style={styles.section}>
                        <View style={styles.inputGroup}>
                            <FormLabel label="General Description" required />
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                placeholder="Brand, size, materials, and any flaws..."
                                multiline
                                numberOfLines={4}
                                value={description}
                                onChangeText={setDescription}
                                textAlignVertical="top"
                            />
                        </View>
                    </View>

                    {/* Submit Button */}
                    <TouchableOpacity
                        style={[styles.publishButton, loading && styles.publishButtonDisabled]}
                        onPress={() => handlePublish('active')}
                        disabled={loading}
                    >
                        {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.publishButtonText}>Publish Listing</Text>}
                    </TouchableOpacity>

                </ScrollView>
            </KeyboardAvoidingView>

            {/* Category Modal */}
            <Modal
                visible={showCategoryModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowCategoryModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowCategoryModal(false)}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Category</Text>
                            <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                                <XMarkIcon size={24} color={Colors.text.primary} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView contentContainerStyle={styles.modalList}>
                            {CATEGORIES.map(item => (
                                <TouchableOpacity
                                    key={item.id}
                                    style={[styles.modalItem, category === item.id && styles.modalItemActive]}
                                    onPress={() => {
                                        setCategory(item.id);
                                        setShowCategoryModal(false);
                                    }}
                                >
                                    <Text style={[styles.modalItemText, category === item.id && styles.modalItemActiveText]}>
                                        {item.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFF',
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
    closeButton: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
    draftButton: { paddingHorizontal: 12, paddingVertical: 6 },
    draftText: { fontSize: 15, color: Colors.primary[500], fontWeight: '600' },
    scrollContent: { paddingBottom: 40 },
    imageSection: { padding: 16, borderBottomWidth: 8, borderBottomColor: '#F9FAFB' },
    horizontalScrollContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    imageList: {
        paddingLeft: 12,
        paddingRight: 16,
        alignItems: 'center',
    },
    addIconButton: {
        width: 100,
        height: 100,
        backgroundColor: Colors.primary[50],
        borderRadius: 12,
        borderWidth: 2,
        borderColor: Colors.primary[100],
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
    },
    addPhotoText: { fontSize: 12, fontWeight: '600', color: Colors.primary[600], marginTop: 4 },
    photoCount: { fontSize: 10, color: Colors.primary[400], marginTop: 2 },
    imageWrapper: {
        position: 'relative',
        marginRight: 12,
    },
    imagePreview: { width: 100, height: 100, borderRadius: 12 },
    removeBadge: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: 'rgba(0,0,0,0.7)',
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#FFF',
    },
    mainBadge: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
        paddingVertical: 2,
    },
    mainBadgeText: { color: '#FFF', fontSize: 10, textAlign: 'center', fontWeight: 'bold' },
    helperText: { fontSize: 12, color: '#6B7280', marginTop: 12 },
    section: { padding: 16, borderBottomWidth: 8, borderBottomColor: '#F9FAFB' },
    labelRow: { flexDirection: 'row', marginBottom: 8 },
    label: { fontSize: 14, fontWeight: '600', color: '#374151' },
    required: { color: Colors.danger[500], marginLeft: 2 },
    inputGroup: { marginBottom: 20 },
    input: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        color: Colors.text.primary,
    },
    textArea: { minHeight: 100 },
    row: { flexDirection: 'row' },
    dropdownButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 52,
    },
    dropdownText: {
        flex: 1,
        fontSize: 16,
        color: Colors.text.primary,
        marginRight: 8,
    },
    dropdownIcon: {
        transform: [{ rotate: '-90deg' }],
    },
    conditionRow: { flexDirection: 'row', gap: 8 },
    conditionBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        alignItems: 'center',
    },
    conditionBtnActive: {
        backgroundColor: Colors.primary[50],
        borderColor: Colors.primary[500],
    },
    conditionText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
    conditionTextActive: { color: Colors.primary[700] },
    sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
    sectionSub: { fontSize: 13, color: '#6B7280', marginBottom: 16 },
    publishButton: {
        backgroundColor: Colors.primary[500],
        margin: 24,
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
    },
    publishButtonDisabled: { opacity: 0.6 },
    publishButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '80%',
        paddingBottom: 40,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    modalList: {
        padding: 10,
    },
    modalItem: {
        padding: 20,
        borderRadius: 12,
    },
    modalItemActive: {
        backgroundColor: Colors.primary[50],
    },
    modalItemText: {
        fontSize: 16,
        color: '#4B5563',
    },
    modalItemActiveText: {
        color: Colors.primary[600],
        fontWeight: '700',
    },
});

export default SellScreen;
