import React, { useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { collection, query, where, onSnapshot, doc, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import * as Clipboard from 'expo-clipboard';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppContext } from '../context/AppContext';
import { colors } from '../theme/colors';
import Card from '../components/Card';
import { WardSetupCard } from '../components/WardPicker';
import { getWardLabel } from '../services/wards';

const HomeScreen = ({ navigation }) => {
  const { user, logout } = useContext(AppContext);
  const [adminRankData, setAdminRankData] = useState(null);
  const [hasActivePoll, setHasActivePoll] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Data states
  const [points, setPoints] = useState(0);
  const [memberCount, setMemberCount] = useState(0);
  const [societyOverviewFootprint, setSocietyOverviewFootprint] = useState(0);
  const [footprint, setFootprint] = useState(0);
  const [itemsLogged, setItemsLogged] = useState(0);
  const [pickupsScheduled, setPickupsScheduled] = useState(0);
  const [co2Saved, setCo2Saved] = useState(0);
  const [personalActivity, setPersonalActivity] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  useEffect(() => {
    if (!user) return;
    
    // 1. Active Polls
    const qPolls = query(collection(db, "polls"), where("societyCode", "==", user.societyCode));
    const unsubPolls = onSnapshot(qPolls, (snapshot) => {
      const polls = snapshot.docs.map(d => d.data());
      const activePolls = polls.filter(p => p.status === 'active' && Date.now() <= p.endsAt);
      if (user?.role === 'member') {
        const hasUnvoted = activePolls.some(p => !(p.votes && Object.keys(p.votes).includes(user.uid)));
        setHasActivePoll(hasUnvoted);
      } else {
        setHasActivePoll(activePolls.length > 0);
      }
    });

    // 2. Society Doc (Points, Member Count)
    const unsubSociety = onSnapshot(doc(db, "societies", user.societyCode), (d) => {
      if (d.exists()) {
        const data = d.data();
        setPoints(data.totalPointsEarned || 0);
        setMemberCount(data.memberCount || 1);
      }
    });

    // 3. Society Footprint & Admin Rank
    const unsubAllSocieties = onSnapshot(collection(db, "societies"), (snapshot) => {
      const computed = snapshot.docs.map(currDoc => {
        const soc = {id: currDoc.id, ...currDoc.data()};
        const mCount = soc.memberCount || 1;
        const totalPointsEarned = soc.totalPointsEarned || 0;
        const regDate = soc.registrationDate || (Date.now() - 30 * 24 * 60 * 60 * 1000);
        const daysSinceRegistration = Math.max(0, (Date.now() - regDate) / (1000 * 60 * 60 * 24));
        const weeksActive = Math.floor(daysSinceRegistration / 7);
        const isEvaluating = weeksActive < 2;
        const normalizedScore = isEvaluating ? 0 : (totalPointsEarned / (weeksActive * Math.max(mCount, 1)));
        let grade = 'C';
        if (normalizedScore >= 10.0) grade = 'A';
        else if (normalizedScore >= 4.0) grade = 'B';
        else if (normalizedScore >= 0.0) grade = 'C';
        else grade = 'D';
        return { ...soc, normalizedScore, isEvaluating, grade };
      });
      const ranked = computed.filter(s => !s.isEvaluating).sort((a, b) => b.normalizedScore - a.normalizedScore);
      const myRow = ranked.findIndex(r => r.societyCode === user.societyCode);
      if (myRow !== -1) {
        setAdminRankData({ ...ranked[myRow], rank: myRow + 1 });
      } else {
        const myEval = computed.find(s => s.societyCode === user.societyCode);
        setAdminRankData(myEval || { isEvaluating: true });
      }
    });

    // 4. All Society Users (for admin to manage members)
    const unsubUsers = onSnapshot(query(collection(db, "users"), where("societyCode", "==", user.societyCode)), (snapshot) => {
      setAllUsers(snapshot.docs.map(d => d.data()));
    });

    // 5. Footprint Entries
    const unsubFootprints = onSnapshot(query(collection(db, "footprint_entries"), where("societyCode", "==", user.societyCode)), (snapshot) => {
      const entries = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
      const totalSocietyKg = entries.reduce((acc, f) => acc + (f.totalKg || 0), 0);
      setSocietyOverviewFootprint(totalSocietyKg);
      setCo2Saved((totalSocietyKg * 1.5).toFixed(1)); // mock math 1.5kg CO2 per 1kg plastic avoided
      
      const myEntries = entries.filter(e => e.userId === user.uid);
      const myTotalKg = myEntries.reduce((acc, e) => acc + (e.totalKg || 0), 0);
      setFootprint(myTotalKg);
      setItemsLogged(myEntries.length);
      
      const formattedActivities = myEntries.sort((a,b) => b.date - a.date).map(e => ({
        id: e.id,
        title: `Logged ${e.items?.length || 0} items (${e.totalKg || 0} kg)`,
        date: e.date
      }));
      setPersonalActivity(formattedActivities);
    });

    // 6. Pickups
    const unsubPickups = onSnapshot(query(collection(db, "pickups"), where("societyCode", "==", user.societyCode)), (snapshot) => {
      const entries = snapshot.docs.map(d => d.data());
      const pending = entries.filter(e => e.status !== 'Completed' && e.status !== 'Cancelled').length;
      setPickupsScheduled(pending);
      setIsLoading(false);
    });

    return () => {
      unsubPolls();
      unsubSociety();
      unsubAllSocieties();
      unsubUsers();
      unsubFootprints();
      unsubPickups();
    };
  }, [user]);



  const getFootprintColor = (val) => {
    if (val < 0.2) return colors.ratingExcellent;
    if (val <= 0.5) return colors.ratingGood;
    if (val <= 1) return colors.ratingModerate;
    return colors.ratingHigh;
  };

  const getFootprintLabel = (val) => {
    if (val < 0.2) return 'Excellent';
    if (val <= 0.5) return 'Good';
    if (val <= 1) return 'Moderate';
    return 'High';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons name="leaf" size={28} color={colors.primary} />
          <Text style={styles.headerTitle}>PlasticTrack</Text>
        </View>
        <TouchableOpacity onPress={logout} style={{ padding: 5 }}>
          <MaterialCommunityIcons name="logout" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.greetingSection}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.greeting}>Hello, {user?.name} 👋</Text>
            <View style={{ backgroundColor: user?.role === 'admin' ? colors.primary : '#E0E0E0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, marginLeft: 10 }}>
              <Text style={{ color: user?.role === 'admin' ? '#FFF' : '#5C5C5C', fontSize: 10, fontWeight: 'bold' }}>{user?.role === 'admin' ? 'ADMIN' : 'MEMBER'}</Text>
            </View>
          </View>
          <Text style={styles.society}>{user?.societyName}{user?.ward ? ` • ${getWardLabel(user.ward)}` : ''}</Text>
          {user?.role === 'admin' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, backgroundColor: '#E8F5E9', padding: 8, borderRadius: 6, alignSelf: 'flex-start' }}>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>Your Society Code: </Text>
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.primary, marginRight: 8 }}>{user?.societyCode}</Text>
              <TouchableOpacity onPress={async () => {
                await Clipboard.setStringAsync(user?.societyCode);
                Alert.alert('Copied!', 'Society code copied to clipboard.', [{ text: 'OK' }]);
              }}>
                <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600', textDecorationLine: 'underline' }}>[Copy]</Text>
              </TouchableOpacity>
            </View>
          )}

          {user?.role === 'admin' && !user?.ward && (
            <WardSetupCard message="Your society was registered before wards were added. Select its BMC ward so the right ward officer can verify your collections." />
          )}

          {/* Smart Highlight: Active Polls Banner */}
          <TouchableOpacity 
             style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: hasActivePoll ? '#FFF9C4' : '#E3F2FD', padding: 15, borderRadius: 12, marginTop: 15, borderWidth: 1, borderColor: hasActivePoll ? '#FBC02D' : '#90CAF9' }}
             onPress={() => navigation.navigate('CommunityVoting')}
          >
             <View style={{flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name={hasActivePoll ? "alert-circle" : "vote"} size={24} color={hasActivePoll ? "#F57F17" : "#1976D2"} />
                <Text style={{ marginLeft: 10, fontSize: 16, fontWeight: 'bold', color: hasActivePoll ? '#F57F17' : '#1976D2' }}>
                  {hasActivePoll ? 'Vote Now 🗳️ - Action Required' : 'Community Voting 🗳️'}
                </Text>
             </View>
             <MaterialCommunityIcons name="chevron-right" size={24} color={hasActivePoll ? "#F57F17" : "#1976D2"} />
          </TouchableOpacity>

          <TouchableOpacity 
             style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', padding: 15, borderRadius: 12, marginTop: 15, borderWidth: 1, borderColor: '#E0E0E0' }}
             onPress={() => navigation.navigate('Updates')}
          >
             <View style={{flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="broadcast" size={24} color={colors.primary} />
                <Text style={{ marginLeft: 10, fontSize: 16, fontWeight: 'bold', color: colors.primary }}>
                  Society Updates 📢
                </Text>
             </View>
             <MaterialCommunityIcons name="chevron-right" size={24} color={colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity 
             style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', padding: 15, borderRadius: 12, marginTop: 15, borderWidth: 1, borderColor: '#E0E0E0' }}
             onPress={() => navigation.navigate('FAQ')}
          >
             <View style={{flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="frequently-asked-questions" size={24} color={colors.primary} />
                <Text style={{ marginLeft: 10, fontSize: 16, fontWeight: 'bold', color: colors.primary }}>
                  FAQs ❓
                </Text>
             </View>
             <MaterialCommunityIcons name="chevron-right" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.cardsRow}>
          <Card style={[styles.mainCard, { borderTopWidth: 4, borderTopColor: getFootprintColor(societyOverviewFootprint) }]}>
            <Text style={styles.cardTitle}>Society's Footprint</Text>
            <View style={styles.scoreRow}>
              <Text style={styles.scoreText}>{societyOverviewFootprint.toFixed(2)} kg</Text>
            </View>
          </Card>

          <Card style={[styles.mainCard, { borderTopWidth: 4, borderTopColor: '#FFD700' }]}>
            <Text style={styles.cardTitle}>Reward Points</Text>
            <View style={styles.scoreRow}>
              <MaterialCommunityIcons name="star" size={28} color="#FFD700" />
              <Text style={[styles.pointsText, { color: points > 0 ? colors.success : (points < 0 ? 'red' : 'gray') }]}>{points}</Text>
            </View>
            {points < 0 && (
              <Text style={{ fontSize: 12, color: 'red', marginBottom: 10 }}>⚠️ Your society is in negative points due to non-recyclable plastic submissions.</Text>
            )}
            {user?.role === 'admin' && (
              <TouchableOpacity onPress={() => navigation.navigate('Rewards')} style={styles.linkButton}>
                <Text style={styles.linkText}>Manage Rewards</Text>
              </TouchableOpacity>
            )}
          </Card>
        </View>

        {user?.role === 'admin' && adminRankData && (
          <Card style={[styles.mainCard, { marginBottom: 20, borderTopWidth: 4, borderTopColor: colors.primary, overflow: 'hidden' }]}>
            <Text style={styles.cardTitle}>Society Rank</Text>
            {adminRankData.isEvaluating ? (
              <View>
                <Text style={styles.scoreText}>Under Evaluation 🕐</Text>
                <Text style={{ fontSize: 13, color: '#888', marginBottom: 10, marginTop: 4 }}>Ranking begins after 2 weeks</Text>
              </View>
            ) : (
              <View>
                <View style={[styles.scoreRow, { marginBottom: 2 }]}>
                  <Text style={styles.scoreText}>#{adminRankData.rank}</Text>
                  <Text style={{ fontSize: 18, marginLeft: 10, fontWeight: 'bold', color: '#555' }}>
                    {adminRankData.grade === 'A' ? '🟢' : adminRankData.grade === 'B' ? '🟡' : adminRankData.grade === 'C' ? '🔴' : '⚫'} [{adminRankData.grade}]
                  </Text>
                </View>
                <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 10, fontWeight: '500' }}>
                  {adminRankData.normalizedScore.toFixed(1)} pts/household/week
                </Text>
                {adminRankData.grade === 'D' && (
                  <Text style={{ fontSize: 12, color: '#D32F2F', fontStyle: 'italic', marginBottom: 10 }}>Submitting too much non-recyclable plastic.</Text>
                )}
              </View>
            )}
            <TouchableOpacity onPress={() => navigation.navigate('Community')} style={[styles.linkButton, { marginTop: 0 }]}>
              <Text style={styles.linkText}>View Full Leaderboard →</Text>
            </TouchableOpacity>
          </Card>
        )}

        {user?.role === 'member' && (
          <View>
            <Card style={[styles.mainCard, { marginBottom: 15, borderTopWidth: 4, borderTopColor: getFootprintColor(footprint) }]}>
              <Text style={styles.cardTitle}>Your Personal Footprint</Text>
              <View style={styles.scoreRow}>
                <Text style={styles.scoreText}>{footprint.toFixed(2)} kg</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: getFootprintColor(footprint) }]}>
                <Text style={styles.badgeText}>{getFootprintLabel(footprint)}</Text>
              </View>
            </Card>
            
            <TouchableOpacity 
              style={{ backgroundColor: '#E8F5E9', padding: 15, borderRadius: 12, alignItems: 'center', borderColor: '#C8E6C9', borderWidth: 1, marginBottom: 20 }}
              onPress={() => navigation.navigate('SustainabilityReport')}
            >
              <Text style={{ color: colors.primary, fontWeight: 'bold' }}>View My Report Card 🌿</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.sectionTitle}>Quick Stats</Text>
        <View style={styles.statsRow}>
          {user?.role === 'admin' ? (
            <Card style={styles.statCard}>
              <Text style={styles.statValue}>{memberCount}</Text>
              <Text style={styles.statLabel}>Members</Text>
            </Card>
          ) : (
            <Card style={styles.statCard}>
              <Text style={styles.statValue}>{itemsLogged}</Text>
              <Text style={styles.statLabel}>Items Logged</Text>
            </Card>
          )}
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{pickupsScheduled}</Text>
            <Text style={styles.statLabel}>{user?.role === 'admin' ? 'Pending Pickups' : 'Pickups Setup'}</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{co2Saved}</Text>
            <Text style={styles.statLabel}>CO₂ Saved (kg)</Text>
          </Card>
        </View>

        {user?.role === 'admin' && (
          <View>
            <TouchableOpacity 
              style={{ backgroundColor: '#FFF', padding: 15, borderRadius: 12, alignItems: 'center', borderColor: colors.primary, borderWidth: 1, marginBottom: 12 }}
              onPress={() => {
                const members = allUsers.filter(u => u.societyCode === user.societyCode && u.role === 'member');
                Alert.alert('Society Members', members.length > 0 ? members.map(m => `• ${m.name} (${m.email})`).join('\n') : 'No members yet.');
              }}
            >
              <Text style={{ color: colors.primary, fontWeight: 'bold' }}>Manage Society Members</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={{ backgroundColor: '#E8F5E9', padding: 15, borderRadius: 12, alignItems: 'center', borderColor: '#C8E6C9', borderWidth: 1, marginBottom: 20 }}
              onPress={() => navigation.navigate('MemberActivity')}
            >
              <Text style={{ color: colors.primary, fontWeight: 'bold' }}>View Member Activity 👥</Text>
            </TouchableOpacity>
          </View>
        )}

        {user?.role === 'member' && (
          <>
            <Text style={styles.sectionTitle}>Your Recent Activity</Text>
            <Card style={styles.activityCard}>
              {personalActivity.length === 0 ? (
                <Text style={styles.emptyText}>No recent activity yet.</Text>
              ) : (
                personalActivity.slice(0, 3).map((act, index) => (
                  <View key={act.id} style={[styles.activityItem, index < (Math.min(personalActivity.length, 3) - 1) && styles.activityItemBorder]}>
                    <MaterialCommunityIcons name="check-circle-outline" size={24} color={colors.primary} />
                    <View style={styles.activityTextContainer}>
                      <Text style={styles.activityTitle}>{act.title}</Text>
                      <Text style={styles.activityDate}>{new Date(act.date).toLocaleDateString()}</Text>
                    </View>
                  </View>
                ))
              )}
            </Card>
          </>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.primary,
    marginLeft: 8,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  greetingSection: {
    marginBottom: 20,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  society: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  cardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  mainCard: {
    flex: 1,
    marginHorizontal: 5,
    padding: 15,
  },
  cardTitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 10,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  scoreText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  pointsText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginLeft: 5,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  linkButton: {
    marginTop: 5,
  },
  linkText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: 10,
    marginBottom: 10,
    marginLeft: 5,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
    padding: 15,
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  activityCard: {
    padding: 0,
  },
  emptyText: {
    padding: 20,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  activityItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  activityTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  activityDate: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
});

export default HomeScreen;
