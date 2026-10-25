import React, { useContext } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppContext } from '../context/AppContext';
import { colors } from '../theme/colors';

// Screens
import LoginScreen from '../screens/LoginScreen';
import AdminSuccessScreen from '../screens/AdminSuccessScreen';
import HomeScreen from '../screens/HomeScreen';
import CalculatorScreen from '../screens/CalculatorScreen';
import ExchangeScreen from '../screens/ExchangeScreen';
import VendorsScreen from '../screens/VendorsScreen';
import CommunityScreen from '../screens/CommunityScreen';
import RewardsScreen from '../screens/RewardsScreen';
import SocietyPointsScreen from '../screens/SocietyPointsScreen';
import SustainabilityReportScreen from '../screens/SustainabilityReportScreen';
import MemberActivityScreen from '../screens/MemberActivityScreen';
import VotingScreen from '../screens/VotingScreen';
import UpdatesScreen from '../screens/UpdatesScreen';
import FAQScreen from '../screens/FAQScreen';
import VendorHomeScreen from '../screens/VendorHomeScreen';
import WeighPickupScreen from '../screens/WeighPickupScreen';
import OfficialHomeScreen from '../screens/OfficialHomeScreen';
import PickupReviewScreen from '../screens/PickupReviewScreen';

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

const MAIN_BY_ROLE = {
  admin: AdminTabs,
  member: MemberTabs,
  vendor: VendorHomeScreen,
  bmc_official: OfficialHomeScreen
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
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="AdminSuccess" component={AdminSuccessScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Main" component={MAIN_BY_ROLE[user?.role] || MemberTabs} />
          <Stack.Screen name="Rewards" component={RewardsScreen} />
          <Stack.Screen name="SustainabilityReport" component={SustainabilityReportScreen} />
          <Stack.Screen name="MemberActivity" component={MemberActivityScreen} />
          <Stack.Screen name="CommunityVoting" component={VotingScreen} />
          <Stack.Screen name="Updates" component={UpdatesScreen} />
          <Stack.Screen name="FAQ" component={FAQScreen} />
          <Stack.Screen name="WeighPickup" component={WeighPickupScreen} />
          <Stack.Screen name="PickupReview" component={PickupReviewScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;
