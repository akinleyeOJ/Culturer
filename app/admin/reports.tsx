import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    Image,
    FlatList,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
    ChevronLeftIcon,
    XMarkIcon,
    UserCircleIcon,
    FlagIcon,
    CheckCircleIcon,
    EyeIcon,
    ClockIcon,
} from 'react-native-heroicons/outline';
import { Colors } from '../../constants/color';
import { fetchAllReports, updateReportStatus, Report } from '../../lib/services/reportService';

const AdminReportsScreen = () => {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [reports, setReports] = useState<Report[]>([]);
    const [selectedReport, setSelectedReport] = useState<Report | null>(null);

    useEffect(() => {
        loadReports();
    }, []);

    const loadReports = async () => {
        setLoading(true);
        const result = await fetchAllReports();
        if (result.success) {
            setReports(result.data || []);
        } else {
            Alert.alert("Error", "Failed to load reports.");
        }
        setLoading(false);
    };

    const handleStatusUpdate = async (reportId: string, status: 'reviewed' | 'resolved') => {
        setSubmitting(true);
        const result = await updateReportStatus(reportId, status);
        if (result.success) {
            Alert.alert("Success", `Report marked as ${status}.`);
            setSelectedReport(null);
            loadReports();
        } else {
            Alert.alert("Error", "Failed to update report status.");
        }
        setSubmitting(false);
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'pending': return { bg: '#FEF3C7', text: '#D97706' };
            case 'reviewed': return { bg: '#DBEAFE', text: '#2563EB' };
            case 'resolved': return { bg: '#D1FAE5', text: '#059669' };
            default: return { bg: '#F3F4F6', text: '#4B5563' };
        }
    };

    const renderReportItem = ({ item }: { item: Report }) => {
        const statusStyle = getStatusStyle(item.status);
        
        return (
            <TouchableOpacity 
                style={styles.reportCard}
                onPress={() => setSelectedReport(item)}
            >
                <View style={styles.cardHeader}>
                    <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                        <Text style={[styles.statusText, { color: statusStyle.text }]}>
                            {item.status.toUpperCase()}
                        </Text>
                    </View>
                    <Text style={styles.cardDate}>
                        {new Date(item.created_at).toLocaleDateString()}
                    </Text>
                </View>

                <View style={styles.userRow}>
                    <View style={styles.miniUserInfo}>
                        <Text style={styles.label}>Reporter</Text>
                        <Text style={styles.username}>@{item.reporter?.username || 'user'}</Text>
                    </View>
                    <FlagIcon size={16} color="#9CA3AF" />
                    <View style={styles.miniUserInfo}>
                        <Text style={styles.label}>Reported</Text>
                        <Text style={styles.username}>@{item.reported_user?.username || 'user'}</Text>
                    </View>
                </View>

                <Text style={styles.reason} numberOfLines={1}>
                    {item.reason}
                </Text>

                <View style={styles.cardFooter}>
                    <Text style={styles.viewDetailsText}>View Details</Text>
                    <ChevronLeftIcon size={16} color={Colors.primary[500]} style={{ transform: [{ rotate: '180deg' }] }} />
                </View>
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={[styles.center, { flex: 1 }]}>
                    <ActivityIndicator size="large" color={Colors.primary[500]} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ChevronLeftIcon size={24} color={Colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>User Reports</Text>
                <View style={{ width: 40 }} />
            </View>

            {reports.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <FlagIcon size={64} color="#D1D5DB" />
                    <Text style={styles.emptyTitle}>No reports found</Text>
                    <Text style={styles.emptySubtitle}>All clear! No pending issues to review.</Text>
                </View>
            ) : (
                <FlatList
                    data={reports}
                    renderItem={renderReportItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    refreshing={loading}
                    onRefresh={loadReports}
                />
            )}

            {/* Detail Overlay */}
            {selectedReport && (
                <View style={styles.overlay}>
                    <View style={styles.detailCard}>
                        <View style={styles.detailHeader}>
                            <Text style={styles.detailTitle}>Report Details</Text>
                            <TouchableOpacity onPress={() => setSelectedReport(null)}>
                                <XMarkIcon size={24} color={Colors.text.primary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.detailScroll} contentContainerStyle={{ paddingBottom: 40 }}>
                            <View style={styles.section}>
                                <Text style={styles.sectionLabel}>Reason</Text>
                                <View style={styles.reasonBox}>
                                    <Text style={styles.reasonText}>{selectedReport.reason}</Text>
                                </View>
                            </View>

                            <View style={styles.section}>
                                <Text style={styles.sectionLabel}>Description</Text>
                                <Text style={styles.descriptionText}>
                                    {selectedReport.details || 'No additional details provided.'}
                                </Text>
                            </View>

                            <View style={styles.partyRow}>
                                <View style={styles.partyColumn}>
                                    <Text style={styles.sectionLabel}>From (Reporter)</Text>
                                    <View style={styles.partyInfo}>
                                        <Image 
                                            source={{ uri: selectedReport.reporter?.avatar_url || 'https://via.placeholder.com/100' }} 
                                            style={styles.miniAvatar} 
                                        />
                                        <Text style={styles.partyName}>{selectedReport.reporter?.full_name}</Text>
                                        <Text style={styles.partyHandle}>@{selectedReport.reporter?.username}</Text>
                                    </View>
                                </View>
                                <View style={styles.partyColumn}>
                                    <Text style={styles.sectionLabel}>Against (Reported)</Text>
                                    <View style={styles.partyInfo}>
                                        <Image 
                                            source={{ uri: selectedReport.reported_user?.avatar_url || 'https://via.placeholder.com/100' }} 
                                            style={styles.miniAvatar} 
                                        />
                                        <Text style={styles.partyName}>{selectedReport.reported_user?.full_name}</Text>
                                        <Text style={styles.partyHandle}>@{selectedReport.reported_user?.username}</Text>
                                    </View>
                                </View>
                            </View>

                            {selectedReport.content_id && (
                                <View style={styles.section}>
                                    <Text style={styles.sectionLabel}>Linked Order</Text>
                                    <TouchableOpacity 
                                        style={styles.orderLink}
                                        onPress={() => {
                                            setSelectedReport(null);
                                            router.push(`/profile/order-details/${selectedReport.content_id}` as any);
                                        }}
                                    >
                                        <Text style={styles.orderLinkText}>View Order #{selectedReport.content_id.slice(0, 8).toUpperCase()}</Text>
                                        <EyeIcon size={18} color={Colors.primary[500]} />
                                    </TouchableOpacity>
                                </View>
                            )}

                            <View style={styles.statusSection}>
                                <Text style={styles.sectionLabel}>Current Status</Text>
                                <View style={[styles.statusBadgeLarge, { backgroundColor: getStatusStyle(selectedReport.status).bg }]}>
                                    <Text style={[styles.statusTextLarge, { color: getStatusStyle(selectedReport.status).text }]}>
                                        {selectedReport.status.toUpperCase()}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.actionButtons}>
                                {selectedReport.status === 'pending' && (
                                    <TouchableOpacity 
                                        style={[styles.actionBtn, styles.reviewBtn]}
                                        onPress={() => handleStatusUpdate(selectedReport.id, 'reviewed')}
                                        disabled={submitting}
                                    >
                                        <ClockIcon size={20} color="#FFF" />
                                        <Text style={styles.actionBtnText}>Mark Reviewed</Text>
                                    </TouchableOpacity>
                                )}
                                {selectedReport.status !== 'resolved' && (
                                    <TouchableOpacity 
                                        style={[styles.actionBtn, styles.resolveBtn]}
                                        onPress={() => handleStatusUpdate(selectedReport.id, 'resolved')}
                                        disabled={submitting}
                                    >
                                        <CheckCircleIcon size={20} color="#FFF" />
                                        <Text style={styles.actionBtnText}>Resolve Issue</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </ScrollView>
                    </View>
                </View>
            )}

            {submitting && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#FFF" />
                </View>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    center: {
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
        borderBottomColor: '#F3F4F6',
    },
    backButton: {
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
    listContent: {
        padding: 16,
    },
    reportCard: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '800',
    },
    cardDate: {
        fontSize: 13,
        color: '#9CA3AF',
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F9FAFB',
        padding: 12,
        borderRadius: 12,
        marginBottom: 12,
    },
    miniUserInfo: {
        flex: 1,
    },
    label: {
        fontSize: 10,
        color: '#9CA3AF',
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    username: {
        fontSize: 14,
        fontWeight: '700',
        color: '#374151',
    },
    reason: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 4,
    },
    viewDetailsText: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.primary[600],
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#111827',
        marginTop: 16,
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 15,
        color: '#6B7280',
        textAlign: 'center',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    detailCard: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        height: '85%',
        paddingBottom: 40,
    },
    detailHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    detailTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#111827',
    },
    detailScroll: {
        padding: 24,
    },
    section: {
        marginBottom: 24,
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#9CA3AF',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 8,
    },
    reasonBox: {
        backgroundColor: Colors.danger[50] + '80',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.danger[100],
    },
    reasonText: {
        fontSize: 18,
        fontWeight: '800',
        color: Colors.danger[700],
    },
    descriptionText: {
        fontSize: 15,
        color: '#4B5563',
        lineHeight: 22,
    },
    partyRow: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 24,
    },
    partyColumn: {
        flex: 1,
    },
    partyInfo: {
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        padding: 16,
        borderRadius: 20,
    },
    miniAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginBottom: 10,
    },
    partyName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
        textAlign: 'center',
    },
    partyHandle: {
        fontSize: 12,
        color: '#6B7280',
        textAlign: 'center',
    },
    orderLink: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.primary[50],
        padding: 16,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: Colors.primary[100],
    },
    orderLinkText: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.primary[700],
    },
    statusSection: {
        marginBottom: 32,
    },
    statusBadgeLarge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
    },
    statusTextLarge: {
        fontSize: 13,
        fontWeight: '800',
    },
    actionButtons: {
        gap: 12,
    },
    actionBtn: {
        flexDirection: 'row',
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    actionBtnText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFF',
    },
    reviewBtn: {
        backgroundColor: '#2563EB',
    },
    resolveBtn: {
        backgroundColor: '#059669',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default AdminReportsScreen;
