import React, { useContext, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, doc, getDoc, onSnapshot, updateDoc, writeBatch, serverTimestamp, increment } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AppContext } from '../context/AppContext';
import { colors } from '../theme/colors';
import Card from '../components/Card';
import Button from '../components/Button';
import PickupDetails, { StatusBadge } from '../components/PickupDetails';
import { showMessage, askConfirm } from '../services/dialogs';
import {
  PICKUP_STATUS, PICKUP_INTERVAL_DAYS, IMPACT_FACTOR, RECYCLABLE_MF, NON_RECYCLABLE_MF,
  sumKg, computeCategoryPoints, computePickupPoints, addDays, toDateString, formatDate
} from '../services/pickupService';

const PickupReviewScreen = ({ route, navigation }) => {
  const { pickupId } = route.params || {};
  const { user } = useContext(AppContext);
  const [pickup, setPickup] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [societyWard, setSocietyWard] = useState(undefined);

  useEffect(() => {
    if (!pickupId) return;
    const unsubscribe = onSnapshot(doc(db, "pickups", pickupId), (snap) => {
      if (snap.exists()) {
        setPickup({ id: snap.id, ...snap.data() });
      } else {
        setNotFound(true);
      }
    });
    return () => unsubscribe();
  }, [pickupId]);

  useEffect(() => {
    if (!pickup?.societyCode) return;
    getDoc(doc(db, "societies", pickup.societyCode))
      .then((snap) => setSocietyWard(snap.exists() ? (snap.data().ward || null) : null))
      .catch((e) => console.error("Error loading society ward", e));
  }, [pickup?.societyCode]);

  // Officials verify only their own ward; societies without a ward yet are open to any official
  const inMyWard = societyWard !== undefined && (!societyWard || societyWard === user?.ward);
  const canVerify = user?.role === 'bmc_official' && !!user?.ward && inMyWard && pickup?.status === PICKUP_STATUS.WEIGHED;
  const canConfirm = user?.role === 'admin' && pickup?.societyCode === user.societyCode && pickup?.status === PICKUP_STATUS.VERIFIED;

  const run = async (action) => {
    setIsSubmitting(true);
    try {
      await action();
    } catch (e) {
      console.error("Pickup review error:", e);
      showMessage('Error', 'Could not save. It may have already been updated by someone else.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const sendBack = async () => {
    if (!reason.trim()) {
      return showMessage('Reason needed', 'Explain what is wrong so the vendor can re-weigh correctly.');
    }
    const ok = await askConfirm('Send back for re-weighing?', `Reason: ${reason.trim()}`, 'Send Back');
    if (!ok) return;
    await run(async () => {
      await updateDoc(doc(db, "pickups", pickupId), {
        status: PICKUP_STATUS.SCHEDULED,
        lastRejection: {
          by: user.role,
          byName: user.name,
          reason: reason.trim(),
          at: Date.now()
        }
      });
      setReason('');
      showMessage('Sent back', 'The vendor will be asked to re-weigh this collection.');
      navigation.goBack();
    });
  };

  const approve = async () => {
    const ok = await askConfirm(
      'Approve this weighing?',
      `I confirm I witnessed ${pickup.totalKg.toFixed(2)} kg being weighed at ${pickup.societyName} and the grade ${pickup.grade} is correct.`,
      'Approve'
    );
    if (!ok) return;
    await run(async () => {
      await updateDoc(doc(db, "pickups", pickupId), {
        status: PICKUP_STATUS.VERIFIED,
        verifiedBy: user.uid,
        verifiedByName: user.name,
        verifiedAt: serverTimestamp()
      });
      showMessage('Verified', 'Sent to the society admin for final confirmation.');
      navigation.goBack();
    });
  };

  const confirm = async () => {
    const points = computePickupPoints(pickup.items, pickup.grade);
    const nextDate = addDays(toDateString(new Date()), PICKUP_INTERVAL_DAYS);
    const ok = await askConfirm(
      'Confirm collection?',
      `${pickup.totalKg.toFixed(2)} kg verified by ${pickup.verifiedByName} (BMC).\n\n+${points} points will be added to your society, and the next pickup will be scheduled for ${formatDate(nextDate)}.`,
      'Confirm'
    );
    if (!ok) return;

    await run(async () => {
      const batch = writeBatch(db);
      batch.update(doc(db, "pickups", pickupId), {
        status: PICKUP_STATUS.COMPLETED,
        confirmedBy: user.uid,
        confirmedByName: user.name,
        confirmedAt: serverTimestamp(),
        pointsAwarded: points
      });
      batch.update(doc(db, "societies", user.societyCode), {
        totalPointsEarned: increment(points)
      });

      // One history entry per category so the sustainability report can split recyclable vs non-recyclable
      ['recyclable', 'non_recyclable'].forEach(category => {
        const kg = sumKg(pickup.items, category);
        if (kg <= 0) return;
        batch.set(doc(collection(db, "exchange_submissions")), {
          societyCode: user.societyCode,
          category,
          plasticType: pickup.items.filter(i => i.category === category).map(i => i.name).join(', '),
          kg,
          impactFactor: IMPACT_FACTOR,
          multiplyingFactor: category === 'recyclable' ? RECYCLABLE_MF : NON_RECYCLABLE_MF,
          grade: pickup.grade,
          pointsEarned: computeCategoryPoints(kg, category, pickup.grade),
          source: 'verified_pickup',
          pickupId,
          submittedBy: user.uid,
          date: serverTimestamp()
        });
      });

      batch.set(doc(collection(db, "announcements")), {
        societyCode: user.societyCode,
        type: 'activity',
        title: 'Pickup Verified',
        description: `${pickup.totalKg.toFixed(2)} kg collected by ${pickup.vendorName}, verified by BMC (${pickup.verifiedByName}). +${points} points!`,
        timestamp: Date.now()
      });

      // Collections repeat every 15 days with the same vendor
      batch.set(doc(collection(db, "pickups")), {
        societyCode: pickup.societyCode,
        societyName: pickup.societyName,
        address: pickup.address || pickup.societyName,
        vendorUid: pickup.vendorUid,
        vendorName: pickup.vendorName,
        vendor: pickup.vendorName, // compatibility
        scheduledDate: nextDate,
        date: nextDate, // compatibility
        timeSlot: pickup.timeSlot,
        instructions: pickup.instructions || '',
        status: PICKUP_STATUS.SCHEDULED,
        scheduledBy: user.uid,
        createdAt: serverTimestamp()
      });

      await batch.commit();
      showMessage('Collection confirmed', `+${points} points added. Next pickup: ${formatDate(nextDate)}.`);
      navigation.goBack();
    });
  };

  if (notFound) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center' }]}>
        <Text style={styles.emptyText}>This pickup no longer exists.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 5 }}>
          <MaterialCommunityIcons name="arrow-left" size={26} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Collection Details</Text>
      </View>

      {!pickup ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Card>
            <View style={{ marginBottom: 10 }}>
              <StatusBadge status={pickup.status} />
            </View>
            <PickupDetails pickup={pickup} />
          </Card>

          {(canVerify || canConfirm) && (
            <Card>
              <Text style={styles.sectionTitle}>{canVerify ? 'BMC Verification' : 'Society Confirmation'}</Text>
              <Text style={styles.hint}>
                {canVerify
                  ? 'Approve only if you were present and the weights, grade and photo match what you saw.'
                  : 'Confirm only if these weights match what was collected from your society.'}
              </Text>
              <Button
                title={isSubmitting ? 'Saving...' : (canVerify ? 'Approve Weighing' : 'Confirm & Credit Points')}
                onPress={canVerify ? approve : confirm}
                disabled={isSubmitting}
                style={{ marginTop: 5 }}
              />
              <Text style={styles.label}>Something wrong?</Text>
              <TextInput
                style={styles.input}
                multiline
                placeholder={canVerify ? 'e.g. Scale reading does not match PET weight' : 'e.g. We handed over more than this'}
                value={reason}
                onChangeText={setReason}
              />
              <Button
                title={canVerify ? 'Send Back for Re-weighing' : 'Dispute & Ask to Re-weigh'}
                type="secondary"
                onPress={sendBack}
                disabled={isSubmitting}
              />
            </Card>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 15, paddingTop: 10, paddingBottom: 15,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0'
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: colors.primary, marginLeft: 10 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  emptyText: { textAlign: 'center', color: colors.textSecondary },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 4 },
  hint: { fontSize: 13, color: colors.textSecondary, marginBottom: 8 },
  label: { fontSize: 14, fontWeight: 'bold', color: colors.textSecondary, marginTop: 20, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 12, fontSize: 15,
    backgroundColor: '#FAFAFA', minHeight: 70, textAlignVertical: 'top', marginBottom: 10
  }
});

export default PickupReviewScreen;
