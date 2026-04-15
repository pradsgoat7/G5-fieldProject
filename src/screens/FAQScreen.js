import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, LayoutAnimation, UIManager, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FAQ_DATA = [
  {
    id: '1',
    question: 'How are points calculated?',
    answer: 'Points are awarded based on the weight (kg) of plastic items you log or exchange. Different types of plastics have varying multipliers depending on their recyclability. Bonus points are also awarded when your entire society consistently meets recycling thresholds.'
  },
  {
    id: '2',
    question: 'How does the reward system work?',
    answer: 'Admins can host polls where society members vote on potential rewards, like water bill discounts or free vendor pickups. You can only vote on rewards that your society has enough accumulated points to afford.'
  },
  {
    id: '3',
    question: 'How is plastic measured and logged?',
    answer: 'When logging plastic usage, the app uses standard average weights for common items (e.g., a standard PET bottle is ~20g) to calculate your footprint automatically. You can also manually submit exact weights if you have a kitchen scale.'
  },
  {
    id: '4',
    question: 'How are vendors scheduled?',
    answer: 'Admins can create a "Vendor Pickup" poll with specific available dates. Once a date wins the majority vote (with at least 40% participation), the admin finalizes it, and the official pickup will appear in your Society Updates feed.'
  },
  {
    id: '5',
    question: 'What is the dynamic society grading?',
    answer: 'Your society receives a grade (A, B, or C) based on the "average points earned per household per week". A "C" rating means less than 0.3kg average weekly reduction. This levels the playing field so smaller new societies can fairly compete against larger old ones on the Community Leaderboard.'
  }
];

const FAQScreen = () => {
  const [expandedId, setExpandedId] = useState(null);

  const toggleExpand = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="frequently-asked-questions" size={28} color={colors.primary} />
        <Text style={styles.headerTitle}>Frequently Asked Questions</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>General Topics</Text>
        
        {FAQ_DATA.map((item) => {
          const isExpanded = expandedId === item.id;
          return (
            <TouchableOpacity 
              key={item.id} 
              style={[styles.faqCard, isExpanded && styles.faqCardExpanded]} 
              activeOpacity={0.8}
              onPress={() => toggleExpand(item.id)}
            >
              <View style={styles.questionRow}>
                <Text style={styles.questionText}>{item.question}</Text>
                <MaterialCommunityIcons 
                  name={isExpanded ? "chevron-up" : "chevron-down"} 
                  size={24} 
                  color={colors.primary} 
                />
              </View>
              {isExpanded && (
                <View style={styles.answerBox}>
                  <Text style={styles.answerText}>{item.answer}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        <View style={styles.footerContainer}>
           <MaterialCommunityIcons name="leaf" size={40} color={colors.secondary} />
           <Text style={styles.footerText}>More questions? Reach out to your local society admin.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9F9',
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
    color: colors.textSecondary,
    marginBottom: 15,
  },
  faqCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 }
  },
  faqCardExpanded: {
    borderColor: colors.primary,
  },
  questionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  questionText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    flex: 1,
    paddingRight: 10,
  },
  answerBox: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  answerText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
  footerContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  footerText: {
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 10,
    textAlign: 'center',
  }
});

export default FAQScreen;
