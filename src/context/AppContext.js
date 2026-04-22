import React, { createContext, useState, useEffect } from 'react';
import { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

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

  const registerAdmin = async (name, societyName, email, password) => {
    try {
      const societyCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      await setDoc(doc(db, "users", uid), {
        uid,
        name,
        email,
        role: "admin",
        societyCode,
        societyName,
        createdAt: Date.now()
      });

      await setDoc(doc(db, "societies", societyCode), {
        societyCode,
        societyName,
        adminEmail: email,
        adminUid: uid,
        memberCount: 1,
        registrationDate: Date.now(),
        totalPointsEarned: 0
      });

      return societyCode;
    } catch (error) {
      console.error("registerAdmin error:", error);
      throw new Error(error.message);
    }
  };

  const registerMember = async (name, email, societyCode, password) => {
    try {
      const societyDocRef = doc(db, "societies", societyCode);
      const societyDoc = await getDoc(societyDocRef);

      if (!societyDoc.exists()) {
        throw new Error('Invalid society code. Please check with your society admin.');
      }

      const societyData = societyDoc.data();

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      await setDoc(doc(db, "users", uid), {
        uid,
        name,
        email,
        role: "member",
        societyCode,
        societyName: societyData.societyName,
        createdAt: Date.now()
      });

      await updateDoc(societyDocRef, {
        memberCount: increment(1)
      });
      
    } catch (error) {
      console.error("registerMember error:", error);
      throw new Error(error.message);
    }
  };

  const loginByCredentials = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("loginByCredentials error:", error);
      throw new Error('Invalid email or password.');
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
      registerAdmin, registerMember, loginByCredentials, logout,
      challengeJoined, toggleChallenge,
      helpfulTips, setHelpfulTips
    }}>
      {children}
    </AppContext.Provider>
  );
};
