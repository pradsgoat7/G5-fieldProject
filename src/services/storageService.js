import AsyncStorage from '@react-native-async-storage/async-storage';

export const saveOnboardingComplete = async (val) => AsyncStorage.setItem('onboarding_complete', val);
export const getOnboardingComplete = async () => await AsyncStorage.getItem('onboarding_complete');
