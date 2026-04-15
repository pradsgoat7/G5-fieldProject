import React, { useContext, useState } from 'react';
import { View, Text, TextInput, StyleSheet, SafeAreaView, Alert, ScrollView, TouchableOpacity, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppContext } from '../context/AppContext';
import Button from '../components/Button';
import Card from '../components/Card';
import { colors } from '../theme/colors';

const LoginScreen = ({ navigation }) => {
  const { loginByCredentials, registerAdmin, registerMember } = useContext(AppContext);
  const [mode, setMode] = useState('login'); // login | register_member | register_admin

  const [name, setName] = useState('');
  const [societyName, setSocietyName] = useState('');
  const [societyCode, setSocietyCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const executeAction = async () => {
    try {
      if (mode === 'login') {
        if (!email || !password) {
          Platform.OS === 'web' ? window.alert('Please enter email and password') : Alert.alert('Error', 'Please enter email and password');
          return;
        }
        await loginByCredentials(email, password);
      } else if (mode === 'register_admin') {
        if (!name || !email || !password || !societyName) {
          Platform.OS === 'web' ? window.alert('Please fill all fields') : Alert.alert('Error', 'Please fill all fields');
          return;
        }
        if (password !== confirmPassword) {
          Platform.OS === 'web' ? window.alert('Passwords do not match') : Alert.alert('Error', 'Passwords do not match');
          return;
        }
        const code = await registerAdmin(name, societyName, email, password);
        
        if (Platform.OS === 'web') {
          window.alert(`Society Registered! 🎉\nYour Society Code is: ${code}\n\nPlease save this code and share it with your residents so they can join your society on PlasticTrack.`);
          setMode('login');
          setPassword('');
          setConfirmPassword('');
          navigation.navigate("AdminSuccess", { societyCode: code });
        } else {
          Alert.alert(
            "Society Registered! 🎉",
            `Your Society Code is: ${code}\n\nPlease save this code and share it with your residents so they can join your society on PlasticTrack.`,
            [
              {
                text: "Copy Code",
                onPress: async () => {
                  await Clipboard.setStringAsync(code);
                  setMode('login');
                  setPassword('');
                  setConfirmPassword('');
                  navigation.navigate("AdminSuccess", { societyCode: code });
                }
              },
              {
                text: "OK, Got it!",
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
          Platform.OS === 'web' ? window.alert('Please fill all fields') : Alert.alert('Error', 'Please fill all fields');
          return;
        }
        if (password !== confirmPassword) {
          Platform.OS === 'web' ? window.alert('Passwords do not match') : Alert.alert('Error', 'Passwords do not match');
          return;
        }
        await registerMember(name, email, societyCode, password);
      }
    } catch (e) {
      Platform.OS === 'web' ? window.alert(e.message) : Alert.alert('Error', e.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        <View style={styles.header}>
          <MaterialCommunityIcons name="leaf" size={48} color={colors.primary} />
          <Text style={styles.title}>PlasticTrack</Text>
          <Text style={styles.tagline}>Track. Reduce. Reward.</Text>
        </View>
        
        <Card style={styles.card}>
          {mode !== 'login' && (
            <View style={styles.tabContainer}>
              <Button 
                title="Member" 
                type={mode === 'register_member' ? 'primary' : 'secondary'} 
                onPress={() => setMode('register_member')} 
                style={styles.tabButton} 
              />
              <Button 
                title="Admin" 
                type={mode === 'register_admin' ? 'primary' : 'secondary'} 
                onPress={() => setMode('register_admin')} 
                style={styles.tabButton} 
              />
            </View>
          )}

          {mode !== 'login' && (
            <TextInput style={styles.input} placeholder="Full Name" value={name} onChangeText={setName} />
          )}
          
          {mode === 'register_admin' && (
            <TextInput style={styles.input} placeholder="Society Name" value={societyName} onChangeText={setSocietyName} />
          )}

          {mode === 'register_member' && (
            <TextInput style={styles.input} placeholder="Society Code (from Admin)" value={societyCode} onChangeText={setSocietyCode} autoCapitalize="characters" />
          )}

          <TextInput style={styles.input} placeholder="Email" keyboardType="email-address" value={email} onChangeText={setEmail} autoCapitalize="none" />
          <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
          
          {mode !== 'login' && (
            <TextInput style={styles.input} placeholder="Confirm Password" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} />
          )}

          <Button 
            title={mode === 'login' ? 'Login' : 'Register'} 
            onPress={executeAction} 
            style={{ marginTop: 20 }}
          />

          <View style={{ alignItems: 'center', marginTop: 15 }}>
            {mode === 'login' ? (
              <>
                <Text style={styles.hint}>Admins: register your society | Members: use code</Text>
                <TouchableOpacity onPress={() => setMode('register_member')}>
                  <Text style={styles.linkText}>Don't have an account? Register</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity onPress={() => setMode('login')}>
                <Text style={styles.linkText}>Already have an account? Login</Text>
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
