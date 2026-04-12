import React, { useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, Alert, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppContext } from '../context/AppContext';
import { colors } from '../theme/colors';
import Card from '../components/Card';
import Button from '../components/Button';

const REWARDS = [
  { id: '1', title: 'Water Bill Discount', points: 500, desc: 'Get ₹100 off your next water bill.', icon: 'water-percent' },
  { id: '2', title: 'Property Tax Reduction', points: 1000, desc: 'Avail a 2% discount on municipal tax.', icon: 'home-city-outline' },
  { id: '3', title: 'Sustainability Certificate', points: 300, desc: 'Official digital certificate of impact.', icon: 'certificate-outline' },
  { id: '4', title: 'Recognition Badge', points: 200, desc: 'Special badge in the community hub.', icon: 'medal-outline' },
  { id: '5', title: 'Free Recycling Pickup', points: 150, desc: 'One scheduled pickup free of cost.', icon: 'recycle' },
];

const RewardsScreen = ({ navigation }) => {
  const { points, addRedemption, redemptions, logActivity } = useContext(AppContext);

  const redeem = (reward) => {
    Alert.alert(
      'Confirm Redemption',
      `Redeem ${reward.title} for ${reward.points} points?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Redeem', 
          onPress: async () => {
            await addRedemption({ id: Date.now().toString(), rewardName: reward.title, pointsSpent: reward.points, date: new Date().toISOString() });
            logActivity(`Redeemed ${reward.title}`);
            Alert.alert('Success', 'Reward redeemed successfully!');
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Rewards</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.balanceContainer}>
          <Text style={styles.balanceLabel}>Current Balance</Text>
          <View style={styles.pointsRow}>
            <MaterialCommunityIcons name="star-circle" size={36} color="#FFD700" />
            <Text style={styles.balanceValue}>{points} pts</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Rewards Catalogue</Text>
        
        {REWARDS.map(reward => {
          const canRedeem = points >= reward.points;
          return (
            <Card key={reward.id} style={styles.rewardCard}>
              <View style={styles.rewardHeader}>
                <View style={styles.iconContainer}>
                  <MaterialCommunityIcons name={reward.icon} size={32} color={colors.primary} />
                </View>
                <View style={styles.rewardInfo}>
                  <Text style={styles.rewardTitle}>{reward.title}</Text>
                  <Text style={styles.rewardPoints}>{reward.points} points</Text>
                </View>
              </View>
              <Text style={styles.rewardDesc}>{reward.desc}</Text>
              <Button 
                title={canRedeem ? "Redeem Reward" : "Not Enough Points"} 
                onPress={() => redeem(reward)} 
                disabled={!canRedeem}
                style={styles.redeemButton}
              />
            </Card>
          );
        })}

        <Text style={styles.sectionTitle}>Redemption History</Text>
        {redemptions.length === 0 ? (
          <Text style={{ textAlign: 'center', color: colors.textSecondary, marginBottom: 20 }}>No redemptions yet.</Text>
        ) : (
          redemptions.map(r => (
            <Card key={r.id} style={styles.historyCard}>
              <Text style={styles.historyTitle}>{r.rewardName}</Text>
              <View style={styles.historyDetails}>
                <Text style={styles.historyDate}>{new Date(r.date).toLocaleDateString()}</Text>
                <Text style={styles.historyPoints}>-{r.pointsSpent} pts</Text>
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  balanceContainer: {
    alignItems: 'center',
    marginBottom: 25,
  },
  balanceLabel: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 5,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginLeft: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 15,
    marginLeft: 5,
  },
  rewardCard: {
    marginBottom: 15,
    padding: 20,
  },
  rewardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 12,
    marginRight: 15,
  },
  rewardInfo: {
    flex: 1,
  },
  rewardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  rewardPoints: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  rewardDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 15,
  },
  redeemButton: {
    paddingVertical: 12,
  },
  historyCard: {
    padding: 15,
    marginBottom: 10,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 5,
  },
  historyDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historyDate: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  historyPoints: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.error,
  }
});

export default RewardsScreen;
