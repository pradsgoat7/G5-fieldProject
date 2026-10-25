import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { LANGUAGES, useTranslation } from '../i18n';

const LanguageToggle = ({ style }) => {
  const { t, language, setLanguage } = useTranslation();
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find(l => l.id === language) || LANGUAGES[0];

  return (
    <>
      <TouchableOpacity
        style={[styles.button, style]}
        onPress={() => setOpen(true)}
        accessibilityLabel={t('language.change')}
      >
        <MaterialCommunityIcons name="translate" size={18} color={colors.primary} />
        <Text style={styles.buttonText}>{current.short}</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.menu}>
            <Text style={styles.menuTitle}>{t('language.choose')}</Text>
            {LANGUAGES.map(l => (
              <TouchableOpacity
                key={l.id}
                style={[styles.option, l.id === language && styles.optionSelected]}
                onPress={() => {
                  setLanguage(l.id);
                  setOpen(false);
                }}
              >
                <Text style={[styles.optionText, l.id === language && styles.optionTextSelected]}>{l.label}</Text>
                {l.id === language && <MaterialCommunityIcons name="check" size={20} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.primary,
    borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#FFF'
  },
  buttonText: { color: colors.primary, fontWeight: 'bold', marginLeft: 4, fontSize: 14 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  menu: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, width: '100%', maxWidth: 320 },
  menuTitle: { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 8 },
  option: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, marginTop: 4
  },
  optionSelected: { backgroundColor: '#E8F5E9' },
  optionText: { fontSize: 17, color: colors.textPrimary },
  optionTextSelected: { fontWeight: 'bold', color: colors.primary }
});

export default LanguageToggle;
