import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/color';
import CustomButton from '../components/Button';
import FontAwesome from '@expo/vector-icons/FontAwesome';

const FilterScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Initial state from params or defaults
  const [minPrice, setMinPrice] = useState(params.minPrice as string || '');
  const [maxPrice, setMaxPrice] = useState(params.maxPrice as string || '');
  const [condition, setCondition] = useState(params.condition as string || '');
  const [location, setLocation] = useState(params.location as string || '');
  const [sortBy, setSortBy] = useState(params.sortBy as string || 'newest');

  const conditions = ['new', 'like_new', 'good', 'fair'];
  const sortOptions = [
    { label: 'Newest Arrivals', value: 'newest' },
    { label: 'Price: Low to High', value: 'price_asc' },
    { label: 'Price: High to Low', value: 'price_desc' },
    { label: 'Most Popular', value: 'popularity' },
  ];

  const handleApply = () => {
    // Navigate back to the previous screen with new params
    router.push({
      pathname: params.returnPath as any || '/(tabs)/Browse',
      params: {
        ...params, // Keep existing params like category/search
        minPrice,
        maxPrice,
        condition,
        location,
        sortBy,
        timestamp: Date.now(), // Force refresh
      }
    });
  };

  const handleReset = () => {
    setMinPrice('');
    setMaxPrice('');
    setCondition('');
    setLocation('');
    setSortBy('newest');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <FontAwesome name="times" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Filters & Sort</Text>
        <TouchableOpacity onPress={handleReset}>
          <Text style={styles.resetText}>Reset</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Sort By */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sort By</Text>
          <View style={styles.chipContainer}>
            {sortOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.chip,
                  sortBy === option.value && styles.activeChip
                ]}
                onPress={() => setSortBy(option.value)}
              >
                <Text style={[
                  styles.chipText,
                  sortBy === option.value && styles.activeChipText
                ]}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Price Range */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Price Range ($)</Text>
          <View style={styles.priceRow}>
            <TextInput
              style={styles.priceInput}
              placeholder="Min"
              keyboardType="numeric"
              value={minPrice}
              onChangeText={setMinPrice}
            />
            <Text style={styles.priceDash}>-</Text>
            <TextInput
              style={styles.priceInput}
              placeholder="Max"
              keyboardType="numeric"
              value={maxPrice}
              onChangeText={setMaxPrice}
            />
          </View>
        </View>

        {/* Condition */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Condition</Text>
          <View style={styles.chipContainer}>
            {conditions.map((c) => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.chip,
                  condition === c && styles.activeChip
                ]}
                onPress={() => setCondition(condition === c ? '' : c)}
              >
                <Text style={[
                  styles.chipText,
                  condition === c && styles.activeChipText
                ]}>{c.replace('_', ' ').toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location / Origin</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Nigeria, Japan..."
            value={location}
            onChangeText={setLocation}
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <CustomButton
          title="Apply Filters"
          onPress={handleApply}
          style={{ width: '100%' }}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[200],
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  closeButton: { padding: 4 },
  resetText: { color: Colors.primary[500], fontWeight: '600' },
  content: { padding: 20 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, color: Colors.text.primary },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.neutral[300],
    backgroundColor: '#fff',
  },
  activeChip: {
    backgroundColor: Colors.primary[100],
    borderColor: Colors.primary[500],
  },
  chipText: { color: Colors.text.secondary },
  activeChipText: { color: Colors.primary[700], fontWeight: '600' },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priceInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.neutral[300],
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  priceDash: { marginHorizontal: 10, color: Colors.neutral[500] },
  input: {
    borderWidth: 1,
    borderColor: Colors.neutral[300],
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral[200],
  },
});

export default FilterScreen;