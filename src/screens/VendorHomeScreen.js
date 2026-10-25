import React, { useContext, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AppContext } from '../context/AppContext';
import { colors } from '../theme/colors';
import Card from '../components/Card';
import Button from '../components/Button';
import { StatusBadge } from '../components/PickupDetails';
import { PICKUP_STATUS, daysUntil, describeCountdown, formatDate } from '../services/pickupService';

const VendorHomeScreen = ({ navigation }) => {
  const { user, logout } = useContext(AppContext);
  const [pickups, setPickups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "pickups"), where("vendorUid", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPickups(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setIsLoading(false);
    }, (error) => {
      console.log("Error fetching vendor pickups", error);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const upcoming = pickups
    .filter(p => p.status === PICKUP_STATUS.SCHEDULED)
    .sort((a, b) => (a.scheduledDate || '').localeCompare(b.scheduledDate || ''));
  const submitted = pickups
    .filter(p => [PICKUP_STATUS.WEIGHED, PICKUP_STATUS.VERIFIED, PICKUP_STATUS.COMPLETED].includes(p.status))
    .sort((a, b) => (b.scheduledDate || '').localeCompare(a.scheduledDate || ''));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <MaterialCommunityIcons name="truck-delivery" size={28} color={colors.primary} />
          <Text style={styles.headerTitle}>My Collections</Text>
        </View>
        <TouchableOpacity onPress={logout} style={{ padding: 5 }}>
          <MaterialCommunityIcons name="logout" size={26} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.greeting}>Hello, {user?.name}</Text>
        <Text style={styles.subtitle}>{user?.organization} • Vendor</Text>

        <Text style={styles.sectionTitle}>Upcoming Collections</Text>
        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : upcoming.length === 0 ? (
          <Text style={styles.emptyText}>No collections assigned to you yet.</Text>
        ) : (
          upcoming.map(p => {
            const days = daysUntil(p.scheduledDate);
            return (
              <Card key={p.id}>
                <View style={styles.cardHeader}>
                  <Text style={styles.societyName}>{p.societyName}</Text>
                  <Text style={[styles.countdown, days < 0 && { color: colors.error }]}>{describeCountdown(p.scheduledDate)}</Text>
                </View>
                <Text style={styles.detail}>{formatDate(p.scheduledDate)} • {p.timeSlot}</Text>
                {p.instructions ? <Text style={styles.detail}>Note: {p.instructions}</Text> : null}
                {p.lastRejection && (
                  <Text style={styles.rejection}>
                    Re-weigh requested by {p.lastRejection.byName}: {p.lastRejection.reason}
                  </Text>
                )}
                <Button
                  title={p.lastRejection ? 'Re-weigh Collection' : 'Start Weighing'}
                  onPress={() => navigation.navigate('WeighPickup', { pickupId: p.id })}
                  style={{ marginTop: 12, paddingVertical: 10 }}
                />
              </Card>
            );
          })
        )}

        <Text style={styles.sectionTitle}>Submitted</Text>
        {!isLoading && submitted.length === 0 && (
          <Text style={styles.emptyText}>Nothing submitted yet.</Text>
        )}
        {submitted.map(p => (
          <TouchableOpacity key={p.id} onPress={() => navigation.navigate('PickupReview', { pickupId: p.id })}>
            <Card>
              <View style={styles.cardHeader}>
                <Text style={styles.societyName}>{p.societyName}</Text>
                <StatusBadge status={p.status} />
              </View>
              <Text style={styles.detail}>{formatDate(p.scheduledDate)} • {(p.totalKg || 0).toFixed(2)} kg • Grade {p.grade}</Text>
            </Card>
          </TouchableOpacity>
        ))}
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
  subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary, marginTop: 15, marginBottom: 5, marginLeft: 5 },
  emptyText: { textAlign: 'center', color: colors.textSecondary, marginTop: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  societyName: { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, flexShrink: 1, marginRight: 8 },
  countdown: { fontSize: 13, fontWeight: 'bold', color: colors.warning },
  detail: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  rejection: { fontSize: 13, color: colors.error, marginTop: 8 }
});

export default VendorHomeScreen;
