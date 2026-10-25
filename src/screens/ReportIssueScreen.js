import React, { useContext, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TextInput, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AppContext } from '../context/AppContext';
import { colors } from '../theme/colors';
import Card from '../components/Card';
import Button from '../components/Button';
import WardPicker from '../components/WardPicker';
import ComplaintStatusBadge from '../components/ComplaintStatusBadge';
import { showMessage } from '../services/dialogs';
import { capturePhoto, getCurrentLocation, formatTimestamp } from '../services/pickupService';
import {
  COMPLAINT_CATEGORIES, complaintCategoryLabel, submitComplaint
} from '../services/complaintService';
import { useTranslation } from '../i18n';

const MAX_DESCRIPTION = 500;

const ReportIssueScreen = ({ navigation }) => {
  const { user } = useContext(AppContext);
  const { t } = useTranslation();
  const [category, setCategory] = useState(null);
  const [description, setDescription] = useState('');
  const [ward, setWard] = useState(user?.ward || null);
  const [photo, setPhoto] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [myReports, setMyReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "complaints"), where("reporterUid", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      // A just-submitted report has no server timestamp yet, so keep it on top
      const seconds = (c) => c.createdAt?.seconds ?? Number.MAX_SAFE_INTEGER;
      setMyReports(data.sort((a, b) => seconds(b) - seconds(a)));
      setIsLoading(false);
    }, (error) => {
      console.log("Error fetching my complaints", error);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const takePhoto = async () => {
    setIsCapturing(true);
    try {
      const dataUri = await capturePhoto();
      if (dataUri) setPhoto(dataUri);
    } catch (e) {
      showMessage(t('weigh.photoFailed'), e.message);
    } finally {
      setIsCapturing(false);
    }
  };

  const submit = async () => {
    if (!category) return showMessage(t('complaints.missingTitle'), t('complaints.missingCategory'));
    if (!description.trim()) return showMessage(t('complaints.missingTitle'), t('complaints.missingDescription'));
    if (!ward) return showMessage(t('complaints.missingTitle'), t('complaints.missingWard'));
    if (!photo) return showMessage(t('complaints.missingTitle'), t('complaints.missingPhoto'));

    setIsSubmitting(true);
    try {
      const location = await getCurrentLocation();
      await submitComplaint({ user, ward, category, description: description.trim(), photo, location });
      showMessage(t('complaints.submittedTitle'), t('complaints.submitted'));
      setCategory(null);
      setDescription('');
      setPhoto(null);
    } catch (e) {
      console.error("Complaint submit error:", e);
      showMessage(t('common.error'), t('common.connectionError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 5 }}>
          <MaterialCommunityIcons name="arrow-left" size={26} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('complaints.reportTitle')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.subtitle}>{t('complaints.reportIntro')}</Text>

        <Card>
          <Text style={styles.label}>{t('complaints.whatHappened')}</Text>
          <View style={styles.categoryGrid}>
            {COMPLAINT_CATEGORIES.map(c => (
              <TouchableOpacity
                key={c.id}
                style={[styles.categoryOption, category === c.id && styles.categorySelected]}
                onPress={() => setCategory(c.id)}
              >
                <MaterialCommunityIcons name={c.icon} size={22} color={category === c.id ? '#FFF' : colors.primary} />
                <Text style={[styles.categoryText, category === c.id && { color: '#FFF' }]}>{complaintCategoryLabel(c.id)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>{t('complaints.describe')}</Text>
          <TextInput
            style={styles.input}
            multiline
            maxLength={MAX_DESCRIPTION}
            placeholder={t('complaints.describePlaceholder')}
            value={description}
            onChangeText={setDescription}
          />

          <Text style={styles.label}>{t('complaints.ward')}</Text>
          <WardPicker value={ward} onChange={setWard} />

          <Text style={styles.label}>{t('complaints.photo')}</Text>
          {photo && <Image source={{ uri: photo }} style={styles.photo} resizeMode="contain" />}
          <Button
            title={isCapturing ? t('weigh.processingPhoto') : (photo ? t('weigh.retakePhoto') : t('weigh.takePhoto'))}
            type={photo ? 'secondary' : 'primary'}
            onPress={takePhoto}
            disabled={isCapturing}
          />
          <Text style={styles.hint}>{t('complaints.locationNote')}</Text>

          <Button
            title={isSubmitting ? t('weigh.submitting') : t('complaints.submit')}
            onPress={submit}
            disabled={isSubmitting}
            style={{ marginTop: 15 }}
          />
        </Card>

        <Text style={styles.sectionTitle}>{t('complaints.myReports')}</Text>
        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : myReports.length === 0 ? (
          <Text style={styles.emptyText}>{t('complaints.noReports')}</Text>
        ) : (
          myReports.map(c => (
            <TouchableOpacity key={c.id} onPress={() => navigation.navigate('ComplaintDetail', { complaintId: c.id })}>
              <Card>
                <View style={styles.reportHeader}>
                  <Text style={styles.reportTitle}>{complaintCategoryLabel(c.category)}</Text>
                  <ComplaintStatusBadge status={c.status} />
                </View>
                <Text style={styles.reportDetail} numberOfLines={2}>{c.description}</Text>
                <Text style={styles.reportMeta}>{formatTimestamp(c.createdAt)}</Text>
              </Card>
            </TouchableOpacity>
          ))
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
  subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 10 },
  label: { fontSize: 14, fontWeight: 'bold', color: colors.textSecondary, marginTop: 12, marginBottom: 8 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  categoryOption: {
    width: '48.5%', flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E0E0E0',
    borderRadius: 10, padding: 10, marginBottom: 8, backgroundColor: '#FAFAFA'
  },
  categorySelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryText: { fontSize: 13, color: colors.textPrimary, marginLeft: 8, flexShrink: 1 },
  input: {
    borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 12, fontSize: 15,
    backgroundColor: '#FAFAFA', minHeight: 80, textAlignVertical: 'top'
  },
  photo: { width: '100%', height: 220, borderRadius: 8, backgroundColor: '#EEE', marginBottom: 10 },
  hint: { fontSize: 12, color: colors.textSecondary, marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary, marginTop: 15, marginBottom: 5, marginLeft: 5 },
  emptyText: { textAlign: 'center', color: colors.textSecondary, marginTop: 10 },
  reportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  reportTitle: { fontSize: 15, fontWeight: 'bold', color: colors.textPrimary, flexShrink: 1, marginRight: 8 },
  reportDetail: { fontSize: 14, color: colors.textSecondary },
  reportMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 4 }
});

export default ReportIssueScreen;
