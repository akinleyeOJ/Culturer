import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    TextInput,
    Keyboard,
    Platform,
    FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeftIcon, MagnifyingGlassIcon } from 'react-native-heroicons/outline';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { Colors } from '../constants/color';
import {
    fetchPickupPoints,
    type PickupPointResult,
    type PickupPointSearchContext,
} from '../lib/services/pickupPointService';
import {
    getPickupPointSelectionState,
    setPickupPointSelectionState,
} from '../lib/pickupPointSelectionStore';

const LIVE_SHIPPING_APIS_ENABLED =
    process.env.EXPO_PUBLIC_ENABLE_LIVE_SHIPPING_APIS === 'true' ||
    (!__DEV__ && process.env.EXPO_PUBLIC_ENABLE_LIVE_SHIPPING_APIS !== 'false');

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const GOOGLE_PLACES_ENABLED = LIVE_SHIPPING_APIS_ENABLED && GOOGLE_PLACES_API_KEY.length > 0;

export default function PickupPointsScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        carrierName?: string;
        address1?: string;
        city?: string;
        zipCode?: string;
        country?: string;
    }>();

    const carrierName = params.carrierName || '';
    const fallbackAddress = useMemo(
        () => ({
            query: typeof params.address1 === 'string' ? params.address1 : '',
            city: typeof params.city === 'string' ? params.city : '',
            postalCode: typeof params.zipCode === 'string' ? params.zipCode : '',
            country: typeof params.country === 'string' ? params.country : '',
        }),
        [params.address1, params.city, params.zipCode, params.country]
    );

    const seededState = getPickupPointSelectionState();
    const [search, setSearch] = useState(
        seededState.carrierName === carrierName ? seededState.search : ''
    );
    const [searchContext, setSearchContext] = useState<PickupPointSearchContext | null>(
        seededState.carrierName === carrierName ? seededState.context : null
    );
    const [selectedPickupPoint, setSelectedPickupPoint] = useState<PickupPointResult | null>(
        seededState.carrierName === carrierName ? seededState.selection : null
    );
    const [results, setResults] = useState<PickupPointResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const requestIdRef = useRef(0);
    const googlePlacesSessionTokenRef = useRef(`pickup-${Date.now()}`);

    useEffect(() => {
        const requestId = ++requestIdRef.current;
        const timer = setTimeout(async () => {
            try {
                setLoading(true);
                setError(null);
                const pickupPoints = await fetchPickupPoints(
                    carrierName,
                    {
                        query: search,
                        city: searchContext?.city,
                        postalCode: searchContext?.postalCode,
                        country: searchContext?.country,
                        latitude: searchContext?.latitude,
                        longitude: searchContext?.longitude,
                    },
                    fallbackAddress
                );

                if (requestId !== requestIdRef.current) {
                    return;
                }

                setResults(pickupPoints);
                setError(pickupPoints.length === 0 ? 'No pickup points found for this search.' : null);
                setSelectedPickupPoint((current) =>
                    current && !pickupPoints.some((pickupPoint) => pickupPoint.id === current.id)
                        ? null
                        : current
                );
            } catch (fetchError) {
                if (requestId === requestIdRef.current) {
                    setResults([]);
                    setError('Could not load pickup points right now.');
                }
                console.error('Pickup point search error:', fetchError);
            } finally {
                if (requestId === requestIdRef.current) {
                    setLoading(false);
                }
            }
        }, search.trim().length < 3 ? 0 : 350);

        return () => clearTimeout(timer);
    }, [carrierName, fallbackAddress, search, searchContext]);

    const handleConfirm = () => {
        if (!selectedPickupPoint) return;

        setPickupPointSelectionState({
            carrierName,
            selection: selectedPickupPoint,
            search,
            context: searchContext,
        });
        router.back();
    };

    const renderSearchSection = () => (
        <View>
            <Text style={styles.subtitle}>
                Search by city, postcode, or street to find nearby {carrierName || 'pickup points'}.
            </Text>

            <View style={styles.searchWrap}>
                <View style={styles.searchIcon}>
                    <MagnifyingGlassIcon size={18} color="#9CA3AF" />
                </View>
                {GOOGLE_PLACES_ENABLED ? (
                    <GooglePlacesAutocomplete
                        placeholder={`Search ${carrierName} pickup points...`}
                        onPress={(data, details = null) => {
                            let locality = '';
                            let postalCode = '';

                            if (details?.address_components) {
                                details.address_components.forEach((component) => {
                                    const types = component.types;
                                    if (types.includes('locality')) locality = component.long_name;
                                    if (types.includes('postal_code')) postalCode = component.long_name;
                                });
                            }

                            setSearch(data.description);
                            setSearchContext({
                                query: data.description,
                                city: locality,
                                postalCode,
                                country: typeof params.country === 'string' ? params.country : '',
                                latitude: details?.geometry?.location?.lat,
                                longitude: details?.geometry?.location?.lng,
                            });
                            setError(null);
                            googlePlacesSessionTokenRef.current = `pickup-${Date.now()}`;
                        }}
                        query={{
                            key: GOOGLE_PLACES_API_KEY,
                            language: carrierName.includes('InPost') ? 'pl' : 'en',
                            sessiontoken: googlePlacesSessionTokenRef.current,
                            ...(carrierName.includes('InPost') ? { components: 'country:pl' } : {}),
                        }}
                        fetchDetails
                        enablePoweredByContainer={false}
                        debounce={350}
                        minLength={3}
                        styles={{
                            container: styles.autocompleteContainer,
                            textInputContainer: styles.autocompleteInputContainer,
                            textInput: styles.autocompleteInput,
                            listView: styles.autocompleteList,
                        }}
                        textInputProps={{
                            value: search,
                            onChangeText: (text: string) => {
                                setSearch(text);
                                setSearchContext(null);
                                setError(null);
                                if (text.trim().length <= 1) {
                                    googlePlacesSessionTokenRef.current = `pickup-${Date.now()}`;
                                }
                            },
                            placeholderTextColor: '#9CA3AF',
                            autoCorrect: false,
                        }}
                    />
                ) : (
                    <TextInput
                        style={styles.searchInput}
                        placeholder={`Search ${carrierName} pickup points...`}
                        value={search}
                        onChangeText={(text) => {
                            setSearch(text);
                            setSearchContext(null);
                            setError(null);
                        }}
                        placeholderTextColor="#9CA3AF"
                        autoCorrect={false}
                    />
                )}
            </View>

            {!GOOGLE_PLACES_ENABLED && (
                <Text style={styles.hintText}>
                    Address suggestions are off in this environment. Type city, street, or postcode to search directly.
                </Text>
            )}

            {loading && (
                <View style={styles.statusBox}>
                    <ActivityIndicator size="small" color={Colors.primary[500]} />
                    <Text style={styles.statusText}>Searching pickup points...</Text>
                </View>
            )}

            {!loading && error && (
                <View style={styles.statusBox}>
                    <Text style={styles.statusText}>{error}</Text>
                </View>
            )}
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.circleBtn}>
                    <ChevronLeftIcon size={24} color={Colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Select Pickup Point</Text>
                <View style={styles.headerSpacer} />
            </View>

            <FlatList
                data={results}
                keyExtractor={(item) => item.id}
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                keyboardShouldPersistTaps="handled"
                ListHeaderComponent={renderSearchSection}
                renderItem={({ item: pickupPoint }) => (
                    <TouchableOpacity
                        style={[
                            styles.resultItem,
                            selectedPickupPoint?.id === pickupPoint.id && styles.resultItemSelected,
                        ]}
                        onPress={() => {
                            Keyboard.dismiss();
                            setSelectedPickupPoint(pickupPoint);
                        }}
                    >
                        <View style={styles.resultContent}>
                            <Text style={styles.resultId}>{pickupPoint.id}</Text>
                            <Text style={styles.resultAddress}>{pickupPoint.address}</Text>
                            <Text style={styles.resultHint}>{pickupPoint.hint}</Text>
                        </View>
                        {selectedPickupPoint?.id === pickupPoint.id && (
                            <View style={styles.resultCheck}>
                                <Text style={styles.resultCheckText}>✓</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                )}
            />

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[
                        styles.confirmButton,
                        !selectedPickupPoint && styles.confirmButtonDisabled,
                    ]}
                    disabled={!selectedPickupPoint}
                    onPress={handleConfirm}
                >
                    <Text style={styles.confirmButtonText}>
                        {selectedPickupPoint ? 'Use This Pickup Point' : 'Select a Pickup Point'}
                    </Text>
                </TouchableOpacity>
            </View>
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
    headerSpacer: {
        width: 40,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
        paddingBottom: 24,
    },
    subtitle: {
        fontSize: 13,
        color: '#6B7280',
        lineHeight: 18,
        marginBottom: 12,
    },
    searchWrap: {
        position: 'relative',
        zIndex: 10,
        marginBottom: 8,
    },
    searchIcon: {
        position: 'absolute',
        left: 12,
        top: 14,
        zIndex: 2,
    },
    autocompleteContainer: {
        flex: 0,
        width: '100%',
    },
    autocompleteInputContainer: {
        width: '100%',
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 10,
    },
    autocompleteInput: {
        height: 46,
        marginTop: 0,
        marginBottom: 0,
        paddingLeft: 34,
        paddingRight: 12,
        fontSize: 15,
        color: '#111827',
        backgroundColor: '#FFF',
        borderRadius: 10,
    },
    autocompleteList: {
        position: 'absolute',
        top: 50,
        left: 0,
        right: 0,
        zIndex: 10,
        elevation: 6,
        backgroundColor: '#FFF',
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
    },
    searchInput: {
        height: 46,
        width: '100%',
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 10,
        paddingLeft: 34,
        paddingRight: 12,
        fontSize: 15,
        color: '#111827',
    },
    hintText: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 8,
    },
    statusBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    statusText: {
        fontSize: 13,
        color: '#6B7280',
    },
    resultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 10,
        padding: 12,
        marginBottom: 8,
    },
    resultItemSelected: {
        borderColor: Colors.primary[500],
        backgroundColor: Colors.primary[50],
    },
    resultContent: {
        flex: 1,
    },
    resultId: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
    },
    resultAddress: {
        fontSize: 13,
        color: '#4B5563',
        marginTop: 2,
    },
    resultHint: {
        fontSize: 11,
        color: '#9CA3AF',
        fontStyle: 'italic',
        marginTop: 2,
    },
    resultCheck: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: Colors.primary[500],
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 12,
    },
    resultCheckText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '700',
    },
    footer: {
        padding: 16,
        paddingBottom: Platform.OS === 'ios' ? 24 : 16,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
        backgroundColor: '#FFF',
    },
    confirmButton: {
        backgroundColor: Colors.primary[500],
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
    },
    confirmButtonDisabled: {
        backgroundColor: '#D1D5DB',
    },
    confirmButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFF',
    },
});
