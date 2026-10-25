import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import Button from '../components/Button';
import Card from '../components/Card';
import { colors } from '../theme/colors';
import { useTranslation } from '../i18n';

const AdminSuccessScreen = ({ route, navigation }) => {
  const { societyCode } = route.params || {};
  const { t } = useTranslation();

  const handleCopyCode = async () => {
    if (societyCode) {
      await Clipboard.setStringAsync(societyCode);
      Alert.alert(t('common.copied'), t('common.copiedCode'), [{ text: t('common.ok') }]);
    }
  };

  const handleProceed = () => {
    navigation.navigate('Login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <MaterialCommunityIcons name="check-circle" size={80} color={colors.primary} style={styles.icon} />
        <Text style={styles.title}>{t('adminSuccess.title')}</Text>
        
        <Card style={styles.card}>
          <Text style={styles.cardSubtitle}>{t('adminSuccess.codeLabel')}</Text>
          <Text style={styles.codeText}>[ {societyCode} ]</Text>
          
          <TouchableOpacity style={styles.copyButton} onPress={handleCopyCode}>
            <MaterialCommunityIcons name="content-copy" size={20} color={colors.primary} />
            <Text style={styles.copyButtonText}>{t('adminSuccess.tapToCopy')}</Text>
          </TouchableOpacity>
        </Card>

        <Text style={styles.subtext}>
          {t('adminSuccess.share')}
        </Text>

        <Button 
          title={t('adminSuccess.proceed')} 
          onPress={handleProceed} 
          style={styles.proceedButton}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  icon: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 30,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    padding: 30,
    alignItems: 'center',
    marginBottom: 30,
  },
  cardSubtitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textSecondary,
    marginBottom: 15,
    letterSpacing: 1,
  },
  codeText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 20,
    letterSpacing: 2,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  copyButtonText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  subtext: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  proceedButton: {
    width: '100%',
  }
});

export default AdminSuccessScreen;
