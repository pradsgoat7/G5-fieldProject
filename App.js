import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { AppProvider } from './src/context/AppContext';
import AppNavigator from './src/navigation/AppNavigator';
import OnboardingScreen from './src/screens/OnboardingScreen';
import * as storage from './src/services/storageService';

export default function App() {
  const [showOnboarding, setShowOnboarding] = useState(null);

  useEffect(() => {
    checkOnboarding();
  }, []);

  const checkOnboarding = async () => {
    const isComplete = await storage.getOnboardingComplete();
    setShowOnboarding(isComplete !== 'true');
  };

  if (showOnboarding === null) return null; 

  return (
    <AppProvider>
      <NavigationContainer>
        {showOnboarding ? <OnboardingScreen onComplete={() => setShowOnboarding(false)} /> : <AppNavigator />}
      </NavigationContainer>
    </AppProvider>
  );
}
