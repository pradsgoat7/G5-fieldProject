import React, { useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TextInput, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AppContext } from '../context/AppContext';
import { colors } from '../theme/colors';
import Card from '../components/Card';
import Button from '../components/Button';

const PLASTIC_TYPES = ['PET Bottles', 'HDPE Containers', 'Plastic Bags', 'Mixed Plastic'];

const ExchangeScreen = () => {
  const { user } = useContext(AppContext);
  const [selectedType, setSelectedType] = useState('PET Bottles');
  const [quantity, setQuantity] = useState('');
  const [societySubmissions, setSocietySubmissions] = useState([]);
  const [points, setPoints] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "exchange_submissions"),
      where("societyCode", "==", user.societyCode),
      orderBy("date", "desc")
    );
    
    const unsubscribeSubmissions = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
      setSocietySubmissions(data);
    }, (error) => {
      console.log("Error fetching submissions", error);
    });

    const societyDocRef = doc(db, "societies", user.societyCode);
    const unsubscribeSociety = onSnapshot(societyDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setPoints(docSnap.data().totalPointsEarned || 0);
      }
      setIsLoading(false);
    });

    return () => {
      unsubscribeSubmissions();
      unsubscribeSociety();
    };
  }, [user]);

  const submitExchange = async () => {
    const kg = parseFloat(quantity);
    if (!kg || kg <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid weight in kg.');
      return;
    }

    const earnedPoints = kg * 100;
    
    try {
      await addDoc(collection(db, "exchange_submissions"), {
        societyCode: user.societyCode,
        plasticType: selectedType,
        kg,
        pointsEarned: earnedPoints,
        submittedBy: user.uid,
        date: serverTimestamp()
      });

      await updateDoc(doc(db, "societies", user.societyCode), {
        totalPointsEarned: increment(earnedPoints)
      });
      
      await addDoc(collection(db, "announcements"), {
        societyCode: user.societyCode,
        type: 'activity',
        title: 'New Exchange Submission',
        description: `Admin submitted ${kg} kg of ${selectedType} and earned ${earnedPoints} points!`,
        timestamp: Date.now()
      });

      Alert.alert(
        'Success!', 
        `You submitted ${kg} kg of ${selectedType} and earned ${earnedPoints} points!`,
        [{ text: 'Awesome' }]
      );
      
      setQuantity('');
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not save data. Check your connection.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="refresh-circle" size={28} color={colors.primary} />
        <Text style={styles.headerTitle}>Plastic Exchange</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.pointsBanner}>
          <MaterialCommunityIcons name="star-circle" size={24} color="#FFF" />
          <Text style={styles.bannerText}>1 kg of plastic = 100 points</Text>
        </View>

        <Card style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Total Points Balance</Text>
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.balanceValue}>{points} pts</Text>
          )}
        </Card>

        <Text style={styles.sectionTitle}>Log Submission</Text>
        <Card style={styles.formCard}>
          <Text style={styles.label}>Plastic Type</Text>
          <View style={styles.typeSelector}>
            {PLASTIC_TYPES.map(type => (
              <TouchableOpacity
                key={type}
                style={[styles.typeOption, selectedType === type && styles.typeOptionSelected]}
                onPress={() => setSelectedType(type)}
              >
                <Text style={[styles.typeText, selectedType === type && styles.typeTextSelected]}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Quantity (kg)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="e.g. 1.5"
            value={quantity}
            onChangeText={setQuantity}
          />

          <Text style={styles.label}>Submission Date</Text>
          <View style={styles.dateReadOnly}>
            <Text style={styles.dateText}>{new Date().toLocaleDateString()}</Text>
          </View>

          <Button title="Submit for Points" onPress={submitExchange} style={{ marginTop: 10 }} />
        </Card>

        <Text style={styles.sectionTitle}>My Submissions</Text>
        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : societySubmissions.length === 0 ? (
          <Text style={styles.emptyText}>No submissions yet.</Text>
        ) : (
          societySubmissions.map((sub) => (
            <Card key={sub.id} style={styles.subCard}>
              <View style={styles.subHeader}>
                <Text style={styles.subType}>{sub.plasticType}</Text>
                <Text style={styles.subPoints}>+{sub.pointsEarned} pts</Text>
              </View>
              <View style={styles.subDetails}>
                <Text style={styles.subDate}>{sub.date?.toDate ? sub.date.toDate().toLocaleDateString() : 'Just now'}</Text>
                <Text style={styles.subKg}>{sub.kg} kg</Text>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
    marginLeft: 10,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  pointsBanner: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  bannerText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  balanceCard: {
    alignItems: 'center',
    padding: 15,
    marginBottom: 20,
  },
  balanceLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  balanceValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
    marginTop: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 10,
    marginLeft: 5,
  },
  formCard: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: 10,
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeOption: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#FAFAFA',
    marginBottom: 8,
  },
  typeOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  typeTextSelected: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FAFAFA',
  },
  dateReadOnly: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#EEEEEE',
  },
  dateText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  subCard: {
    padding: 15,
    marginBottom: 10,
  },
  subHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  subType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  subPoints: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.success,
  },
  subDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  subDate: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  subKg: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: 10,
  }
});

export default ExchangeScreen;
