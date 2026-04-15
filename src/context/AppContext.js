import React, { createContext, useState, useEffect } from 'react';
import * as storage from '../services/storageService';

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);

  // Users & Roles
  const [allUsers, setAllUsers] = useState([]);
  const [societies, setSocieties] = useState([]);
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Data lists
  const [footprintEntries, setFootprintEntries] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [pickups, setPickups] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [challengeJoined, setChallengeJoined] = useState(false);
  const [helpfulTips, setHelpfulTips] = useState([]);

  // Filtered views
  const [societySubmissions, setSocietySubmissions] = useState([]);
  const [societyRedemptions, setSocietyRedemptions] = useState([]);
  const [societyPickups, setSocietyPickups] = useState([]);
  const [personalFootprints, setPersonalFootprints] = useState([]);
  const [personalActivity, setPersonalActivity] = useState([]);

  // Derived state
  const [points, setPoints] = useState(0);
  const [footprint, setFootprint] = useState(0);
  const [itemsLogged, setItemsLogged] = useState(0);
  const [pickupsScheduled, setPickupsScheduled] = useState(0);
  const [co2Saved] = useState(1.2);

  useEffect(() => {
    loadAllData();
  }, []);

  // Filter logic whenever base lists or user changes
  useEffect(() => {
    if (!user) return;
    const socSubs = submissions.filter(s => s.societyCode === user.societyCode);
    const socReds = redemptions.filter(r => r.societyCode === user.societyCode);
    const socPicks = pickups.filter(p => p.societyCode === user.societyCode);
    const myFoots = footprintEntries.filter(f => f.userId === user.id);
    const myAct = recentActivity.filter(a => a.userId === user.id);

    setSocietySubmissions(socSubs);
    setSocietyRedemptions(socReds);
    setSocietyPickups(socPicks);
    setPersonalFootprints(myFoots);
    setPersonalActivity(myAct);

    setPoints(socSubs.reduce((acc, sub) => acc + (sub.points || 0), 0) - socReds.reduce((acc, r) => acc + (r.pointsSpent || 0), 0));
    setFootprint(myFoots[0]?.totalKg || 0);
    setItemsLogged(myFoots.reduce((acc, curr) => acc + (curr.items || 0), 0));
    setPickupsScheduled(socPicks.length);
  }, [submissions, redemptions, footprintEntries, pickups, recentActivity, user]);

  const loadAllData = async () => {
    try {
      const uProfile = await storage.getLoggedInUser();
      const sAllUsers = await storage.getAllUsers();
      const sSocieties = await storage.getSocieties();
      setAllUsers(sAllUsers || []);
      setSocieties(sSocieties || []);

      if (uProfile) {
        setUser(uProfile);
        setIsAuthenticated(true);
      }

      setFootprintEntries(await storage.getAllFootprintEntries() || []);
      setSubmissions(await storage.getAllSubmissions() || []);
      setPickups(await storage.getAllPickups() || []);
      setRedemptions(await storage.getAllRedemptions() || []);
      setRecentActivity(await storage.getRecentActivity() || []);
      
      const chal = await storage.getChallengeJoined();
      setChallengeJoined(chal || false);
      setHelpfulTips(await storage.getHelpfulTips() || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  // Auth Functions
  const registerAdmin = async (name, societyName, email, password) => {
    const societyCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    if (societies.find(s => s.societyName.toLowerCase() === societyName.toLowerCase())) {
      throw new Error(`A society with this name already exists. If you are a resident, register as a Member.`);
    }

    const newSociety = { societyCode, societyName, adminEmail: email, registrationDate: Date.now() };
    const navSoc = [...societies, newSociety];
    setSocieties(navSoc);
    console.log("Generated society code:", societyCode);
    await storage.saveSocieties(navSoc);
    console.log("Successfully saved society to AsyncStorage");

    const newUser = { id: Date.now().toString(), name, email, password, role: 'admin', societyCode, societyName };
    const navUsers = [...allUsers, newUser];
    setAllUsers(navUsers);
    await storage.saveAllUsers(navUsers);

    // Do not auto-login admins so they can see the Success Screen and then proceed to Login manually
    return societyCode;
  };

  const registerMember = async (name, email, societyCode, password) => {
    const soc = societies.find(s => s.societyCode === societyCode);
    if (!soc) throw new Error('Invalid society code. Please check with your society admin.');

    const newUser = { id: Date.now().toString(), name, email, password, role: 'member', societyCode, societyName: soc.societyName };
    const navUsers = [...allUsers, newUser];
    setAllUsers(navUsers);
    await storage.saveAllUsers(navUsers);

    setUser(newUser);
    setIsAuthenticated(true);
    await storage.saveLoggedInUser(newUser);
  };

  const loginByCredentials = async (email, password) => {
    const found = allUsers.find(u => u.email === email && u.password === password);
    if (!found) throw new Error('Invalid email or password.');
    
    setUser(found);
    setIsAuthenticated(true);
    await storage.saveLoggedInUser(found);
  };

  const logout = async () => {
    setUser(null);
    setIsAuthenticated(false);
    await storage.saveLoggedInUser(null);
  };

  // Writes
  const logActivity = async (title) => {
    const newEntry = { id: Date.now().toString(), title, date: new Date().toISOString(), userId: user?.id, societyCode: user?.societyCode };
    const updated = [newEntry, ...recentActivity];
    setRecentActivity(updated);
    await storage.saveRecentActivity(updated);
  };

  const addFootprintEntry = async (entry) => {
    const updated = [{ ...entry, userId: user?.id, societyCode: user?.societyCode }, ...footprintEntries];
    setFootprintEntries(updated);
    await storage.saveFootprintEntries(updated);
  };

  const addSubmission = async (entry) => {
    const updated = [{ ...entry, societyCode: user?.societyCode }, ...submissions];
    setSubmissions(updated);
    await storage.saveSubmissions(updated);
  };

  const addPickup = async (entry) => {
    const updated = [{ ...entry, societyCode: user?.societyCode }, ...pickups];
    setPickups(updated);
    await storage.savePickups(updated);
  };

  const updatePickupStatus = async (id, status) => {
    const updated = pickups.map(p => p.id === id ? { ...p, status } : p);
    setPickups(updated);
    await storage.savePickups(updated);
    if (status === 'Completed') {
      // Auto add 50 points to society
      await addSubmission({ id: Date.now().toString() + 'bonus', date: new Date().toISOString(), type: 'Pickup Bonus', kg: 0, points: 50 });
    }
  };

  const addRedemption = async (entry) => {
    const updated = [{ ...entry, societyCode: user?.societyCode }, ...redemptions];
    setRedemptions(updated);
    await storage.saveRedemptions(updated);
  };

  const toggleChallenge = async () => {
    // Challenge per user logic would save locally per device usually, but let's keep it simple
    setChallengeJoined(!challengeJoined);
    await storage.saveChallengeJoined(!challengeJoined);
  };

  return (
    <AppContext.Provider value={{
      isLoading, isAuthenticated,
      user, societies, allUsers,
      registerAdmin, registerMember, loginByCredentials, logout,
      points, footprint, itemsLogged, pickupsScheduled, co2Saved,
      footprintEntries, personalFootprints, addFootprintEntry,
      submissions, societySubmissions, addSubmission,
      pickups, societyPickups, addPickup, updatePickupStatus,
      redemptions, societyRedemptions, addRedemption,
      recentActivity, personalActivity, logActivity,
      challengeJoined, toggleChallenge,
      helpfulTips, setHelpfulTips
    }}>
      {children}
    </AppContext.Provider>
  );
};
