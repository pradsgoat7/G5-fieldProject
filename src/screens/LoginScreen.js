import React, { useContext, useState } from 'react';
import { View, Text, TextInput, StyleSheet, SafeAreaView, Alert, ScrollView, TouchableOpacity, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppContext } from '../context/AppContext';
import Button from '../components/Button';
import Card from '../components/Card';
import { colors } from '../theme/colors';
import WardPicker from '../components/WardPicker';
import LanguageToggle from '../components/LanguageToggle';
import { useTranslation } from '../i18n';

const LoginScreen = ({ navigation }) => {
  const { loginByCredentials, registerAdmin, registerMember, registerStaff } = useContext(AppContext);
  const { t } = useTranslation();
  const [mode, setMode] = useState('login'); // login | register_member | register_admin | register_staff

  const [name, setName] = useState('');
  const [societyName, setSocietyName] = useState('');
  const [societyCode, setSocietyCode] = useState('');
  const [organization, setOrganization] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [ward, setWard] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const executeAction = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      if (mode === 'login') {
        if (!email || !password) {
          Platform.OS === 'web' ? window.alert(t('login.enterEmailPassword')) : Alert.alert(t('common.error'), t('login.enterEmailPassword'));
          return;
        }
        await loginByCredentials(email, password);
      } else if (mode === 'register_admin') {
        if (!name || !email || !password || !societyName || !ward) {
          Platform.OS === 'web' ? window.alert(t('login.fillAllFields')) : Alert.alert(t('common.error'), t('login.fillAllFields'));
          return;
        }
        if (password !== confirmPassword) {
          Platform.OS === 'web' ? window.alert(t('login.passwordsDontMatch')) : Alert.alert(t('common.error'), t('login.passwordsDontMatch'));
          return;
        }
        const code = await registerAdmin(name, societyName, ward, email, password);
        
        if (Platform.OS === 'web') {
          window.alert(`${t('login.societyRegistered')}\n\n${t('login.societyCodeMessage', { code })}`);
          setMode('login');
          setPassword('');
          setConfirmPassword('');
          navigation.navigate("AdminSuccess", { societyCode: code });
        } else {
          Alert.alert(
            t('login.societyRegistered'),
            t('login.societyCodeMessage', { code }),
            [
              {
                text: t('login.copyCode'),
                onPress: async () => {
                  await Clipboard.setStringAsync(code);
                  setMode('login');
                  setPassword('');
                  setConfirmPassword('');
                  navigation.navigate("AdminSuccess", { societyCode: code });
                }
              },
              {
                text: t('login.gotIt'),
                onPress: () => {
                  setMode('login');
                  setPassword('');
                  setConfirmPassword('');
                  navigation.navigate("AdminSuccess", { societyCode: code });
                }
              }
            ]
          );
        }
      } else if (mode === 'register_member') {
        if (!name || !email || !password || !societyCode) {
          Platform.OS === 'web' ? window.alert(t('login.fillAllFields')) : Alert.alert(t('common.error'), t('login.fillAllFields'));
          return;
        }
        if (password !== confirmPassword) {
          Platform.OS === 'web' ? window.alert(t('login.passwordsDontMatch')) : Alert.alert(t('common.error'), t('login.passwordsDontMatch'));
          return;
        }
        await registerMember(name, email, societyCode, password);
      } else if (mode === 'register_staff') {
        if (!name || !organization || !ward || !inviteCode || !email || !password) {
          Platform.OS === 'web' ? window.alert(t('login.fillAllFields')) : Alert.alert(t('common.error'), t('login.fillAllFields'));
          return;
        }
        if (password !== confirmPassword) {
          Platform.OS === 'web' ? window.alert(t('login.passwordsDontMatch')) : Alert.alert(t('common.error'), t('login.passwordsDontMatch'));
          return;
        }
        await registerStaff(name, organization, ward, inviteCode, email, password);
      }
    } catch (e) {
      Platform.OS === 'web' ? window.alert(e.message) : Alert.alert(t('common.error'), e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        <View style={{ alignItems: 'flex-end' }}>
          <LanguageToggle />
        </View>
        <View style={styles.header}>
          <MaterialCommunityIcons name="leaf" size={48} color={colors.primary} />
          <Text style={styles.title}>PlasticTrack</Text>
          <Text style={styles.tagline}>{t('login.tagline')}</Text>
        </View>
        
        <Card style={styles.card}>
          {mode !== 'login' && (
            <View style={styles.tabContainer}>
              <Button 
                title={t('login.member')} 
                type={mode === 'register_member' ? 'primary' : 'secondary'} 
                onPress={() => setMode('register_member')} 
                style={styles.tabButton} 
              />
              <Button 
                title={t('login.admin')} 
                type={mode === 'register_admin' ? 'primary' : 'secondary'} 
                onPress={() => setMode('register_admin')} 
                style={styles.tabButton} 
              />
              <Button 
                title={t('login.vendorBmc')} 
                type={mode === 'register_staff' ? 'primary' : 'secondary'} 
                onPress={() => setMode('register_staff')} 
                style={styles.tabButton} 
              />
            </View>
          )}

          {mode !== 'login' && (
            <TextInput style={styles.input} placeholder={t('login.fullName')} value={name} onChangeText={setName} />
          )}
          
          {mode === 'register_admin' && (
            <>
              <TextInput style={styles.input} placeholder={t('login.societyName')} value={societyName} onChangeText={setSocietyName} />
              <WardPicker value={ward} onChange={setWard} placeholder={t('login.societyWard')} />
            </>
          )}

          {mode === 'register_member' && (
            <TextInput style={styles.input} placeholder={t('login.societyCode')} value={societyCode} onChangeText={setSocietyCode} autoCapitalize="characters" />
          )}

          {mode === 'register_staff' && (
            <>
              <TextInput style={styles.input} placeholder={t('login.organization')} value={organization} onChangeText={setOrganization} />
              <WardPicker value={ward} onChange={setWard} placeholder={t('login.staffWard')} />
              <TextInput style={styles.input} placeholder={t('login.inviteCode')} value={inviteCode} onChangeText={setInviteCode} autoCapitalize="characters" />
            </>
          )}

          <TextInput style={styles.input} placeholder={t('login.email')} keyboardType="email-address" value={email} onChangeText={setEmail} autoCapitalize="none" />
          <TextInput style={styles.input} placeholder={t('login.password')} secureTextEntry value={password} onChangeText={setPassword} />
          
          {mode !== 'login' && (
            <TextInput style={styles.input} placeholder={t('login.confirmPassword')} secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} />
          )}

          <Button 
            title={submitting ? t('common.pleaseWait') : (mode === 'login' ? t('login.login') : t('login.register'))} 
            onPress={executeAction} 
            disabled={submitting}
            style={{ marginTop: 20 }}
          />

          <View style={{ alignItems: 'center', marginTop: 15 }}>
            {mode === 'login' ? (
              <>
                <Text style={styles.hint}>{t('login.hint')}</Text>
                <TouchableOpacity onPress={() => setMode('register_member')}>
                  <Text style={styles.linkText}>{t('login.noAccount')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity onPress={() => setMode('login')}>
                <Text style={styles.linkText}>{t('login.haveAccount')}</Text>
              </TouchableOpacity>
            )}
          </View>

        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
    marginTop: 10,
  },
  tagline: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 5,
  },
  card: {
    padding: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    marginHorizontal: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 14,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: '#FAFAFA',
  },
  hint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 10,
  },
  linkText: {
    color: colors.primary,
    fontWeight: 'bold',
  }
});

export default LoginScreen;
