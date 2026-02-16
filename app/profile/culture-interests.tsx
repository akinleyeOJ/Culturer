import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/color'; // Adjust path if needed
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { ChevronLeftIcon, CheckIcon } from 'react-native-heroicons/outline';
import { CATEGORIES as APP_CATEGORIES } from '../../constants/categories';
import { CONTINENT_REGIONS } from '../../constants/regions';



export default function CultureInterestsScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

    useEffect(() => {
        if (user) fetchData();
    }, [user]);

    const fetchData = async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('interested_cultures, item_interests')
                .eq('id', user.id)
                .single();

            if (data) {
                const profile = data as any;
                if (profile.interested_cultures) setSelectedRegions(profile.interested_cultures);
                if (profile.item_interests) setSelectedCategories(profile.item_interests);
            }
        } catch (e) {
            console.error('Error fetching interests:', e);
        } finally {
            setLoading(false);
        }
    };

    const toggleRegion = (region: string) => {
        if (selectedRegions.includes(region)) {
            setSelectedRegions(selectedRegions.filter(r => r !== region));
        } else {
            setSelectedRegions([...selectedRegions, region]);
        }
    };

    const toggleCategory = (category: string) => {
        if (selectedCategories.includes(category)) {
            setSelectedCategories(selectedCategories.filter(c => c !== category));
        } else {
            setSelectedCategories([...selectedCategories, category]);
        }
    };

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        try {
            const { error } = await supabase.from('profiles').update({
                interested_cultures: selectedRegions as any,
                item_interests: selectedCategories as any
            } as any).eq('id', user.id);

            if (error) throw error;
            router.back();
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setSaving(false);
        }
    };

    const SelectableChip = ({ label, selected, onPress }: { label: string, selected: boolean, onPress: () => void }) => (
        <TouchableOpacity
            style={[
                styles.chip,
                selected && styles.chipSelected
            ]}
            onPress={onPress}
        >
            <Text style={[
                styles.chipText,
                selected && styles.chipTextSelected
            ]}>
                {label}
            </Text>
            {selected && <CheckIcon size={16} color="#FFF" style={styles.checkIcon} />}
        </TouchableOpacity>
    );

    const CategoryCard = ({ label, icon, selected, onPress }: { label: string, icon: string, selected: boolean, onPress: () => void }) => (
        <TouchableOpacity
            style={[
                styles.categoryCard,
                selected && styles.categoryCardSelected
            ]}
            onPress={onPress}
        >
            <Text style={styles.categoryIcon}>{icon}</Text>
            <Text style={[
                styles.categoryLabel,
                selected && styles.categoryLabelSelected
            ]}>
                {label}
            </Text>
            {selected && (
                <View style={styles.checkmarkBadge}>
                    <CheckIcon size={12} color="#FFF" />
                </View>
            )}
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.circleBtn}>
                    <ChevronLeftIcon size={24} color={Colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Culture & Interests</Text>
                <TouchableOpacity onPress={handleSave} disabled={saving}>
                    {saving ? <ActivityIndicator size="small" color={Colors.primary[500]} /> : (
                        <Text style={styles.saveText}>Save</Text>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.description}>
                    Personalize your discovery experience by selecting the regions and categories that interest you most.
                </Text>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Regions & Cultures</Text>
                    <Text style={styles.sectionSubtitle}>Which parts of the world do you want to explore?</Text>

                    {CONTINENT_REGIONS.map((continentGroup) => (
                        <View key={continentGroup.continent} style={styles.continentGroup}>
                            <Text style={styles.continentTitle}>{continentGroup.continent}</Text>
                            <View style={styles.chipContainer}>
                                {continentGroup.regions.map(region => (
                                    <SelectableChip
                                        key={region}
                                        label={region}
                                        selected={selectedRegions.includes(region)}
                                        onPress={() => toggleRegion(region)}
                                    />
                                ))}
                            </View>
                        </View>
                    ))}
                </View>

                <View style={styles.divider} />

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Item Categories</Text>
                    <Text style={styles.sectionSubtitle}>What kind of items are you looking for?</Text>
                    <View style={styles.gridContainer}>
                        {APP_CATEGORIES.map(category => (
                            <CategoryCard
                                key={category.id}
                                label={category.name}
                                icon={category.icon}
                                selected={selectedCategories.includes(category.name)}
                                onPress={() => toggleCategory(category.name)}
                            />
                        ))}
                    </View>
                </View>
            </ScrollView>
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
    saveText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.primary[600],
    },
    content: {
        padding: 20,
        paddingBottom: 40,
    },
    description: {
        fontSize: 16,
        color: '#6B7280',
        marginBottom: 24,
        lineHeight: 24,
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
        color: '#9CA3AF',
        marginBottom: 16,
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
    divider: {
        height: 1,
        backgroundColor: '#F3F4F6',
        marginVertical: 32,
    },
    continentGroup: {
        marginBottom: 24,
    },
    continentTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
    // Grid Styles
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    categoryCard: {
        width: '48%', // 2 columns approx
        aspectRatio: 1.3,
        backgroundColor: '#FAFAFA',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 12,
        position: 'relative',
    },
    categoryCardSelected: {
        backgroundColor: Colors.primary[50],
        borderColor: Colors.primary[500],
    },
    categoryIcon: {
        fontSize: 32,
        marginBottom: 8,
    },
    categoryLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        textAlign: 'center',
    },
    categoryLabelSelected: {
        color: Colors.primary[700],
    },
    checkmarkBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: Colors.primary[500],
        borderRadius: 10,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
