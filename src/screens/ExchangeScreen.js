import React, { useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AppContext } from '../context/AppContext';
import { colors } from '../theme/colors';
import Card from '../components/Card';
import {
  GRADES, IMPACT_FACTOR, RECYCLABLE_MF, NON_RECYCLABLE_MF, PICKUP_INTERVAL_DAYS
} from '../services/pickupService';

const ExchangeScreen = () => {
  const { user } = useContext(AppContext);
  const [societySubmissions, setSocietySubmissions] = useState([]);
  const [points, setPoints] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user || !user.societyCode) return;
    
    console.log("Current user societyCode:", user.societyCode);
    console.log("Fetching submissions for society...");

    const q = query(
      collection(db, "exchange_submissions"),
      where("societyCode", "==", user.societyCode)
    );
    
    const unsubscribeSubmissions = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
      const sortedData = data.sort((a, b) => {
        const aTime = a.date?.seconds || a.date || 0;
        const bTime = b.date?.seconds || b.date || 0;
        return bTime - aTime;
      });
      console.log("Submissions loaded:", sortedData.length);
      setSocietySubmissions(sortedData);
    }, (error) => {
      console.log("Error fetching submissions", error);
    });

    const societyDocRef = doc(db, "societies", user.societyCode);
    const unsubscribeSociety = onSnapshot(societyDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setPoints(docSnap.data().totalPointsEarned || 0);
      }
      setIsLoading(false);
    });

    return () => {
      unsubscribeSubmissions();
      unsubscribeSociety();
    };
  }, [user]);


  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="refresh-circle" size={28} color={colors.primary} />
        <Text style={styles.headerTitle}>Plastic Exchange</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.pointsBanner}>
          <MaterialCommunityIcons name="shield-check" size={24} color="#FFF" />
          <Text style={styles.bannerText}>Points come only from BMC-verified pickups</Text>
        </View>

        <Card style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Total Points Balance</Text>
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.balanceValue}>{points} pts</Text>
          )}
        </Card>

        <Text style={styles.sectionTitle}>How Points Work</Text>
        <Card style={styles.formCard}>
          <Text style={styles.ruleText}>
            Every {PICKUP_INTERVAL_DAYS} days a vendor weighs your society's plastic, a BMC official verifies it, and you confirm it in the Vendors tab.
          </Text>
          <Text style={styles.ruleText}>♻️ Recyclable: {IMPACT_FACTOR * RECYCLABLE_MF} points per kg</Text>
          <Text style={styles.ruleText}>🚫 Segregated non-recyclable: {IMPACT_FACTOR * NON_RECYCLABLE_MF} points per kg</Text>
          <Text style={[styles.ruleText, { marginTop: 8, fontWeight: 'bold' }]}>Multiplied by the segregation grade:</Text>
          {GRADES.map(g => (
            <Text key={g.id} style={styles.ruleText}>  {g.label}: ×{g.multiplier}</Text>
          ))}
        </Card>

        <Text style={styles.sectionTitle}>My Submissions</Text>
        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : societySubmissions.length === 0 ? (
          <Text style={styles.emptyText}>No submissions yet.</Text>
        ) : (
          societySubmissions.map((sub) => {
            const isLegacy = !sub.category;
            const isVerified = sub.source === 'verified_pickup';
            const isRecyclable = sub.category === 'recyclable';
            const bgColors = isLegacy ? '#EEEEEE' : (isRecyclable ? '#E8F5E9' : '#FFF3E0');
            const titleText = isLegacy ? `🗄️ ${sub.plasticType}` : (isRecyclable ? `♻️ ${sub.plasticType}` : `🚫 ${sub.plasticType}`);
            const badgeText = isLegacy ? 'Legacy Submission' : isVerified ? 'BMC Verified ✅' : (isRecyclable ? 'Recyclable 🟢' : 'Non-Recyclable 🔴');
            const mfText = isLegacy ? '' : isVerified
              ? ` (MF: ${sub.multiplyingFactor}x, Grade ${sub.grade})`
              : ` (MF: ${isRecyclable ? '+1.5' : '-0.5'}x)`;
            
            const isNegative = sub.pointsEarned < 0;
            const pointsColor = isNegative ? 'red' : colors.success;
            const pointsText = isLegacy ? `Points earned: +${sub.pointsEarned}` : `Points: ${isNegative ? '' : '+'}${sub.pointsEarned}${mfText}`;

            return (
              <Card key={sub.id} style={styles.subCard}>
                <View style={[styles.subHeader, { marginBottom: 10 }]}>
                  <Text style={styles.subType}>{titleText}</Text>
                  <View style={[styles.badgeContainer, { backgroundColor: bgColors }]}>
                    <Text style={styles.badgeText}>{badgeText}</Text>
                  </View>
                </View>
                <Text style={styles.subDate}>{sub.kg} kg  •  {sub.date?.toDate ? sub.date.toDate().toLocaleDateString() : 'Just now'}</Text>
                <Text style={[styles.subPointsText, { color: pointsColor }]}>{pointsText}</Text>
              </Card>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
    marginLeft: 10,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  ruleText: {
    fontSize: 14,
    color: colors.textPrimary,
    marginVertical: 2,
  },
  pointsBanner: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  bannerText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  balanceCard: {
    alignItems: 'center',
    padding: 15,
    marginBottom: 20,
  },
  balanceLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  balanceValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
    marginTop: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 10,
    marginLeft: 5,
  },
  formCard: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: 10,
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeOption: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#FAFAFA',
    marginBottom: 8,
  },
  typeOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  typeTextSelected: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FAFAFA',
  },
  dateReadOnly: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#EEEEEE',
  },
  dateText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  categoryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  categoryCard: {
    width: '48%',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  categoryCardSelectedRecyclable: {
    borderColor: '#4CAF50',
    backgroundColor: '#E8F5E9',
  },
  categoryCardSelectedNonRecyclable: {
    borderColor: '#FF9800',
    backgroundColor: '#FFF3E0',
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  categorySubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginVertical: 4,
  },
  categoryTap: {
    fontSize: 10,
    color: '#9E9E9E',
  },
  chipContainer: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 10,
    marginRight: 10,
    backgroundColor: '#FAFAFA',
    minWidth: 120,
  },
  chipSelectedRecyclable: {
    borderColor: '#4CAF50',
    backgroundColor: '#4CAF50',
  },
  chipSelectedNonRecyclable: {
    borderColor: '#FF9800',
    backgroundColor: '#FF9800',
  },
  chipTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  chipDesc: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: '#FFF',
  },
  previewCard: {
    marginTop: 20,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
  },
  previewRecyclable: {
    backgroundColor: '#E8F5E9',
    borderColor: '#C8E6C9',
  },
  previewNonRecyclable: {
    backgroundColor: '#FFEBEE',
    borderColor: '#FFCDD2',
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: colors.textPrimary,
  },
  previewText: {
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  previewPoints: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    color: colors.textPrimary,
  },
  previewMessage: {
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
    color: colors.textSecondary,
  },
  previewEmpty: {
    fontSize: 14,
    marginTop: 10,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  subCard: {
    padding: 15,
    marginBottom: 10,
  },
  subHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  badgeContainer: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  subDate: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  subPointsText: {
    fontSize: 14,
    color: colors.success,
    fontWeight: 'bold',
    marginTop: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: 10,
  }
});

export default ExchangeScreen;
