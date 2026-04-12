import React, { useContext, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TextInput, Alert, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppContext } from '../context/AppContext';
import { colors } from '../theme/colors';
import Card from '../components/Card';
import Button from '../components/Button';

const VENDORS = [
  { id: '1', name: 'GreenCycle Recyclers', rating: '4.8' },
  { id: '2', name: 'EcoPickup Services', rating: '4.5' },
  { id: '3', name: 'CleanEarth Waste Mgmt', rating: '4.6' }
];

const PLASTIC_TYPES = ['PET Bottles', 'HDPE Constants', 'Plastic Bags', 'Mixed'];
const TIME_SLOTS = ['Morning (8am-12pm)', 'Afternoon (12pm-4pm)', 'Evening (4pm-7pm)'];

const VendorsScreen = () => {
  const { user, societyPickups, addPickup, logActivity, updatePickupStatus } = useContext(AppContext);
  const [vendor, setVendor] = useState(VENDORS[0].name);
  const [types, setTypes] = useState(['PET Bottles']);
  const [kg, setKg] = useState('');
  const [timeSlot, setTimeSlot] = useState(TIME_SLOTS[0]);
  const [instructions, setInstructions] = useState('');

  const toggleType = (t) => {
    if (types.includes(t)) {
      setTypes(types.filter(i => i !== t));
    } else {
      setTypes([...types, t]);
    }
  };

  const schedulePickup = async () => {
    if (!kg || types.length === 0) {
      Alert.alert('Error', 'Please enter estimated quantity and select at least one plastic type.');
      return;
    }

    Alert.alert(
      'Pickup Scheduled!',
      "You'll earn bonus points on completion.",
      [{ text: 'OK' }]
    );

    const newPickup = {
      id: Date.now().toString(),
      vendor: vendor,
      date: new Date().toISOString().split('T')[0],
      type: types.join(', '),
      kg: parseFloat(kg),
      status: 'Scheduled'
    };

    await addPickup(newPickup);
    logActivity(`Scheduled pickup with ${vendor}`);

    setKg('');
    setInstructions('');
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

          <Text style={styles.label}>Plastic Type (Multi-select)</Text>
          <View style={styles.checkboxContainer}>
            {PLASTIC_TYPES.map(t => (
              <TouchableOpacity key={t} style={styles.checkboxRow} onPress={() => toggleType(t)}>
                <MaterialCommunityIcons 
                  name={types.includes(t) ? 'checkbox-marked' : 'checkbox-blank-outline'} 
                  size={24} 
                  color={colors.primary} 
                />
                <Text style={styles.checkboxLabel}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

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
        {societyPickups.length === 0 ? (
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
                     await updatePickupStatus(p.id, 'Completed');
                     Alert.alert('Pickup completed!', '+50 bonus points added to your society.');
                     logActivity(`Completed pickup with ${p.vendor}`);
                  }} style={{ flex: 1, marginRight: 5, paddingVertical: 8 }} />
                  <Button title="Cancel" type="secondary" onPress={async () => {
                     await updatePickupStatus(p.id, 'Cancelled');
                     logActivity(`Cancelled pickup with ${p.vendor}`);
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
  checkboxContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '50%',
    marginBottom: 10,
  },
  checkboxLabel: {
    marginLeft: 8,
    fontSize: 14,
    color: colors.textPrimary,
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
