import React, { useContext, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, SafeAreaView, Dimensions, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { BarChart } from 'react-native-chart-kit';
import { collection, query, where, getDocs, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
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
  const { user } = useContext(AppContext);
  const [inputs, setInputs] = useState({});
  const [result, setResult] = useState(null);
  const [historyTab, setHistoryTab] = useState('personal');
  const [personalFootprints, setPersonalFootprints] = useState([]);
  const [societyMembers, setSocietyMembers] = useState([]);
  const [societyFootprints, setSocietyFootprints] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [weeklyData, setWeeklyData] = useState([0, 0, 0, 0]);
  const [insightText, setInsightText] = useState("");
  const [latestRatingColor, setLatestRatingColor] = useState(colors.ratingGood);

  const getISOWeekInfo = (date = new Date()) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = (d.getDay() || 7) - 1; 
    d.setDate(d.getDate() - day + 3); 
    const firstThursday = d.getTime();
    d.setMonth(0, 1);
    if (d.getDay() !== 4) {
      d.setMonth(0, 1 + ((4 - d.getDay()) + 7) % 7);
    }
    const weekNum = 1 + Math.ceil((firstThursday - d) / 604800000);
    return { year: d.getFullYear(), week: weekNum };
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchWeeklyData();
    }, [user])
  );

  const fetchWeeklyData = async () => {
    if (!user) return;
    try {
      // Fetch personal footprint
      const q = query(collection(db, "footprint_entries"), where("userId", "==", user.uid), orderBy("date", "desc"));
      const snapshot = await getDocs(q);
      const userEntries = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
      setPersonalFootprints(userEntries);
      
      const current = getISOWeekInfo();
      let weeks = [];
      for(let i=3; i>=0; i--) {
         let w = current.week - i;
         let y = current.year;
         if (w <= 0) {
            y -= 1;
            w += 52; 
         }
         weeks.push({ year: y, week: w, total: 0 });
      }

      userEntries.forEach(entry => {
         const dInfo = getISOWeekInfo(entry.date);
         const targetWeek = weeks.find(w => w.year === dInfo.year && w.week === dInfo.week);
         if (targetWeek) {
            targetWeek.total += (entry.totalKg || 0);
         }
      });

      const dataArr = weeks.map(w => w.total);
      setWeeklyData(dataArr);

      const mostRecentTotal = dataArr[3];
      const colorRating = getFootprintProps(mostRecentTotal);
      setLatestRatingColor(colorRating.color);

      const w3 = dataArr[2];
      const w4 = dataArr[3];
      if (w4 < w3) setInsightText("📉 Great job! Your usage is decreasing.");
      else if (w4 > w3) setInsightText("📈 Your usage increased this week. Try to reduce!");
      else setInsightText("➡️ Your usage has been consistent this week.");
      
      if (user.role === 'admin') {
        const hq = query(collection(db, "footprint_entries"), where("societyCode", "==", user.societyCode), orderBy("date", "desc"));
        const hSnap = await getDocs(hq);
        setSocietyFootprints(hSnap.docs.map(d => ({id: d.id, ...d.data()})));
        
        const mq = query(collection(db, "users"), where("societyCode", "==", user.societyCode));
        const mSnap = await getDocs(mq);
        setSocietyMembers(mSnap.docs.map(d => ({id: d.id, ...d.data()})));
      }
      
    } catch (e) {
      console.log(e);
    }
  };

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
      try {
        await addDoc(collection(db, "footprint_entries"), {
          userId: user.uid,
          societyCode: user.societyCode,
          items: result.totalItems,
          totalKg: result.totalKg,
          rating: getFootprintProps(result.totalKg).label,
          date: serverTimestamp()
        });
        
        await addDoc(collection(db, "announcements"), {
          societyCode: user.societyCode,
          type: 'activity',
          title: 'Footprint Logged',
          description: `Logged ${result.totalItems} items (${result.totalKg.toFixed(2)} kg)`,
          timestamp: Date.now()
        });
        
        setResult(null);
        setInputs({});
        Alert.alert('Success', 'Saved successfully!');
        navigation.navigate('Home');
      } catch (e) {
        Alert.alert('Error', 'Could not save data. Check your connection.');
        console.log(e);
      }
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

        {/* FEATURE 1: PLASTIC FOOTPRINT HISTORY CHART */}
        <View style={{ marginTop: 25, marginBottom: 15 }}>
          <Text style={[styles.sectionTitle, { marginBottom: 10 }]}>📊 Your 4-Week Trend</Text>
          <Card>
            <BarChart
              data={{
                labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                datasets: [{ data: weeklyData }]
              }}
              width={Dimensions.get('window').width - 80}
              height={200}
              yAxisLabel=""
              yAxisSuffix=""
              chartConfig={{
                backgroundGradientFrom: '#ffffff',
                backgroundGradientFromOpacity: 0,
                backgroundGradientTo: '#ffffff',
                backgroundGradientToOpacity: 0,
                color: (opacity = 1) => latestRatingColor,
                labelColor: (opacity = 1) => colors.textSecondary,
                strokeWidth: 2,
                barPercentage: 0.5,
                decimalPlaces: 1,
                fillShadowGradient: latestRatingColor,
                fillShadowGradientOpacity: 1
              }}
              verticalLabelRotation={0}
              fromZero={true}
              withInnerLines={false}
              showValuesOnTopOfBars={true}
              style={{
                marginVertical: 8,
                borderRadius: 16,
                marginLeft: -10
              }}
            />
            {insightText ? (
               <Text style={{ textAlign: 'center', marginTop: 10, fontSize: 13, color: colors.textPrimary, fontWeight: '500' }}>
                 {insightText}
               </Text>
            ) : null}
          </Card>
        </View>

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
                    <Text style={styles.historyDate}>{entry.date?.toDate ? entry.date.toDate().toLocaleDateString() : 'Just now'}</Text>
                    <Text style={styles.historyRating}>{entry.rating}</Text>
                  </View>
                  <Text style={styles.historyKg}>{entry.totalKg.toFixed(2)} kg ({entry.items} items)</Text>
                </Card>
              ))
            ) : (
              societyMembers.map(member => {
                const memberHistory = societyFootprints.filter(f => f.userId === member.uid);
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
