import React, { useState, useEffect, useContext } from 'react';
import { 
  View, Text, ScrollView, TextInput, 
  TouchableOpacity, ActivityIndicator, StyleSheet, Dimensions, Alert
} from 'react-native';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AppContext } from '../context/AppContext';
import { BarChart } from 'react-native-chart-kit';

export default function CalculatorScreen({ navigation }) {
  const { user } = useContext(AppContext);
  const [bottles, setBottles] = useState('0');
  const [bags, setBags] = useState('0');
  const [packaging, setPackaging] = useState('0');
  const [straws, setStraws] = useState('0');
  const [cups, setCups] = useState('0');
  const [other, setOther] = useState('0');
  const [result, setResult] = useState(null);
  
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [weeklyData, setWeeklyData] = useState([0, 0, 0, 0]);
  const [historyTab, setHistoryTab] = useState('personal');

  const getCurrentWeekNumber = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    return Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);
  };

  const computeWeeklyData = (entries) => {
    const now = new Date();
    const currentWeekNum = getCurrentWeekNumber();
    
    const weeklyTotals = [0, 0, 0, 0];
    
    entries.forEach(entry => {
      try {
        const entryDate = entry.date?.toDate 
          ? entry.date.toDate() 
          : new Date(entry.date || 0);
        
        const entryWeek = Math.ceil(
          ((entryDate - new Date(entryDate.getFullYear(), 0, 1)) 
          / 86400000 + 
          new Date(entryDate.getFullYear(), 0, 1).getDay() + 1) / 7
        );
        
        const weeksAgo = currentWeekNum - entryWeek;
        if (weeksAgo >= 0 && weeksAgo < 4) {
          weeklyTotals[3 - weeksAgo] += entry.totalKg || 0;
        }
      } catch(e) {
        // skip invalid entries silently
      }
    });
    
    return weeklyTotals;
  };

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    
    const q = historyTab === 'personal' || user.role !== 'admin'
      ? query(collection(db, "footprint_entries"), where("userId", "==", user.uid))
      : query(collection(db, "footprint_entries"), where("societyCode", "==", user.societyCode));
      
    setLoading(true);
    
    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        try {
          const data = snapshot.docs
            .map(doc => {
              const d = doc.data();
              let jsDate = new Date();
              try {
                jsDate = d.date?.toDate 
                  ? d.date.toDate() 
                  : new Date(d.date || Date.now());
              } catch(e) {}
              return { id: doc.id, ...d, jsDate };
            })
            .sort((a, b) => b.jsDate - a.jsDate);
          
          setHistory(data);
          if (historyTab === 'personal') {
            setWeeklyData(computeWeeklyData(data));
          }
        } catch(e) {
          console.log("History error:", e);
          setHistory([]);
        }
        setLoading(false);
      },
      (error) => {
        console.log("Firestore error:", error);
        setHistory([]);
        setLoading(false);
      }
    );
    
    return () => unsubscribe();
  }, [user, historyTab]);

  const calculate = () => {
    try {
      const total =
        (parseFloat(bottles) || 0) * 0.03 +
        (parseFloat(bags) || 0) * 0.01 +
        (parseFloat(packaging) || 0) * 0.05 +
        (parseFloat(straws) || 0) * 0.003 +
        (parseFloat(cups) || 0) * 0.01 +
        (parseFloat(other) || 0) * 0.04;

      const rating =
        total < 0.2 ? 'Excellent' :
        total < 0.5 ? 'Good' :
        total < 1.0 ? 'Moderate' : 'High';

      setResult({ 
        total: total.toFixed(2), 
        rating,
        monthly: (total * 4).toFixed(2),
        yearly: (total * 52).toFixed(2),
        impact: Math.round(total / 0.01)
      });
    } catch(e) {
      console.log("Calculation error:", e);
    }
  };

  const saveToDashboard = async () => {
    if (!result) return;
    try {
      await addDoc(collection(db, "footprint_entries"), {
        userId: user.uid,
        userName: user.name,
        societyCode: user.societyCode,
        items: {
          bottles: parseInt(bottles) || 0,
          bags: parseInt(bags) || 0,
          packaging: parseInt(packaging) || 0,
          straws: parseInt(straws) || 0,
          cups: parseInt(cups) || 0,
          other: parseInt(other) || 0
        },
        totalKg: parseFloat(result.total),
        rating: result.rating,
        date: serverTimestamp(),
        weekNumber: getCurrentWeekNumber(),
        year: new Date().getFullYear()
      });
      
      Alert.alert("Success", "Saved successfully! ✅");
      
      setBottles('0');
      setBags('0');
      setPackaging('0');
      setStraws('0');
      setCups('0');
      setOther('0');
      setResult(null);
    } catch(e) {
      console.log("Save error:", e);
      Alert.alert("Error", "Could not save entry.");
    }
  };

  const chartData = {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    datasets: [{ data: weeklyData }]
  };

  const last = weeklyData[3];
  const prev = weeklyData[2];
  const insight = last < prev && prev > 0
    ? "📉 Great job! Your usage is decreasing."
    : last > prev
    ? "📈 Your usage increased this week. Try to reduce!"
    : "➡️ Your usage has been consistent.";

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Footprint Calculator</Text>
      
      {[
        { label: 'Plastic Bottles', value: bottles, set: setBottles, ind: '♻️ Recyclable', color: '#2E7D32' },
        { label: 'Plastic Bags', value: bags, set: setBags, ind: '🚫 Non-Recyclable', color: '#C62828' },
        { label: 'Food Packaging', value: packaging, set: setPackaging, ind: '🚫 Non-Recyclable', color: '#C62828' },
        { label: 'Straws', value: straws, set: setStraws, ind: '🚫 Non-Recyclable', color: '#C62828' },
        { label: 'Disposable Cups', value: cups, set: setCups, ind: '🚫 Non-Recyclable', color: '#C62828' },
        { label: 'Other Items', value: other, set: setOther, ind: null },
      ].map(item => (
        <View key={item.label} style={styles.row}>
          <View style={{flex: 1}}>
            <Text style={styles.label}>{item.label}</Text>
            {item.ind && <Text style={{fontSize: 10, color: item.color, marginTop: 2}}>{item.ind}</Text>}
          </View>
          <TextInput
            style={styles.input}
            value={item.value}
            onChangeText={item.set}
            keyboardType="numeric"
          />
        </View>
      ))}

      <TouchableOpacity style={styles.button} onPress={calculate}>
        <Text style={styles.buttonText}>Calculate</Text>
      </TouchableOpacity>

      {result && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your Results</Text>
          <View style={{borderBottomWidth: 1, borderBottomColor: '#E0E0E0', paddingBottom: 8, marginBottom: 8}}>
            <Text style={{marginBottom: 4}}>Total this week: {result.total} kg</Text>
            <Text style={{marginBottom: 4}}>Monthly estimate: {result.monthly} kg</Text>
            <Text>Yearly estimate: {result.yearly} kg</Text>
          </View>
          
          <Text style={{fontStyle: 'italic', color: '#E65100', marginBottom: 8}}>
            Environmental impact: Equivalent to {result.impact} plastic bags.
          </Text>
          
          <Text style={{fontWeight: '600'}}>
            Rating: <Text style={{color: 
              result.rating === 'Excellent' ? '#2E7D32' : 
              result.rating === 'Good' ? '#F9A825' : 
              result.rating === 'Moderate' ? '#E65100' : '#C62828'
            }}>{result.rating}</Text>
          </Text>
          
          <TouchableOpacity style={[styles.button, {marginTop: 16, marginBottom: 0}]} onPress={saveToDashboard}>
            <Text style={styles.buttonText}>Save to Dashboard</Text>
          </TouchableOpacity>
        </View>
      )}

      {historyTab === 'personal' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📊 4-Week Trend</Text>
          {(() => {
            try {
              return (
                <View>
                  <BarChart
                    data={chartData}
                    width={Dimensions.get('window').width - 64}
                    height={200}
                    chartConfig={{
                      backgroundColor: '#ffffff',
                      backgroundGradientFrom: '#ffffff',
                      backgroundGradientTo: '#ffffff',
                      decimalPlaces: 2,
                      color: (opacity = 1) => `rgba(46, 125, 50, ${opacity})`,
                      labelColor: (opacity = 1) => `rgba(92, 92, 92, ${opacity})`,
                    }}
                    style={{ borderRadius: 12 }}
                  />
                  <Text style={{ textAlign: 'center', marginTop: 10, color: '#5C5C5C', fontWeight: '500' }}>
                    {insight}
                  </Text>
                </View>
              );
            } catch(e) {
              return <Text style={styles.empty}>Chart unavailable</Text>;
            }
          })()}
        </View>
      )}

      <View style={styles.card}>
        <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
          <Text style={[styles.cardTitle, {marginBottom: 0}]}>History</Text>
          {user?.role === 'admin' && (
            <View style={{flexDirection: 'row'}}>
              <TouchableOpacity onPress={() => setHistoryTab('personal')} style={{paddingHorizontal: 8, paddingVertical: 4, backgroundColor: historyTab === 'personal' ? '#2E7D32' : '#E0E0E0', borderRadius: 4, marginRight: 8}}>
                <Text style={{color: historyTab === 'personal' ? 'white' : 'black', fontSize: 12}}>Personal</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setHistoryTab('society')} style={{paddingHorizontal: 8, paddingVertical: 4, backgroundColor: historyTab === 'society' ? '#2E7D32' : '#E0E0E0', borderRadius: 4}}>
                <Text style={{color: historyTab === 'society' ? 'white' : 'black', fontSize: 12}}>Society</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        
        {loading ? (
          <ActivityIndicator size="small" color="#2E7D32" />
        ) : history.length === 0 ? (
          <Text style={styles.empty}>No history yet. Save a calculation to see it here.</Text>
        ) : (
          history.map(entry => (
            <View key={entry.id} style={{
              backgroundColor: '#F9F9F9',
              borderRadius: 12,
              padding: 12,
              marginBottom: 8,
              borderLeftWidth: 4,
              borderLeftColor:
                entry.rating === 'Excellent' ? '#2E7D32' :
                entry.rating === 'Good' ? '#F9A825' :
                entry.rating === 'Moderate' ? '#E65100' : '#C62828'
            }}>
              <Text style={{fontWeight: '600', color: '#1B1B1B'}}>
                {historyTab === 'society' && entry.userName ? `👤 ${entry.userName} • ` : ''}
                {entry.jsDate.toLocaleDateString('en-IN', {
                  day: '2-digit', month: 'short', year: 'numeric'
                })}
              </Text>
              <Text style={{color: '#5C5C5C', marginTop: 2}}>
                {entry.totalKg?.toFixed(2) || '0.00'} kg  •  
                {entry.rating || 'Unknown'}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F8E9', padding: 16 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#2E7D32', marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', 
         alignItems: 'center', marginBottom: 12, backgroundColor: 'white',
         padding: 12, borderRadius: 12 },
  label: { fontSize: 14, color: '#1B1B1B' },
  input: { width: 80, borderWidth: 1, borderColor: '#A5D6A7', 
           borderRadius: 8, padding: 8, textAlign: 'center' },
  button: { backgroundColor: '#2E7D32', padding: 16, borderRadius: 12,
            alignItems: 'center', marginVertical: 16 },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  card: { backgroundColor: 'white', borderRadius: 16, padding: 16, 
          marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8, 
               color: '#2E7D32' },
  empty: { color: '#5C5C5C', textAlign: 'center', padding: 16 },
  historyItem: { padding: 8, borderBottomWidth: 1, 
                 borderBottomColor: '#F1F8E9' },
});
