import React, { useContext, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { AppContext } from '../context/AppContext';
import { colors } from '../theme/colors';
import Card from '../components/Card';
import * as storage from '../services/storageService';

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

  useFocusEffect(
    React.useCallback(() => {
      if (user?.role === 'admin') loadMemberData();
    }, [user])
  );

  const loadMemberData = async () => {
    try {
      const allUsers = await storage.getAllUsers() || [];
      const societyMembers = allUsers.filter(u => u.societyCode === user.societyCode && u.role === 'member');
      const allFootprints = await storage.getAllFootprintEntries() || [];

      const currentWeekInfo = getISOWeekInfo(Date.now());
      let activeThisWeek = 0;

      const processedMembers = societyMembers.map(member => {
        const memberEntries = allFootprints.filter(f => f.userId === member.id).sort((a,b) => new Date(b.date) - new Date(a.date));
        
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

      // Sort order: Inactive (red), Active Last (yellow), Active This (green), Never logged.
      // Wait, prompt: "Inactive members (red) at the top... Then last-week members (yellow)... Then active this week (green)... Never logged always at the very top above inactive"
      const statusOrder = {
        'never': 1,
        'inactive': 2,
        'active_last': 3,
        'active_this': 4
      };

      processedMembers.sort((a,b) => statusOrder[a.status] - statusOrder[b.status]);
      
      setMembersList(processedMembers);
      setActiveCount(activeThisWeek);
    } catch(e) {
      console.log(e);
    }
  };

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

        {membersList.map(member => (
          <Card key={member.id} style={[styles.memberCard, { borderLeftWidth: 4, borderLeftColor: member.badgeColor }]}>
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
        ))}

        {membersList.length === 0 && (
          <Text style={{ textAlign: 'center', color: '#888', marginTop: 40 }}>No members joined yet.</Text>
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
