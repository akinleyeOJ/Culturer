import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Switch,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeftIcon } from 'react-native-heroicons/outline';
import { Colors } from '../../constants/color';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type Preferences = {
    messages: boolean;
    price_drops: boolean;
    back_in_stock: boolean;
    promotions: boolean;
    security_alerts: boolean;
};

export default function NotificationSettingsScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [preferences, setPreferences] = useState<Preferences>({
        messages: true,
        price_drops: true,
        back_in_stock: true,
        promotions: false,
        security_alerts: true,
    });

    useEffect(() => {
        if (user) fetchPreferences();
    }, [user]);

    const fetchPreferences = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('notification_preferences')
                .eq('id', user!.id)
                .single();

            if (error) throw error;
            const profile = data as any;
            if (profile?.notification_preferences) {
                setPreferences(profile.notification_preferences as Preferences);
            }
        } catch (error) {
            console.error('Error fetching preferences:', error);
        } finally {
            setLoading(false);
        }
    };

    const togglePreference = async (key: keyof Preferences) => {
        const newPrefs = { ...preferences, [key]: !preferences[key] };
        setPreferences(newPrefs);

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ notification_preferences: newPrefs } as any)
                .eq('id', user!.id);

            if (error) throw error;
        } catch (error) {
            console.error('Error saving preference:', error);
            // Revert on error
            setPreferences(preferences);
            Alert.alert('Error', 'Failed to save preference');
        }
    };

    const SettingItem = ({
        title,
        subtitle,
        value,
        onToggle
    }: {
        title: string;
        subtitle: string;
        value: boolean;
        onToggle: () => void;
    }) => (
        <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>{title}</Text>
                <Text style={styles.settingSubtitle}>{subtitle}</Text>
            </View>
            <Switch
                value={value}
                onValueChange={onToggle}
                trackColor={{ false: '#D1D1D6', true: Colors.primary[500] }}
                ios_backgroundColor="#D1D1D6"
            />
        </View>
    );

    if (loading) return (
        <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={Colors.primary[500]} />
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.circleBtn}>
                    <ChevronLeftIcon size={24} color={Colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notifications</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Activity</Text>
                    <SettingItem
                        title="Messages"
                        subtitle="Direct messages from buyers and sellers"
                        value={preferences.messages}
                        onToggle={() => togglePreference('messages')}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Wishlist Alerts</Text>
                    <SettingItem
                        title="Price Drops"
                        subtitle="When an item you like goes on sale"
                        value={preferences.price_drops}
                        onToggle={() => togglePreference('price_drops')}
                    />
                    <SettingItem
                        title="Back in Stock"
                        subtitle="When a sold out item becomes available"
                        value={preferences.back_in_stock}
                        onToggle={() => togglePreference('back_in_stock')}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Marketing</Text>
                    <SettingItem
                        title="Promotions"
                        subtitle="Exclusive deals and personalized offers"
                        value={preferences.promotions}
                        onToggle={() => togglePreference('promotions')}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>System</Text>
                    <SettingItem
                        title="Security Alerts"
                        subtitle="Account login and security notices"
                        value={preferences.security_alerts}
                        onToggle={() => togglePreference('security_alerts')}
                    />
                </View>

                <Text style={styles.footerText}>
                    Note: Critical account updates cannot be turned off. Push notifications must also be enabled in your device settings.
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    centerContainer: {
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
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#EEE',
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    circleBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        paddingBottom: 40,
    },
    section: {
        backgroundColor: '#FFF',
        marginTop: 24,
        paddingHorizontal: 16,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#EEE',
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.neutral[500],
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginTop: 16,
        marginBottom: 8,
        marginLeft: 0,
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 0.5,
        borderBottomColor: '#EEE',
    },
    settingInfo: {
        flex: 1,
        paddingRight: 16,
    },
    settingTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text.primary,
        marginBottom: 4,
    },
    settingSubtitle: {
        fontSize: 14,
        color: Colors.text.secondary,
        lineHeight: 18,
    },
    footerText: {
        padding: 24,
        fontSize: 13,
        color: Colors.neutral[400],
        lineHeight: 18,
        textAlign: 'center',
    }
});
