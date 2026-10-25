import React, { useContext, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AppContext } from '../context/AppContext';
import { colors } from '../theme/colors';
import Card from '../components/Card';
import { StatusBadge } from '../components/PickupDetails';
import { PICKUP_STATUS, formatDate, formatTimestamp } from '../services/pickupService';

const OfficialHomeScreen = ({ navigation }) => {
  const { user, logout } = useContext(AppContext);
  const [tab, setTab] = useState('pending');
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const unsubPending = onSnapshot(
      query(collection(db, "pickups"), where("status", "==", PICKUP_STATUS.WEIGHED)),
      (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setPending(data.sort((a, b) => (a.weighedAt?.seconds || 0) - (b.weighedAt?.seconds || 0)));
        setIsLoading(false);
      },
      (error) => {
        console.log("Error fetching pending pickups", error);
        setIsLoading(false);
      }
    );
    const unsubHistory = onSnapshot(
      query(collection(db, "pickups"), where("verifiedBy", "==", user.uid)),
      (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setHistory(data.sort((a, b) => (b.verifiedAt?.seconds || 0) - (a.verifiedAt?.seconds || 0)));
      },
      (error) => console.log("Error fetching verification history", error)
    );
    return () => {
      unsubPending();
      unsubHistory();
    };
  }, [user]);

  const list = tab === 'pending' ? pending : history;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <MaterialCommunityIcons name="shield-check" size={28} color={colors.primary} />
          <Text style={styles.headerTitle}>BMC Verification</Text>
        </View>
        <TouchableOpacity onPress={logout} style={{ padding: 5 }}>
          <MaterialCommunityIcons name="logout" size={26} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.greeting}>Hello, {user?.name}</Text>
        <Text style={styles.subtitle}>{user?.organization} • BMC Official</Text>

        <View style={styles.tabs}>
          <TouchableOpacity style={[styles.tab, tab === 'pending' && styles.tabActive]} onPress={() => setTab('pending')}>
            <Text style={[styles.tabText, tab === 'pending' && styles.tabTextActive]}>To Verify ({pending.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, tab === 'history' && styles.tabActive]} onPress={() => setTab('history')}>
            <Text style={[styles.tabText, tab === 'history' && styles.tabTextActive]}>Verified by Me ({history.length})</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : list.length === 0 ? (
          <Text style={styles.emptyText}>
            {tab === 'pending' ? 'No collections waiting for verification.' : 'You have not verified any collections yet.'}
          </Text>
        ) : (
          list.map(p => (
            <TouchableOpacity key={p.id} onPress={() => navigation.navigate('PickupReview', { pickupId: p.id })}>
              <Card>
                <View style={styles.cardHeader}>
                  <Text style={styles.societyName}>{p.societyName}</Text>
                  <StatusBadge status={p.status} />
                </View>
                <Text style={styles.detail}>Vendor: {p.vendorName}</Text>
                <Text style={styles.detail}>
                  {(p.totalKg || 0).toFixed(2)} kg • Grade {p.grade} • {p.location ? '📍 Located' : '⚠️ No location'}
                </Text>
                <Text style={styles.detail}>
                  {tab === 'pending' ? `Weighed ${formatTimestamp(p.weighedAt)}` : `Verified ${formatTimestamp(p.verifiedAt)}`} • Pickup {formatDate(p.scheduledDate)}
                </Text>
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
  greeting: { fontSize: 22, fontWeight: 'bold', color: colors.textPrimary },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 15 },
  tabs: { flexDirection: 'row', marginBottom: 10 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#E0E0E0', marginHorizontal: 4, alignItems: 'center' },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontWeight: 'bold', color: colors.textSecondary },
  tabTextActive: { color: '#FFF' },
  emptyText: { textAlign: 'center', color: colors.textSecondary, marginTop: 20 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  societyName: { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, flexShrink: 1, marginRight: 8 },
  detail: { fontSize: 14, color: colors.textSecondary, marginTop: 2 }
});

export default OfficialHomeScreen;
