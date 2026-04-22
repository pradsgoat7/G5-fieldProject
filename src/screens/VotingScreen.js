import React, { useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Alert, TextInput, Platform, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AppContext } from '../context/AppContext';
import { colors } from '../theme/colors';
import Card from '../components/Card';
import Button from '../components/Button';

const VotingScreen = () => {
  const { user } = useContext(AppContext);
  const [polls, setPolls] = useState([]);
  const [societyMemberCount, setSocietyMemberCount] = useState(1);
  const [societyPoints, setSocietyPoints] = useState(0);
  
  // Admin form state
  const [isCreating, setIsCreating] = useState(false);
  const [newPollType, setNewPollType] = useState('reward'); // 'reward' or 'date'
  const [newPollQuestion, setNewPollQuestion] = useState('');
  const [customDates, setCustomDates] = useState(['', '']);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const unsubSocieties = onSnapshot(doc(db, "societies", user.societyCode), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSocietyMemberCount(Math.max(data.memberCount || 1, 1));
        setSocietyPoints(data.totalPointsEarned || 0);
      }
    });

    const unsubPolls = onSnapshot(query(collection(db, "polls"), where("societyCode", "==", user.societyCode)), (snapshot) => {
      const data = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
      setPolls(data.sort((a,b) => b.createdAt - a.createdAt));
      setIsLoading(false);
    });

    return () => {
      unsubSocieties();
      unsubPolls();
    };
  }, [user]);

  const REWARD_OPTIONS = [
    { label: 'Water Bill Discount', cost: 10000 },
    { label: 'Property Tax Reduction', cost: 20000 },
    { label: 'Certificate', cost: 2000 },
    { label: 'Free Pickup', cost: 5000 }
  ];

  const showAlert = (title, msg) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  };

  const handleCreatePoll = async () => {
    try {
      if (!newPollQuestion || !newPollQuestion.trim()) {
        return showAlert('Error', 'Please enter a valid poll question.');
      }

      let finalOptions = [];
      if (newPollType === 'reward') {
        const affordable = REWARD_OPTIONS.filter(r => societyPoints >= r.cost).map(r => r.label);
        if (affordable.length < 2) {
          return showAlert('Error', 'Your society must afford at least 2 reward options to launch a valid poll. Current points: ' + societyPoints);
        }
        finalOptions = affordable;
      } else {
        const validDates = customDates.filter(d => Boolean(d) && d.trim().length > 0);
        if (validDates.length < 2) {
          return showAlert('Error', 'Please provide at least 2 date options.');
        }
        finalOptions = validDates;
      }

      await addDoc(collection(db, "polls"), {
         societyCode: user.societyCode,
         question: newPollQuestion.trim(),
         type: newPollType, 
         options: finalOptions,
         votes: {},
         createdAt: Date.now(),
         endsAt: Date.now() + 3 * 24 * 60 * 60 * 1000, 
         status: 'active', 
         finalDecision: null
      });

      showAlert('Success', 'Poll created successfully!');
      setIsCreating(false);
      setNewPollQuestion('');
      setCustomDates(['', '']);
    } catch(err) {
      console.log('Save Poll Error:', err);
      showAlert('Error', 'Failed to save the poll correctly.');
    }
  };

  const handleVote = async (pollId, optionIndex) => {
    try {
      const pollRef = doc(db, "polls", pollId);
      const poll = polls.find(p => p.id === pollId);
      if (!poll) return;

      const newVotes = { ...poll.votes, [user.uid]: optionIndex };
      await updateDoc(pollRef, { votes: newVotes });
      showAlert('Voted!', 'Your vote has been cast. Thank you!');
    } catch (e) {
      console.log(e);
      showAlert('Error', 'Could not cast vote.');
    }
  };

  const finalizeTie = async (pollId, chosenOptionLabel) => {
    try {
      const pollRef = doc(db, "polls", pollId);
      await updateDoc(pollRef, {
         status: 'completed',
         finalDecision: chosenOptionLabel
      });
      showAlert('Resolved', 'You successfully resolved the tie!');
    } catch (e) {
      console.log(e);
      showAlert('Error', 'Could not resolve tie.');
    }
  };

  const renderPoll = (poll) => {
    const isExpired = Date.now() > poll.endsAt;
    const voteKeys = Object.keys(poll.votes || {});
    const totalVotes = voteKeys.length;
    const hasVoted = voteKeys.includes(user.uid);
    const requiredVotes = Math.ceil(societyMemberCount * 0.4);
    
    const isCompleted = poll.status === 'completed' || isExpired;
    
    let resultJSX = null;

    // Calculate options counts
    const optionCounts = poll.options.map((opt, idx) => {
      const count = Object.values(poll.votes || {}).filter(v => v === idx).length;
      return { opt, count, idx };
    });

    if (isCompleted) {
      if (totalVotes < requiredVotes) {
        resultJSX = <Text style={[styles.statusText, {color: colors.error}]}>Insufficient Participation (required {requiredVotes})</Text>;
      } else {
        const maxVotes = Math.max(...optionCounts.map(o => o.count));
        const winners = optionCounts.filter(o => o.count === maxVotes);
        
        if (poll.finalDecision) {
           resultJSX = <Text style={[styles.statusText, {color: colors.success}]}>Winner: {poll.finalDecision}</Text>;
        } else if (winners.length > 1) {
           if (user.role === 'admin') {
             resultJSX = (
               <View style={{marginTop: 10}}>
                 <Text style={[styles.statusText, {color: colors.warning, marginBottom: 10}]}>Tie — Admin Decision Required</Text>
                 {winners.map(w => (
                   <TouchableOpacity key={w.idx} onPress={() => finalizeTie(poll.id, w.opt)} style={styles.tieBtn}>
                     <Text style={{color: '#FFF', fontWeight: 'bold'}}>👉 Finalize "{w.opt}"</Text>
                   </TouchableOpacity>
                 ))}
               </View>
             );
           } else {
             resultJSX = <Text style={[styles.statusText, {color: colors.warning}]}>Tie — Admin Decision Required</Text>;
           }
        } else {
           resultJSX = <Text style={[styles.statusText, {color: colors.success}]}>Winner: {winners[0].opt}</Text>;
        }
      }
    }

    return (
      <Card key={poll.id} style={styles.pollCard}>
        <View style={styles.pollHeader}>
           <MaterialCommunityIcons name="poll" size={24} color={colors.primary} />
           <Text style={styles.pollQuestion}>{poll.question}</Text>
        </View>

        {!isCompleted && <Text style={styles.infoText}>Ends: {new Date(poll.endsAt).toLocaleDateString()}</Text>}
        <Text style={styles.infoText}>Participation: {totalVotes} / {requiredVotes} required</Text>

        <View style={{ marginTop: 15 }}>
          {optionCounts.map(item => {
            const pct = totalVotes > 0 ? ((item.count / totalVotes) * 100).toFixed(0) : 0;
            const isUserChoice = (poll.votes || {})[user.uid] === item.idx;

            return (
              <View key={item.idx} style={styles.optionContainer}>
                 {(!isCompleted && !hasVoted && user.role === 'member') ? (
                    <TouchableOpacity style={styles.voteBtn} onPress={() => handleVote(poll.id, item.idx)}>
                       <Text style={styles.voteBtnText}>Vote</Text>
                    </TouchableOpacity>
                 ) : null}

                 <View style={{flex: 1}}>
                   <View style={styles.optionLabelRow}>
                     <Text style={[styles.optionName, isUserChoice && {color: colors.primary, fontWeight: 'bold'}]}>
                       {item.opt} {isUserChoice ? '✅' : ''}
                     </Text>
                     <Text style={styles.optionStats}>{item.count} votes ({pct}%)</Text>
                   </View>
                   <View style={styles.progressBarBg}>
                     <View style={[styles.progressBarFill, { width: `${pct}%` }]} />
                   </View>
                 </View>
              </View>
            );
          })}
        </View>

        {isCompleted && <View style={styles.resultBox}>{resultJSX}</View>}
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="vote" size={28} color={colors.primary} />
        <Text style={styles.headerTitle}>Community Voting</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>

        {isLoading && <ActivityIndicator size="large" color={colors.primary} style={{marginBottom: 15}} />}

        {user?.role === 'admin' && (
          <View style={styles.adminControls}>
             <Button 
                title={isCreating ? "Cancel" : "Create New Poll"} 
                type={isCreating ? "secondary" : "primary"} 
                onPress={() => setIsCreating(!isCreating)} 
             />

             {isCreating && (
               <Card style={styles.createCard}>
                 <Text style={styles.sectionTitle}>Create Poll</Text>
                 
                 <View style={styles.typeSelector}>
                    <TouchableOpacity style={[styles.typeBtn, newPollType === 'reward' && styles.typeBtnActive]} onPress={() => setNewPollType('reward')}>
                      <Text style={[styles.typeText, newPollType === 'reward' && {color: '#FFF'}]}>Reward Vote</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.typeBtn, newPollType === 'date' && styles.typeBtnActive]} onPress={() => setNewPollType('date')}>
                      <Text style={[styles.typeText, newPollType === 'date' && {color: '#FFF'}]}>Pickup Date Vote</Text>
                    </TouchableOpacity>
                 </View>

                 <TextInput 
                   style={styles.input} 
                   placeholder="Enter Poll Question"
                   value={newPollQuestion}
                   onChangeText={setNewPollQuestion}
                 />

                 {newPollType === 'date' && (
                   <View>
                     <Text style={{marginBottom: 5, color: colors.textSecondary}}>Option 1:</Text>
                     <TextInput style={styles.input} value={customDates[0]} onChangeText={(t) => {const n=[...customDates]; n[0]=t; setCustomDates(n);}} placeholder="e.g. 15th Nov" />
                     <Text style={{marginBottom: 5, color: colors.textSecondary}}>Option 2:</Text>
                     <TextInput style={styles.input} value={customDates[1]} onChangeText={(t) => {const n=[...customDates]; n[1]=t; setCustomDates(n);}} placeholder="e.g. 20th Nov" />
                     <Text style={{fontSize: 12, color: '#888'}}>Only standard 2 choices provided for demo</Text>
                   </View>
                 )}

                 {newPollType === 'reward' && (
                   <Text style={{fontSize: 12, color: '#888', marginBottom: 10, fontStyle: 'italic'}}>
                     Reward options are automatically drafted based on affordability (Society Points: {societyPoints}).
                   </Text>
                 )}

                 <Button title="Launch Poll" onPress={handleCreatePoll} />
               </Card>
             )}
          </View>
        )}

        <Text style={styles.sectionTitle}>Active Polls</Text>
        {polls.filter(p => p.status !== 'completed' && Date.now() <= p.endsAt).length === 0 ? (
          <Text style={styles.emptyText}>No active polls right now.</Text>
        ) : (
          polls.filter(p => p.status !== 'completed' && Date.now() <= p.endsAt).map(renderPoll)
        )}

        <View style={{height: 30}} />

        <Text style={styles.sectionTitle}>Completed Polls</Text>
        {polls.filter(p => p.status === 'completed' || Date.now() > p.endsAt).length === 0 ? (
          <Text style={styles.emptyText}>No completed polls yet.</Text>
        ) : (
          polls.filter(p => p.status === 'completed' || Date.now() > p.endsAt).map(renderPoll)
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  emptyText: {
    color: colors.textSecondary,
    fontStyle: 'italic',
    padding: 10,
  },
  adminControls: {
    marginBottom: 25,
  },
  createCard: {
    marginTop: 15,
    backgroundColor: '#F8F9FA'
  },
  typeSelector: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  typeBtnActive: {
    backgroundColor: colors.primary,
  },
  typeText: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFF',
    marginBottom: 15,
  },
  pollCard: {
    marginBottom: 15,
  },
  pollHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  pollQuestion: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginLeft: 10,
    flex: 1,
  },
  infoText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 34,
  },
  optionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  voteBtn: {
    backgroundColor: '#E8F5E9',
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 15,
    marginRight: 15,
  },
  voteBtnText: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  optionLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  optionName: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  optionStats: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: 'bold',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  resultBox: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  tieBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  }
});

export default VotingScreen;
