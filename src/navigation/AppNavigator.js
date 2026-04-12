import React, { useContext } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppContext } from '../context/AppContext';
import { colors } from '../theme/colors';

// Screens
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import CalculatorScreen from '../screens/CalculatorScreen';
import ExchangeScreen from '../screens/ExchangeScreen';
import VendorsScreen from '../screens/VendorsScreen';
import CommunityScreen from '../screens/CommunityScreen';
import RewardsScreen from '../screens/RewardsScreen';
import SocietyPointsScreen from '../screens/SocietyPointsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const AdminTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Home') iconName = 'home';
          else if (route.name === 'Calculator') iconName = 'calculator';
          else if (route.name === 'Exchange') iconName = 'star';
          else if (route.name === 'Vendors') iconName = 'truck-delivery';
          else if (route.name === 'Community') iconName = 'account-group';
          return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Calculator" component={CalculatorScreen} />
      <Tab.Screen name="Exchange" component={ExchangeScreen} />
      <Tab.Screen name="Vendors" component={VendorsScreen} />
      <Tab.Screen name="Community" component={CommunityScreen} />
    </Tab.Navigator>
  );
};

const MemberTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Home') iconName = 'home';
          else if (route.name === 'Calculator') iconName = 'calculator';
          else if (route.name === 'Society Points') iconName = 'star';
          else if (route.name === 'Community') iconName = 'account-group';
          return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Calculator" component={CalculatorScreen} />
      <Tab.Screen name="Society Points" component={SocietyPointsScreen} />
      <Tab.Screen name="Community" component={CommunityScreen} />
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  const { isAuthenticated, isLoading, user } = useContext(AppContext);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <>
          <Stack.Screen name="Main" component={user?.role === 'admin' ? AdminTabs : MemberTabs} />
          <Stack.Screen name="Rewards" component={RewardsScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;
