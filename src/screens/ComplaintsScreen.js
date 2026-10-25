import React, { useContext, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AppContext } from '../context/AppContext';
import { colors } from '../theme/colors';
import Card from '../components/Card';
import ComplaintStatusBadge from '../components/ComplaintStatusBadge';
import LanguageToggle from '../components/LanguageToggle';
import { WardSetupCard } from '../components/WardPicker';
import { formatTimestamp } from '../services/pickupService';
import { getWardLabel } from '../services/wards';
import { isComplaintOpen, complaintCategoryLabel, complaintCategoryIcon } from '../services/complaintService';
import { useTranslation } from '../i18n';

const ComplaintsScreen = ({ navigation }) => {
  const { user, logout } = useContext(AppContext);
  const { t } = useTranslation();
  const [tab, setTab] = useState('open');
  const [complaints, setComplaints] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.ward) {
      setIsLoading(false);
      return;
    }
    const q = query(collection(db, "complaints"), where("ward", "==", user.ward));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setComplaints(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setIsLoading(false);
    }, (error) => {
      console.log("Error fetching ward complaints", error);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user?.ward]);

  // Oldest open complaint first so nothing waits too long; newest closed first
  const open = complaints.filter(isComplaintOpen).sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
  const closed = complaints.filter(c => !isComplaintOpen(c)).sort((a, b) => (b.closedAt?.seconds || 0) - (a.closedAt?.seconds || 0));
  const list = tab === 'open' ? open : closed;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
          <MaterialCommunityIcons name="alert-octagon" size={28} color={colors.primary} />
          <Text style={styles.headerTitle}>{t('complaints.officialTitle')}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <LanguageToggle style={{ marginRight: 8 }} />
          <TouchableOpacity onPress={logout} style={{ padding: 5 }}>
            <MaterialCommunityIcons name="logout" size={26} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.wardName}>{getWardLabel(user?.ward)}</Text>
        <Text style={styles.subtitle}>{t('complaints.officialIntro')}</Text>

        {!user?.ward && <WardSetupCard message={t('ward.setupOfficialVerify')} />}

        <View style={styles.tabs}>
          <TouchableOpacity style={[styles.tab, tab === 'open' && styles.tabActive]} onPress={() => setTab('open')}>
            <Text style={[styles.tabText, tab === 'open' && styles.tabTextActive]}>{t('complaints.openTab', { count: open.length })}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, tab === 'closed' && styles.tabActive]} onPress={() => setTab('closed')}>
            <Text style={[styles.tabText, tab === 'closed' && styles.tabTextActive]}>{t('complaints.closedTab', { count: closed.length })}</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : list.length === 0 ? (
          <Text style={styles.emptyText}>{tab === 'open' ? t('complaints.noOpen') : t('complaints.noClosed')}</Text>
        ) : (
          list.map(c => (
            <TouchableOpacity key={c.id} onPress={() => navigation.navigate('ComplaintDetail', { complaintId: c.id })}>
              <Card>
                <View style={styles.cardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1, marginRight: 8 }}>
                    <MaterialCommunityIcons name={complaintCategoryIcon(c.category)} size={20} color={colors.primary} />
                    <Text style={styles.cardTitle}>{complaintCategoryLabel(c.category)}</Text>
                  </View>
                  <ComplaintStatusBadge status={c.status} />
                </View>
                <Text style={styles.detail} numberOfLines={2}>{c.description}</Text>
                <Text style={styles.meta}>
                  {t('complaints.reportedBy', { name: c.reporterName, society: c.societyName || '-' })} • {formatTimestamp(c.createdAt)}
                </Text>
                {!c.location && <Text style={styles.warning}>{t('complaints.noLocation')}</Text>}
              </Card>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 15,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0'
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: colors.primary, marginLeft: 10 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  wardName: { fontSize: 22, fontWeight: 'bold', color: colors.textPrimary },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 12 },
  tabs: { flexDirection: 'row', marginBottom: 10 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#E0E0E0', marginHorizontal: 4, alignItems: 'center' },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontWeight: 'bold', color: colors.textSecondary },
  tabTextActive: { color: '#FFF' },
  emptyText: { textAlign: 'center', color: colors.textSecondary, marginTop: 20 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: colors.textPrimary, marginLeft: 6, flexShrink: 1 },
  detail: { fontSize: 14, color: colors.textSecondary },
  meta: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  warning: { fontSize: 12, color: colors.warning, marginTop: 2 }
});

export default ComplaintsScreen;
