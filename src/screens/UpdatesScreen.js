import React, { useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Alert, TextInput, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, deleteDoc, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AppContext } from '../context/AppContext';
import { colors } from '../theme/colors';
import Card from '../components/Card';
import Button from '../components/Button';
import { useTranslation, getLocale } from '../i18n';

const UpdatesScreen = () => {
  const { user } = useContext(AppContext);
  const { t } = useTranslation();
  const [updates, setUpdates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState('announcement');

  useEffect(() => {
    if (!user || !user.societyCode) {
      setUpdates([]);
      setIsLoading(false);
      return;
    }
    const q = query(collection(db, "announcements"), where("societyCode", "==", user.societyCode));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
      const sortedData = data.sort((a, b) => {
        const aTime = a.timestamp || 0;
        const bTime = b.timestamp || 0;
        return bTime - aTime;
      });
      setUpdates(sortedData);
      setIsLoading(false);
    }, (error) => {
      console.log("Error fetching announcements", error);
      setUpdates([]);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const handlePost = async () => {
    if (!newTitle.trim() || !newDesc.trim()) {
      return Alert.alert(t('common.error'), t('updates.fillBoth'));
    }
    try {
      await addDoc(collection(db, "announcements"), {
        societyCode: user.societyCode,
        type: newType,
        title: newTitle,
        description: newDesc,
        timestamp: Date.now(),
        postedBy: user.uid,
        createdAt: serverTimestamp()    
      });
      Alert.alert(t('calculator.successTitle'), t('updates.posted'));
      setNewTitle('');
      setNewDesc('');
      setIsCreating(false);
    } catch (e) {
      console.error(e);
      Alert.alert(t('common.error'), t('updates.postError'));
    }
  };

  const handleDelete = async (id) => {
    Alert.alert(t('updates.delete'), t('updates.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('updates.delete'), style: 'destructive', onPress: async () => {
          try {
            await deleteDoc(doc(db, "announcements", id));
          } catch (e) {
            console.error(e);
            Alert.alert(t('common.error'), t('updates.deleteError'));
          }
      }}
    ]);
  };

  const CATEGORIES = [
    { id: 'announcement', icon: 'bullhorn', color: '#1976D2', label: t('updates.categories.announcement') },
    { id: 'pickup', icon: 'truck', color: '#F57D00', label: t('updates.categories.pickup') },
    { id: 'event', icon: 'calendar-star', color: '#9C27B0', label: t('updates.categories.event') },
    { id: 'progress', icon: 'trending-up', color: '#2E7D32', label: t('updates.categories.progress') }
  ];

  const getStyleForType = (type) => CATEGORIES.find(c => c.id === type) || CATEGORIES[0];

  if (hasError) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text>{t('updates.loadError')}</Text>
        <TouchableOpacity onPress={() => setHasError(false)}>
          <Text style={{color: '#2E7D32', marginTop: 10}}>{t('updates.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  try {
    return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="broadcast" size={28} color={colors.primary} />
        <Text style={styles.headerTitle}>{t('updates.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {user?.role === 'admin' && (
           <View style={{ marginBottom: 20 }}>
             <Button 
                title={isCreating ? t('common.cancel') : t('updates.postNew')} 
                type={isCreating ? "secondary" : "primary"} 
                onPress={() => setIsCreating(!isCreating)} 
             />
             
             {isCreating && (
               <Card style={styles.createCard}>
                 <Text style={styles.sectionTitle}>{t('updates.create')}</Text>
                 
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
                   {t('updates.selected', { category: CATEGORIES.find(c => c.id === newType)?.label })}
                 </Text>

                 <TextInput 
                   style={styles.input} 
                   placeholder={t('updates.titlePlaceholder')}
                   value={newTitle}
                   onChangeText={setNewTitle}
                 />
                 <TextInput 
                   style={[styles.input, {height: 80, textAlignVertical: 'top'}]} 
                   placeholder={t('updates.descPlaceholder')}
                   value={newDesc}
                   multiline
                   onChangeText={setNewDesc}
                 />

                 <Button title={t('updates.post')} onPress={handlePost} />
               </Card>
             )}
           </View>
        )}

        <Text style={styles.sectionTitle}>{t('updates.latest')}</Text>
        
        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : updates.length === 0 ? (
          <Text style={styles.emptyText}>{t('updates.none')}</Text>
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
                      <Text style={styles.updateDate}>{item.timestamp ? new Date(item.timestamp).toLocaleString(getLocale()) : t('common.justNow')}</Text>
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
  } catch (err) {
    console.error("Render error in UpdatesScreen:", err);
    if (!hasError) setHasError(true);
    return null;
  }
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
