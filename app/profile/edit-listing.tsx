import React, { useState } from 'react';
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
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { ChevronLeftIcon, CameraIcon, XMarkIcon, ChevronRightIcon, InformationCircleIcon } from 'react-native-heroicons/outline';
import { Colors } from '../../constants/color';
import { CATEGORIES } from '../../constants/categories';
import { useAuth } from '../../contexts/AuthContext';
import { uploadProductImages, createListing, fetchProductById, deleteListing } from '../../lib/services/productService';
import { ImageZoomModal } from '../../components/ImageZoomModal';

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

const EditListingScreen = () => {
    const router = useRouter();
    const { user } = useAuth();
    const { draftId, type } = useLocalSearchParams<{ draftId: string, type: 'active' | 'draft' }>();

    const [loading, setLoading] = useState(false);
    const [isFetchingDraft, setIsFetchingDraft] = useState(true);

    // Form State
    const [images, setImages] = useState<ImageFile[]>([]);
    const [title, setTitle] = useState('');
    const [price, setPrice] = useState('');
    const [category, setCategory] = useState('');
    const [condition, setCondition] = useState('new');
    const [culturalOrigin, setCulturalOrigin] = useState('');
    const [culturalStory, setCulturalStory] = useState('');
    const [description, setDescription] = useState('');
    const [stockQuantity, setStockQuantity] = useState('1');
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [zoomVisible, setZoomVisible] = useState(false);
    const [selectedZoomIndex, setSelectedZoomIndex] = useState(0);
    const [isPickingImage, setIsPickingImage] = useState(false);
    const [originalStatus, setOriginalStatus] = useState<'active' | 'draft' | null>(type || null);

    // Fetch Item if editing
    React.useEffect(() => {
        if (draftId && user) {
            const loadDraft = async () => {
                try {
                    const draft = await fetchProductById(draftId, user.id);
                    if (draft) {
                        setTitle(draft.name);
                        setPrice(draft.price.replace('$', ''));
                        setCategory(draft.category);
                        setCondition(draft.condition?.toLowerCase().replace(' ', '_') || 'new');
                        setCulturalOrigin(draft.cultural_origin || '');
                        setCulturalStory(draft.cultural_story || '');
                        setDescription(draft.description || '');
                        setStockQuantity((draft.stock_quantity || 1).toString());
                        setOriginalStatus(draft.status);
                        setImages(draft.images.map((url: string) => ({ uri: url })));
                    }
                } catch (error) {
                    console.error('Error fetching item:', error);
                    Alert.alert('Error', 'Could not load listing details.');
                } finally {
                    setIsFetchingDraft(false);
                }
            };
            loadDraft();
        } else {
            router.back();
        }
    }, [draftId, user]);

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
                    const manipulated = await ImageManipulator.manipulateAsync(
                        asset.uri,
                        [{ resize: { width: 1200 } }],
                        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
                    );
                    return {
                        uri: manipulated.uri,
                        base64: manipulated.base64
                    };
                }));

                setImages(prev => {
                    const combined = [...prev, ...newImages];
                    return combined.slice(0, 5);
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

    const handleUpdate = async (status: 'active' | 'draft' = 'active') => {
        if (!user || !draftId) return;

        if (images.length === 0) {
            Alert.alert('Missing Photos', 'Please add at least one photo of your item.');
            return;
        }
        if (status === 'active' && (!title.trim() || !price || !category)) {
            Alert.alert('Missing Info', 'Please fill in the title, price, and category before publishing.');
            return;
        }

        if (!description.trim()) {
            Alert.alert('Missing Description', 'Please provide a general description.');
            return;
        }

        try {
            setLoading(true);

            const newImagesToUpload = images.filter(img => img.base64);
            const existingUrls = images.filter(img => !img.base64).map(img => img.uri);

            let uploadedUrls: string[] = [];
            if (newImagesToUpload.length > 0) {
                const uploadData = newImagesToUpload.map(img => ({ base64: img.base64!, uri: img.uri }));
                uploadedUrls = await uploadProductImages(user.id, uploadData);
            }

            const finalImages = [...existingUrls, ...uploadedUrls];

            await createListing({
                id: draftId,
                user_id: user.id,
                name: title,
                description,
                price: Math.max(0, parseFloat(price) || 0),
                category,
                condition,
                cultural_origin: culturalOrigin,
                cultural_story: culturalStory,
                images: finalImages,
                status,
                stock_quantity: Math.max(0, parseInt(stockQuantity) || 1),
            });

            Alert.alert('Success!', status === 'active' ? 'Your listing has been updated.' : 'Draft updated.', [
                {
                    text: 'OK',
                    onPress: () => {
                        router.navigate(status === 'active' ? '/profile/listings' : '/profile/drafts' as any);
                    }
                }
            ]);

        } catch (error: any) {
            console.error('Error updating:', error);
            Alert.alert('Error', `Failed to update: ${error.message || 'Please try again.'}`);
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
                >
                    {selectedCat ? selectedCat.name : 'Select a category'}
                </Text>
                <ChevronLeftIcon size={20} color={Colors.neutral[500]} style={styles.dropdownIcon} />
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => {
                            const isDraft = originalStatus === 'draft';
                            router.navigate(isDraft ? '/profile/drafts' : '/profile/listings');
                        }}
                        style={styles.closeButton}
                    >
                        <XMarkIcon size={24} color={Colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>
                        {originalStatus === 'active' ? 'Edit Listing' : 'Edit Draft'}
                    </Text>
                    {originalStatus !== 'active' ? (
                        <TouchableOpacity
                            onPress={() => handleUpdate('draft')}
                            disabled={loading}
                            style={styles.draftButton}
                        >
                            <Text style={styles.draftText}>Draft</Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={{ width: 40 }} />
                    )}
                </View>

                {isFetchingDraft ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color={Colors.primary[500]} />
                        <Text style={styles.loadingText}>Loading details...</Text>
                    </View>
                ) : (
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 24 }}
                    >
                        {/* Same Form Sections as sell.tsx */}
                        <View style={styles.imageSection}>
                            <View style={styles.horizontalScrollContainer}>
                                <TouchableOpacity style={styles.addIconButton} onPress={handlePickImage}>
                                    <CameraIcon size={32} color={Colors.primary[500]} />
                                    <Text style={styles.addPhotoText}>Add Photo</Text>
                                    <Text style={styles.photoCount}>{images.length}/5</Text>
                                </TouchableOpacity>

                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageList}>
                                    {images.map((item, index) => (
                                        <View key={index} style={styles.imageWrapper}>
                                            <TouchableOpacity
                                                activeOpacity={0.9}
                                                onPress={() => {
                                                    setSelectedZoomIndex(index);
                                                    setZoomVisible(true);
                                                }}
                                            >
                                                <Image source={{ uri: item.uri }} style={styles.imagePreview} />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.removeBadge}
                                                onPress={() => removeImage(index)}
                                            >
                                                <XMarkIcon size={14} color="#FFF" />
                                            </TouchableOpacity>
                                            {index === 0 && (
                                                <View style={styles.mainBadge}>
                                                    <Text style={styles.mainBadgeText}>Main</Text>
                                                </View>
                                            )}
                                        </View>
                                    ))}
                                </ScrollView>
                            </View>
                            <Text style={styles.helperText}>First photo is your item cover image. Max 5 photos.</Text>
                        </View>

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

                            <View style={styles.inputGroup}>
                                <FormLabel label="Quantity" />
                                <TextInput
                                    style={[styles.input, { width: 100 }]}
                                    placeholder="1"
                                    keyboardType="number-pad"
                                    value={stockQuantity}
                                    onChangeText={setStockQuantity}
                                />
                            </View>
                        </View>

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

                        <TouchableOpacity
                            style={[styles.publishButton, loading && styles.publishButtonDisabled]}
                            onPress={() => handleUpdate('active')}
                            disabled={loading}
                        >
                            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.publishButtonText}>Save & Publish</Text>}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.deleteDraftButton}
                            onPress={() => {
                                const isDraft = originalStatus === 'draft';
                                Alert.alert(
                                    isDraft ? 'Delete Draft' : 'Delete Listing',
                                    `Are you sure you want to delete this ${isDraft ? 'draft' : 'listing'}?`,
                                    [
                                        { text: 'Cancel', style: 'cancel' },
                                        {
                                            text: 'Delete',
                                            style: 'destructive',
                                            onPress: async () => {
                                                try {
                                                    await deleteListing(draftId!);
                                                    router.navigate(isDraft ? '/profile/drafts' : '/profile/listings');
                                                } catch (error) {
                                                    console.error("Failed to delete listing:", error);
                                                }
                                            }
                                        }
                                    ]
                                );
                            }}
                        >
                            <Text style={styles.deleteDraftText}>
                                {originalStatus === 'active' ? 'Delete Listing' : 'Delete Draft'}
                            </Text>
                        </TouchableOpacity>
                    </ScrollView>
                )}
            </KeyboardAvoidingView>

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

            <ImageZoomModal
                visible={zoomVisible}
                images={images.map(img => img.uri)}
                initialIndex={selectedZoomIndex}
                onClose={() => setZoomVisible(false)}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
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
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 12, color: '#6B7280', fontSize: 14 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
    draftButton: { paddingHorizontal: 12, paddingVertical: 6 },
    draftText: { fontSize: 15, color: Colors.primary[500], fontWeight: '600' },
    imageSection: { padding: 16, borderBottomWidth: 8, borderBottomColor: '#F9FAFB' },
    horizontalScrollContainer: { flexDirection: 'row', alignItems: 'center' },
    imageList: { paddingLeft: 12, paddingRight: 16, alignItems: 'center' },
    addIconButton: {
        width: 100, height: 100, backgroundColor: Colors.primary[50], borderRadius: 12,
        borderWidth: 2, borderColor: Colors.primary[100], borderStyle: 'dashed',
        justifyContent: 'center', alignItems: 'center',
    },
    addPhotoText: { fontSize: 12, fontWeight: '600', color: Colors.primary[600], marginTop: 4 },
    photoCount: { fontSize: 10, color: Colors.primary[400], marginTop: 2 },
    imageWrapper: { position: 'relative', marginRight: 12 },
    imagePreview: { width: 100, height: 100, borderRadius: 12 },
    removeBadge: {
        position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.7)',
        width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
        borderWidth: 1.5, borderColor: '#FFF',
    },
    mainBadge: {
        position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)',
        borderBottomLeftRadius: 12, borderBottomRightRadius: 12, paddingVertical: 2,
    },
    mainBadgeText: { color: '#FFF', fontSize: 10, textAlign: 'center', fontWeight: 'bold' },
    helperText: { fontSize: 12, color: '#6B7280', marginTop: 12 },
    section: { padding: 16, borderBottomWidth: 8, borderBottomColor: '#F9FAFB' },
    labelRow: { flexDirection: 'row', marginBottom: 8 },
    label: { fontSize: 14, fontWeight: '600', color: '#374151' },
    required: { color: Colors.danger[500], marginLeft: 2 },
    inputGroup: { marginBottom: 20 },
    input: {
        backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB',
        borderRadius: 12, padding: 14, fontSize: 16, color: Colors.text.primary,
    },
    textArea: { minHeight: 100 },
    row: { flexDirection: 'row' },
    dropdownButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB',
        borderRadius: 12, paddingHorizontal: 16, height: 52,
    },
    dropdownText: { flex: 1, fontSize: 16, color: Colors.text.primary, marginRight: 8 },
    dropdownIcon: { transform: [{ rotate: '-90deg' }] },
    conditionRow: { flexDirection: 'row', gap: 8 },
    conditionBtn: {
        flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#F9FAFB',
        borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center',
    },
    conditionBtnActive: { backgroundColor: Colors.primary[50], borderColor: Colors.primary[500] },
    conditionText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
    conditionTextActive: { color: Colors.primary[700] },
    sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
    sectionSub: { fontSize: 13, color: '#6B7280', marginBottom: 12 },
    publishButton: {
        backgroundColor: Colors.primary[500], marginHorizontal: 24, marginTop: 12,
        marginBottom: 12, paddingVertical: 16, borderRadius: 14, alignItems: 'center',
    },
    publishButtonDisabled: { opacity: 0.6 },
    publishButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
    deleteDraftButton: {
        marginHorizontal: 24, paddingVertical: 14, borderRadius: 12,
        borderWidth: 1, borderColor: '#FEE2E2', backgroundColor: '#FEF2F2',
        alignItems: 'center', marginBottom: 24,
    },
    deleteDraftText: { color: '#EF4444', fontSize: 15, fontWeight: '600' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%', paddingBottom: 40 },
    modalHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    },
    modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
    modalList: { padding: 10 },
    modalItem: { padding: 20, borderRadius: 12 },
    modalItemActive: { backgroundColor: Colors.primary[50] },
    modalItemText: { fontSize: 16, color: '#4B5563' },
    modalItemActiveText: { color: Colors.primary[600], fontWeight: '700' },
});

export default EditListingScreen;
