import React, { useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppContext } from '../context/AppContext';
import { colors } from '../theme/colors';
import Card from '../components/Card';

const HomeScreen = ({ navigation }) => {
  const { user, points, footprint, itemsLogged, pickupsScheduled, co2Saved, personalActivity, allUsers, footprintEntries, logout } = useContext(AppContext);

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

        {user?.role === 'member' && (
          <Card style={[styles.mainCard, { marginBottom: 20, borderTopWidth: 4, borderTopColor: getFootprintColor(footprint) }]}>
            <Text style={styles.cardTitle}>Your Personal Footprint</Text>
            <View style={styles.scoreRow}>
              <Text style={styles.scoreText}>{footprint.toFixed(2)} kg</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: getFootprintColor(footprint) }]}>
              <Text style={styles.badgeText}>{getFootprintLabel(footprint)}</Text>
            </View>
          </Card>
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
          <TouchableOpacity 
            style={{ backgroundColor: '#FFF', padding: 15, borderRadius: 12, alignItems: 'center', borderColor: colors.primary, borderWidth: 1, marginBottom: 20 }}
            onPress={() => {
              const members = allUsers.filter(u => u.societyCode === user.societyCode && u.role === 'member');
              Alert.alert('Society Members', members.length > 0 ? members.map(m => `• ${m.name} (${m.email})`).join('\n') : 'No members yet.');
            }}
          >
            <Text style={{ color: colors.primary, fontWeight: 'bold' }}>Manage Society Members</Text>
          </TouchableOpacity>
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
