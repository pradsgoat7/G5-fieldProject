import AsyncStorage from '@react-native-async-storage/async-storage';

export const saveUserProfile = async (data) => AsyncStorage.setItem('user_profile', JSON.stringify(data));
export const getUserProfile = async () => JSON.parse(await AsyncStorage.getItem('user_profile'));

export const saveSocieties = async (val) => AsyncStorage.setItem('societies', JSON.stringify(val));
export const getSocieties = async () => JSON.parse(await AsyncStorage.getItem('societies'));

export const saveAllUsers = async (val) => AsyncStorage.setItem('all_users', JSON.stringify(val));
export const getAllUsers = async () => JSON.parse(await AsyncStorage.getItem('all_users'));

export const saveLoggedInUser = async (data) => AsyncStorage.setItem('logged_in_user', JSON.stringify(data));
export const getLoggedInUser = async () => JSON.parse(await AsyncStorage.getItem('logged_in_user'));

export const saveFootprintEntries = async (entries) => AsyncStorage.setItem('footprint_entries', JSON.stringify(entries));
export const getAllFootprintEntries = async () => JSON.parse(await AsyncStorage.getItem('footprint_entries'));

export const saveSubmissions = async (entries) => AsyncStorage.setItem('exchange_submissions', JSON.stringify(entries));
export const getAllSubmissions = async () => JSON.parse(await AsyncStorage.getItem('exchange_submissions'));

export const savePickups = async (entries) => AsyncStorage.setItem('pickups', JSON.stringify(entries));
export const getAllPickups = async () => JSON.parse(await AsyncStorage.getItem('pickups'));

export const saveRedemptions = async (entries) => AsyncStorage.setItem('redemptions', JSON.stringify(entries));
export const getAllRedemptions = async () => JSON.parse(await AsyncStorage.getItem('redemptions'));

export const saveChallengeJoined = async (val) => AsyncStorage.setItem('challenge_joined', JSON.stringify(val));
export const getChallengeJoined = async () => JSON.parse(await AsyncStorage.getItem('challenge_joined'));

export const saveHelpfulTips = async (val) => AsyncStorage.setItem('helpful_tips', JSON.stringify(val));
export const getHelpfulTips = async () => JSON.parse(await AsyncStorage.getItem('helpful_tips'));

export const saveRecentActivity = async (val) => AsyncStorage.setItem('activity_feed', JSON.stringify(val));
export const getRecentActivity = async () => JSON.parse(await AsyncStorage.getItem('activity_feed'));
