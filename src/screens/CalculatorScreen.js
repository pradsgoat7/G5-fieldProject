import React, { useContext, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, SafeAreaView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppContext } from '../context/AppContext';
import { colors } from '../theme/colors';
import Card from '../components/Card';
import Button from '../components/Button';

const calcItems = [
  { id: 'bottles', label: 'Plastic Bottles', weight: 0.03, icon: 'bottle-soda-outline' },
  { id: 'bags', label: 'Plastic Bags', weight: 0.01, icon: 'shopping-outline' },
  { id: 'packaging', label: 'Food Packaging', weight: 0.05, icon: 'food-takeout-box-outline' },
  { id: 'straws', label: 'Straws', weight: 0.003, icon: 'cup-water' },
  { id: 'cups', label: 'Disposable Cups', weight: 0.01, icon: 'cup-outline' },
  { id: 'others', label: 'Other Plastic Items', weight: 0.04, icon: 'archive-outline' },
];

const CalculatorScreen = ({ navigation }) => {
  const { user, footprintEntries, personalFootprints, addFootprintEntry, logActivity, allUsers } = useContext(AppContext);
  const [inputs, setInputs] = useState({});
  const [result, setResult] = useState(null);
  const [historyTab, setHistoryTab] = useState('personal');

  const handleInputChange = (id, value) => {
    setInputs(prev => ({ ...prev, [id]: parseInt(value) || 0 }));
  };

  const calculate = () => {
    let totalKg = 0;
    let totalItems = 0;
    calcItems.forEach(item => {
      const count = inputs[item.id] || 0;
      totalKg += count * item.weight;
      totalItems += count;
    });

    setResult({
      totalKg,
      totalItems,
      monthly: totalKg * 4,
      yearly: totalKg * 52,
      impact: Math.round(totalKg / 0.01), // equivalent to bags
    });
  };

  const saveToDashboard = async () => {
    if (result) {
      await addFootprintEntry({
        id: Date.now().toString(),
        date: new Date().toISOString(),
        totalKg: result.totalKg,
        items: result.totalItems,
        rating: getFootprintProps(result.totalKg).label
      });
      logActivity(`Used Calculator: Logged ${result.totalItems} items (${result.totalKg.toFixed(2)} kg)`);
      setResult(null);
      setInputs({});
      Alert.alert('Success', 'Saved successfully!');
      navigation.navigate('Home');
    }
  };

  const getFootprintProps = (val) => {
    if (val < 0.2) return { color: colors.ratingExcellent, label: 'Excellent' };
    if (val <= 0.5) return { color: colors.ratingGood, label: 'Good' };
    if (val <= 1) return { color: colors.ratingModerate, label: 'Moderate' };
    return { color: colors.ratingHigh, label: 'High' };
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="leaf" size={24} color={colors.primary} />
        <Text style={styles.headerTitle}>Footprint Calculator</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Calculate Your Plastic Footprint</Text>
        <Text style={styles.subtitle}>Log the plastic items you used this week</Text>

        <Card>
          {calcItems.map(item => (
            <View key={item.id} style={styles.inputRow}>
              <MaterialCommunityIcons name={item.icon} size={24} color={colors.primary} />
              <Text style={styles.inputLabel}>{item.label}</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                placeholder="0"
                value={inputs[item.id]?.toString() || ''}
                onChangeText={(val) => handleInputChange(item.id, val)}
              />
            </View>
          ))}
          <Button title="Calculate" onPress={calculate} style={{ marginTop: 10 }} />
        </Card>

        {result && (
          <Card style={styles.resultCard}>
            <Text style={styles.resultTitle}>Your Results</Text>
            
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Total this week:</Text>
              <Text style={styles.resultValue}>{result.totalKg.toFixed(2)} kg</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Monthly estimate:</Text>
              <Text style={styles.resultValue}>{result.monthly.toFixed(2)} kg</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Yearly estimate:</Text>
              <Text style={styles.resultValue}>{result.yearly.toFixed(2)} kg</Text>
            </View>
            
            <View style={styles.divider} />
            
            <Text style={styles.impactText}>
              Environmental Impact: Equivalent to <Text style={{fontWeight:'bold'}}>{result.impact}</Text> plastic bags.
            </Text>

            <View style={styles.ratingRow}>
              <Text style={styles.ratingLabel}>Rating:</Text>
              <View style={[styles.badge, { backgroundColor: getFootprintProps(result.totalKg).color }]}>
                <Text style={styles.badgeText}>{getFootprintProps(result.totalKg).label}</Text>
              </View>
            </View>

            <Button title="Save to Dashboard" onPress={saveToDashboard} style={{ marginTop: 20 }} />
          </Card>
        )}

        {(personalFootprints.length > 0 || user?.role === 'admin') && (
          <View style={{ marginTop: 30 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>History</Text>
              {user?.role === 'admin' && (
                <View style={{ flexDirection: 'row' }}>
                  <Button title="Personal" type={historyTab==='personal'?'primary':'secondary'} onPress={()=>setHistoryTab('personal')} style={{ marginRight: 5, paddingVertical: 5, paddingHorizontal: 10 }} />
                  <Button title="Society" type={historyTab==='society'?'primary':'secondary'} onPress={()=>setHistoryTab('society')} style={{ paddingVertical: 5, paddingHorizontal: 10 }} />
                </View>
              )}
            </View>

            {historyTab === 'personal' ? (
              personalFootprints.map(entry => (
                <Card key={entry.id} style={styles.historyCard}>
                  <View style={styles.historyHeader}>
                    <Text style={styles.historyDate}>{new Date(entry.date).toLocaleDateString()}</Text>
                    <Text style={styles.historyRating}>{entry.rating}</Text>
                  </View>
                  <Text style={styles.historyKg}>{entry.totalKg.toFixed(2)} kg ({entry.items} items)</Text>
                </Card>
              ))
            ) : (
              allUsers.filter(u => u.societyCode === user.societyCode).map(member => {
                const memberHistory = footprintEntries.filter(f => f.userId === member.id);
                if (memberHistory.length === 0) return null;
                const latest = memberHistory[0];
                return (
                  <Card key={member.id} style={styles.historyCard}>
                    <View style={styles.historyHeader}>
                      <Text style={{ fontSize: 16, fontWeight: 'bold' }}>{member.name}</Text>
                      <Text style={styles.historyRating}>{latest.rating}</Text>
                    </View>
                    <Text style={styles.historyKg}>{latest.totalKg.toFixed(2)} kg</Text>
                  </Card>
                )
              })
            )}
          </View>
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
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
    marginTop: 5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  inputLabel: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    marginLeft: 10,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    width: 60,
    paddingVertical: 8,
    paddingHorizontal: 12,
    textAlign: 'center',
    fontSize: 16,
    backgroundColor: '#FAFAFA',
  },
  resultCard: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 15,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  resultLabel: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  resultValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: '#EEEEEE',
    marginVertical: 15,
  },
  impactText: {
    fontSize: 14,
    color: colors.warning,
    fontStyle: 'italic',
    marginBottom: 15,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginRight: 10,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 10,
    marginLeft: 5,
  },
  historyCard: {
    padding: 15,
    marginBottom: 10,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  historyDate: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  historyRating: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.primary,
  },
  historyKg: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
  }
});

export default CalculatorScreen;
