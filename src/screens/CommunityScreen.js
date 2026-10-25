import React, { useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Dimensions, TextInput, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { colors } from '../theme/colors';
import Card from '../components/Card';
import Button from '../components/Button';
import { AppContext } from '../context/AppContext';
import { useTranslation, getLocale } from '../i18n';
import { getWeekInfo, joinDocId, participationShare } from '../services/challengeService';
import { showMessage, describeError } from '../services/dialogs';

const { width } = Dimensions.get('window');

// Tip text lives in the translation files under community.tips
const TIP_IDS = ['bag', 'straws', 'bulk', 'containers', 'soap'];



const POSTS = [
  { id: '1', user: 'Anita M.', time: '2 hours ago', content: 'Just replaced all plastic containers with glass jars! Feels so much cleaner.' },
  { id: '2', user: 'Vikas S.', time: '5 hours ago', content: 'Our society just hit 1,000 kg of plastic recycled this year! Great job everyone! 🌍' },
  { id: '3', user: 'Priya K.', time: 'Yesterday', content: 'Found a great local store that sells grains in bulk without plastic bags.' },
];

const CommunityScreen = () => {
  const { user } = useContext(AppContext);
  const { t } = useTranslation();
  const week = getWeekInfo();
  const [weekJoins, setWeekJoins] = useState([]);
  const [isJoining, setIsJoining] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [localPosts, setLocalPosts] = useState([]);
  
  const [lbItems, setLbItems] = useState([]);
  const [isComputingLB, setIsComputingLB] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Listen to all societies for leaderboard
    const unsubSocieties = onSnapshot(collection(db, "societies"), (snapshot) => {
      const storedSocieties = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
      
      const computed = storedSocieties.map(soc => {
        const membersCount = soc.memberCount || 1;
        const totalPointsEarned = soc.totalPointsEarned || 0;

        const regDate = soc.registrationDate || (Date.now() - 30 * 24 * 60 * 60 * 1000);
        const daysSinceRegistration = Math.max(0, (Date.now() - regDate) / (1000 * 60 * 60 * 24));
        const weeksActive = Math.floor(daysSinceRegistration / 7);

        const isEvaluating = weeksActive < 2;
        const safeMembers = Math.max(membersCount, 1);
        const normalizedScore = isEvaluating ? 0 : (totalPointsEarned / (weeksActive * safeMembers));

        let grade = 'C';
        if (normalizedScore >= 10.0) grade = 'A';
        else if (normalizedScore >= 4.0) grade = 'B';
        else if (normalizedScore >= 0.0) grade = 'C';
        else grade = 'D';

        return {
          ...soc,
          membersCount,
          totalPointsEarned,
          weeksActive,
          daysSinceRegistration: Math.floor(daysSinceRegistration),
          isEvaluating,
          normalizedScore,
          grade
        };
      });

      const ranked = computed.filter(s => !s.isEvaluating).sort((a, b) => b.normalizedScore - a.normalizedScore);
      const evaluating = computed.filter(s => s.isEvaluating).sort((a, b) => (a.registrationDate || 0) - (b.registrationDate || 0));

      const finalRanked = ranked.map((r, i) => ({ ...r, rank: i + 1 }));
      setLbItems([...finalRanked, ...evaluating]);
      setIsComputingLB(false);
    });

    // Listen to announcements for posts
    const q = query(
      collection(db, "announcements"), 
      where("societyCode", "==", user.societyCode), 
      orderBy("timestamp", "desc")
    );
    
    const unsubPosts = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
      setLocalPosts(data);
    });

    // Everyone in the society who joined this week's challenge
    const unsubJoins = onSnapshot(
      query(collection(db, "challenge_joins"), where("societyCode", "==", user.societyCode), where("weekId", "==", week.weekId)),
      (snapshot) => setWeekJoins(snapshot.docs.map(d => d.data())),
      (error) => console.log("Error fetching challenge joins", error)
    );

    return () => {
      unsubSocieties();
      unsubPosts();
      unsubJoins();
    };
  }, [user, week.weekId]);

  const mySociety = lbItems.find(s => s.societyCode === user?.societyCode);
  const memberCount = mySociety?.membersCount || 1;
  const hasJoined = weekJoins.some(j => j.uid === user?.uid);
  const share = participationShare(weekJoins.length, memberCount);
  const joinedNames = weekJoins.filter(j => j.uid !== user?.uid).map(j => j.name);

  // Tapping again leaves the challenge
  const handleJoin = async () => {
    if (isJoining) return;
    setIsJoining(true);
    const ref = doc(db, "challenge_joins", joinDocId(week.weekId, user.uid));
    try {
      if (hasJoined) {
        await deleteDoc(ref);
      } else {
        await setDoc(ref, {
          weekId: week.weekId,
          challengeId: week.challengeId,
          uid: user.uid,
          name: user.name,
          societyCode: user.societyCode,
          joinedAt: serverTimestamp()
        });
      }
    } catch (e) {
      console.error("Challenge join error:", e);
      showMessage(t('common.error'), describeError(e));
    } finally {
      setIsJoining(false);
    }
  };

  const postAnnouncement = async () => {
    if (announcement.trim()) {
      try {
        await addDoc(collection(db, "announcements"), {
          societyCode: user.societyCode,
          type: 'announcement',
          title: t('community.adminPost'),
          description: announcement,
          user: user.name + ' (Admin)',
          timestamp: Date.now(),
          postedBy: user.uid,
          isAdminAuthored: true,
          createdAt: serverTimestamp()    
        });
        setAnnouncement('');
      } catch (error) {
        console.error("Error posting announcement:", error);
      }
    }
  };

  const visiblePosts = localPosts;


  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="account-group" size={28} color={colors.primary} />
        <Text style={styles.headerTitle}>{t('community.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.challengeCard}>
          <View style={styles.challengeHeader}>
            <Text style={styles.challengeBadge}>{t('community.weeklyChallenge')}</Text>
            <Text style={styles.challengeEnds}>
              {week.daysLeft === 0 ? t('community.endsToday') : t('community.endsIn', { count: week.daysLeft })}
            </Text>
          </View>
          <Text style={styles.challengeText}>{t(`community.challenges.${week.challengeId}`)}</Text>
          <Text style={styles.progressLabel}>
            {t('community.participationCount', { joined: weekJoins.length, total: memberCount, percent: Math.round(share * 100) })}
          </Text>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${Math.round(share * 100)}%` }]} />
          </View>
          {joinedNames.length > 0 && (
            <Text style={styles.joinedNames}>
              {joinedNames.length <= 3
                ? t('community.joinedNames', { names: joinedNames.join(', ') })
                : t('community.joinedNamesMore', { names: joinedNames.slice(0, 3).join(', '), count: joinedNames.length - 3 })}
            </Text>
          )}
          <Button 
            title={isJoining ? t('common.pleaseWait') : (hasJoined ? t('community.joinedLeave') : t('community.join'))} 
            type={hasJoined ? "secondary" : "primary"}
            onPress={handleJoin}
            disabled={isJoining}
            style={styles.joinButton} 
          />
        </Card>

        <Text style={styles.sectionTitle}>{t('community.tipsTitle')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tipsScroll}>
          {TIP_IDS.map(id => (
            <Card key={id} style={styles.tipCard}>
              <Text style={styles.tipText}>{t(`community.tips.${id}`)}</Text>
            </Card>
          ))}
        </ScrollView>

        <Text style={styles.sectionTitle}>{t('community.statsTitle')}</Text>
        <Card style={styles.statsCard}>
          <View style={styles.statRow}>
            <MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.warning} />
            <Text style={styles.statText}>{t('community.stat1')}</Text>
          </View>
          <View style={styles.statRow}>
            <MaterialCommunityIcons name="recycle" size={20} color={colors.primary} />
            <Text style={styles.statText}>{t('community.stat2')}</Text>
          </View>
          <View style={styles.statRow}>
            <MaterialCommunityIcons name="earth" size={20} color={colors.secondary} />
            <Text style={styles.statText}>{t('community.stat3')}</Text>
          </View>
        </Card>

        <Text style={styles.sectionTitle}>{t('community.leaderboard')}</Text>
        <Card style={styles.leaderboardCard}>
          {isComputingLB ? (
            <View style={{ padding: 30, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : lbItems.length === 0 ? (
            <Text style={{ padding: 20, textAlign: 'center', color: colors.textSecondary }}>{t('community.noSocieties')}</Text>
          ) : (
            lbItems.map((item, index) => {
              const isMySociety = item.societyCode === user?.societyCode;
              const hasRankedSocieties = lbItems.some(s => !s.isEvaluating);
              
              if (!hasRankedSocieties && index === 0) {
                // If the very first item is under evaluation, it means no ranked societies exist
              }

              let medal = '';
              if (!item.isEvaluating) {
                if (item.rank === 1) medal = '🥇';
                else if (item.rank === 2) medal = '🥈';
                else if (item.rank === 3) medal = '🥉';
              }

              let gradeIcon = '⚪';
              let gradeText = t('community.eval');
              if (!item.isEvaluating) {
                gradeText = item.grade;
                if (item.grade === 'A') gradeIcon = '🟢';
                else if (item.grade === 'B') gradeIcon = '🟡';
                else if (item.grade === 'C') gradeIcon = '🔴';
                else if (item.grade === 'D') gradeIcon = '⚫';
              }

              return (
                <View key={item.societyCode} style={[styles.lbNewRow, isMySociety && styles.mySocietyHighlight]}>
                  {isMySociety && <Text style={styles.mySocietyBadge}>{t('community.yourSociety')}</Text>}
                  
                  {!item.isEvaluating ? (
                    <>
                      <View style={styles.lbNewHeader}>
                        <Text style={styles.lbNewRank}>{medal ? medal : `#${item.rank}`}  {item.societyName}</Text>
                        <Text style={[styles.lbNewGrade, item.grade === 'D' && { backgroundColor: '#333', color: '#FFF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }]}>[{gradeText}] {gradeIcon}</Text>
                      </View>
                      <Text style={styles.lbNewScore}>{t('community.score', { value: item.normalizedScore.toFixed(1) })}</Text>
                      {item.grade === 'D' && <Text style={{ fontSize: 12, color: '#D32F2F', fontStyle: 'italic', marginBottom: 4 }}>{t('home.tooMuchNonRecyclable')}</Text>}
                      <Text style={styles.lbNewSub}>{t('community.membersWeeks', { members: item.membersCount, count: item.weeksActive })}</Text>
                      <Text style={styles.lbNewSub}>{t('community.totalPoints', { points: item.totalPointsEarned })}</Text>
                      {item.totalPointsEarned === 0 && <Text style={[styles.lbNewSub, { fontStyle: 'italic', color: '#999' }]}>{t('community.noSubmissions')}</Text>}
                    </>
                  ) : (
                    <View style={styles.evalCard}>
                      <View style={styles.lbNewHeader}>
                        <Text style={[styles.lbNewRank, { color: '#666' }]}>🕐  {item.societyName}</Text>
                        <Text style={styles.lbNewGrade}>[{t('community.eval')}] ⚪</Text>
                      </View>
                      <Text style={[styles.lbNewScore, { color: '#888', fontSize: 13 }]}>{t('home.rankingBegins')}</Text>
                      <Text style={[styles.lbNewSub, { color: '#888' }]}>{t('community.membersDays', { members: item.membersCount, count: item.daysSinceRegistration })}</Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
          {!isComputingLB && lbItems.length > 0 && !lbItems.some(s => !s.isEvaluating) && (
            <Text style={{ padding: 15, textAlign: 'center', color: '#888', fontStyle: 'italic' }}>
              {t('community.noneRanked')}
            </Text>
          )}
        </Card>

        <Text style={styles.sectionTitle}>{t('community.posts')}</Text>
        
        {user?.role === 'admin' && (
           <Card style={{ marginBottom: 15 }}>
             <TextInput 
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]} 
                multiline 
                placeholder={t('community.postPlaceholder')} 
                value={announcement} 
                onChangeText={setAnnouncement} 
              />
             <Button title={t('community.postButton')} onPress={postAnnouncement} />
           </Card>
        )}

        {visiblePosts.map(post => (
          <Card key={post.id} style={styles.postCard}>
            <View style={styles.postHeader}>
              <View style={styles.postAvatar}>
                <Text style={styles.avatarText}>{(post.user?post.user:post.title).charAt(0)}</Text>
              </View>
              <View>
                <Text style={styles.postUser}>{post.user || post.title}</Text>
                {post.isAdminAuthored && <Text style={{color: colors.primary, fontSize: 12, fontWeight: 'bold'}}>{t('community.adminAnnouncement')}</Text>}
                <Text style={styles.postTime}>{post.time || (post.timestamp ? new Date(post.timestamp).toLocaleString(getLocale()) : t('common.justNow'))}</Text>
              </View>
            </View>
            <Text style={styles.postContent}>{post.content || post.description}</Text>
            <View style={styles.postActions}>
              <TouchableOpacity style={styles.actionBtn}>
                <MaterialCommunityIcons name="heart-outline" size={20} color={colors.textSecondary} />
                <Text style={styles.actionText}>{t('community.like')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn}>
                <MaterialCommunityIcons name="comment-outline" size={20} color={colors.textSecondary} />
                <Text style={styles.actionText}>{t('community.comment')}</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ))}
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
  challengeCard: {
    backgroundColor: '#E8F5E9',
    borderColor: colors.primary,
    borderWidth: 1,
    marginBottom: 20,
  },
  challengeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  challengeBadge: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.primary,
  },
  challengeEnds: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  joinedNames: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  challengeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 15,
  },
  progressLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  progressBarBg: {
    height: 10,
    backgroundColor: '#C8E6C9',
    borderRadius: 5,
    marginBottom: 15,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 5,
  },
  joinButton: {
    paddingVertical: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 10,
    marginLeft: 5,
  },
  tipsScroll: {
    flexDirection: 'row',
    marginBottom: 20,
    overflow: 'visible',
  },
  tipCard: {
    width: width * 0.6,
    height: 100,
    marginRight: 15,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFF',
  },
  tipText: {
    fontSize: 16,
    textAlign: 'center',
    color: colors.textPrimary,
    fontWeight: '500',
  },
  statsCard: {
    padding: 15,
    marginBottom: 20,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  statText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  leaderboardCard: {
    padding: 0,
    marginBottom: 20,
    backgroundColor: 'transparent',
    elevation: 0,
    shadowOpacity: 0,
  },
  lbNewRow: {
    backgroundColor: '#FFF',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    position: 'relative',
    overflow: 'hidden',
  },
  mySocietyHighlight: {
    borderColor: colors.primary,
    backgroundColor: '#F1F8E9',
    borderWidth: 2,
  },
  mySocietyBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: colors.primary,
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderBottomLeftRadius: 8,
    zIndex: 1,
  },
  lbNewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  lbNewRank: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    flex: 1,
  },
  lbNewGrade: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textSecondary,
    marginLeft: 10,
  },
  lbNewScore: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 4,
  },
  lbNewSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  evalCard: {
    opacity: 0.8,
  },
  postCard: {
    marginBottom: 15,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  postAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  postUser: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  postTime: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  postContent: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
    marginBottom: 15,
  },
  postActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  actionText: {
    marginLeft: 5,
    color: colors.textSecondary,
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FAFAFA',
    marginBottom: 10,
  }
});

export default CommunityScreen;
