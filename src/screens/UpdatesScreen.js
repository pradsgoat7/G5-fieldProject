import React, { useContext, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Alert, TextInput } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { AppContext } from '../context/AppContext';
import { colors } from '../theme/colors';
import Card from '../components/Card';
import Button from '../components/Button';
import * as storage from '../services/storageService';

const UpdatesScreen = () => {
  const { user } = useContext(AppContext);
  const [updates, setUpdates] = useState([]);
  
  // Admin form
  const [isCreating, setIsCreating] = useState(false);
  const [newType, setNewType] = useState('announcement');
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  useFocusEffect(
    React.useCallback(() => {
      loadUpdates();
    }, [user])
  );

  const loadUpdates = async () => {
    try {
      const allUpdates = await storage.getCommunityUpdates() || [];
      const societyUpdates = allUpdates.filter(u => u.societyCode === user.societyCode);
      setUpdates(societyUpdates.sort((a,b) => b.timestamp - a.timestamp));
    } catch(e) {}
  };

  const handlePost = async () => {
    if (!newTitle.trim() || !newDesc.trim()) {
      return Alert.alert('Error', 'Please fill out both title and description.');
    }
    const newItem = {
      id: Date.now().toString(),
      societyCode: user.societyCode,
      type: newType,
      title: newTitle,
      description: newDesc,
      timestamp: Date.now()
    };
    const allUpdates = await storage.getCommunityUpdates() || [];
    await storage.saveCommunityUpdates([...allUpdates, newItem]);
    Alert.alert('Success', 'Update posted!');
    setNewTitle('');
    setNewDesc('');
    setIsCreating(false);
    loadUpdates();
  };

  const handleDelete = async (id) => {
    Alert.alert('Delete', 'Are you sure you want to delete this update?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          const allUpdates = await storage.getCommunityUpdates() || [];
          const filtered = allUpdates.filter(u => u.id !== id);
          await storage.saveCommunityUpdates(filtered);
          loadUpdates();
      }}
    ]);
  };

  const CATEGORIES = [
    { id: 'announcement', icon: 'bullhorn', color: '#1976D2', label: 'Announcement' },
    { id: 'pickup', icon: 'truck', color: '#F57D00', label: 'Vendor Pickup' },
    { id: 'event', icon: 'calendar-star', color: '#9C27B0', label: 'Event' },
    { id: 'progress', icon: 'trending-up', color: '#2E7D32', label: 'Progress Focus' }
  ];

  const getStyleForType = (type) => CATEGORIES.find(c => c.id === type) || CATEGORIES[0];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="broadcast" size={28} color={colors.primary} />
        <Text style={styles.headerTitle}>Society Updates</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {user?.role === 'admin' && (
           <View style={{ marginBottom: 20 }}>
             <Button 
                title={isCreating ? "Cancel" : "Post New Update 📢"} 
                type={isCreating ? "secondary" : "primary"} 
                onPress={() => setIsCreating(!isCreating)} 
             />
             
             {isCreating && (
               <Card style={styles.createCard}>
                 <Text style={styles.sectionTitle}>Create Update</Text>
                 
                 <View style={styles.typeSelectorRow}>
                   {CATEGORIES.map(c => (
                     <TouchableOpacity 
                       key={c.id} 
                       style={[styles.typeBtn, newType === c.id && styles.typeBtnActive, { borderColor: c.color }]} 
                       onPress={() => setNewType(c.id)}
                     >
                       <MaterialCommunityIcons name={c.icon} size={20} color={newType === c.id ? '#FFF' : c.color} />
                     </TouchableOpacity>
                   ))}
                 </View>

                 <Text style={{fontSize: 12, color: colors.textSecondary, marginBottom: 10, alignSelf:'center', fontWeight:'bold'}}>
                   {CATEGORIES.find(c => c.id === newType)?.label} Selected
                 </Text>

                 <TextInput 
                   style={styles.input} 
                   placeholder="Headline Title"
                   value={newTitle}
                   onChangeText={setNewTitle}
                 />
                 <TextInput 
                   style={[styles.input, {height: 80, textAlignVertical: 'top'}]} 
                   placeholder="Details / Description..."
                   value={newDesc}
                   multiline
                   onChangeText={setNewDesc}
                 />

                 <Button title="Post to Community" onPress={handlePost} />
               </Card>
             )}
           </View>
        )}

        <Text style={styles.sectionTitle}>Latest Updates</Text>
        
        {updates.length === 0 ? (
          <Text style={styles.emptyText}>No recent updates from your society admin.</Text>
        ) : (
          updates.map(item => {
            const styleRef = getStyleForType(item.type);
            return (
              <Card key={item.id} style={[styles.updateCard, { borderLeftColor: styleRef.color, borderLeftWidth: 5 }]}>
                <View style={styles.cardHeader}>
                   <View style={[styles.iconWrapper, { backgroundColor: styleRef.color + '20' }]}>
                     <MaterialCommunityIcons name={styleRef.icon} size={28} color={styleRef.color} />
                   </View>
                   <View style={{ flex: 1, marginLeft: 15 }}>
                      <Text style={styles.updateTitle}>{item.title}</Text>
                      <Text style={styles.updateDate}>{new Date(item.timestamp).toLocaleString()}</Text>
                   </View>
                   {user?.role === 'admin' && (
                      <TouchableOpacity onPress={() => handleDelete(item.id)} style={{padding: 5}}>
                        <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.error} />
                      </TouchableOpacity>
                   )}
                </View>
                <Text style={styles.updateDesc}>{item.description}</Text>
              </Card>
            )
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 15,
  },
  emptyText: {
    color: colors.textSecondary,
    fontStyle: 'italic',
    padding: 10,
  },
  createCard: {
    marginTop: 15,
    backgroundColor: '#F8F9FA'
  },
  typeSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  typeBtn: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    width: '22%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary, 
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
  updateCard: {
    padding: 0,
    marginBottom: 15,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    paddingBottom: 5,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  updateTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  updateDate: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  updateDesc: {
    fontSize: 14,
    color: colors.textPrimary,
    paddingHorizontal: 15,
    paddingBottom: 20,
    lineHeight: 22,
    marginTop: 10,
  }
});

export default UpdatesScreen;
