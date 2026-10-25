import React, { useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AppContext } from '../context/AppContext';
import { colors } from '../theme/colors';
import Card from '../components/Card';
import { useTranslation, getLocale, translateRating } from '../i18n';

const STATUS_LABEL_KEYS = {
  never: 'memberActivity.noEntries',
  active_this_week: 'memberActivity.activeThisWeek',
  active_last_week: 'memberActivity.activeLastWeek',
  inactive: 'memberActivity.inactive'
};

const MemberActivityScreen = () => {
  const { user } = useContext(AppContext);
  const { t } = useTranslation();
  const [membersList, setMembersList] = useState([]);
  const [activeCount, setActiveCount] = useState(0);

  const getActivityStatus = (lastLoggedDate) => {
    if (!lastLoggedDate) return "never";
    const logDate = lastLoggedDate?.toDate ? lastLoggedDate.toDate() : new Date(lastLoggedDate);
    const now = new Date();
    
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);
    
    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
    
    if (logDate >= startOfWeek) {
      return "active_this_week";
    } else if (logDate >= startOfLastWeek) {
      return "active_last_week";
    } else {
      return "inactive";
    }
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

    let activeThisWeek = 0;

    const processedMembers = societyUsers.map(member => {
      const memberEntries = societyFootprints.filter(f => f.userId === member.uid);
      
      memberEntries.sort((a, b) => {
        const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
        const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
        return dateB - dateA;
      });
      
      let status = 'never';
      let badgeColor = '#9E9E9E';
      let lastDate = null;
      let latestTotal = null;
      let latestRating = null;

      if (memberEntries.length > 0) {
        const latestEntry = memberEntries[0];
        lastDate = latestEntry.date?.toDate ? latestEntry.date.toDate() : (latestEntry.date ? new Date(latestEntry.date) : null);
        latestTotal = latestEntry.totalKg;
        latestRating = latestEntry.rating;

        status = getActivityStatus(latestEntry.date);
        
        if (status === "active_this_week") {
           badgeColor = colors.success;
           activeThisWeek++;
        } else if (status === "active_last_week") {
           badgeColor = colors.ratingGood;
        } else {
           badgeColor = colors.error;
        }
      }

      return {
        ...member,
        entriesCount: memberEntries.length,
        lastDate,
        latestTotal,
        latestRating,
        status,
        badgeColor
      };
    });

    const statusOrder = {
      'never': 1,
      'inactive': 2,
      'active_last_week': 3,
      'active_this_week': 4
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
        <Text style={styles.headerTitle}>{t('memberActivity.header')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.summarySection}>
          <Text style={styles.title}>{t('memberActivity.title')}</Text>
          <Text style={styles.subtitle}>{t('memberActivity.society', { name: user?.societyName })}</Text>
          <View style={styles.periodBadge}>
             <Text style={styles.periodText}>{t('memberActivity.activeCount', { active: activeCount, total: membersList.length })}</Text>
          </View>
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : membersList.length === 0 ? (
          <Text style={{ textAlign: 'center', color: '#888', marginTop: 40 }}>{t('memberActivity.noMembers')}</Text>
        ) : (
          membersList.map(member => (
            <Card key={member.uid} style={[styles.memberCard, { borderLeftWidth: 4, borderLeftColor: member.badgeColor }]}>
              <View style={styles.memberHeader}>
                <Text style={styles.memberName}>{member.name}</Text>
                <Text style={styles.memberEmail}>{member.email}</Text>
              </View>

              <View style={styles.statusRow}>
                 <View style={[styles.badge, { backgroundColor: member.badgeColor }]}>
                   <Text style={styles.badgeText}>{t(STATUS_LABEL_KEYS[member.status] || STATUS_LABEL_KEYS.inactive)}</Text>
                 </View>
                 {member.lastDate && (
                   <Text style={styles.dateText}>
                     {t('memberActivity.lastLogged', { date: member.lastDate.toLocaleDateString(getLocale(), { day: '2-digit', month: 'short', year: 'numeric' }) })}
                   </Text>
                 )}
              </View>

              <View style={styles.statsDivider} />
              
              <View style={styles.statsRow}>
                 <View style={styles.statBox}>
                   <Text style={styles.statLabel}>{t('memberActivity.totalEntries')}</Text>
                   <Text style={styles.statVal}>{member.entriesCount}</Text>
                 </View>
                 {member.latestTotal !== null && (
                   <View style={styles.statBox}>
                     <Text style={styles.statLabel}>{t('memberActivity.latestFootprint')}</Text>
                     <Text style={styles.statVal}>{member.latestTotal.toFixed(2)} kg</Text>
                     <Text style={[styles.statSub, { color: colors.primary }]}>{translateRating(member.latestRating)}</Text>
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
