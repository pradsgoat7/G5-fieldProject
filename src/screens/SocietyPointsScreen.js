import React, { useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AppContext } from '../context/AppContext';
import { colors } from '../theme/colors';
import Card from '../components/Card';

const SocietyPointsScreen = () => {
  const { user } = useContext(AppContext);
  const [points, setPoints] = useState(0);
  const [societySubmissions, setSocietySubmissions] = useState([]);
  const [societyRedemptions, setSocietyRedemptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const unsubSociety = onSnapshot(doc(db, "societies", user.societyCode), (d) => {
      if (d.exists()) {
        setPoints(d.data().totalPointsEarned || 0);
      }
    });

    const unsubSubmissions = onSnapshot(query(collection(db, "exchange_submissions"), where("societyCode", "==", user.societyCode)), (snapshot) => {
      const subs = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
      setSocietySubmissions(subs.sort((a, b) => (b.date?.seconds || b.date || 0) - (a.date?.seconds || a.date || 0)));
    });

    const unsubRedemptions = onSnapshot(query(collection(db, "redemptions"), where("societyCode", "==", user.societyCode)), (snapshot) => {
      const redemps = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
      setSocietyRedemptions(redemps.sort((a, b) => b.date - a.date));
      setIsLoading(false);
    });

    return () => {
      unsubSociety();
      unsubSubmissions();
      unsubRedemptions();
    };
  }, [user]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="star-circle" size={24} color={colors.primary} />
        <Text style={styles.headerTitle}>Society Points</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {isLoading && <ActivityIndicator size="large" color={colors.primary} style={{marginBottom: 15}} />}
        <View style={styles.balanceContainer}>
          <Text style={styles.balanceLabel}>Society Balance</Text>
          <View style={styles.pointsRow}>
            <MaterialCommunityIcons name="star-circle" size={36} color="#FFD700" />
            <Text style={styles.balanceValue}>{points} pts</Text>
          </View>
        </View>

        <Card style={{ marginBottom: 20, backgroundColor: '#E8F5E9' }}>
          <Text style={{ textAlign: 'center', color: colors.primary, fontWeight: 'bold' }}>
            Points are managed by your society admin.
          </Text>
        </Card>

        <Text style={styles.sectionTitle}>Submission History</Text>
        {societySubmissions.length === 0 ? (
          <Text style={styles.emptyText}>No submissions logged yet.</Text>
        ) : (
          societySubmissions.map(sub => (
            <Card key={sub.id} style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <Text style={styles.historyType}>{sub.plasticType || sub.type}</Text>
                <Text style={styles.historyPoints}>{(sub.pointsEarned ?? sub.points) >= 0 ? '+' : ''}{sub.pointsEarned ?? sub.points} pts</Text>
              </View>
              <Text style={styles.historyDate}>
                {(sub.date?.toDate ? sub.date.toDate() : new Date(sub.date)).toLocaleDateString()} - {Number(sub.kg || 0).toFixed(2)} kg{sub.source === 'verified_pickup' ? ' • BMC verified ✅' : ''}
              </Text>
            </Card>
          ))
        )}

        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Redeemed Rewards</Text>
        {societyRedemptions.length === 0 ? (
          <Text style={styles.emptyText}>No rewards redeemed yet.</Text>
        ) : (
          societyRedemptions.map(r => (
            <Card key={r.id} style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <Text style={styles.historyType}>{r.rewardName}</Text>
                <Text style={{ ...styles.historyPoints, color: colors.error }}>-{r.pointsSpent} pts</Text>
              </View>
              <Text style={styles.historyDate}>{new Date(r.date).toLocaleDateString()}</Text>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: colors.primary, marginLeft: 10 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  balanceContainer: { alignItems: 'center', marginBottom: 25 },
  balanceLabel: { fontSize: 16, color: colors.textSecondary, marginBottom: 5 },
  pointsRow: { flexDirection: 'row', alignItems: 'center' },
  balanceValue: { fontSize: 36, fontWeight: 'bold', color: colors.textPrimary, marginLeft: 10 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 15, marginLeft: 5 },
  emptyText: { textAlign: 'center', color: colors.textSecondary, marginBottom: 20 },
  historyCard: { padding: 15, marginBottom: 10 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  historyType: { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary },
  historyPoints: { fontSize: 16, fontWeight: 'bold', color: colors.success },
  historyDate: { fontSize: 14, color: colors.textSecondary }
});

export default SocietyPointsScreen;
