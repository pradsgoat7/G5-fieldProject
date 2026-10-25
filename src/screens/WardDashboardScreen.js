import React, { useContext, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Pressable, ActivityIndicator, Platform, Share } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AppContext } from '../context/AppContext';
import { colors } from '../theme/colors';
import Card from '../components/Card';
import { showMessage } from '../services/dialogs';
import { WardSetupCard } from '../components/WardPicker';
import { getWardLabel } from '../services/wards';
import { GRADES, gradeLabel, plasticName, formatDate, toDateString } from '../services/pickupService';
import {
  PERIODS, periodLabel, societyStatusLabel, buildWardReport, buildMonthlyTrend, buildWardCsv
} from '../services/wardReport';
import { useTranslation, translate } from '../i18n';
import LanguageToggle from '../components/LanguageToggle';

// Validated categorical slots (colorblind-safe pair); text never uses these colors
const SERIES_RECYCLABLE = '#2a78d6';
const SERIES_NON_RECYCLABLE = '#eb6834';

const STATUS_ICON_COLORS = {
  overdue: colors.error,
  not_started: colors.textSecondary,
  inactive: colors.warning,
  active: colors.success
};

const formatKg = (kg) => translate('common.kg', { value: kg >= 100 ? Math.round(kg) : kg.toFixed(1) });
const formatPercent = (share) => (share === null ? '–' : `${Math.round(share * 100)}%`);

const HBar = ({ label, value, max, color, valueText }) => (
  <View style={styles.hbarRow}>
    <Text style={styles.hbarLabel} numberOfLines={1}>{label}</Text>
    <View style={styles.hbarTrack}>
      <View style={[styles.hbarFill, { width: `${max > 0 ? Math.max((value / max) * 100, value > 0 ? 2 : 0) : 0}%`, backgroundColor: color }]} />
    </View>
    <Text style={styles.hbarValue}>{valueText}</Text>
  </View>
);

const StatTile = ({ icon, iconColor, label, value }) => (
  <View style={styles.tile}>
    <View style={styles.tileHeader}>
      <MaterialCommunityIcons name={icon} size={16} color={iconColor || colors.textSecondary} />
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
    <Text style={styles.tileValue}>{value}</Text>
  </View>
);

const MonthlyTrend = ({ trend }) => {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(trend.length - 1);
  const max = Math.max(...trend.map(b => b.kg), 0);
  const current = trend[selected];

  return (
    <View>
      <Text style={styles.trendCaption}>
        {current.fullLabel}: <Text style={styles.trendCaptionValue}>{formatKg(current.kg)}</Text>
      </Text>
      <View style={styles.trendChart}>
        {trend.map((b, i) => (
          <Pressable
            key={b.key}
            style={styles.trendColumn}
            onPress={() => setSelected(i)}
            onHoverIn={() => setSelected(i)}
            accessibilityLabel={`${b.fullLabel}: ${formatKg(b.kg)}`}
          >
            <View style={styles.trendBarArea}>
              <View
                style={[
                  styles.trendBar,
                  { height: `${max > 0 ? Math.max((b.kg / max) * 100, b.kg > 0 ? 2 : 0) : 0}%` },
                  i !== selected && { opacity: 0.45 }
                ]}
              />
            </View>
            <Text style={[styles.trendLabel, i === selected && styles.trendLabelSelected]}>{b.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.chartNote}>{t('dashboard.tapMonth')}{max > 0 ? ` • ${t('dashboard.tallestBar', { kg: formatKg(max) })}` : ''}</Text>
    </View>
  );
};

const WardDashboardScreen = ({ navigation }) => {
  const { user, logout } = useContext(AppContext);
  const { t, language } = useTranslation();
  const [pickups, setPickups] = useState([]);
  const [societies, setSocieties] = useState([]);
  const [periodId, setPeriodId] = useState(PERIODS[0].id);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubPickups = onSnapshot(collection(db, "pickups"), (snapshot) => {
      setPickups(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setIsLoading(false);
    }, (error) => {
      console.log("Error fetching pickups for dashboard", error);
      setIsLoading(false);
    });
    const unsubSocieties = onSnapshot(collection(db, "societies"), (snapshot) => {
      setSocieties(snapshot.docs.map(d => d.data()));
    }, (error) => console.log("Error fetching societies for dashboard", error));
    return () => {
      unsubPickups();
      unsubSocieties();
    };
  }, []);

  const period = PERIODS.find(p => p.id === periodId);
  // Pickups are matched to the ward through their society, so older pickups without a ward field still count
  const wardSocieties = useMemo(() => societies.filter(s => s.ward && s.ward === user?.ward), [societies, user?.ward]);
  const wardPickups = useMemo(() => {
    const codes = new Set(wardSocieties.map(s => s.societyCode));
    return pickups.filter(p => codes.has(p.societyCode));
  }, [pickups, wardSocieties]);
  const unassignedSocieties = societies.filter(s => !s.ward).length;

  const report = useMemo(() => buildWardReport(wardPickups, wardSocieties, period.days), [wardPickups, wardSocieties, period.days]);
  // Month names are localized when the trend is built, so rebuild on language change
  const trend = useMemo(() => buildMonthlyTrend(wardPickups), [wardPickups, language]);
  const wardName = getWardLabel(user?.ward);

  const exportCsv = async () => {
    const csv = buildWardCsv(report, periodLabel(period), wardName);
    const fileName = `plastictrack-ward-report-${toDateString(new Date())}.csv`;
    try {
      if (Platform.OS === 'web') {
        // The BOM makes Excel read the file as UTF-8
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        await Share.share({ title: fileName, message: csv });
      }
    } catch (e) {
      console.error("CSV export error:", e);
      showMessage(t('dashboard.exportFailedTitle'), t('dashboard.exportFailed'));
    }
  };

  const maxMaterialKg = report.materials.length ? report.materials[0].kg : 0;
  const maxGradeCount = Math.max(...GRADES.map(g => report.gradeCounts[g.id]), 0);
  const attentionItems = [
    report.overdueSocieties > 0 && { icon: 'alert-circle', color: colors.error, text: t('dashboard.attentionOverdue', { count: report.overdueSocieties }) },
    report.awaitingVerification > 0 && { icon: 'shield-alert', color: colors.warning, text: t('dashboard.attentionAwaiting', { count: report.awaitingVerification }), onPress: () => navigation.navigate('Verify') },
    report.noPickupScheduled > 0 && { icon: 'calendar-remove', color: colors.textSecondary, text: t('dashboard.attentionNoPickup', { count: report.noPickupScheduled }) },
    unassignedSocieties > 0 && { icon: 'map-marker-question', color: colors.textSecondary, text: t('dashboard.attentionNoWard', { count: unassignedSocieties }) }
  ].filter(Boolean);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
          <MaterialCommunityIcons name="view-dashboard" size={28} color={colors.primary} />
          <Text style={styles.headerTitle}>{t('dashboard.title')}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <LanguageToggle style={{ marginRight: 8 }} />
          <TouchableOpacity onPress={logout} style={{ padding: 5 }}>
            <MaterialCommunityIcons name="logout" size={26} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.wardName}>{wardName}</Text>
        <Text style={styles.subtitle}>{t('dashboard.subtitle', { organization: user?.organization })}</Text>

        {!user?.ward && (
          <WardSetupCard message={t('ward.setupOfficialDashboard')} />
        )}

        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexShrink: 1 }}>
            {PERIODS.map(p => (
              <TouchableOpacity
                key={p.id}
                style={[styles.chip, periodId === p.id && styles.chipSelected]}
                onPress={() => setPeriodId(p.id)}
              >
                <Text style={[styles.chipText, periodId === p.id && styles.chipTextSelected]}>{periodLabel(p)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.exportButton} onPress={exportCsv} disabled={isLoading}>
            <MaterialCommunityIcons name="download" size={18} color={colors.primary} />
            <Text style={styles.exportText}>{t('dashboard.export')}</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            <Card>
              <Text style={styles.heroLabel}>{t('dashboard.heroLabel')}</Text>
              <Text style={styles.heroValue}>{formatKg(report.totalKg)}</Text>
              <Text style={styles.heroDetail}>
                {t('dashboard.heroDetail', { count: report.collections, share: formatPercent(report.recyclableShare), period: periodLabel(period) })}
              </Text>
            </Card>

            <View style={styles.tileGrid}>
              <StatTile icon="home-group" label={t('dashboard.activeSocieties')} value={`${report.activeSocieties} / ${report.totalSocieties}`} />
              <StatTile icon="star-circle" label={t('dashboard.gradeACollections')} value={formatPercent(report.gradeAShare)} />
              <StatTile icon="recycle" label={t('pickup.recyclable')} value={formatKg(report.recyclableKg)} />
              <StatTile icon="trash-can-outline" label={t('pickup.nonRecyclable')} value={formatKg(report.nonRecyclableKg)} />
            </View>

            {attentionItems.length > 0 && (
              <Card>
                <Text style={styles.cardTitle}>{t('dashboard.needsAttention')}</Text>
                {attentionItems.map(item => (
                  <TouchableOpacity key={item.text} style={styles.attentionRow} onPress={item.onPress} disabled={!item.onPress}>
                    <MaterialCommunityIcons name={item.icon} size={18} color={item.color} />
                    <Text style={styles.attentionText}>{item.text}</Text>
                    {item.onPress && <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textSecondary} />}
                  </TouchableOpacity>
                ))}
              </Card>
            )}

            <Card>
              <Text style={styles.cardTitle}>{t('dashboard.perMonth')}</Text>
              <Text style={styles.cardSubtitle}>{t('dashboard.perMonthSubtitle', { ward: wardName })}</Text>
              <MonthlyTrend trend={trend} />
            </Card>

            <Card>
              <Text style={styles.cardTitle}>{t('dashboard.byMaterial')}</Text>
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendSwatch, { backgroundColor: SERIES_RECYCLABLE }]} />
                  <Text style={styles.legendText}>{t('pickup.recyclable')}</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendSwatch, { backgroundColor: SERIES_NON_RECYCLABLE }]} />
                  <Text style={styles.legendText}>{t('pickup.nonRecyclable')}</Text>
                </View>
              </View>
              {report.materials.length === 0 ? (
                <Text style={styles.emptyText}>{t('dashboard.noCollections')}</Text>
              ) : (
                report.materials.map(m => (
                  <HBar
                    key={m.id || m.name}
                    label={plasticName(m.id, m.name)}
                    value={m.kg}
                    max={maxMaterialKg}
                    color={m.category === 'recyclable' ? SERIES_RECYCLABLE : SERIES_NON_RECYCLABLE}
                    valueText={formatKg(m.kg)}
                  />
                ))
              )}
            </Card>

            <Card>
              <Text style={styles.cardTitle}>{t('dashboard.segregation')}</Text>
              <Text style={styles.cardSubtitle}>{t('dashboard.segregationSubtitle')}</Text>
              {GRADES.map(g => {
                const count = report.gradeCounts[g.id];
                const share = report.collections ? count / report.collections : null;
                return (
                  <HBar
                    key={g.id}
                    label={gradeLabel(g.id)}
                    value={count}
                    max={maxGradeCount}
                    color={SERIES_RECYCLABLE}
                    valueText={`${count} (${formatPercent(share)})`}
                  />
                );
              })}
            </Card>

            <Card>
              <Text style={styles.cardTitle}>{t('dashboard.societies')}</Text>
              <Text style={styles.cardSubtitle}>{t('dashboard.societiesSubtitle', { period: periodLabel(period) })}</Text>
              {report.societies.length === 0 ? (
                <Text style={styles.emptyText}>{t('dashboard.noSocieties', { ward: wardName })}</Text>
              ) : (
                report.societies.map(s => (
                  <View key={s.societyCode} style={styles.societyRow}>
                    <View style={styles.societyHeader}>
                      <Text style={styles.societyName} numberOfLines={1}>{s.societyName}</Text>
                      <View style={styles.statusChip}>
                        <MaterialCommunityIcons name={s.status.icon} size={14} color={STATUS_ICON_COLORS[s.status.id]} />
                        <Text style={styles.statusText}>{societyStatusLabel(s.status)}</Text>
                      </View>
                    </View>
                    <Text style={styles.societyDetail}>
                      {formatKg(s.totalKg)} • {t('dashboard.kgPerMember', { kg: s.kgPerMember.toFixed(1) })} • {t('dashboard.collectionCount', { count: s.collections })}
                      {s.gradeAShare !== null ? ` • ${t('dashboard.gradeAShare', { share: formatPercent(s.gradeAShare) })}` : ''}
                    </Text>
                    <Text style={styles.societyDetail}>
                      {t('dashboard.lastVerified', { date: s.lastVerified ? formatDate(s.lastVerified) : t('dashboard.never') })} • {s.nextPickup ? t('dashboard.nextPickup', { date: formatDate(s.nextPickup) }) : t('dashboard.noPickupScheduled')}
                    </Text>
                  </View>
                ))
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 15,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0'
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: colors.primary, marginLeft: 10 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  wardName: { fontSize: 22, fontWeight: 'bold', color: colors.textPrimary },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 12 },
  filterRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  chip: {
    borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 20, paddingVertical: 7, paddingHorizontal: 14,
    backgroundColor: '#FAFAFA', marginRight: 8
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontSize: 13 },
  chipTextSelected: { color: '#FFF', fontWeight: 'bold' },
  exportButton: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.primary,
    borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12, marginLeft: 4, backgroundColor: '#FFF'
  },
  exportText: { color: colors.primary, fontWeight: 'bold', marginLeft: 4, fontSize: 13 },
  heroLabel: { fontSize: 14, color: colors.textSecondary },
  heroValue: { fontSize: 36, fontWeight: 'bold', color: colors.textPrimary, marginVertical: 4 },
  heroDetail: { fontSize: 13, color: colors.textSecondary },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: {
    width: '48.5%', backgroundColor: colors.card, borderRadius: 16, padding: 14, marginVertical: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3.84, elevation: 3
  },
  tileHeader: { flexDirection: 'row', alignItems: 'center' },
  tileLabel: { fontSize: 12, color: colors.textSecondary, marginLeft: 5, flexShrink: 1 },
  tileValue: { fontSize: 22, fontWeight: 'bold', color: colors.textPrimary, marginTop: 6 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary },
  cardSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2, marginBottom: 8 },
  emptyText: { color: colors.textSecondary, fontSize: 14, marginVertical: 8 },
  attentionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  attentionText: { flex: 1, fontSize: 14, color: colors.textPrimary, marginLeft: 8 },
  trendCaption: { fontSize: 14, color: colors.textSecondary, marginBottom: 8 },
  trendCaptionValue: { fontWeight: 'bold', color: colors.textPrimary },
  trendChart: { flexDirection: 'row' },
  trendColumn: { flex: 1, alignItems: 'center' },
  trendBarArea: {
    height: 130, width: '100%', justifyContent: 'flex-end', paddingHorizontal: 6,
    borderBottomWidth: 1, borderBottomColor: '#E0E0E0'
  },
  trendBar: { width: '100%', backgroundColor: SERIES_RECYCLABLE, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  trendLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  trendLabelSelected: { color: colors.textPrimary, fontWeight: 'bold' },
  chartNote: { fontSize: 11, color: colors.textSecondary, marginTop: 8 },
  legend: { flexDirection: 'row', marginTop: 6, marginBottom: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 16 },
  legendSwatch: { width: 12, height: 12, borderRadius: 3, marginRight: 6 },
  legendText: { fontSize: 13, color: colors.textSecondary },
  hbarRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  hbarLabel: { width: 125, fontSize: 13, color: colors.textPrimary, marginRight: 8 },
  hbarTrack: { flex: 1, height: 12, justifyContent: 'center' },
  hbarFill: { height: 12, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  hbarValue: { width: 78, fontSize: 13, color: colors.textSecondary, textAlign: 'right', marginLeft: 8 },
  societyRow: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  societyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  societyName: { fontSize: 15, fontWeight: 'bold', color: colors.textPrimary, flexShrink: 1, marginRight: 8 },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5',
    borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3
  },
  statusText: { fontSize: 12, color: colors.textPrimary, marginLeft: 4 },
  societyDetail: { fontSize: 13, color: colors.textSecondary, marginTop: 3 }
});

export default WardDashboardScreen;
