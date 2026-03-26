import React from 'react';
import { View, Text, TouchableOpacity, Switch, TextInput } from 'react-native';
import { CardField } from '@stripe/stripe-react-native';
import { DevicePhoneMobileIcon, CreditCardIcon, LockClosedIcon } from 'react-native-heroicons/outline';
import { Colors } from '../../constants/color';

interface PaymentStepProps {
    styles: any;
    country: string;
    selectedPaymentMethod: 'card' | 'apple_pay' | 'p24';
    setSelectedPaymentMethod: (value: 'card' | 'apple_pay' | 'p24') => void;
    loadingCards: boolean;
    savedCards: any[];
    selectedSavedCardId: string | null;
    setSelectedSavedCardId: (value: string | null) => void;
    saveCard: boolean;
    setSaveCard: (value: boolean) => void;
    cardHolderName: string;
    setCardHolderName: (value: string) => void;
    setCardDetails: (details: any) => void;
}

export function PaymentStep({
    styles,
    country,
    selectedPaymentMethod,
    setSelectedPaymentMethod,
    loadingCards,
    savedCards,
    selectedSavedCardId,
    setSelectedSavedCardId,
    saveCard,
    setSaveCard,
    cardHolderName,
    setCardHolderName,
    setCardDetails,
}: PaymentStepProps) {
    return (
        <View style={styles.stepContainer}>
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Select Payment Method</Text>

                <TouchableOpacity
                    style={[styles.radioOption, selectedPaymentMethod === 'apple_pay' && styles.radioOptionSelected]}
                    onPress={() => setSelectedPaymentMethod('apple_pay')}
                >
                    <View style={styles.radioRow}>
                        <View style={styles.radioCircle}>
                            {selectedPaymentMethod === 'apple_pay' && <View style={styles.radioDot} />}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <View style={styles.paymentIconContainer}>
                                <DevicePhoneMobileIcon size={24} color={'#000'} />
                            </View>
                            <View>
                                <Text style={styles.radioTitle}>Apple Pay</Text>
                                <Text style={styles.radioSubtitle}>Finalise payment with Apple Pay</Text>
                            </View>
                        </View>
                    </View>
                </TouchableOpacity>

                {country === 'Poland' && (
                    <TouchableOpacity
                        style={[styles.radioOption, selectedPaymentMethod === 'p24' && styles.radioOptionSelected]}
                        onPress={() => setSelectedPaymentMethod('p24')}
                    >
                        <View style={styles.radioRow}>
                            <View style={styles.radioCircle}>
                                {selectedPaymentMethod === 'p24' && <View style={styles.radioDot} />}
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                                <View style={[styles.paymentIconContainer, { backgroundColor: '#d4145a', borderColor: '#d4145a' }]}>
                                    <Text style={{ fontSize: 10, fontWeight: '900', color: '#fff' }}>P24</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.radioTitle}>Przelewy24</Text>
                                    <Text style={styles.radioSubtitle} numberOfLines={1} ellipsizeMode="tail">Blik, bank transfers & more</Text>
                                </View>
                            </View>
                        </View>
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    style={[styles.radioOption, selectedPaymentMethod === 'card' && styles.radioOptionSelected]}
                    onPress={() => setSelectedPaymentMethod('card')}
                >
                    <View style={styles.radioRow}>
                        <View style={styles.radioCircle}>
                            {selectedPaymentMethod === 'card' && <View style={styles.radioDot} />}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <View style={styles.paymentIconContainer}>
                                <CreditCardIcon size={24} color={Colors.neutral[800]} />
                            </View>
                            <View>
                                <Text style={styles.radioTitle}>Bank card</Text>
                                <Text style={styles.radioSubtitle}>Use a credit or debit card</Text>
                            </View>
                        </View>
                    </View>
                </TouchableOpacity>
            </View>

            {selectedPaymentMethod === 'card' && (
                <View style={[styles.section, { marginTop: -12 }]}>
                    {!loadingCards && savedCards && savedCards.length > 0 && (
                        <View style={{ marginBottom: 24 }}>
                            <Text style={styles.sectionTitle}>Saved Cards</Text>
                            {savedCards.map((card) => (
                                <TouchableOpacity
                                    key={card.id}
                                    style={[
                                        styles.radioOption,
                                        selectedSavedCardId === card.id && styles.radioOptionSelected,
                                        { marginBottom: 8 }
                                    ]}
                                    onPress={() => {
                                        setSelectedSavedCardId(card.id);
                                        setSaveCard(false);
                                    }}
                                >
                                    <View style={styles.radioRow}>
                                        <View style={styles.radioCircle}>
                                            {selectedSavedCardId === card.id && <View style={styles.radioDot} />}
                                        </View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                            <CreditCardIcon size={24} color={Colors.neutral[800]} />
                                            <View>
                                                <Text style={styles.radioTitle}>
                                                    {card.brand.toUpperCase()} {card.last4}
                                                </Text>
                                                <Text style={styles.radioSubtitle}>{card.exp_month}/{card.exp_year}</Text>
                                            </View>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))}
                            <TouchableOpacity
                                style={[styles.radioOption, selectedSavedCardId === null && styles.radioOptionSelected]}
                                onPress={() => setSelectedSavedCardId(null)}
                            >
                                <View style={styles.radioRow}>
                                    <View style={styles.radioCircle}>
                                        {selectedSavedCardId === null && <View style={styles.radioDot} />}
                                    </View>
                                    <Text style={styles.radioTitle}>Use a new card</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {selectedSavedCardId === null && (
                        <View style={styles.cardInputContainer}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <Text style={styles.sectionTitle}>Card Details</Text>
                                <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                                    <View style={[styles.cardBrandLogo, { backgroundColor: '#f7f7f7ff' }]}>
                                        <Text style={{ color: '#1A1F71', fontSize: 10, fontWeight: '700', fontStyle: 'italic' }}>VISA</Text>
                                    </View>
                                    <View style={[styles.cardBrandLogo, { backgroundColor: '#f7f7f7ff', flexDirection: 'row', paddingHorizontal: 4 }]}>
                                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF5F00', marginRight: -2 }} />
                                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#F79E1B' }} />
                                    </View>
                                    <View style={[styles.cardBrandLogo, { backgroundColor: '#f7f7f7ff', flexDirection: 'row', paddingHorizontal: 4 }]}>
                                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#0099DF', marginRight: -2 }} />
                                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#CC0000' }} />
                                    </View>
                                </View>
                            </View>

                            <View style={{ marginBottom: 16 }}>
                                <Text style={styles.formLabel}>Card Information</Text>
                                <CardField
                                    postalCodeEnabled={false}
                                    placeholders={{
                                        number: '4242 4242 4242 4242',
                                        expiration: 'MM/YY',
                                        cvc: 'CVC',
                                    }}
                                    cardStyle={{
                                        backgroundColor: '#FFFFFF',
                                        textColor: Colors.text.primary,
                                        borderColor: Colors.neutral[300],
                                        borderWidth: 1,
                                        borderRadius: 8,
                                        fontSize: 16,
                                    }}
                                    style={{
                                        width: '100%',
                                        height: 50,
                                        marginTop: 8,
                                    }}
                                    onCardChange={setCardDetails}
                                />
                            </View>

                            <View style={{ marginBottom: 16 }}>
                                <Text style={styles.formLabel}>Cardholder's Name</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. John Doe"
                                    value={cardHolderName}
                                    onChangeText={setCardHolderName}
                                    autoCapitalize="words"
                                />
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, justifyContent: 'space-between' }}>
                                <Text style={{ ...styles.formLabel, marginBottom: 0 }}>Save for future purchases</Text>
                                <Switch
                                    value={saveCard}
                                    onValueChange={setSaveCard}
                                    trackColor={{ false: Colors.neutral[200], true: Colors.success[500] }}
                                    thumbColor={'#FFFFFF'}
                                />
                            </View>

                            <View style={styles.secureBadge}>
                                <LockClosedIcon size={12} color={Colors.success[700]} />
                                <Text style={styles.secureText}>Payments are secure and encrypted</Text>
                            </View>
                        </View>
                    )}
                </View>
            )}
        </View>
    );
}
