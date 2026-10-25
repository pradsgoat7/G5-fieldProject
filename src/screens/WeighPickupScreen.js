import React, { useContext, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TextInput, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { doc, onSnapshot, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AppContext } from '../context/AppContext';
import { colors } from '../theme/colors';
import Card from '../components/Card';
import Button from '../components/Button';
import { showMessage, askConfirm } from '../services/dialogs';
import {
  PICKUP_STATUS, RECYCLABLE_TYPES, NON_RECYCLABLE_TYPES, GRADES,
  computePickupPoints, formatDate, captureScalePhoto, getCurrentLocation
} from '../services/pickupService';

const MAX_KG_PER_TYPE = 2000;

const WeighPickupScreen = ({ route, navigation }) => {
  const { pickupId } = route.params || {};
  const { user } = useContext(AppContext);
  const [pickup, setPickup] = useState(null);
  const [weights, setWeights] = useState({});
  const [grade, setGrade] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!pickupId) return;
    const unsubscribe = onSnapshot(doc(db, "pickups", pickupId), (snap) => {
      setPickup(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });
    return () => unsubscribe();
  }, [pickupId]);

  const allTypes = [
    ...RECYCLABLE_TYPES.map(t => ({ ...t, category: 'recyclable' })),
    ...NON_RECYCLABLE_TYPES.map(t => ({ ...t, category: 'non_recyclable' }))
  ];

  const items = allTypes
    .map(t => ({ id: t.id, name: t.name, category: t.category, kg: parseFloat(weights[t.id]) }))
    .filter(i => i.kg > 0);
  const totalKg = items.reduce((acc, i) => acc + i.kg, 0);

  const takePhoto = async () => {
    setIsCapturing(true);
    try {
      const dataUri = await captureScalePhoto();
      if (dataUri) setPhoto(dataUri);
    } catch (e) {
      showMessage('Photo failed', e.message);
    } finally {
      setIsCapturing(false);
    }
  };

  const submit = async () => {
    const invalid = Object.entries(weights).find(([, v]) => v !== '' && (isNaN(parseFloat(v)) || parseFloat(v) < 0 || parseFloat(v) > MAX_KG_PER_TYPE));
    if (invalid) {
      return showMessage('Invalid weight', `Each weight must be between 0 and ${MAX_KG_PER_TYPE} kg.`);
    }
    if (items.length === 0) return showMessage('No weights entered', 'Enter the weighed kg for at least one plastic type.');
    if (!grade) return showMessage('Grade missing', 'Select the segregation grade.');
    if (!photo) return showMessage('Photo missing', 'Take a photo of the weighing scale showing the reading.');

    const ok = await askConfirm(
      'Submit weighing?',
      `${totalKg.toFixed(2)} kg total, grade ${grade}.\n\nThis will be sent to the BMC official for verification. You cannot edit it afterwards.`,
      'Submit'
    );
    if (!ok) return;

    setIsSubmitting(true);
    try {
      const location = await getCurrentLocation();
      const batch = writeBatch(db);
      batch.set(doc(db, "pickup_photos", pickupId), {
        pickupId,
        societyCode: pickup.societyCode,
        dataUri: photo,
        uploadedBy: user.uid,
        createdAt: serverTimestamp()
      });
      batch.update(doc(db, "pickups", pickupId), {
        status: PICKUP_STATUS.WEIGHED,
        items,
        totalKg,
        kg: totalKg, // compatibility
        type: items.map(i => i.name).join(', '), // compatibility
        grade,
        hasPhoto: true,
        location,
        weighedAt: serverTimestamp(),
        weighedBy: user.uid
      });
      await batch.commit();
      showMessage('Submitted', 'Sent to the BMC official for verification.');
      navigation.goBack();
    } catch (e) {
      console.error("Weigh submit error:", e);
      showMessage('Error', 'Could not submit. Check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!pickup) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const canWeigh = pickup.status === PICKUP_STATUS.SCHEDULED && pickup.vendorUid === user.uid;

  const renderTypeInputs = (types, category) => types.map(t => (
    <View key={t.id} style={styles.weightRow}>
      <Text style={styles.weightLabel}>{category === 'recyclable' ? '♻️' : '🚫'} {t.name}</Text>
      <TextInput
        style={styles.weightInput}
        keyboardType="decimal-pad"
        placeholder="0"
        value={weights[t.id] || ''}
        onChangeText={(v) => setWeights({ ...weights, [t.id]: v })}
      />
      <Text style={styles.kgUnit}>kg</Text>
    </View>
  ));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 5 }}>
          <MaterialCommunityIcons name="arrow-left" size={26} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Weigh Collection</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card>
          <Text style={styles.societyName}>{pickup.societyName}</Text>
          <Text style={styles.detail}>{formatDate(pickup.scheduledDate)} • {pickup.timeSlot}</Text>
          {pickup.instructions ? <Text style={styles.detail}>Note: {pickup.instructions}</Text> : null}
        </Card>

        {!canWeigh ? (
          <Text style={styles.emptyText}>This collection has already been weighed.</Text>
        ) : (
          <>
            <Card>
              <Text style={styles.sectionTitle}>1. Weigh each type</Text>
              <Text style={styles.hint}>Leave blank if the society had none of that type.</Text>
              <Text style={styles.groupLabel}>Recyclable</Text>
              {renderTypeInputs(RECYCLABLE_TYPES, 'recyclable')}
              <Text style={styles.groupLabel}>Non-Recyclable</Text>
              {renderTypeInputs(NON_RECYCLABLE_TYPES, 'non_recyclable')}
              <Text style={styles.totalText}>Total: {totalKg.toFixed(2)} kg</Text>
            </Card>

            <Card>
              <Text style={styles.sectionTitle}>2. Segregation grade</Text>
              {GRADES.map(g => (
                <TouchableOpacity
                  key={g.id}
                  style={[styles.gradeOption, grade === g.id && styles.gradeSelected]}
                  onPress={() => setGrade(g.id)}
                >
                  <Text style={[styles.gradeLabel, grade === g.id && { color: '#FFF' }]}>{g.label}</Text>
                  <Text style={[styles.gradeDesc, grade === g.id && { color: '#FFF' }]}>{g.desc} • points ×{g.multiplier}</Text>
                </TouchableOpacity>
              ))}
            </Card>

            <Card>
              <Text style={styles.sectionTitle}>3. Photo of the scale</Text>
              <Text style={styles.hint}>Photograph the scale display with the waste on it so the reading is visible.</Text>
              {photo && <Image source={{ uri: photo }} style={styles.photo} resizeMode="contain" />}
              <Button
                title={isCapturing ? 'Processing photo...' : (photo ? 'Retake Photo' : 'Take Photo')}
                type={photo ? 'secondary' : 'primary'}
                onPress={takePhoto}
                disabled={isCapturing}
                style={{ marginTop: 10 }}
              />
            </Card>

            <Card style={{ backgroundColor: '#E8F5E9' }}>
              <Text style={styles.previewText}>
                Points for society: {grade ? computePickupPoints(items, grade) : '- (select grade)'}
              </Text>
              <Text style={styles.hint}>Your location is recorded when you submit.</Text>
            </Card>

            <Button
              title={isSubmitting ? 'Submitting...' : 'Submit for BMC Verification'}
              onPress={submit}
              disabled={isSubmitting}
              style={{ marginTop: 10 }}
            />
          </>
        )}
      </ScrollView>
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
  societyName: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary },
  detail: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  emptyText: { textAlign: 'center', color: colors.textSecondary, marginTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 4 },
  hint: { fontSize: 13, color: colors.textSecondary, marginBottom: 8 },
  groupLabel: { fontSize: 14, fontWeight: 'bold', color: colors.textSecondary, marginTop: 10, marginBottom: 4 },
  weightRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  weightLabel: { flex: 1, fontSize: 14, color: colors.textPrimary },
  weightInput: {
    width: 80, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8,
    paddingVertical: 6, paddingHorizontal: 10, fontSize: 15, backgroundColor: '#FAFAFA', textAlign: 'right'
  },
  kgUnit: { marginLeft: 6, color: colors.textSecondary, width: 20 },
  totalText: { fontSize: 15, fontWeight: 'bold', color: colors.primary, marginTop: 10, textAlign: 'right' },
  gradeOption: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, padding: 12, marginTop: 8, backgroundColor: '#FAFAFA' },
  gradeSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  gradeLabel: { fontSize: 15, fontWeight: 'bold', color: colors.textPrimary },
  gradeDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  photo: { width: '100%', height: 260, borderRadius: 8, backgroundColor: '#EEE', marginTop: 6 },
  previewText: { fontSize: 16, fontWeight: 'bold', color: colors.primary, marginBottom: 4 }
});

export default WeighPickupScreen;
