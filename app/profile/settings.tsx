import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    ScrollView,
    Switch,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/color';
import { useAuth } from '../../contexts/AuthContext';
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    UserCircleIcon,
    BuildingStorefrontIcon,
    EnvelopeIcon,
    PhoneIcon,
    LockClosedIcon,
    LanguageIcon,
    GlobeAmericasIcon,
    SwatchIcon,
    MapPinIcon,
    BellIcon,
    CreditCardIcon,
    TruckIcon
} from 'react-native-heroicons/outline';

const SettingsScreen = () => {
    const router = useRouter();
    const { user } = useAuth();

    // Toggles state
    const [locationEnabled, setLocationEnabled] = useState(true);
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);

    const SettingsSection = ({ title, children }: { title?: string, children: React.ReactNode }) => (
        <View style={styles.section}>
            {title && <Text style={styles.sectionTitle}>{title}</Text>}
            <View style={styles.sectionContent}>
                {children}
            </View>
        </View>
    );

    const SettingsItem = ({
        icon: Icon,
        label,
        value,
        onPress,
        showArrow = true,
        textColor = Colors.text.primary,
        rightElement
    }: any) => (
        <TouchableOpacity
            style={styles.item}
            onPress={onPress}
            disabled={!onPress && !showArrow}
        >
            <View style={styles.itemLeft}>
                <Icon size={22} color={Colors.neutral[500]} />
                <Text style={[styles.itemLabel, { color: textColor }]}>{label}</Text>
            </View>
            <View style={styles.itemRight}>
                {value && <Text style={styles.itemValue}>{value}</Text>}
                {rightElement}
                {showArrow && !rightElement && <ChevronRightIcon size={20} color={Colors.neutral[400]} />}
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ChevronLeftIcon size={24} color={Colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Settings</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* Account Card */}
                <View style={styles.accountCard}>
                    <View style={styles.accountInfo}>
                        <Image
                            source={{ uri: user?.user_metadata?.avatar_url || 'https://via.placeholder.com/150' }}
                            style={styles.avatar}
                        />
                        <View style={styles.accountText}>
                            <Text style={styles.name}>{user?.user_metadata?.full_name || 'User'}</Text>
                            <Text style={styles.handle}>{user?.email}</Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={styles.shopButton}
                        onPress={() => router.push('/(tabs)/sell' as any)}
                    >
                        <BuildingStorefrontIcon size={20} color={Colors.text.primary} />
                        <Text style={styles.shopButtonText}>My Shop</Text>
                        <ChevronRightIcon size={16} color={Colors.text.primary} />
                    </TouchableOpacity>
                </View>

                {/* Account Details */}
                <SettingsSection title="Account">
                    <SettingsItem
                        icon={EnvelopeIcon}
                        label="Email"
                        value={user?.email}
                        showArrow={true}
                        onPress={() => { }}
                    />
                    <SettingsItem
                        icon={PhoneIcon}
                        label="Phone number"
                        value="+1 •••• 88"
                        showArrow={true}
                        onPress={() => { }}
                    />
                    <SettingsItem
                        icon={LockClosedIcon}
                        label="Password"
                        value="Last changed 3mo ago"
                        showArrow={true}
                        onPress={() => { }}
                    />
                </SettingsSection>

                {/* Preferences */}
                <SettingsSection title="Preferences">
                    <SettingsItem
                        icon={LanguageIcon}
                        label="Language"
                        value="English"
                        onPress={() => { }}
                    />
                    <SettingsItem
                        icon={GlobeAmericasIcon}
                        label="Region & currency"
                        value="Global • USD"
                        onPress={() => { }}
                    />
                    <SettingsItem
                        icon={SwatchIcon}
                        label="Theme"
                        value="System"
                        onPress={() => { }}
                    />
                    <SettingsItem
                        icon={MapPinIcon}
                        label="Location services"
                        showArrow={false}
                        rightElement={
                            <Switch
                                value={locationEnabled}
                                onValueChange={setLocationEnabled}
                                trackColor={{ true: Colors.primary[500] }}
                            />
                        }
                    />
                    <SettingsItem
                        icon={BellIcon}
                        label="Notifications"
                        showArrow={false}
                        rightElement={
                            <Switch
                                value={notificationsEnabled}
                                onValueChange={setNotificationsEnabled}
                                trackColor={{ true: Colors.primary[500] }}
                            />
                        }
                    />
                </SettingsSection>

                {/* Buying */}
                <SettingsSection title="Buying">
                    <SettingsItem
                        icon={CreditCardIcon}
                        label="Payment methods"
                        value="Visa •••• 4242"
                        onPress={() => { }}
                    />
                    <SettingsItem
                        icon={TruckIcon}
                        label="Shipping address"
                        value="Add or edit"
                        onPress={() => { }}
                    />
                </SettingsSection>

                <TouchableOpacity style={styles.deleteButton} onPress={() => Alert.alert("Delete Account", "This action cannot be undone.")}>
                    <Text style={styles.deleteButtonText}>Delete account</Text>
                </TouchableOpacity>

                <Text style={styles.version}>Version 1.0.0 (2024)</Text>

            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    accountCard: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    accountInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: Colors.primary[100],
    },
    accountText: {
        marginLeft: 12,
        flex: 1,
    },
    name: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    handle: {
        fontSize: 14,
        color: '#6B7280',
    },
    shopButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        padding: 12,
        borderRadius: 12,
        justifyContent: 'space-between',
    },
    shopButtonText: {
        flex: 1,
        marginLeft: 12,
        fontSize: 15,
        fontWeight: '600',
        color: '#374151',
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#9CA3AF',
        marginBottom: 8,
        marginLeft: 4,
        textTransform: 'uppercase',
    },
    sectionContent: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        overflow: 'hidden',
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    itemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    itemLabel: {
        fontSize: 16,
        fontWeight: '500',
    },
    itemRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    itemValue: {
        fontSize: 14,
        color: '#6B7280',
    },
    deleteButton: {
        padding: 16,
        alignItems: 'center',
        marginBottom: 24,
    },
    deleteButtonText: {
        color: Colors.danger[500],
        fontSize: 16,
        fontWeight: '600',
    },
    version: {
        textAlign: 'center',
        color: '#D1D5DB',
        fontSize: 12,
        marginBottom: 20,
    }
});

export default SettingsScreen;
