import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    SafeAreaView,
    LayoutAnimation,
    Platform,
    UIManager,
    Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Colors } from '../constants/color';
import { CATEGORIES } from '../constants/categories';
import { useAuth } from '../contexts/AuthContext';
import { fetchRecentlyViewed } from '../lib/services/productService';
import { RecentlyViewedCard } from '../components/Card';

if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

interface RecentlyViewedProduct {
    id: string;
    name: string;
    price: string;
    emoji: string;
    image?: string;
}

const SearchScreen = () => {
    const router = useRouter();
    const { user } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
    const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedProduct[]>([]);
    const inputRef = useRef<TextInput>(null);

    useEffect(() => {
        // Fetch recently viewed
        const loadRecentlyViewed = async () => {
            if (user) {
                const data = await fetchRecentlyViewed(user.id);
                setRecentlyViewed(data);
            }
        };
        loadRecentlyViewed();
    }, [user]);

    const handleSearchSubmit = () => {
        if (searchQuery.trim()) {
            router.push({
                pathname: '/(tabs)/Browse',
                params: { search: searchQuery.trim() }
            });
        }
    };

    const toggleCategory = (categoryId: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedCategory(expandedCategory === categoryId ? null : categoryId);
    };

    const handleSubcategoryPress = (categoryName: string, subcategoryName: string) => {
        router.push({
            pathname: '/(tabs)/Browse',
            params: {
                category: categoryName, // Or map to ID if needed
                subcategory: subcategoryName
            }
        });
    };

    const handleProductPress = (productId: string) => {
        // Navigate to product details (when implemented)
        // For now, just go to Browse
        router.push('/(tabs)/Browse');
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <FontAwesome name="chevron-left" size={20} color={Colors.text.primary} />
                </TouchableOpacity>
                <View style={styles.searchContainer}>
                    <FontAwesome name="search" size={16} color={Colors.neutral[400]} style={styles.searchIcon} />
                    <TextInput
                        ref={inputRef}
                        style={styles.searchInput}
                        placeholder="Search for anything"
                        placeholderTextColor={Colors.neutral[400]}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onSubmitEditing={handleSearchSubmit}
                        returnKeyType="search"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <FontAwesome name="times-circle" size={16} color={Colors.neutral[400]} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                keyboardDismissMode="on-drag"
                keyboardShouldPersistTaps="handled"
            >
                {/* Search by Category */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Shop by category</Text>
                    <View style={styles.categoryList}>
                        {CATEGORIES.map((category) => (
                            <View key={category.id} style={styles.categoryItemContainer}>
                                <TouchableOpacity
                                    style={styles.categoryItem}
                                    onPress={() => toggleCategory(category.id)}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.categoryLeft}>
                                        <Text style={styles.categoryIcon}>{category.icon}</Text>
                                        <Text style={styles.categoryName}>{category.name}</Text>
                                    </View>
                                    <FontAwesome
                                        name={expandedCategory === category.id ? "chevron-up" : "chevron-right"}
                                        size={12}
                                        color={Colors.neutral[400]}
                                    />
                                </TouchableOpacity>

                                {/* Subcategories */}
                                {expandedCategory === category.id && (
                                    <View style={styles.subcategoryList}>
                                        {category.subcategories.map((sub, index) => (
                                            <TouchableOpacity
                                                key={index}
                                                style={styles.subcategoryItem}
                                                onPress={() => handleSubcategoryPress(category.id, sub)}
                                            >
                                                <Text style={styles.subcategoryText}>{sub}</Text>
                                                <FontAwesome name="angle-right" size={12} color={Colors.neutral[300]} />
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>
                        ))}
                    </View>
                </View>

                {/* Recently Viewed */}
                {recentlyViewed.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Recently Viewed</Text>
                            <TouchableOpacity onPress={() => router.push('/(tabs)/Browse')}>
                                <Text style={styles.seeAllText}>Browse All</Text>
                            </TouchableOpacity>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentList}>
                            {recentlyViewed.map((item) => (
                                <RecentlyViewedCard
                                    key={item.id}
                                    name={item.name}
                                    price={item.price}
                                    image={item.image}
                                    emoji={item.emoji}
                                    onPress={() => handleProductPress(item.id)}
                                    style={{ marginRight: 12 }}
                                />
                            ))}
                        </ScrollView>
                    </View>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.neutral[100],
    },
    backButton: {
        padding: 8,
        marginRight: 8,
    },
    searchContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.neutral[100],
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 44,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: Colors.text.primary,
        height: '100%',
    },
    content: {
        flex: 1,
    },
    section: {
        marginTop: 24,
        paddingHorizontal: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: Colors.text.primary,
        marginBottom: 12,
    },
    seeAllText: {
        fontSize: 14,
        color: Colors.primary[500],
        fontWeight: '500',
    },
    categoryList: {
        backgroundColor: '#fff',
    },
    categoryItemContainer: {
        borderBottomWidth: 1,
        borderBottomColor: Colors.neutral[100],
    },
    categoryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
    },
    categoryLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    categoryIcon: {
        fontSize: 20,
        marginRight: 12,
        width: 28,
        textAlign: 'center',
    },
    categoryName: {
        fontSize: 16,
        fontWeight: '500',
        color: Colors.text.primary,
    },
    subcategoryList: {
        backgroundColor: Colors.neutral[100],
        paddingHorizontal: 16,
        paddingBottom: 8,
    },
    subcategoryItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.neutral[200],
    },
    subcategoryText: {
        fontSize: 14,
        color: Colors.text.secondary,
    },
    recentList: {
        paddingRight: 16,
    },
});

export default SearchScreen;
