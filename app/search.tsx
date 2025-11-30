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
    Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../constants/color';
import { CATEGORIES } from '../constants/categories';
import { useAuth } from '../contexts/AuthContext';
import { fetchRecentlyViewed } from '../lib/services/productService';
import { RecentlyViewedCard } from '../components/Card';

// Enable LayoutAnimation for Android
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

const SEARCH_HISTORY_KEY = 'culturer_search_history';

const SearchScreen = () => {
    const router = useRouter();
    const { user } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
    const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedProduct[]>([]);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const inputRef = useRef<TextInput>(null);

    // Automatically focus the input when the screen mounts
    useEffect(() => {
        const timer = setTimeout(() => {
            inputRef.current?.focus();
        }, 100);

        return () => clearTimeout(timer);
    }, []);

    // Load recent searches and recently viewed products
    useEffect(() => {
        loadSearchHistory();
        
        const loadRecentlyViewed = async () => {
            if (user) {
                const data = await fetchRecentlyViewed(user.id);
                setRecentlyViewed(data);
            }
        };
        loadRecentlyViewed();
    }, [user]);

    const loadSearchHistory = async () => {
        try {
            const history = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
            if (history) {
                setRecentSearches(JSON.parse(history));
            }
        } catch (error) {
            console.error('Failed to load search history', error);
        }
    };

    const saveSearchTerm = async (term: string) => {
        try {
            const cleanedTerm = term.trim();
            if (!cleanedTerm) return;

            // Remove duplicates (case-insensitive) and add to top
            // Limit set to 5 items
            const newHistory = [
                cleanedTerm,
                ...recentSearches.filter(t => t.toLowerCase() !== cleanedTerm.toLowerCase())
            ].slice(0, 5); 

            setRecentSearches(newHistory);
            await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory));
        } catch (error) {
            console.error('Failed to save search term', error);
        }
    };

    const removeSearchTerm = async (termToRemove: string) => {
        try {
            const newHistory = recentSearches.filter(term => term !== termToRemove);
            setRecentSearches(newHistory);
            await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory));
        } catch (error) {
            console.error('Failed to remove search term', error);
        }
    };

    const clearSearchHistory = async () => {
        try {
            setRecentSearches([]);
            await AsyncStorage.removeItem(SEARCH_HISTORY_KEY);
        } catch (error) {
            console.error('Failed to clear search history', error);
        }
    };

    const handleSearchSubmit = async (query: string = searchQuery) => {
        if (query.trim()) {
            // REMOVED 'await' here to prevent blocking navigation
            saveSearchTerm(query);
            router.push({
                pathname: '/(tabs)/Browse',
                params: { search: query.trim() }
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
                category: categoryName,
                subcategory: subcategoryName
            }
        });
    };

    const handleProductPress = (productId: string) => {
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
                        onSubmitEditing={() => handleSearchSubmit(searchQuery)}
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
                {/* Recent Searches Section - Placed ABOVE Categories */}
                {recentSearches.length > 0 && !searchQuery && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Recent Searches</Text>
                            <TouchableOpacity onPress={clearSearchHistory}>
                                <Text style={styles.clearText}>Clear</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.recentSearchesContainer}>
                            {recentSearches.map((term, index) => (
                                <View key={index} style={styles.recentSearchItemWrapper}>
                                    <TouchableOpacity 
                                        style={styles.recentSearchItem}
                                        onPress={() => {
                                            setSearchQuery(term);
                                            handleSearchSubmit(term);
                                        }}
                                    >
                                        <FontAwesome name="clock-o" size={14} color={Colors.neutral[400]} style={styles.recentIcon} />
                                        <Text style={styles.recentSearchText} numberOfLines={1}>{term}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        style={styles.removeButton}
                                        onPress={() => removeSearchTerm(term)}
                                    >
                                        <FontAwesome name="times" size={12} color={Colors.neutral[400]} />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

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
    clearText: {
        fontSize: 14,
        color: Colors.neutral[500],
        fontWeight: '500',
    },
    recentSearchesContainer: {
        flexDirection: 'column',
    },
    recentSearchItemWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.neutral[100],
    },
    recentSearchItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    recentIcon: {
        marginRight: 10,
    },
    recentSearchText: {
        fontSize: 15,
        color: Colors.text.secondary,
        flex: 1,
    },
    removeButton: {
        padding: 8,
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