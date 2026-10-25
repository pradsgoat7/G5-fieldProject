import React, { useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AppContext } from '../context/AppContext';
import { colors } from '../theme/colors';
import Card from '../components/Card';

const SustainabilityReportScreen = () => {
  const { user } = useContext(AppContext);
  const [stats, setStats] = useState({
    totalPlasticLogged: 0,
    totalKgRecycled: 0,
    totalRecyclableKg: 0,
    totalNonRecyclableKg: 0,
    pointsEarned: 0,
    pickupsCompleted: 0
  });
  const [gradeInfo, setGradeInfo] = useState({ grade: '', label: '', hasData: false, tip: '' });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const unsubFootprints = onSnapshot(query(collection(db, "footprint_entries"), where("userId", "==", user.uid)), (snapshot) => {
      const userFootprints = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
      
      const totalPlasticLogged = userFootprints.reduce((acc, curr) => acc + (curr.totalKg || 0), 0);

      if (userFootprints.length === 0) {
        setGradeInfo({ grade: '', label: 'Not Enough Data Yet', hasData: false, tip: '' });
      } else {
        const MS_IN_WEEK = 604800000;
        const sortedDates = userFootprints.map(f => new Date(f.date).getTime() || f.date?.toMillis?.() || Date.now()).sort();
        const firstEntry = sortedDates[0];
        const timeSpan = Date.now() - firstEntry;
        const weeksActive = Math.max(1, Math.ceil(timeSpan / MS_IN_WEEK));
        
        const averageWeekly = totalPlasticLogged / weeksActive;

        let grade = 'C';
        let label = 'Needs Improvement';
        let gradeIcon = '🔴';
        let tip = "Start small — avoid single-use bottles for 7 days.";

        if (averageWeekly < 0.3) {
          grade = 'A';
          label = 'Eco Champion';
          gradeIcon = '🟢';
          tip = "You're doing amazing! Encourage your neighbors to join.";
        } else if (averageWeekly <= 0.7) {
          grade = 'B';
          label = 'On the Right Track';
          gradeIcon = '🟡';
          tip = "Try replacing plastic bags with cloth bags this week.";
        }
        setGradeInfo({ grade, label, hasData: true, gradeIcon, tip, averageWeekly });
      }
      
      setStats(prev => ({...prev, totalPlasticLogged}));
    });

    const unsubSubmissions = onSnapshot(query(collection(db, "exchange_submissions"), where("societyCode", "==", user.societyCode)), (snapshot) => {
      const societySubmissions = snapshot.docs.map(d => d.data());
      const totalKgRecycled = societySubmissions.reduce((acc, curr) => acc + (curr.kg || 0), 0);
      const pointsEarned = societySubmissions.reduce((acc, curr) => acc + (curr.pointsEarned || 0), 0);
      const totalRecyclableKg = societySubmissions.reduce((acc, curr) => curr.category === 'recyclable' ? acc + (curr.kg || 0) : acc, 0);
      const totalNonRecyclableKg = societySubmissions.reduce((acc, curr) => curr.category === 'non_recyclable' ? acc + (curr.kg || 0) : acc, 0);
      const totalRecyclablePoints = societySubmissions.reduce((acc, curr) => curr.category === 'recyclable' ? acc + (curr.pointsEarned || 0) : acc, 0);
      const totalNonRecyclablePoints = societySubmissions.reduce((acc, curr) => curr.category === 'non_recyclable' ? acc + (curr.pointsEarned || 0) : acc, 0);
      setStats(prev => ({...prev, totalKgRecycled, totalRecyclableKg, totalNonRecyclableKg, pointsEarned, totalRecyclablePoints, totalNonRecyclablePoints}));
    });

    const unsubPickups = onSnapshot(query(collection(db, "pickups"), where("societyCode", "==", user.societyCode)), (snapshot) => {
      const allPickups = snapshot.docs.map(d => d.data());
      const completedPickups = allPickups.filter(p => p.status === 'Completed');
      setStats(prev => ({...prev, pickupsCompleted: completedPickups.length}));
      setIsLoading(false);
    });

    return () => {
      unsubFootprints();
      unsubSubmissions();
      unsubPickups();
    };
  }, [user]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="leaf-circle-outline" size={28} color={colors.primary} />
        <Text style={styles.headerTitle}>Sustainability Report</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileSection}>
          <Text style={styles.title}>🌿 My Sustainability Report</Text>
          <Text style={styles.subtitle}>{user?.name}</Text>
          <Text style={styles.societyText}>{user?.societyName}</Text>
          <View style={styles.periodBadge}>
             <Text style={styles.periodText}>Report period: All time</Text>
          </View>
        </View>

        {isLoading && <ActivityIndicator size="large" color={colors.primary} style={{marginBottom: 15}} />}

        <Text style={styles.sectionTitle}>Overview Stats</Text>
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <MaterialCommunityIcons name="scale" size={24} color={colors.primary} style={{marginBottom: 5}} />
            <Text style={styles.statValue}>{stats.totalPlasticLogged.toFixed(1)} kg</Text>
            <Text style={styles.statLabel}>Total Plastic Logged</Text>
          </Card>
          <Card style={styles.statCard}>
            <MaterialCommunityIcons name="recycle" size={24} color={colors.success} style={{marginBottom: 5}} />
            <Text style={styles.statValue}>{stats.totalKgRecycled.toFixed(1)} kg</Text>
            <Text style={styles.statLabel}>Society Recycled</Text>
          </Card>
          <Card style={styles.statCard}>
            <MaterialCommunityIcons name="star-circle-outline" size={24} color="#FFD700" style={{marginBottom: 5}} />
            <Text style={styles.statValue}>{stats.pointsEarned}</Text>
            <Text style={styles.statLabel}>Points Earned</Text>
          </Card>
          <Card style={styles.statCard}>
            <MaterialCommunityIcons name="truck-outline" size={24} color={colors.secondary} style={{marginBottom: 5}} />
            <Text style={styles.statValue}>{stats.pickupsCompleted}</Text>
            <Text style={styles.statLabel}>Pickups Completed</Text>
          </Card>
        </View>

        <Text style={styles.sectionTitle}>Submission Breakdown</Text>
        <Card style={styles.breakdownCard}>
          <Text style={styles.breakdownText}>♻️ Recyclable:     {stats.totalRecyclableKg.toFixed(1)} kg  →  +{Math.abs(stats.totalRecyclablePoints || 0)} points earned</Text>
          <Text style={styles.breakdownText}>🚫 Non-Recyclable: {stats.totalNonRecyclableKg.toFixed(1)} kg  →  {(stats.totalNonRecyclablePoints || 0) >= 0 ? '+' : ''}{stats.totalNonRecyclablePoints || 0} points</Text>
          <View style={{ height: 1, backgroundColor: '#E0E0E0', marginVertical: 10 }} />
          <Text style={[styles.breakdownText, { fontWeight: 'bold' }]}>📊 Net Points from Submissions: {stats.pointsEarned} points</Text>
        </Card>

        <Text style={styles.sectionTitle}>Personal Grade</Text>
        <Card style={styles.gradeCard}>
          {!gradeInfo.hasData ? (
             <View style={styles.gradeCenter}>
                <Text style={styles.noDataText}>{gradeInfo.label}</Text>
             </View>
          ) : (
             <View style={styles.gradeCenter}>
                <Text style={styles.gradeMainLabel}>Grade {gradeInfo.grade} {gradeInfo.gradeIcon}</Text>
                <Text style={styles.gradeSubLabel}>{gradeInfo.label}</Text>
                <Text style={styles.averageText}>({gradeInfo.averageWeekly.toFixed(2)} kg / week)</Text>
             </View>
          )}
        </Card>

        {gradeInfo.hasData && (
          <Card style={styles.tipCard}>
             <MaterialCommunityIcons name="lightbulb-on-outline" size={24} color="#FFA000" />
             <View style={{flex: 1, marginLeft: 10}}>
                <Text style={styles.tipLabel}>Personalized Tip</Text>
                <Text style={styles.tipText}>{gradeInfo.tip}</Text>
             </View>
          </Card>
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
  profileSection: {
    marginBottom: 25,
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 18,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 8,
  },
  societyText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  periodBadge: {
    backgroundColor: '#E0F7FA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 12,
  },
  periodText: {
    color: '#006064',
    fontSize: 12,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 10,
    marginLeft: 5,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  statCard: {
    width: '48%',
    padding: 15,
    marginBottom: 15,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  breakdownCard: {
    padding: 15,
    marginBottom: 20,
  },
  breakdownText: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '500',
    marginBottom: 8,
  },
  gradeCard: {
    padding: 25,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeCenter: {
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textSecondary,
  },
  gradeMainLabel: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  gradeSubLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  averageText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 5,
    fontStyle: 'italic',
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFDE7',
    borderColor: '#FFF59D',
    borderWidth: 1,
  },
  tipLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F57F17',
    marginBottom: 4,
  },
  tipText: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  }
});

export default SustainabilityReportScreen;
