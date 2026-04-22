import React, { useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AppContext } from '../context/AppContext';
import { colors } from '../theme/colors';
import Card from '../components/Card';

const MemberActivityScreen = () => {
  const { user } = useContext(AppContext);
  const [membersList, setMembersList] = useState([]);
  const [activeCount, setActiveCount] = useState(0);

  const getISOWeekInfo = (date = new Date()) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = (d.getDay() || 7) - 1; 
    d.setDate(d.getDate() - day + 3); 
    const firstThursday = d.getTime();
    d.setMonth(0, 1);
    if (d.getDay() !== 4) {
      d.setMonth(0, 1 + ((4 - d.getDay()) + 7) % 7);
    }
    const weekNum = 1 + Math.ceil((firstThursday - d) / 604800000);
    return { year: d.getFullYear(), week: weekNum };
  };

  const [isLoading, setIsLoading] = useState(true);
  const [societyUsers, setSocietyUsers] = useState([]);
  const [societyFootprints, setSocietyFootprints] = useState([]);

  useEffect(() => {
    if (user?.role !== 'admin') return;

    const unsubUsers = onSnapshot(query(collection(db, "users"), where("societyCode", "==", user.societyCode), where("role", "==", "member")), (snapshot) => {
      setSocietyUsers(snapshot.docs.map(d => ({id: d.id, ...d.data()})));
    });

    const unsubFootprints = onSnapshot(query(collection(db, "footprint_entries"), where("societyCode", "==", user.societyCode)), (snapshot) => {
      setSocietyFootprints(snapshot.docs.map(d => ({id: d.id, ...d.data()})));
    });

    return () => {
      unsubUsers();
      unsubFootprints();
    };
  }, [user]);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    setIsLoading(true);

    const currentWeekInfo = getISOWeekInfo(Date.now());
    let activeThisWeek = 0;

    const processedMembers = societyUsers.map(member => {
      const memberEntries = societyFootprints.filter(f => f.userId === member.uid).sort((a,b) => b.date - a.date);
      
      let status = 'never';
      let badgeColor = '#9E9E9E';
      let badgeLabel = 'No entries yet';
      let lastDate = null;
      let latestTotal = null;
      let latestRating = null;

      if (memberEntries.length > 0) {
        const latestEntry = memberEntries[0];
        lastDate = new Date(latestEntry.date);
        latestTotal = latestEntry.totalKg;
        latestRating = latestEntry.rating;

        const entryWeekInfo = getISOWeekInfo(lastDate);
        if (entryWeekInfo.year === currentWeekInfo.year && entryWeekInfo.week === currentWeekInfo.week) {
           status = 'active_this';
           badgeColor = colors.success;
           badgeLabel = 'Active this week ✅';
           activeThisWeek++;
        } else if (
           (entryWeekInfo.year === currentWeekInfo.year && entryWeekInfo.week === currentWeekInfo.week - 1) ||
           (entryWeekInfo.year === currentWeekInfo.year - 1 && currentWeekInfo.week === 1 && entryWeekInfo.week > 50)
        ) {
           status = 'active_last';
           badgeColor = colors.ratingGood;
           badgeLabel = 'Active last week';
        } else {
           status = 'inactive';
           badgeColor = colors.error;
           badgeLabel = 'Inactive ⚠️';
        }
      }

      return {
        ...member,
        entriesCount: memberEntries.length,
        lastDate,
        latestTotal,
        latestRating,
        status,
        badgeColor,
        badgeLabel
      };
    });

    const statusOrder = {
      'never': 1,
      'inactive': 2,
      'active_last': 3,
      'active_this': 4
    };

    processedMembers.sort((a,b) => statusOrder[a.status] - statusOrder[b.status]);
    
    setMembersList(processedMembers);
    setActiveCount(activeThisWeek);
    setIsLoading(false);
  }, [societyUsers, societyFootprints, user]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="account-group" size={28} color={colors.primary} />
        <Text style={styles.headerTitle}>Member Activity Overview</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.summarySection}>
          <Text style={styles.title}>👥 Member Activity</Text>
          <Text style={styles.subtitle}>Society: {user?.societyName}</Text>
          <View style={styles.periodBadge}>
             <Text style={styles.periodText}>{activeCount} of {membersList.length} members active this week</Text>
          </View>
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : membersList.length === 0 ? (
          <Text style={{ textAlign: 'center', color: '#888', marginTop: 40 }}>No members joined yet.</Text>
        ) : (
          membersList.map(member => (
            <Card key={member.uid} style={[styles.memberCard, { borderLeftWidth: 4, borderLeftColor: member.badgeColor }]}>
              <View style={styles.memberHeader}>
                <Text style={styles.memberName}>{member.name}</Text>
                <Text style={styles.memberEmail}>{member.email}</Text>
              </View>

              <View style={styles.statusRow}>
                 <View style={[styles.badge, { backgroundColor: member.badgeColor }]}>
                   <Text style={styles.badgeText}>{member.badgeLabel}</Text>
                 </View>
                 {member.lastDate && (
                   <Text style={styles.dateText}>Last logged: {member.lastDate.toLocaleDateString()}</Text>
                 )}
              </View>

              <View style={styles.statsDivider} />
              
              <View style={styles.statsRow}>
                 <View style={styles.statBox}>
                   <Text style={styles.statLabel}>Total Entries</Text>
                   <Text style={styles.statVal}>{member.entriesCount}</Text>
                 </View>
                 {member.latestTotal !== null && (
                   <View style={styles.statBox}>
                     <Text style={styles.statLabel}>Latest Footprint</Text>
                     <Text style={styles.statVal}>{member.latestTotal.toFixed(2)} kg</Text>
                     <Text style={[styles.statSub, { color: colors.primary }]}>{member.latestRating}</Text>
                   </View>
                 )}
              </View>
            </Card>
          ))
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
  summarySection: {
    marginBottom: 25,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 4,
  },
  periodBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  periodText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: 'bold',
  },
  memberCard: {
    padding: 15,
    marginBottom: 15,
  },
  memberHeader: {
    marginBottom: 10,
  },
  memberName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  memberEmail: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 10,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  dateText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  statsDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  statVal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  statSub: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  }
});

export default MemberActivityScreen;
