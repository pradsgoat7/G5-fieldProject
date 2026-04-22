import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyC7Mt1k7HdlVVns53kOW3upQdTxVMDlozM",
  authDomain: "fieldproject-13207.firebaseapp.com",
  projectId: "fieldproject-13207",
  storageBucket: "fieldproject-13207.firebasestorage.app",
  messagingSenderId: "60231101961",
  appId: "1:60231101961:web:18413f6d4537e282d892d8"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export default app;
