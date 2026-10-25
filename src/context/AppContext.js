import React, { createContext, useState, useEffect } from 'react';
import { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, deleteUser } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, increment, writeBatch } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { translate as t } from '../i18n';

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const [helpfulTips, setHelpfulTips] = useState([
    { id: '1', title: 'Bring Reusable Bags', category: 'Shopping', desc: 'Keep a few reusable bags in your car or by the door so you do not forget them.' },
    { id: '2', title: 'Say No to Straws', category: 'Dining', desc: 'When ordering a drink, simply ask the server to hold the straw.' },
    { id: '3', title: 'Use a Reusable Bottle', category: 'Daily', desc: 'Switching to a reusable water bottle can save hundreds of plastic bottles a year.' },
    { id: '4', title: 'Buy in Bulk', category: 'Shopping', desc: 'Buying items in bulk reduces packaging waste. Store them in glass or reusable containers.' }
  ]);
  const [challengeJoined, setChallengeJoined] = useState(false); // mock for now

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userDoc.exists()) {
            setUser(userDoc.data());
            setIsAuthenticated(true);
          } else {
            console.warn("User document not found in Firestore!");
            setUser(null);
            setIsAuthenticated(false);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          setUser(null);
          setIsAuthenticated(false);
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const friendlyAuthError = (error) => {
    if (error.code === 'auth/email-already-in-use') return t('auth.emailInUse');
    if (error.code === 'auth/weak-password') return t('auth.weakPassword');
    if (error.code === 'auth/invalid-email') return t('auth.invalidEmail');
    return error.message;
  };

  // If profile setup fails after the auth account is created, remove the account
  // so the email isn't left registered with no user document.
  const rollbackAuthUser = async (createdUser) => {
    if (!createdUser) return;
    try {
      await deleteUser(createdUser);
    } catch (e) {
      console.error("rollbackAuthUser error:", e);
    }
  };

  const registerAdmin = async (name, societyName, ward, email, password) => {
    let createdUser = null;
    try {
      const societyCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      createdUser = userCredential.user;
      const uid = userCredential.user.uid;

      await setDoc(doc(db, "users", uid), {
        uid,
        name,
        email,
        role: "admin",
        societyCode,
        societyName,
        ward,
        createdAt: Date.now()
      });

      await setDoc(doc(db, "societies", societyCode), {
        societyCode,
        societyName,
        ward,
        adminEmail: email,
        adminUid: uid,
        memberCount: 1,
        registrationDate: Date.now(),
        totalPointsEarned: 0
      });

      return societyCode;
    } catch (error) {
      console.error("registerAdmin error:", error);
      await rollbackAuthUser(createdUser);
      throw new Error(friendlyAuthError(error));
    }
  };

  const registerMember = async (name, email, societyCode, password) => {
    let createdUser = null;
    try {
      const societyDocRef = doc(db, "societies", societyCode);
      const societyDoc = await getDoc(societyDocRef);

      if (!societyDoc.exists()) {
        throw new Error(t('auth.invalidSocietyCode'));
      }

      const societyData = societyDoc.data();

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      createdUser = userCredential.user;
      const uid = userCredential.user.uid;

      const userData = {
        uid,
        name,
        email,
        role: "member",
        societyCode,
        societyName: societyData.societyName,
        ...(societyData.ward ? { ward: societyData.ward } : {}),
        createdAt: Date.now()
      };
      await setDoc(doc(db, "users", uid), userData);

      await updateDoc(societyDocRef, {
        memberCount: increment(1)
      });

      // onAuthStateChanged fires before the user doc is written, so it can't log the member in
      setUser(userData);
      setIsAuthenticated(true);
    } catch (error) {
      console.error("registerMember error:", error);
      await rollbackAuthUser(createdUser);
      throw new Error(friendlyAuthError(error));
    }
  };

  // Vendors and BMC officials join with an invite code; the code decides which role they get
  const registerStaff = async (name, organization, ward, inviteCode, email, password) => {
    let createdUser = null;
    try {
      const code = inviteCode.trim().toUpperCase();
      const inviteDoc = await getDoc(doc(db, "invite_codes", code));
      const role = inviteDoc.exists() ? inviteDoc.data().role : null;

      if (role !== 'vendor' && role !== 'bmc_official') {
        throw new Error(t('auth.invalidInviteCode'));
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      createdUser = userCredential.user;
      const uid = userCredential.user.uid;

      const userData = {
        uid,
        name,
        email,
        role,
        organization,
        ward,
        inviteCode: code,
        createdAt: Date.now()
      };
      await setDoc(doc(db, "users", uid), userData);

      // onAuthStateChanged fires before the user doc is written, so it can't log the user in
      setUser(userData);
      setIsAuthenticated(true);
    } catch (error) {
      console.error("registerStaff error:", error);
      await rollbackAuthUser(createdUser);
      throw new Error(friendlyAuthError(error));
    }
  };

  // For accounts created before wards existed; security rules only allow setting it once
  const setMyWard = async (ward) => {
    const batch = writeBatch(db);
    batch.update(doc(db, "users", user.uid), { ward });
    if (user.role === 'admin') {
      batch.update(doc(db, "societies", user.societyCode), { ward });
    }
    await batch.commit();
    setUser(prev => ({ ...prev, ward }));
  };

  const loginByCredentials = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("loginByCredentials error:", error);
      throw new Error(t('auth.invalidCredentials'));
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("logout error:", error);
    }
  };

  const toggleChallenge = () => {
    setChallengeJoined(!challengeJoined);
  };

  return (
    <AppContext.Provider value={{
      isLoading, isAuthenticated, user,
      registerAdmin, registerMember, registerStaff, loginByCredentials, logout, setMyWard,
      challengeJoined, toggleChallenge,
      helpfulTips, setHelpfulTips
    }}>
      {children}
    </AppContext.Provider>
  );
};
