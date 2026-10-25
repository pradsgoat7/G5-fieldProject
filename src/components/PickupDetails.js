import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { colors } from '../theme/colors';
import {
  statusLabel, getGrade, gradeLabel, plasticName, timeSlotLabel, sumKg, computeCategoryPoints, computePickupPoints, formatDate, formatTimestamp
} from '../services/pickupService';
import { useTranslation } from '../i18n';

const STATUS_COLORS = {
  Scheduled: colors.warning,
  Weighed: '#1976D2',
  Verified: '#7B1FA2',
  Completed: colors.success,
  Cancelled: colors.error
};

export const StatusBadge = ({ status }) => (
  <View style={[styles.badge, { backgroundColor: STATUS_COLORS[status] || colors.textSecondary }]}>
    <Text style={styles.badgeText}>{statusLabel(status)}</Text>
  </View>
);

const Row = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value}</Text>
  </View>
);

const TimelineStep = ({ done, title, detail }) => (
  <View style={styles.timelineStep}>
    <MaterialCommunityIcons
      name={done ? 'check-circle' : 'circle-outline'}
      size={20}
      color={done ? colors.success : '#BDBDBD'}
    />
    <View style={{ marginLeft: 8, flex: 1 }}>
      <Text style={[styles.timelineTitle, !done && { color: colors.textSecondary }]}>{title}</Text>
      {detail ? <Text style={styles.timelineDetail}>{detail}</Text> : null}
    </View>
  </View>
);

const PickupDetails = ({ pickup, showPhoto = true }) => {
  const { t } = useTranslation();
  const [photo, setPhoto] = useState(null);
  const [photoLoading, setPhotoLoading] = useState(false);

  const hasWeights = Array.isArray(pickup.items) && pickup.items.length > 0;

  useEffect(() => {
    if (!showPhoto || !pickup.hasPhoto) return;
    setPhotoLoading(true);
    getDoc(doc(db, "pickup_photos", pickup.id))
      .then((snap) => setPhoto(snap.exists() ? snap.data().dataUri : null))
      .catch((e) => console.error("Error loading scale photo", e))
      .finally(() => setPhotoLoading(false));
  }, [pickup.id, pickup.hasPhoto, pickup.weighedAt, showPhoto]);

  const openMap = () => {
    const { latitude, longitude } = pickup.location;
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`);
  };

  const recyclableKg = hasWeights ? sumKg(pickup.items, 'recyclable') : 0;
  const nonRecyclableKg = hasWeights ? sumKg(pickup.items, 'non_recyclable') : 0;

  return (
    <View>
      <Row label={t('pickup.society')} value={pickup.societyName || pickup.societyCode} />
      <Row label={t('pickup.vendor')} value={pickup.vendorName || pickup.vendor || '-'} />
      <Row label={t('pickup.pickupDate')} value={`${formatDate(pickup.scheduledDate || pickup.date)}${pickup.timeSlot ? ` • ${timeSlotLabel(pickup.timeSlot)}` : ''}`} />

      {pickup.lastRejection && pickup.status === 'Scheduled' && (
        <View style={styles.rejectionBox}>
          <Text style={styles.rejectionTitle}>
            {t('pickup.sentBackBy', { name: pickup.lastRejection.byName, by: pickup.lastRejection.by === 'bmc_official' ? t('pickup.byBmc') : t('pickup.bySociety') })}
          </Text>
          <Text style={styles.rejectionText}>{t('pickup.reason', { reason: pickup.lastRejection.reason })}</Text>
        </View>
      )}

      {hasWeights && (
        <>
          <Text style={styles.sectionLabel}>{t('pickup.weighedQuantities')}</Text>
          {pickup.items.map(item => (
            <View key={item.id} style={styles.itemRow}>
              <Text style={styles.itemName}>{item.category === 'recyclable' ? '♻️' : '🚫'} {plasticName(item.id, item.name)}</Text>
              <Text style={styles.itemKg}>{item.kg} kg</Text>
            </View>
          ))}
          <View style={styles.totalsBox}>
            <Row label={t('pickup.recyclable')} value={t('pickup.kgToPoints', { kg: recyclableKg.toFixed(2), points: computeCategoryPoints(recyclableKg, 'recyclable', pickup.grade) })} />
            <Row label={t('pickup.nonRecyclable')} value={t('pickup.kgToPoints', { kg: nonRecyclableKg.toFixed(2), points: computeCategoryPoints(nonRecyclableKg, 'non_recyclable', pickup.grade) })} />
            <Row label={t('pickup.grade')} value={`${gradeLabel(pickup.grade)} (×${getGrade(pickup.grade).multiplier})`} />
            <Row label={t('pickup.total')} value={t('pickup.kgToPoints', { kg: (pickup.totalKg || 0).toFixed(2), points: pickup.pointsAwarded ?? computePickupPoints(pickup.items, pickup.grade) })} />
          </View>

          <Text style={styles.sectionLabel}>{t('pickup.proof')}</Text>
          {pickup.location ? (
            <TouchableOpacity onPress={openMap} style={styles.locationRow}>
              <MaterialCommunityIcons name="map-marker" size={18} color={colors.primary} />
              <Text style={styles.locationText}>
                {pickup.location.latitude.toFixed(5)}, {pickup.location.longitude.toFixed(5)} {t('pickup.openInMaps')}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.warningText}>{t('pickup.noLocation')}</Text>
          )}

          {showPhoto && (
            photoLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
            ) : photo ? (
              <Image source={{ uri: photo }} style={styles.photo} resizeMode="contain" />
            ) : (
              <Text style={styles.warningText}>{t('pickup.noPhoto')}</Text>
            )
          )}
        </>
      )}

      <Text style={styles.sectionLabel}>{t('pickup.signOff')}</Text>
      <TimelineStep done title={t('pickup.stepScheduled')} detail={formatTimestamp(pickup.createdAt)} />
      <TimelineStep
        done={!!pickup.weighedAt && pickup.status !== 'Scheduled'}
        title={t('pickup.stepWeighed')}
        detail={pickup.weighedAt && pickup.status !== 'Scheduled' ? `${pickup.vendorName} • ${formatTimestamp(pickup.weighedAt)}` : null}
      />
      <TimelineStep
        done={!!pickup.verifiedAt && ['Verified', 'Completed'].includes(pickup.status)}
        title={t('pickup.stepVerified')}
        detail={pickup.verifiedAt && ['Verified', 'Completed'].includes(pickup.status) ? `${pickup.verifiedByName} • ${formatTimestamp(pickup.verifiedAt)}` : null}
      />
      <TimelineStep
        done={pickup.status === 'Completed'}
        title={t('pickup.stepConfirmed')}
        detail={pickup.confirmedAt ? `${pickup.confirmedByName} • ${formatTimestamp(pickup.confirmedAt)}` : null}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
  badgeText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 3 },
  rowLabel: { fontSize: 14, color: colors.textSecondary, marginRight: 10 },
  rowValue: { fontSize: 14, color: colors.textPrimary, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  sectionLabel: { fontSize: 15, fontWeight: 'bold', color: colors.textPrimary, marginTop: 16, marginBottom: 6 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  itemName: { fontSize: 14, color: colors.textPrimary },
  itemKg: { fontSize: 14, fontWeight: 'bold', color: colors.textPrimary },
  totalsBox: { backgroundColor: '#F1F8E9', borderRadius: 8, padding: 10, marginTop: 10 },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  locationText: { color: colors.primary, marginLeft: 4, fontSize: 14, textDecorationLine: 'underline' },
  warningText: { color: colors.warning, fontSize: 14, marginBottom: 8 },
  photo: { width: '100%', height: 300, borderRadius: 8, backgroundColor: '#EEE', marginTop: 4 },
  rejectionBox: { backgroundColor: '#FFEBEE', borderRadius: 8, padding: 10, marginTop: 10 },
  rejectionTitle: { color: colors.error, fontWeight: 'bold', fontSize: 14 },
  rejectionText: { color: colors.textPrimary, fontSize: 14, marginTop: 4 },
  timelineStep: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 5 },
  timelineTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  timelineDetail: { fontSize: 12, color: colors.textSecondary, marginTop: 2 }
});

export default PickupDetails;
