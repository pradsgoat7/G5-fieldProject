import React, { useContext, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Dimensions, TextInput } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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

const LEADERBOARD = [
  { rank: 1, name: 'Sun City Apartments', points: 15400 },
  { rank: 2, name: 'Green Valley Society', points: 12300 },
  { rank: 3, name: 'Oakwood Heights', points: 9800 },
  { rank: 4, name: 'Riverside Enclave', points: 8750 },
  { rank: 5, name: 'Pine Crest', points: 6400 },
];

const POSTS = [
  { id: '1', user: 'Anita M.', time: '2 hours ago', content: 'Just replaced all plastic containers with glass jars! Feels so much cleaner.' },
  { id: '2', user: 'Vikas S.', time: '5 hours ago', content: 'Our society just hit 1,000 kg of plastic recycled this year! Great job everyone! 🌍' },
  { id: '3', user: 'Priya K.', time: 'Yesterday', content: 'Found a great local store that sells grains in bulk without plastic bags.' },
];

const CommunityScreen = () => {
  const { challengeJoined, toggleChallenge, logActivity, societies, submissions, redemptions, user } = useContext(AppContext);
  const [announcement, setAnnouncement] = useState('');
  const [localPosts, setLocalPosts] = useState(POSTS);

  const handleJoin = async () => {
    await toggleChallenge();
    if (!challengeJoined) logActivity('Joined the Weekly Challenge!');
  };

  const postAnnouncement = () => {
    if (announcement.trim()) {
      const newPost = { 
        id: Date.now().toString(), 
        user: user.name + ' (Admin)', 
        time: 'Just now', 
        content: announcement, 
        societyCode: user.societyCode, 
        isAdminAuthored: true 
      };
      setLocalPosts([newPost, ...localPosts]);
      setAnnouncement('');
    }
  };

  const visiblePosts = localPosts.filter(p => !p.societyCode || p.societyCode === user?.societyCode);
  
  const leaderboard = societies.map(soc => {
     const socSubs = submissions.filter(s => s.societyCode === soc.societyCode);
     const socReds = redemptions.filter(r => r.societyCode === soc.societyCode);
     const earned = socSubs.reduce((acc, sub) => acc + (sub.points || 0), 0);
     const spent = socReds.reduce((acc, r) => acc + (r.pointsSpent || 0), 0);
     return { name: soc.societyName, points: earned - spent };
  }).sort((a,b) => b.points - a.points).slice(0, 5);

  const lbItems = societies.length > 0 ? leaderboard.map((l, i) => ({ rank: i+1, ...l })) : LEADERBOARD;

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

        <Text style={styles.sectionTitle}>Society Leaderboard (Top 5)</Text>
        <Card style={styles.leaderboardCard}>
          {lbItems.map((item, index) => (
            <View key={item.rank} style={[styles.lbRow, index < (Math.min(lbItems.length, 5) - 1) && styles.lbBorder]}>
              <View style={styles.lbLeft}>
                <Text style={styles.lbRank}>#{item.rank}</Text>
                <Text style={[styles.lbName, item.name === user?.societyName && styles.lbNameHighlight]}>{item.name}</Text>
              </View>
              <Text style={styles.lbPoints}>{item.points} pts</Text>
            </View>
          ))}
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
                <Text style={styles.avatarText}>{post.user.charAt(0)}</Text>
              </View>
              <View>
                <Text style={styles.postUser}>{post.user}</Text>
                {post.isAdminAuthored && <Text style={{color: colors.primary, fontSize: 12, fontWeight: 'bold'}}>📢 Admin Announcement</Text>}
                <Text style={styles.postTime}>{post.time}</Text>
              </View>
            </View>
            <Text style={styles.postContent}>{post.content}</Text>
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
  },
  lbRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
    alignItems: 'center',
  },
  lbBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  lbLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lbRank: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textSecondary,
    width: 30,
  },
  lbName: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  lbNameHighlight: {
    fontWeight: 'bold',
    color: colors.primary,
  },
  lbPoints: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.success,
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
