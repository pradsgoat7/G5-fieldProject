import React, { useContext, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as storage from '../services/storageService';
import * as Clipboard from 'expo-clipboard';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppContext } from '../context/AppContext';
import { colors } from '../theme/colors';
import Card from '../components/Card';

const HomeScreen = ({ navigation }) => {
  const { user, points, footprint, itemsLogged, pickupsScheduled, co2Saved, personalActivity, allUsers, footprintEntries, logout } = useContext(AppContext);
  const [adminRankData, setAdminRankData] = useState(null);
  const [hasActivePoll, setHasActivePoll] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      checkActivePolls();
      if (user?.role === 'admin') {
        computeAdminRank();
      }
    }, [user])
  );

  const checkActivePolls = async () => {
    try {
       const polls = await storage.getCommunityPolls() || [];
       const societyPolls = polls.filter(p => p.societyCode === user.societyCode && p.status === 'active' && Date.now() <= p.endsAt);
       if (user?.role === 'member') {
          // Check if un-voted active polls exist
          const hasUnvoted = societyPolls.some(p => !Object.keys(p.votes).includes(user.id));
          setHasActivePoll(hasUnvoted);
       } else {
          setHasActivePoll(societyPolls.length > 0);
       }
    } catch(e) {}
  };

  const computeAdminRank = async () => {
    try {
      const storedSocieties = await storage.getSocieties() || [];
      const storedUsers = await storage.getAllUsers() || [];
      const storedSubmissions = await storage.getAllSubmissions() || [];

      const computed = storedSocieties.map(soc => {
        const membersCount = storedUsers.filter(u => u.societyCode === soc.societyCode && u.role === 'member').length;
        const socSubs = storedSubmissions.filter(s => s.societyCode === soc.societyCode);
        const totalPointsEarned = socSubs.reduce((acc, sub) => acc + (sub.points || 0), 0);
        const regDate = soc.registrationDate || (Date.now() - 30 * 24 * 60 * 60 * 1000);
        const daysSinceRegistration = Math.max(0, (Date.now() - regDate) / (1000 * 60 * 60 * 24));
        const weeksActive = Math.floor(daysSinceRegistration / 7);
        const isEvaluating = weeksActive < 2;
        const safeMembers = Math.max(membersCount, 1);
        const normalizedScore = isEvaluating ? 0 : (totalPointsEarned / (weeksActive * safeMembers));
        let grade = 'C';
        if (normalizedScore >= 10.0) grade = 'A';
        else if (normalizedScore >= 4.0) grade = 'B';
        return {
          ...soc,
          normalizedScore,
          isEvaluating,
          grade
        };
      });

      const ranked = computed.filter(s => !s.isEvaluating).sort((a, b) => b.normalizedScore - a.normalizedScore);
      
      const myRow = ranked.findIndex(r => r.societyCode === user.societyCode);
      if (myRow !== -1) {
        setAdminRankData({ ...ranked[myRow], rank: myRow + 1 });
      } else {
        const myEval = computed.find(s => s.societyCode === user.societyCode);
        setAdminRankData(myEval || { isEvaluating: true });
      }
    } catch(e) {}
  };

  const societyOverviewFootprint = footprintEntries
    .filter(f => f.societyCode === user?.societyCode)
    .reduce((acc, f) => acc + (f.totalKg || 0), 0);

  const memberCount = allUsers.filter(u => u.societyCode === user?.societyCode).length;

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
          <Text style={styles.society}>{user?.societyName}</Text>
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
              <Text style={styles.pointsText}>{points}</Text>
            </View>
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
                    {adminRankData.grade === 'A' ? '🟢' : adminRankData.grade === 'B' ? '🟡' : '🔴'} [{adminRankData.grade}]
                  </Text>
                </View>
                <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 10, fontWeight: '500' }}>
                  {adminRankData.normalizedScore.toFixed(1)} pts/household/week
                </Text>
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
