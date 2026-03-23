import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    ActivityIndicator,
    Modal,
    TextInput,
    FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/color';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { ChevronLeftIcon, CheckIcon, XMarkIcon, PlusIcon, MagnifyingGlassIcon } from 'react-native-heroicons/outline';
import { CONTINENT_REGIONS } from '../../constants/regions';
import { WORLD_LANGUAGES, SUGGESTED_LANGUAGES } from '../../constants/languages';

const SHIPPING_OPTIONS = [
    'Domestic Only',
    'Worldwide',
    'North America',
    'South America',
    'Europe',
    'Africa',
    'Asia',
    'Oceania'
];

export default function LanguagesRegionsScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
    const [selectedShipping, setSelectedShipping] = useState<string[]>([]);
    const [selectedCultures, setSelectedCultures] = useState<string[]>([]);

    const [isLanguageModalVisible, setLanguageModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredLanguages = searchQuery.trim() === ''
        ? WORLD_LANGUAGES
        : WORLD_LANGUAGES.filter(lang => lang.toLowerCase().includes(searchQuery.toLowerCase()));

    useEffect(() => {
        if (user) fetchData();
    }, [user]);

    const fetchData = async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('spoken_languages, shipping_regions, cultures')
                .eq('id', user.id)
                .single();

            if (data) {
                const profile = data as any;
                if (profile.spoken_languages) setSelectedLanguages(profile.spoken_languages);
                if (profile.shipping_regions) setSelectedShipping(profile.shipping_regions);
                if (profile.cultures) setSelectedCultures(profile.cultures);
            }
        } catch (e) {
            console.error('Error fetching seller settings:', e);
        } finally {
            setLoading(false);
        }
    };

    const toggleSelection = (
        item: string,
        list: string[],
        setList: React.Dispatch<React.SetStateAction<string[]>>
    ) => {
        if (list.includes(item)) {
            setList(list.filter(i => i !== item));
        } else {
            setList([...list, item]);
        }
    };

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        try {
            const { error } = await supabase.from('profiles').update({
                spoken_languages: selectedLanguages as any,
                shipping_regions: selectedShipping as any,
                cultures: selectedCultures as any
            } as any).eq('id', user.id);

            if (error) throw error;
            router.back();
        } catch (e: any) {
            Alert.alert('Error updating settings', e.message);
        } finally {
            setSaving(false);
        }
    };

    const SelectableChip = ({ label, selected, onPress }: { label: string, selected: boolean, onPress: () => void }) => (
        <TouchableOpacity
            style={[styles.chip, selected && styles.chipSelected]}
            onPress={onPress}
        >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {label}
            </Text>
            {selected && <CheckIcon size={16} color="#FFF" style={styles.checkIcon} />}
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeftIcon size={24} color={Colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Languages & regions</Text>
                <TouchableOpacity onPress={handleSave} disabled={saving}>
                    {saving ? <ActivityIndicator size="small" color={Colors.primary[500]} /> : (
                        <Text style={styles.saveText}>Save</Text>
                    )}
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={Colors.primary[500]} />
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.content} keyboardDismissMode="on-drag">
                    <Text style={styles.description}>
                        Help buyers know how to communicate with you and where you ship your items.
                    </Text>

                    {/* Spoken Languages Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>I speak...</Text>
                        <Text style={styles.sectionSubtitle}>Select the languages you can comfortably communicate in with buyers.</Text>
                        <View style={styles.chipContainer}>
                            {selectedLanguages.map(lang => (
                                <TouchableOpacity
                                    key={lang}
                                    style={[styles.chip, styles.chipSelected]}
                                    onPress={() => toggleSelection(lang, selectedLanguages, setSelectedLanguages)}
                                >
                                    <Text style={[styles.chipText, styles.chipTextSelected]}>{lang}</Text>
                                    <XMarkIcon size={14} color="#FFF" style={styles.removeIcon} />
                                </TouchableOpacity>
                            ))}
                            <TouchableOpacity
                                style={styles.addLanguageBtn}
                                onPress={() => setLanguageModalVisible(true)}
                            >
                                <PlusIcon size={16} color={Colors.primary[600]} />
                                <Text style={styles.addLanguageText}>Add Language</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.divider} />

                    {/* Shipping Regions Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>I ship to...</Text>
                        <Text style={styles.sectionSubtitle}>Where are you willing to post your physical products to?</Text>
                        <View style={styles.chipContainer}>
                            {SHIPPING_OPTIONS.map(region => (
                                <SelectableChip
                                    key={region}
                                    label={region}
                                    selected={selectedShipping.includes(region)}
                                    onPress={() => toggleSelection(region, selectedShipping, setSelectedShipping)}
                                />
                            ))}
                        </View>
                    </View>

                    <View style={styles.divider} />

                    {/* Cultural Focus Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Shop Cultural Focus</Text>
                        <Text style={styles.sectionSubtitle}>What cultures are central to the items in your shop? This helps buyers find you when they browse relevant cultures.</Text>

                        {CONTINENT_REGIONS.map((continentGroup) => (
                            <View key={continentGroup.continent} style={styles.continentGroup}>
                                <Text style={styles.continentTitle}>{continentGroup.continent}</Text>
                                <View style={styles.chipContainer}>
                                    {continentGroup.regions.map(culture => (
                                        <SelectableChip
                                            key={culture}
                                            label={culture}
                                            selected={selectedCultures.includes(culture)}
                                            onPress={() => toggleSelection(culture, selectedCultures, setSelectedCultures)}
                                        />
                                    ))}
                                </View>
                            </View>
                        ))}

                        {/* Display Legacy/Custom Cultures that aren't in the official list so they can be removed */}
                        {(() => {
                            const allOfficialRegions = CONTINENT_REGIONS.flatMap(cg => cg.regions);
                            const legacyCultures = selectedCultures.filter(c => !allOfficialRegions.includes(c));

                            if (legacyCultures.length === 0) return null;

                            return (
                                <View style={styles.continentGroup}>
                                    <Text style={[styles.continentTitle, { color: Colors.danger[500] }]}>Legacy/Custom Tags (Tap to remove)</Text>
                                    <View style={styles.chipContainer}>
                                        {legacyCultures.map(culture => (
                                            <TouchableOpacity
                                                key={`legacy-${culture}`}
                                                style={[styles.chip, styles.chipSelected, { backgroundColor: Colors.danger[50], borderColor: Colors.danger[200] }]}
                                                onPress={() => toggleSelection(culture, selectedCultures, setSelectedCultures)}
                                            >
                                                <Text style={[styles.chipText, styles.chipTextSelected, { color: Colors.danger[600] }]}>{culture}</Text>
                                                <XMarkIcon size={14} color={Colors.danger[600]} style={styles.removeIcon} />
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            );
                        })()}
                    </View>
                </ScrollView>
            )}

            <Modal
                visible={isLanguageModalVisible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => {
                    setLanguageModalVisible(false);
                    setSearchQuery('');
                }}
            >
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Add a Language</Text>
                        <TouchableOpacity onPress={() => {
                            setLanguageModalVisible(false);
                            setSearchQuery('');
                        }} style={styles.closeBtn}>
                            <XMarkIcon size={24} color={Colors.text.primary} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.searchContainer}>
                        <MagnifyingGlassIcon size={20} color={Colors.text.tertiary} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search languages..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            clearButtonMode="while-editing"
                        />
                    </View>

                    <FlatList
                        data={searchQuery.trim() === '' ? [...SUGGESTED_LANGUAGES, '---', ...WORLD_LANGUAGES] : filteredLanguages}
                        keyExtractor={(item, index) => `${item}-${index}`}
                        renderItem={({ item }) => {
                            if (item === '---') {
                                return <View style={styles.divider} />;
                            }

                            const isSuggested = searchQuery.trim() === '' && SUGGESTED_LANGUAGES.includes(item);
                            const isSelected = selectedLanguages.includes(item);

                            return (
                                <TouchableOpacity
                                    style={styles.languageListItem}
                                    onPress={() => {
                                        if (!isSelected) {
                                            setSelectedLanguages([...selectedLanguages, item]);
                                        }
                                        setLanguageModalVisible(false);
                                        setSearchQuery('');
                                    }}
                                >
                                    <Text style={[styles.languageListText, isSelected && styles.languageListTextSelected]}>
                                        {item} {isSuggested ? '⭐' : ''}
                                    </Text>
                                    {isSelected && <CheckIcon size={20} color={Colors.primary[500]} />}
                                </TouchableOpacity>
                            );
                        }}
                        contentContainerStyle={styles.languageListContent}
                        keyboardShouldPersistTaps="handled"
                    />
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
}

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
    backBtn: {
        padding: 8,
        marginLeft: -8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    saveText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.primary[600],
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        padding: 20,
        paddingBottom: 40,
    },
    description: {
        fontSize: 15,
        color: '#6B7280',
        marginBottom: 24,
        lineHeight: 22,
    },
    section: {
        marginBottom: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    sectionSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 16,
        lineHeight: 20,
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        backgroundColor: '#FFF',
    },
    chipSelected: {
        backgroundColor: Colors.primary[500],
        borderColor: Colors.primary[500],
    },
    chipText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
    },
    chipTextSelected: {
        color: '#FFF',
    },
    checkIcon: {
        marginLeft: 8,
    },
    removeIcon: {
        marginLeft: 4,
    },
    addLanguageBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: Colors.primary[200],
        backgroundColor: Colors.primary[50],
        borderStyle: 'dashed',
    },
    addLanguageText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.primary[600],
        marginLeft: 6,
    },
    divider: {
        height: 1,
        backgroundColor: '#F3F4F6',
        marginVertical: 32,
    },
    continentGroup: {
        marginBottom: 20,
    },
    continentTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#4B5563',
        marginBottom: 10,
    },
    modalContainer: {
        flex: 1,
        backgroundColor: '#FFF',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        position: 'relative',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    closeBtn: {
        position: 'absolute',
        right: 16,
        padding: 8,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        margin: 16,
        paddingHorizontal: 12,
        borderRadius: 12,
        height: 48,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 16,
        color: '#111827',
    },
    languageListContent: {
        paddingHorizontal: 16,
        paddingBottom: 40,
    },
    languageListItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    languageListText: {
        fontSize: 16,
        color: '#374151',
    },
    languageListTextSelected: {
        fontWeight: '600',
        color: Colors.primary[600],
    },
});
