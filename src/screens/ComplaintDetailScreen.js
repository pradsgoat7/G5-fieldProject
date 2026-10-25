import React, { useContext, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TextInput, TouchableOpacity, Image, ActivityIndicator, Linking } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { doc, getDoc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AppContext } from '../context/AppContext';
import { colors } from '../theme/colors';
import Card from '../components/Card';
import Button from '../components/Button';
import ComplaintStatusBadge from '../components/ComplaintStatusBadge';
import { showMessage, askConfirm, describeError } from '../services/dialogs';
import { formatTimestamp } from '../services/pickupService';
import { getWardLabel } from '../services/wards';
import {
  COMPLAINT_STATUS, isComplaintOpen, complaintCategoryLabel, complaintCategoryIcon
} from '../services/complaintService';
import { useTranslation } from '../i18n';

const Step = ({ done, title, detail }) => (
  <View style={styles.step}>
    <MaterialCommunityIcons name={done ? 'check-circle' : 'circle-outline'} size={20} color={done ? colors.success : '#BDBDBD'} />
    <View style={{ marginLeft: 8, flex: 1 }}>
      <Text style={[styles.stepTitle, !done && { color: colors.textSecondary }]}>{title}</Text>
      {detail ? <Text style={styles.stepDetail}>{detail}</Text> : null}
    </View>
  </View>
);

const ComplaintDetailScreen = ({ route, navigation }) => {
  const { complaintId } = route.params || {};
  const { user } = useContext(AppContext);
  const { t } = useTranslation();
  const [complaint, setComplaint] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [photoLoading, setPhotoLoading] = useState(true);
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!complaintId) return;
    const unsubscribe = onSnapshot(doc(db, "complaints", complaintId), (snap) => {
      if (snap.exists()) setComplaint({ id: snap.id, ...snap.data() });
      else setNotFound(true);
    });
    getDoc(doc(db, "complaint_photos", complaintId))
      .then((snap) => setPhoto(snap.exists() ? snap.data().dataUri : null))
      .catch((e) => console.error("Error loading complaint photo", e))
      .finally(() => setPhotoLoading(false));
    return () => unsubscribe();
  }, [complaintId]);

  const canAct = user?.role === 'bmc_official' && !!user?.ward && complaint?.ward === user.ward && complaint && isComplaintOpen(complaint);

  const updateStatus = async (status, requireNote) => {
    if (requireNote && !note.trim()) {
      return showMessage(t('review.reasonNeededTitle'), t('complaints.noteNeeded'));
    }
    const confirmKey = { InProgress: 'complaints.confirmInProgress', Resolved: 'complaints.confirmResolve', Rejected: 'complaints.confirmReject' }[status];
    const ok = await askConfirm(t(confirmKey), note.trim() ? t('complaints.noteLabel', { note: note.trim() }) : '', t('common.yes'));
    if (!ok) return;

    setIsSaving(true);
    try {
      const fields = {
        status,
        handledBy: user.uid,
        handledByName: user.name,
        updatedAt: serverTimestamp()
      };
      if (status === COMPLAINT_STATUS.IN_PROGRESS) fields.inProgressAt = serverTimestamp();
      if (status === COMPLAINT_STATUS.RESOLVED || status === COMPLAINT_STATUS.REJECTED) {
        fields.closedAt = serverTimestamp();
        fields.resolutionNote = note.trim();
      }
      await updateDoc(doc(db, "complaints", complaintId), fields);
      setNote('');
    } catch (e) {
      console.error("Complaint update error:", e);
      showMessage(t('common.error'), e?.code === 'permission-denied' ? describeError(e) : t('review.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const openMap = () => {
    const { latitude, longitude } = complaint.location;
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`);
  };

  if (notFound) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center' }]}>
        <Text style={styles.emptyText}>{t('complaints.notFound')}</Text>
      </SafeAreaView>
    );
  }

  const closed = complaint && !isComplaintOpen(complaint);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 5 }}>
          <MaterialCommunityIcons name="arrow-left" size={26} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('complaints.detailTitle')}</Text>
      </View>

      {!complaint ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Card>
            <View style={styles.titleRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
                <MaterialCommunityIcons name={complaintCategoryIcon(complaint.category)} size={24} color={colors.primary} />
                <Text style={styles.title}>{complaintCategoryLabel(complaint.category)}</Text>
              </View>
              <ComplaintStatusBadge status={complaint.status} />
            </View>
            <Text style={styles.description}>{complaint.description}</Text>
            <Text style={styles.meta}>
              {t('complaints.reportedBy', { name: complaint.reporterName, society: complaint.societyName || '-' })}
            </Text>
            <Text style={styles.meta}>{getWardLabel(complaint.ward)} • {formatTimestamp(complaint.createdAt)}</Text>

            {complaint.location ? (
              <TouchableOpacity onPress={openMap} style={styles.locationRow}>
                <MaterialCommunityIcons name="map-marker" size={18} color={colors.primary} />
                <Text style={styles.locationText}>
                  {complaint.location.latitude.toFixed(5)}, {complaint.location.longitude.toFixed(5)} {t('pickup.openInMaps')}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.warningText}>{t('complaints.noLocation')}</Text>
            )}

            {photoLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
            ) : photo ? (
              <Image source={{ uri: photo }} style={styles.photo} resizeMode="contain" />
            ) : (
              <Text style={styles.warningText}>{t('complaints.noPhoto')}</Text>
            )}

            <Text style={styles.sectionLabel}>{t('complaints.progress')}</Text>
            <Step done title={t('complaints.stepReported')} detail={formatTimestamp(complaint.createdAt)} />
            <Step
              done={!!complaint.inProgressAt || closed}
              title={t('complaints.stepInProgress')}
              detail={complaint.inProgressAt ? formatTimestamp(complaint.inProgressAt) : null}
            />
            <Step
              done={closed}
              title={complaint.status === COMPLAINT_STATUS.REJECTED ? t('complaints.stepRejected') : t('complaints.stepResolved')}
              detail={closed ? `${complaint.handledByName} • ${formatTimestamp(complaint.closedAt)}` : null}
            />
            {complaint.resolutionNote ? (
              <View style={styles.noteBox}>
                <Text style={styles.noteText}>{t('complaints.officialNote', { note: complaint.resolutionNote })}</Text>
              </View>
            ) : null}
          </Card>

          {canAct && (
            <Card>
              <Text style={styles.sectionLabel}>{t('complaints.actionTitle')}</Text>
              {complaint.status === COMPLAINT_STATUS.OPEN && (
                <Button
                  title={t('complaints.markInProgress')}
                  type="secondary"
                  onPress={() => updateStatus(COMPLAINT_STATUS.IN_PROGRESS, false)}
                  disabled={isSaving}
                  style={{ marginBottom: 12 }}
                />
              )}
              <TextInput
                style={styles.input}
                multiline
                placeholder={t('complaints.notePlaceholder')}
                value={note}
                onChangeText={setNote}
              />
              <Button
                title={isSaving ? t('common.saving') : t('complaints.markResolved')}
                onPress={() => updateStatus(COMPLAINT_STATUS.RESOLVED, true)}
                disabled={isSaving}
                style={{ marginBottom: 10 }}
              />
              <Button
                title={t('complaints.reject')}
                type="secondary"
                onPress={() => updateStatus(COMPLAINT_STATUS.REJECTED, true)}
                disabled={isSaving}
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
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { fontSize: 17, fontWeight: 'bold', color: colors.textPrimary, marginLeft: 8, flexShrink: 1 },
  description: { fontSize: 15, color: colors.textPrimary, marginBottom: 8 },
  meta: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  locationText: { color: colors.primary, marginLeft: 4, fontSize: 14, textDecorationLine: 'underline' },
  warningText: { color: colors.warning, fontSize: 14, marginTop: 8 },
  photo: { width: '100%', height: 280, borderRadius: 8, backgroundColor: '#EEE', marginTop: 10 },
  sectionLabel: { fontSize: 15, fontWeight: 'bold', color: colors.textPrimary, marginTop: 16, marginBottom: 6 },
  step: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 5 },
  stepTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  stepDetail: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  noteBox: { backgroundColor: '#F1F8E9', borderRadius: 8, padding: 10, marginTop: 8 },
  noteText: { fontSize: 14, color: colors.textPrimary },
  input: {
    borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 12, fontSize: 15,
    backgroundColor: '#FAFAFA', minHeight: 70, textAlignVertical: 'top', marginBottom: 10
  }
});

export default ComplaintDetailScreen;
