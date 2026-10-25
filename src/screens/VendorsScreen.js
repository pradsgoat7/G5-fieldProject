import React, { useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot, addDoc, getDocs, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AppContext } from '../context/AppContext';
import { colors } from '../theme/colors';
import Card from '../components/Card';
import Button from '../components/Button';
import { StatusBadge } from '../components/PickupDetails';
import { showMessage, askConfirm } from '../services/dialogs';
import {
  PICKUP_STATUS, PICKUP_INTERVAL_DAYS, toDateString, addDays, daysUntil, describeCountdown, formatDate
} from '../services/pickupService';

const TIME_SLOTS = ['Morning (8am-12pm)', 'Afternoon (12pm-4pm)', 'Evening (4pm-7pm)'];
const ACTIVE_STATUSES = [PICKUP_STATUS.SCHEDULED, PICKUP_STATUS.WEIGHED, PICKUP_STATUS.VERIFIED];

const VendorsScreen = ({ navigation }) => {
  const { user } = useContext(AppContext);
  const [vendors, setVendors] = useState([]);
  const [vendorUid, setVendorUid] = useState(null);
  const [pickupDate, setPickupDate] = useState(toDateString(new Date()));
  const [timeSlot, setTimeSlot] = useState(TIME_SLOTS[0]);
  const [instructions, setInstructions] = useState('');
  const [societyPickups, setSocietyPickups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScheduling, setIsScheduling] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "pickups"), where("societyCode", "==", user.societyCode));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
      setSocietyPickups(data.sort((a, b) => (b.scheduledDate || b.date || '').localeCompare(a.scheduledDate || a.date || '')));
      setIsLoading(false);
    }, (error) => {
      console.log("Error fetching pickups", error);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    getDocs(query(collection(db, "users"), where("role", "==", "vendor")))
      .then((snapshot) => {
        const data = snapshot.docs.map(d => d.data());
        setVendors(data);
        if (data.length > 0) setVendorUid(data[0].uid);
      })
      .catch((e) => console.log("Error fetching vendors", e));
  }, []);

  // Pickups created before vendor accounts existed have no vendorUid and can't be weighed
  const activePickup = societyPickups.find(p => ACTIVE_STATUSES.includes(p.status) && p.vendorUid);
  const pastPickups = societyPickups.filter(p => p !== activePickup);

  const shiftDate = (days) => {
    const next = addDays(pickupDate, days);
    if (daysUntil(next) >= 0) setPickupDate(next);
  };

  const schedulePickup = async () => {
    const vendor = vendors.find(v => v.uid === vendorUid);
    if (!vendor) {
      return showMessage('No vendor selected', 'Select a registered vendor for the collection.');
    }
    setIsScheduling(true);
    try {
      const vendorName = `${vendor.name} (${vendor.organization})`;
      await addDoc(collection(db, "pickups"), {
        societyCode: user.societyCode,
        societyName: user.societyName,
        address: user.societyName,
        vendorUid: vendor.uid,
        vendorName,
        vendor: vendorName, // compatibility
        scheduledDate: pickupDate,
        date: pickupDate, // compatibility
        timeSlot,
        instructions,
        status: PICKUP_STATUS.SCHEDULED,
        scheduledBy: user.uid,
        createdAt: serverTimestamp()
      });

      await addDoc(collection(db, "announcements"), {
        societyCode: user.societyCode,
        type: 'activity',
        title: 'Pickup Scheduled',
        description: `Collection by ${vendorName} on ${formatDate(pickupDate)}`,
        timestamp: Date.now()
      });

      showMessage('Pickup Scheduled!', 'Points are credited after the vendor weighs it, a BMC official verifies it and you confirm.');
      setInstructions('');
    } catch (e) {
      console.error(e);
      showMessage('Error', 'Could not schedule pickup. Check your connection.');
    } finally {
      setIsScheduling(false);
    }
  };

  const cancelPickup = async (p) => {
    const ok = await askConfirm('Cancel pickup?', `Cancel the collection on ${formatDate(p.scheduledDate || p.date)}?`, 'Cancel Pickup');
    if (!ok) return;
    try {
      await updateDoc(doc(db, "pickups", p.id), { status: PICKUP_STATUS.CANCELLED });
    } catch (e) {
      console.error(e);
      showMessage('Error', 'Could not cancel pickup.');
    }
  };

  const renderActivePickup = (p) => {
    const days = daysUntil(p.scheduledDate);
    return (
      <Card style={styles.formCard}>
        <View style={styles.pickupHeader}>
          <Text style={styles.vendorName}>Next Collection</Text>
          <StatusBadge status={p.status} />
        </View>
        <Text style={styles.pickupDetail}>Vendor: {p.vendorName}</Text>
        <Text style={styles.pickupDetail}>Date: {formatDate(p.scheduledDate)} • {p.timeSlot}</Text>
        {p.status === PICKUP_STATUS.SCHEDULED && (
          <Text style={[styles.countdown, days < 0 && { color: colors.error }]}>{describeCountdown(p.scheduledDate)}</Text>
        )}
        {p.status === PICKUP_STATUS.SCHEDULED && p.lastRejection && (
          <Text style={styles.rejection}>Sent back by {p.lastRejection.byName}: {p.lastRejection.reason}</Text>
        )}
        {p.status === PICKUP_STATUS.WEIGHED && (
          <Text style={styles.pickupDetail}>Weighed: {(p.totalKg || 0).toFixed(2)} kg. Waiting for the BMC official to verify.</Text>
        )}
        {p.status === PICKUP_STATUS.VERIFIED && (
          <Text style={styles.pickupDetail}>Verified by {p.verifiedByName} (BMC). Please review and confirm.</Text>
        )}

        {p.status === PICKUP_STATUS.VERIFIED ? (
          <Button title="Review & Confirm" onPress={() => navigation.navigate('PickupReview', { pickupId: p.id })} style={{ marginTop: 15 }} />
        ) : p.status === PICKUP_STATUS.WEIGHED ? (
          <Button title="View Details" type="secondary" onPress={() => navigation.navigate('PickupReview', { pickupId: p.id })} style={{ marginTop: 15 }} />
        ) : (
          <Button title="Cancel Pickup" type="secondary" onPress={() => cancelPickup(p)} style={{ marginTop: 15 }} />
        )}
      </Card>
    );
  };

  const renderScheduleForm = () => (
    <Card style={styles.formCard}>
      <Text style={styles.label}>Select Vendor</Text>
      {vendors.length === 0 ? (
        <Text style={styles.pickupDetail}>No vendors have registered yet. Vendors sign up with the vendor invite code.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
          {vendors.map(v => (
            <TouchableOpacity
              key={v.uid}
              style={[styles.pill, vendorUid === v.uid && styles.pillSelected]}
              onPress={() => setVendorUid(v.uid)}
            >
              <Text style={[styles.pillText, vendorUid === v.uid && styles.pillTextSelected]}>
                {v.organization} ({v.name})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <Text style={styles.label}>Pickup Date</Text>
      <View style={styles.dateRow}>
        <TouchableOpacity onPress={() => shiftDate(-1)} style={styles.dateButton}>
          <MaterialCommunityIcons name="chevron-left" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.dateText}>{formatDate(pickupDate)}</Text>
        <TouchableOpacity onPress={() => shiftDate(1)} style={styles.dateButton}>
          <MaterialCommunityIcons name="chevron-right" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Preferred Time Slot</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
        {TIME_SLOTS.map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.pill, timeSlot === t && styles.pillSelected]}
            onPress={() => setTimeSlot(t)}
          >
            <Text style={[styles.pillText, timeSlot === t && styles.pillTextSelected]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.label}>Society Address</Text>
      <View style={styles.readOnlyInput}>
        <Text style={styles.readOnlyText}>{user?.societyName}</Text>
      </View>

      <Text style={styles.label}>Special Instructions</Text>
      <TextInput
        style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
        multiline
        placeholder="Collection point, gate number, etc."
        value={instructions}
        onChangeText={setInstructions}
      />

      <Button
        title={isScheduling ? 'Scheduling...' : 'Schedule Pickup'}
        onPress={schedulePickup}
        disabled={isScheduling || vendors.length === 0}
        style={{ marginTop: 15 }}
      />
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="truck-delivery" size={28} color={colors.primary} />
        <Text style={styles.headerTitle}>Vendor Pickups</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.subtitle}>
          Collections happen every {PICKUP_INTERVAL_DAYS} days. The vendor weighs your plastic, a BMC official verifies it, and you confirm before points are credited.
        </Text>

        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : activePickup ? renderActivePickup(activePickup) : renderScheduleForm()}

        <Text style={styles.sectionTitle}>Past Pickups</Text>
        {!isLoading && pastPickups.length === 0 ? (
          <Text style={styles.emptyText}>No past pickups yet.</Text>
        ) : (
          pastPickups.map(p => (
            <Card key={p.id}>
                <View style={styles.pickupHeader}>
                  <Text style={styles.vendorName}>{p.vendorName || p.vendor}</Text>
                  <StatusBadge status={p.status} />
                </View>
                <Text style={styles.pickupDetail}>Date: {formatDate(p.scheduledDate || p.date)}</Text>
                {p.kg ? <Text style={styles.pickupDetail}>Items: {Number(p.kg).toFixed(2)} kg of {p.type}</Text> : null}
                {p.pointsAwarded != null && <Text style={styles.points}>+{p.pointsAwarded} points</Text>}
                {p.items && (
                  <TouchableOpacity onPress={() => navigation.navigate('PickupReview', { pickupId: p.id })}>
                    <Text style={styles.detailsLink}>View weights, photo & sign-off →</Text>
                  </TouchableOpacity>
                )}
                {p.status === PICKUP_STATUS.SCHEDULED && (
                  <Button title="Cancel" type="secondary" onPress={() => cancelPickup(p)} style={{ marginTop: 10, paddingVertical: 8 }} />
                )}
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
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  formCard: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FAFAFA',
  },
  readOnlyInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#EEEEEE',
  },
  readOnlyText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  horizontalScroll: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  pill: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#FAFAFA',
    marginRight: 8,
  },
  pillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  pillTextSelected: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  pillSelectedRecyclable: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  pillSelectedNonRecyclable: {
    backgroundColor: '#FF9800',
    borderColor: '#FF9800',
  },
  pillText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  pillTextSelected: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 10,
    marginLeft: 5,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: 10,
  },
  pickupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  vendorName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FAFAFA',
  },
  dateButton: {
    padding: 10,
  },
  dateText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  countdown: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.warning,
    marginTop: 6,
  },
  rejection: {
    fontSize: 13,
    color: colors.error,
    marginTop: 6,
  },
  detailsLink: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.primary,
    marginTop: 8,
  },
  points: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.success,
    marginTop: 4,
  },
  pickupDetail: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  }
});

export default VendorsScreen;
