import React, { useContext, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, SafeAreaView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppContext } from '../context/AppContext';
import { colors } from '../theme/colors';
import Button from './Button';
import { BMC_WARDS, getWardLabel } from '../services/wards';
import { showMessage, askConfirm } from '../services/dialogs';
import { useTranslation } from '../i18n';

const WardPicker = ({ value, onChange, placeholder, style }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const selected = BMC_WARDS.find(w => w.id === value);

  return (
    <>
      <TouchableOpacity style={[styles.field, style]} onPress={() => setOpen(true)}>
        <Text style={selected ? styles.fieldText : styles.placeholder} numberOfLines={1}>
          {selected ? `${getWardLabel(selected.id)} – ${selected.areas}` : (placeholder || t('ward.select'))}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={22} color={colors.textSecondary} />
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <SafeAreaView style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t('ward.select')}</Text>
              <TouchableOpacity onPress={() => setOpen(false)} style={{ padding: 4 }}>
                <MaterialCommunityIcons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={BMC_WARDS}
              keyExtractor={w => w.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.option, item.id === value && styles.optionSelected]}
                  onPress={() => {
                    onChange(item.id);
                    setOpen(false);
                  }}
                >
                  <Text style={styles.optionTitle}>{getWardLabel(item.id)}</Text>
                  <Text style={styles.optionAreas}>{item.areas}</Text>
                </TouchableOpacity>
              )}
            />
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
};

// Shown to accounts created before wards existed; the ward can only be set once
export const WardSetupCard = ({ message }) => {
  const { setMyWard } = useContext(AppContext);
  const { t } = useTranslation();
  const [ward, setWard] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    if (!ward) return showMessage(t('ward.selectWardTitle'), t('ward.selectWardMessage'));
    const ok = await askConfirm(t('ward.confirmTitle'), t('ward.confirmMessage', { ward: getWardLabel(ward) }), t('ward.confirmButton'));
    if (!ok) return;
    setIsSaving(true);
    try {
      await setMyWard(ward);
    } catch (e) {
      console.error("setMyWard error:", e);
      showMessage(t('common.error'), t('ward.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.setupCard}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <MaterialCommunityIcons name="map-marker-alert" size={20} color={colors.warning} />
        <Text style={styles.setupTitle}>{t('ward.setupTitle')}</Text>
      </View>
      <Text style={styles.setupText}>{message}</Text>
      <WardPicker value={ward} onChange={setWard} />
      <Button title={isSaving ? t('common.saving') : t('ward.save')} onPress={save} disabled={isSaving} style={{ marginTop: 10, paddingVertical: 10 }} />
    </View>
  );
};

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 14, marginBottom: 15, backgroundColor: '#FAFAFA'
  },
  fieldText: { fontSize: 16, color: colors.textPrimary, flexShrink: 1, marginRight: 8 },
  placeholder: { fontSize: 16, color: '#9E9E9E', flexShrink: 1, marginRight: 8 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '80%' },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#EEE'
  },
  sheetTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary },
  option: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F3F3F3' },
  optionSelected: { backgroundColor: '#E8F5E9' },
  optionTitle: { fontSize: 15, fontWeight: 'bold', color: colors.textPrimary },
  optionAreas: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  setupCard: {
    backgroundColor: '#FFF8E1', borderRadius: 12, padding: 14, marginVertical: 10,
    borderWidth: 1, borderColor: '#FFE082'
  },
  setupTitle: { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, marginLeft: 6 },
  setupText: { fontSize: 13, color: colors.textSecondary, marginBottom: 10 }
});

export default WardPicker;
