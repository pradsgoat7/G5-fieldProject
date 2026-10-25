import React, { useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TextInput, Alert, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AppContext } from '../context/AppContext';
import { colors } from '../theme/colors';
import Card from '../components/Card';
import Button from '../components/Button';

const RECYCLABLE_TYPES = [
  { id: 'pet', name: 'PET Bottles', desc: 'water bottles, cold drink bottles' },
  { id: 'hdpe', name: 'HDPE Containers', desc: 'milk jugs, shampoo bottles' },
  { id: 'ldpe', name: 'LDPE Bags', desc: 'clean zip-lock bags, bread bags' },
  { id: 'pp', name: 'PP Containers', desc: 'yogurt cups, medicine bottles' },
  { id: 'glass', name: 'Glass Bottles', desc: 'ketchup, juice glass bottles' },
  { id: 'cardboard', name: 'Cardboard / Paper', desc: 'clean cardboard boxes' },
  { id: 'metal', name: 'Metal Cans', desc: 'aluminium cans, tin cans' },
  { id: 'others_rec', name: 'Others (Recyclable)', desc: 'specify custom type' }
];

const NON_RECYCLABLE_TYPES = [
  { id: 'mlp', name: 'MLP Packaging', desc: 'multi-layer chips packets, wrappers' },
  { id: 'thermocol', name: 'Thermocol / EPS', desc: 'styrofoam cups, packaging foam' },
  { id: 'pvc', name: 'PVC Plastic', desc: 'pipes, cling wrap, blister packs' },
  { id: 'contaminated', name: 'Contaminated Plastic', desc: 'soiled food containers, dirty bags' },
  { id: 'composite', name: 'Composite Packaging', desc: 'tetra packs, juice cartons' },
  { id: 'cutlery', name: 'Disposable Cutlery', desc: 'plastic spoons, forks, straws' },
  { id: 'thin_film', name: 'Thin Plastic Films', desc: 'carry bags, shrink wrap' },
  { id: 'others_non_rec', name: 'Others (Non-Recyclable)', desc: 'specify custom type' }
];

const ExchangeScreen = () => {
  const { user } = useContext(AppContext);
  const [category, setCategory] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [customType, setCustomType] = useState('');
  const [quantity, setQuantity] = useState('');
  const [societySubmissions, setSocietySubmissions] = useState([]);
  const [points, setPoints] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user || !user.societyCode) return;
    
    console.log("Current user societyCode:", user.societyCode);
    console.log("Fetching submissions for society...");

    const q = query(
      collection(db, "exchange_submissions"),
      where("societyCode", "==", user.societyCode)
    );
    
    const unsubscribeSubmissions = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
      const sortedData = data.sort((a, b) => {
        const aTime = a.date?.seconds || a.date || 0;
        const bTime = b.date?.seconds || b.date || 0;
        return bTime - aTime;
      });
      console.log("Submissions loaded:", sortedData.length);
      setSocietySubmissions(sortedData);
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


  const submitExchange = () => {
    console.log("Submit pressed");
    console.log("Category:", category);

    if (!category) {
      Alert.alert('Error', 'Please select a category');
      return;
    }
    if (!selectedType) {
      Alert.alert('Error', 'Please select a plastic type');
      return;
    }
    const isOthers = selectedType.id === 'others_rec' || selectedType.id === 'others_non_rec';
    if (isOthers && !customType.trim()) {
      Alert.alert('Error', 'Please describe the plastic type');
      return;
    }
    
    const kg = parseFloat(quantity);
    console.log("Quantity:", quantity);
    if (!kg || kg <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid weight in kg.');
      return;
    }

    let mf;
    if (category === "recyclable") {
      mf = 1.5;
    } else {
      mf = -0.5;
    }
    const earnedPoints = kg * 10 * mf;
    const plasticTypeToSave = isOthers ? customType.trim() : selectedType.name;
    
    console.log("Plastic type:", plasticTypeToSave);
    console.log("Points to save:", earnedPoints);
    
    const saveSubmission = async () => {
      console.log("Saving to Firestore...");
      try {
        await addDoc(collection(db, "exchange_submissions"), {
          societyCode: user.societyCode,
          category: category,
          plasticType: plasticTypeToSave,
          kg,
          impactFactor: 10,
          multiplyingFactor: mf,
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
          description: `Admin submitted ${kg} kg of ${plasticTypeToSave} and ${category === 'recyclable' ? 'earned' : 'lost'} ${Math.abs(earnedPoints)} points!`,
          timestamp: Date.now()
        });

        console.log("Saved successfully");

        Alert.alert(
          'Success!', 
          `You submitted ${kg} kg of ${plasticTypeToSave} and ${category === 'recyclable' ? 'earned' : 'lost'} ${Math.abs(earnedPoints)} points!`,
          [{ text: 'Awesome' }]
        );
        
        setCategory(null);
        setSelectedType(null);
        setCustomType('');
        setQuantity('');
      } catch (e) {
        console.error(e);
        Alert.alert('Error', 'Could not save data. Check your connection.');
      }
    };

    if (category === 'non_recyclable') {
      const deductionAmount = kg * 10 * 0.5;
      if (Platform.OS === 'web') {
        if (window.confirm(`⚠️ Confirm Submission\n\nYou are submitting non-recyclable plastic.\n\nThis will DEDUCT ${deductionAmount} points from your society.\n\nAre you sure you want to continue?`)) {
          saveSubmission();
        }
      } else {
        Alert.alert(
          "⚠️ Confirm Submission",
          `You are submitting non-recyclable plastic.\n\nThis will DEDUCT ${deductionAmount} points from your society.\n\nAre you sure you want to continue?`,
          [
            { text: "Cancel", style: "cancel" },
            { text: "Yes, Submit", onPress: () => saveSubmission() }
          ]
        );
      }
    } else {
      saveSubmission();
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
          <Text style={styles.label}>Select Category</Text>
          <View style={styles.categoryContainer}>
            <TouchableOpacity 
              style={[styles.categoryCard, category === 'recyclable' && styles.categoryCardSelectedRecyclable]}
              onPress={() => { setCategory('recyclable'); setSelectedType(null); setCustomType(''); }}
            >
              <Text style={styles.categoryTitle}>♻️ Recyclable</Text>
              <Text style={styles.categorySubtitle}>Earn 1.5x points</Text>
              <Text style={styles.categoryTap}>[tap to select]</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.categoryCard, category === 'non_recyclable' && styles.categoryCardSelectedNonRecyclable]}
              onPress={() => { setCategory('non_recyclable'); setSelectedType(null); setCustomType(''); }}
            >
              <Text style={styles.categoryTitle}>🚫 Non-Recyclable</Text>
              <Text style={styles.categorySubtitle}>Lose 0.5x points</Text>
              <Text style={styles.categoryTap}>MF: -0.5x  •  Points will be deducted</Text>
            </TouchableOpacity>
          </View>

          {category && (
            <>
              <Text style={styles.label}>Plastic Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipContainer}>
                {(category === 'recyclable' ? RECYCLABLE_TYPES : NON_RECYCLABLE_TYPES).map(t => {
                  const isSelected = selectedType?.id === t.id;
                  const isRecyclable = category === 'recyclable';
                  return (
                    <TouchableOpacity 
                      key={t.id} 
                      style={[
                        styles.chip, 
                        isSelected && (isRecyclable ? styles.chipSelectedRecyclable : styles.chipSelectedNonRecyclable)
                      ]}
                      onPress={() => setSelectedType(t)}
                    >
                      <Text style={[styles.chipTitle, isSelected && (isRecyclable ? styles.chipTextSelected : styles.chipTextSelected)]}>{t.name}</Text>
                      <Text style={[styles.chipDesc, isSelected && (isRecyclable ? styles.chipTextSelected : styles.chipTextSelected)]}>{t.desc}</Text>
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>
            </>
          )}

          {selectedType && (selectedType.id === 'others_rec' || selectedType.id === 'others_non_rec') && (
            <>
               <Text style={styles.label}>Describe the plastic type</Text>
               <TextInput 
                 style={styles.input} 
                 placeholder="e.g., Bubble wrap, acrylic container..." 
                 value={customType} 
                 onChangeText={setCustomType} 
               />
            </>
          )}

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

          {category && (
            <View style={[styles.previewCard, category === 'recyclable' ? styles.previewRecyclable : styles.previewNonRecyclable]}>
              <Text style={styles.previewTitle}>{category === 'recyclable' ? '📊 Points Preview' : '⚠️ Points Preview'}</Text>
              <Text style={styles.previewText}>Category: {category === 'recyclable' ? 'Recyclable  (MF: +1.5x)' : 'Non-Recyclable  (MF: -0.5x)'}</Text>
              <Text style={styles.previewText}>Plastic: {selectedType ? (selectedType.id.startsWith('others') ? (customType || '...') : selectedType.name) : '-'}</Text>
              <Text style={styles.previewText}>Quantity: {quantity ? quantity + ' kg' : '-' }</Text>
              
              {(parseFloat(quantity) > 0) ? (
                <>
                  <Text style={[styles.previewPoints, category === 'non_recyclable' && { color: 'red' }]}>Points = {parseFloat(quantity)} × 10 × {category === 'recyclable' ? '1.5' : '(-0.5)'} = {parseFloat(quantity) * 10 * (category === 'recyclable' ? 1.5 : -0.5)} points</Text>
                  <Text style={[styles.previewMessage, category === 'non_recyclable' && { color: 'red', fontWeight: 'bold' }]}>
                    {category === 'recyclable' 
                      ? '✅ Great choice! You earn reward points.' 
                      : `❌ Warning: This will DEDUCT ${Math.abs(parseFloat(quantity) * 10 * -0.5)} points\nfrom your society balance!`}
                  </Text>
                </>
              ) : (
                <Text style={styles.previewEmpty}>Enter quantity to see points</Text>
              )}
            </View>
          )}

          <Button title="Submit for Points" onPress={submitExchange} style={{ marginTop: 20 }} />
        </Card>

        <Text style={styles.sectionTitle}>My Submissions</Text>
        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : societySubmissions.length === 0 ? (
          <Text style={styles.emptyText}>No submissions yet.</Text>
        ) : (
          societySubmissions.map((sub) => {
            const isLegacy = !sub.category;
            const isRecyclable = sub.category === 'recyclable';
            const bgColors = isLegacy ? '#EEEEEE' : (isRecyclable ? '#E8F5E9' : '#FFF3E0');
            const titleText = isLegacy ? `🗄️ ${sub.plasticType}` : (isRecyclable ? `♻️ ${sub.plasticType}` : `🚫 ${sub.plasticType}`);
            const badgeText = isLegacy ? 'Legacy Submission' : (isRecyclable ? 'Recyclable 🟢' : 'Non-Recyclable 🔴');
            const mfText = isLegacy ? '' : ` (MF: ${isRecyclable ? '+1.5' : '-0.5'}x)`;
            
            const isNegative = sub.pointsEarned < 0;
            const pointsColor = isNegative ? 'red' : colors.success;
            const pointsText = isLegacy ? `Points earned: +${sub.pointsEarned}` : `Points: ${isNegative ? '' : '+'}${sub.pointsEarned}${mfText}`;

            return (
              <Card key={sub.id} style={styles.subCard}>
                <View style={[styles.subHeader, { marginBottom: 10 }]}>
                  <Text style={styles.subType}>{titleText}</Text>
                  <View style={[styles.badgeContainer, { backgroundColor: bgColors }]}>
                    <Text style={styles.badgeText}>{badgeText}</Text>
                  </View>
                </View>
                <Text style={styles.subDate}>{sub.kg} kg  •  {sub.date?.toDate ? sub.date.toDate().toLocaleDateString() : 'Just now'}</Text>
                <Text style={[styles.subPointsText, { color: pointsColor }]}>{pointsText}</Text>
              </Card>
            );
          })
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
  categoryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  categoryCard: {
    width: '48%',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  categoryCardSelectedRecyclable: {
    borderColor: '#4CAF50',
    backgroundColor: '#E8F5E9',
  },
  categoryCardSelectedNonRecyclable: {
    borderColor: '#FF9800',
    backgroundColor: '#FFF3E0',
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  categorySubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginVertical: 4,
  },
  categoryTap: {
    fontSize: 10,
    color: '#9E9E9E',
  },
  chipContainer: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 10,
    marginRight: 10,
    backgroundColor: '#FAFAFA',
    minWidth: 120,
  },
  chipSelectedRecyclable: {
    borderColor: '#4CAF50',
    backgroundColor: '#4CAF50',
  },
  chipSelectedNonRecyclable: {
    borderColor: '#FF9800',
    backgroundColor: '#FF9800',
  },
  chipTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  chipDesc: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: '#FFF',
  },
  previewCard: {
    marginTop: 20,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
  },
  previewRecyclable: {
    backgroundColor: '#E8F5E9',
    borderColor: '#C8E6C9',
  },
  previewNonRecyclable: {
    backgroundColor: '#FFEBEE',
    borderColor: '#FFCDD2',
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: colors.textPrimary,
  },
  previewText: {
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  previewPoints: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    color: colors.textPrimary,
  },
  previewMessage: {
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
    color: colors.textSecondary,
  },
  previewEmpty: {
    fontSize: 14,
    marginTop: 10,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  subCard: {
    padding: 15,
    marginBottom: 10,
  },
  subHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  badgeContainer: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  subDate: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  subPointsText: {
    fontSize: 14,
    color: colors.success,
    fontWeight: 'bold',
    marginTop: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: 10,
  }
});

export default ExchangeScreen;
