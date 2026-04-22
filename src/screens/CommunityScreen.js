import React, { useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Dimensions, TextInput, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { colors } from '../theme/colors';
import Card from '../components/Card';
import Button from '../components/Button';
import { AppContext } from '../context/AppContext';

const { width } = Dimensions.get('window');

const TIPS = [
  { id: '1', text: 'Carry a reusable bag 🛍️' },
  { id: '2', text: 'Refuse plastic straws 🥤' },
  { id: '3', text: 'Buy in bulk to reduce packaging 📦' },
  { id: '4', text: 'Choose glass or metal containers 🫙' },
  { id: '5', text: 'Opt for bar soap over plastic bottles 🧼' },
];



const POSTS = [
  { id: '1', user: 'Anita M.', time: '2 hours ago', content: 'Just replaced all plastic containers with glass jars! Feels so much cleaner.' },
  { id: '2', user: 'Vikas S.', time: '5 hours ago', content: 'Our society just hit 1,000 kg of plastic recycled this year! Great job everyone! 🌍' },
  { id: '3', user: 'Priya K.', time: 'Yesterday', content: 'Found a great local store that sells grains in bulk without plastic bags.' },
];

const CommunityScreen = () => {
  const { challengeJoined, toggleChallenge, user } = useContext(AppContext);
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

    return () => {
      unsubSocieties();
      unsubPosts();
    };
  }, [user]);

  const handleJoin = async () => {
    await toggleChallenge();
    if (!challengeJoined) logActivity('Joined the Weekly Challenge!');
  };

  const postAnnouncement = async () => {
    if (announcement.trim()) {
      try {
        await addDoc(collection(db, "announcements"), {
          societyCode: user.societyCode,
          type: 'announcement',
          title: 'Admin Post',
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
        <Text style={styles.headerTitle}>Community Hub</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.challengeCard}>
          <Text style={styles.challengeBadge}>🌟 Weekly Challenge</Text>
          <Text style={styles.challengeText}>Go bag-free for 7 days 🛍️</Text>
          <Text style={styles.progressLabel}>Society Participation: 67%</Text>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: '67%' }]} />
          </View>
          <Button 
            title={challengeJoined ? "Challenge Joined!" : "Join Challenge"} 
            type={challengeJoined ? "secondary" : "primary"}
            onPress={handleJoin}
            style={styles.joinButton} 
          />
        </Card>

        <Text style={styles.sectionTitle}>Plastic Reduction Tips</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tipsScroll}>
          {TIPS.map(tip => (
            <Card key={tip.id} style={styles.tipCard}>
              <Text style={styles.tipText}>{tip.text}</Text>
            </Card>
          ))}
        </ScrollView>

        <Text style={styles.sectionTitle}>Awareness Stats</Text>
        <Card style={styles.statsCard}>
          <View style={styles.statRow}>
            <MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.warning} />
            <Text style={styles.statText}>Plastic takes 400–1000 years to decompose.</Text>
          </View>
          <View style={styles.statRow}>
            <MaterialCommunityIcons name="recycle" size={20} color={colors.primary} />
            <Text style={styles.statText}>Only 9% of plastic ever produced has been recycled.</Text>
          </View>
          <View style={styles.statRow}>
            <MaterialCommunityIcons name="earth" size={20} color={colors.secondary} />
            <Text style={styles.statText}>India generates 3.5 million tonnes of plastic waste annually.</Text>
          </View>
        </Card>

        <Text style={styles.sectionTitle}>Society Leaderboard</Text>
        <Card style={styles.leaderboardCard}>
          {isComputingLB ? (
            <View style={{ padding: 30, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : lbItems.length === 0 ? (
            <Text style={{ padding: 20, textAlign: 'center', color: colors.textSecondary }}>No societies available.</Text>
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
              let gradeText = 'Eval';
              if (!item.isEvaluating) {
                gradeText = item.grade;
                if (item.grade === 'A') gradeIcon = '🟢';
                else if (item.grade === 'B') gradeIcon = '🟡';
                else if (item.grade === 'C') gradeIcon = '🔴';
              }

              return (
                <View key={item.societyCode} style={[styles.lbNewRow, isMySociety && styles.mySocietyHighlight]}>
                  {isMySociety && <Text style={styles.mySocietyBadge}>Your Society</Text>}
                  
                  {!item.isEvaluating ? (
                    <>
                      <View style={styles.lbNewHeader}>
                        <Text style={styles.lbNewRank}>{medal ? medal : `#${item.rank}`}  {item.societyName}</Text>
                        <Text style={styles.lbNewGrade}>[{gradeText}] {gradeIcon}</Text>
                      </View>
                      <Text style={styles.lbNewScore}>Score: {item.normalizedScore.toFixed(1)} pts/household/week</Text>
                      <Text style={styles.lbNewSub}>Members: {item.membersCount} | Active: {item.weeksActive} weeks</Text>
                      <Text style={styles.lbNewSub}>Total Points: {item.totalPointsEarned}</Text>
                      {item.totalPointsEarned === 0 && <Text style={[styles.lbNewSub, { fontStyle: 'italic', color: '#999' }]}>No submissions yet</Text>}
                    </>
                  ) : (
                    <View style={styles.evalCard}>
                      <View style={styles.lbNewHeader}>
                        <Text style={[styles.lbNewRank, { color: '#666' }]}>🕐  {item.societyName}</Text>
                        <Text style={styles.lbNewGrade}>[Eval] ⚪</Text>
                      </View>
                      <Text style={[styles.lbNewScore, { color: '#888', fontSize: 13 }]}>Ranking begins after 2 weeks</Text>
                      <Text style={[styles.lbNewSub, { color: '#888' }]}>Members: {item.membersCount} | Active: {item.daysSinceRegistration} days</Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
          {!isComputingLB && lbItems.length > 0 && !lbItems.some(s => !s.isEvaluating) && (
            <Text style={{ padding: 15, textAlign: 'center', color: '#888', fontStyle: 'italic' }}>
              No societies ranked yet. Rankings appear after 2 weeks of activity.
            </Text>
          )}
        </Card>

        <Text style={styles.sectionTitle}>Community Posts</Text>
        
        {user?.role === 'admin' && (
           <Card style={{ marginBottom: 15 }}>
             <TextInput 
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]} 
                multiline 
                placeholder="Post an announcement to your society..." 
                value={announcement} 
                onChangeText={setAnnouncement} 
              />
             <Button title="Post Announcement" onPress={postAnnouncement} />
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
                {post.isAdminAuthored && <Text style={{color: colors.primary, fontSize: 12, fontWeight: 'bold'}}>📢 Admin Announcement</Text>}
                <Text style={styles.postTime}>{post.time || (post.timestamp ? new Date(post.timestamp).toLocaleString() : 'Just now')}</Text>
              </View>
            </View>
            <Text style={styles.postContent}>{post.content || post.description}</Text>
            <View style={styles.postActions}>
              <TouchableOpacity style={styles.actionBtn}>
                <MaterialCommunityIcons name="heart-outline" size={20} color={colors.textSecondary} />
                <Text style={styles.actionText}>Like</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn}>
                <MaterialCommunityIcons name="comment-outline" size={20} color={colors.textSecondary} />
                <Text style={styles.actionText}>Comment</Text>
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
  challengeBadge: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 5,
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
