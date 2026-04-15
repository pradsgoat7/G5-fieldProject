import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Dimensions, FlatList, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import * as storage from '../services/storageService';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    title: 'Track Your Plastic',
    description: 'Log the plastic you use every day and understand your environmental footprint — one item at a time.',
    icon: 'earth',
    bgTint: '#F1F8E9'
  },
  {
    id: '2',
    title: 'Earn Rewards',
    description: 'Submit plastic waste for recycling and earn points for your society. Redeem them for real benefits like bill discounts and certificates.',
    icon: 'star',
    bgTint: '#FFFDE7'
  },
  {
    id: '3',
    title: 'Build a Greener Community',
    description: 'Join weekly challenges, climb the society leaderboard, and work together to reduce plastic waste in your neighborhood.',
    icon: 'handshake-outline',
    bgTint: '#E3F2FD'
  }
];

const OnboardingScreen = ({ navigation, onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef(null);

  const handleFinish = async () => {
    await storage.saveOnboardingComplete('true');
    if (onComplete) {
      onComplete();
    } else {
      // Fallback navigation if passed down via stack
      navigation.replace('AppNavigator');
    }
  };

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    }
  };

  const onScroll = (e) => {
    const x = e.nativeEvent.contentOffset.x;
    const index = Math.round(x / width);
    setCurrentIndex(index);
  };

  const renderItem = ({ item }) => {
    return (
      <View style={[styles.slide, { backgroundColor: item.bgTint }]}>
        <View style={styles.contentContainer}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name={item.icon} size={120} color={colors.primary} />
          </View>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.description}>{item.description}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
         {currentIndex < SLIDES.length - 1 ? (
            <TouchableOpacity onPress={handleFinish}>
               <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
         ) : <View />}
      </View>

      <FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onMomentumScrollEnd={onScroll}
      />

      <View style={styles.footer}>
        <View style={styles.dotsContainer}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, currentIndex === i && styles.activeDot]} />
          ))}
        </View>

        {currentIndex === SLIDES.length - 1 ? (
          <TouchableOpacity style={styles.getStartedBtn} onPress={handleFinish}>
            <Text style={styles.getStartedText}>Get Started 🌿</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
            <Text style={styles.nextText}>Next →</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  topBar: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    zIndex: 1,
    position: 'absolute',
    top: 50,
    width: '100%',
  },
  skipText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: 'bold',
  },
  slide: {
    width,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    alignItems: 'center',
    paddingHorizontal: 30,
    marginTop: -50,
  },
  iconContainer: {
    marginBottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    position: 'absolute',
    bottom: 50,
    width: '100%',
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    marginBottom: 30,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#CCC',
    marginHorizontal: 5,
  },
  activeDot: {
    backgroundColor: colors.primary,
    width: 24,
  },
  nextBtn: {
    alignSelf: 'flex-end',
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginRight: 10,
  },
  nextText: {
    fontSize: 18,
    color: colors.primary,
    fontWeight: 'bold',
  },
  getStartedBtn: {
    backgroundColor: colors.primary,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  getStartedText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  }
});

export default OnboardingScreen;
