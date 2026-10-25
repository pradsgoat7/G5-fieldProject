import React, { useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AppContext } from '../context/AppContext';
import { colors } from '../theme/colors';
import Card from '../components/Card';
import Button from '../components/Button';

import { REWARDS, rewardTitle, rewardDesc, translateRewardName } from '../services/rewards';
import { useTranslation, getLocale } from '../i18n';

const RewardsScreen = ({ navigation }) => {
  const { user } = useContext(AppContext);
  const { t } = useTranslation();
  const [points, setPoints] = useState(0);
  const [redemptions, setRedemptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    const q = query(
      collection(db, "redemptions"),
      where("societyCode", "==", user.societyCode),
      orderBy("date", "desc")
    );
    const unsubscribeRedemptions = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
      setRedemptions(data);
    }, (error) => {
      console.log("Error fetching redemptions", error);
    });

    const societyDocRef = doc(db, "societies", user.societyCode);
    const unsubscribeSociety = onSnapshot(societyDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setPoints(docSnap.data().totalPointsEarned || 0);
      }
      setIsLoading(false);
    });

    return () => {
      unsubscribeRedemptions();
      unsubscribeSociety();
    };
  }, [user]);

  const redeem = (reward) => {
    Alert.alert(
      t('rewards.confirmTitle'),
      t('rewards.confirmMessage', { reward: rewardTitle(reward), points: reward.points }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { 
          text: t('rewards.redeem'), 
          onPress: async () => {
            try {
              await addDoc(collection(db, "redemptions"), {
                societyCode: user.societyCode,
                rewardName: reward.title,
                pointsSpent: reward.points,
                redeemedBy: user.uid,
                date: serverTimestamp()
              });
              
              await updateDoc(doc(db, "societies", user.societyCode), {
                totalPointsEarned: increment(-reward.points)
              });
              
              await addDoc(collection(db, "announcements"), {
                societyCode: user.societyCode,
                type: 'activity',
                title: t('rewards.announcementTitle'),
                description: t('rewards.announcement', { reward: rewardTitle(reward), points: reward.points }),
                timestamp: Date.now()
              });

              Alert.alert(t('calculator.successTitle'), t('rewards.success'));
            } catch (e) {
              console.error(e);
              Alert.alert(t('common.error'), t('common.connectionError'));
            }
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
        <Text style={styles.headerTitle}>{t('rewards.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.balanceContainer}>
          <Text style={styles.balanceLabel}>{t('rewards.balance')}</Text>
          <View style={styles.pointsRow}>
            <MaterialCommunityIcons name="star-circle" size={36} color="#FFD700" />
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 10 }} />
            ) : (
              <Text style={styles.balanceValue}>{t('common.pts', { value: points })}</Text>
            )}
          </View>
        </View>

        <Text style={styles.sectionTitle}>{t('rewards.catalogue')}</Text>
        
        {REWARDS.map(reward => {
          const canRedeem = points >= reward.points;
          return (
            <Card key={reward.id} style={styles.rewardCard}>
              <View style={styles.rewardHeader}>
                <View style={styles.iconContainer}>
                  <MaterialCommunityIcons name={reward.icon} size={32} color={colors.primary} />
                </View>
                <View style={styles.rewardInfo}>
                  <Text style={styles.rewardTitle}>{rewardTitle(reward)}</Text>
                  <Text style={styles.rewardPoints}>{t('rewards.points', { points: reward.points })}</Text>
                </View>
              </View>
              <Text style={styles.rewardDesc}>{rewardDesc(reward)}</Text>
              <Button 
                title={canRedeem ? t('rewards.redeemReward') : t('rewards.notEnough')} 
                onPress={() => redeem(reward)} 
                disabled={!canRedeem}
                style={styles.redeemButton}
              />
            </Card>
          );
        })}

        <Text style={styles.sectionTitle}>{t('rewards.history')}</Text>
        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : redemptions.length === 0 ? (
          <Text style={{ textAlign: 'center', color: colors.textSecondary, marginBottom: 20 }}>{t('rewards.noRedemptions')}</Text>
        ) : (
          redemptions.map(r => (
            <Card key={r.id} style={styles.historyCard}>
              <Text style={styles.historyTitle}>{translateRewardName(r.rewardName)}</Text>
              <View style={styles.historyDetails}>
                <Text style={styles.historyDate}>{r.date?.toDate ? r.date.toDate().toLocaleDateString(getLocale()) : t('common.justNow')}</Text>
                <Text style={styles.historyPoints}>{t('common.pts', { value: -r.pointsSpent })}</Text>
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
