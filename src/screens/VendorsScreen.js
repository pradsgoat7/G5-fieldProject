import React, { useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TextInput, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AppContext } from '../context/AppContext';
import { colors } from '../theme/colors';
import Card from '../components/Card';
import Button from '../components/Button';

const VENDORS = [
  { id: '1', name: 'GreenCycle Recyclers', rating: '4.8' },
  { id: '2', name: 'EcoPickup Services', rating: '4.5' },
  { id: '3', name: 'CleanEarth Waste Mgmt', rating: '4.6' }
];

const RECYCLABLE_TYPES = [
  { id: 'pet', name: 'PET Bottles' },
  { id: 'hdpe', name: 'HDPE Containers' },
  { id: 'ldpe', name: 'LDPE Bags' },
  { id: 'pp', name: 'PP Containers' },
  { id: 'glass', name: 'Glass Bottles' },
  { id: 'cardboard', name: 'Cardboard / Paper' },
  { id: 'metal', name: 'Metal Cans' }
];

const NON_RECYCLABLE_TYPES = [
  { id: 'mlp', name: 'MLP Packaging' },
  { id: 'thermocol', name: 'Thermocol / EPS' },
  { id: 'pvc', name: 'PVC Plastic' },
  { id: 'contaminated', name: 'Contaminated Plastic' },
  { id: 'composite', name: 'Composite Packaging' },
  { id: 'cutlery', name: 'Disposable Cutlery' },
  { id: 'thin_film', name: 'Thin Plastic Films' }
];
const TIME_SLOTS = ['Morning (8am-12pm)', 'Afternoon (12pm-4pm)', 'Evening (4pm-7pm)'];

const VendorsScreen = () => {
  const { user } = useContext(AppContext);
  const [vendor, setVendor] = useState(VENDORS[0].name);
  const [recyclableTypes, setRecyclableTypes] = useState([]);
  const [nonRecyclableTypes, setNonRecyclableTypes] = useState([]);
  const [kg, setKg] = useState('');
  const [timeSlot, setTimeSlot] = useState(TIME_SLOTS[0]);
  const [instructions, setInstructions] = useState('');
  const [societyPickups, setSocietyPickups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "pickups"),
      where("societyCode", "==", user.societyCode),
      orderBy("date", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
      setSocietyPickups(data);
      setIsLoading(false);
    }, (error) => {
      console.log("Error fetching pickups", error);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const toggleRecyclable = (name) => {
    if (recyclableTypes.includes(name)) {
      setRecyclableTypes(recyclableTypes.filter(i => i !== name));
    } else {
      setRecyclableTypes([...recyclableTypes, name]);
    }
  };

  const toggleNonRecyclable = (name) => {
    if (nonRecyclableTypes.includes(name)) {
      setNonRecyclableTypes(nonRecyclableTypes.filter(i => i !== name));
    } else {
      setNonRecyclableTypes([...nonRecyclableTypes, name]);
    }
  };

  const schedulePickup = async () => {
    if (!kg || (recyclableTypes.length === 0 && nonRecyclableTypes.length === 0)) {
      Alert.alert('Error', 'Please enter estimated quantity and select at least one plastic type.');
      return;
    }

    const mergedTypes = [...recyclableTypes, ...nonRecyclableTypes];

    try {
      await addDoc(collection(db, "pickups"), {
        societyCode: user.societyCode,
        vendorName: vendor,
        vendor: vendor, // keeping vendor property for UI compatibility
        recyclableTypes,
        nonRecyclableTypes,
        plasticTypes: mergedTypes,
        type: mergedTypes.join(', '), // compatibility
        estimatedKg: parseFloat(kg),
        kg: parseFloat(kg), // compatibility
        date: new Date().toISOString().split('T')[0], // compatibility
        pickupDate: serverTimestamp(),
        timeSlot: timeSlot,
        address: user.societyName,
        instructions: instructions,
        status: 'Scheduled',
        scheduledBy: user.uid,
        createdAt: serverTimestamp()
      });

      await addDoc(collection(db, "announcements"), {
        societyCode: user.societyCode,
        type: 'activity',
        title: 'Pickup Scheduled',
        description: `Scheduled pickup with ${vendor}`,
        timestamp: Date.now()
      });

      Alert.alert(
        'Pickup Scheduled!',
        "You'll earn bonus points on completion.",
        [{ text: 'OK' }]
      );

      setKg('');
      setInstructions('');
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not schedule pickup. Check your connection.');
    }
  };

  const getStatusColor = (status) => {
    if (status === 'Completed') return colors.success;
    if (status === 'Cancelled') return colors.error;
    return colors.warning; // Scheduled
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="truck-delivery" size={28} color={colors.primary} />
        <Text style={styles.headerTitle}>Schedule a Pickup</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.subtitle}>Connect with authorized recycling vendors</Text>

        <Card style={styles.formCard}>
          <Text style={styles.label}>Select Vendor</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
            {VENDORS.map(v => (
              <TouchableOpacity
                key={v.id}
                style={[styles.pill, vendor === v.name && styles.pillSelected]}
                onPress={() => setVendor(v.name)}
              >
                <Text style={[styles.pillText, vendor === v.name && styles.pillTextSelected]}>
                  {v.name} ({v.rating}★)
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Recyclable Plastics (Multi-select)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
            {RECYCLABLE_TYPES.map(t => (
              <TouchableOpacity
                key={t.id}
                style={[styles.pill, recyclableTypes.includes(t.name) && styles.pillSelectedRecyclable]}
                onPress={() => toggleRecyclable(t.name)}
              >
                <Text style={[styles.pillText, recyclableTypes.includes(t.name) && styles.pillTextSelected]}>
                  {t.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Non-Recyclable Plastics (Multi-select)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
            {NON_RECYCLABLE_TYPES.map(t => (
              <TouchableOpacity
                key={t.id}
                style={[styles.pill, nonRecyclableTypes.includes(t.name) && styles.pillSelectedNonRecyclable]}
                onPress={() => toggleNonRecyclable(t.name)}
              >
                <Text style={[styles.pillText, nonRecyclableTypes.includes(t.name) && styles.pillTextSelected]}>
                  {t.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Estimated Quantity (kg)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="e.g. 5"
            value={kg}
            onChangeText={setKg}
          />

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
            placeholder="Apartment number, gate code, etc."
            value={instructions}
            onChangeText={setInstructions}
          />

          <Button title="Schedule Pickup" onPress={schedulePickup} style={{ marginTop: 15 }} />
        </Card>

        <Text style={styles.sectionTitle}>My Scheduled Pickups</Text>
        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : societyPickups.length === 0 ? (
          <Text style={styles.emptyText}>No pickups yet. Schedule your first one!</Text>
        ) : (
          societyPickups.map(p => (
            <Card key={p.id}>
              <View style={styles.pickupHeader}>
                <Text style={styles.vendorName}>{p.vendor}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(p.status) }]}>
                  <Text style={styles.statusText}>{p.status}</Text>
                </View>
              </View>
              <Text style={styles.pickupDetail}>Date: {p.date}</Text>
              <Text style={styles.pickupDetail}>Items: {p.kg} kg of {p.type}</Text>

              {p.status === 'Scheduled' && (
                <View style={{ flexDirection: 'row', marginTop: 15 }}>
                  <Button title="Mark Complete" type="primary" onPress={async () => {
                     try {
                       await updateDoc(doc(db, "pickups", p.id), { status: 'Completed' });
                       
                       await updateDoc(doc(db, "societies", user.societyCode), {
                         totalPointsEarned: increment(50)
                       });
                       await addDoc(collection(db, "exchange_submissions"), {
                          societyCode: user.societyCode,
                          plasticType: 'Pickup Bonus',
                          kg: 0,
                          pointsEarned: 50,
                          submittedBy: 'system',
                          date: serverTimestamp()
                       });
                       await addDoc(collection(db, "announcements"), {
                         societyCode: user.societyCode,
                         type: 'activity',
                         title: 'Pickup Completed',
                         description: `Completed pickup with ${p.vendor}`,
                         timestamp: Date.now()
                       });
                       Alert.alert('Pickup completed!', '+50 bonus points added to your society.');
                     } catch (e) {
                       Alert.alert('Error', 'Could not update pickup.');
                     }
                  }} style={{ flex: 1, marginRight: 5, paddingVertical: 8 }} />
                  <Button title="Cancel" type="secondary" onPress={async () => {
                     try {
                        await updateDoc(doc(db, "pickups", p.id), { status: 'Cancelled' });
                     } catch (e) {
                        Alert.alert('Error', 'Could not cancel pickup.');
                     }
                  }} style={{ flex: 1, marginLeft: 5, paddingVertical: 8 }} />
                </View>
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
  pickupDetail: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  }
});

export default VendorsScreen;
