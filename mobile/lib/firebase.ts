import { initializeApp, getApps } from "firebase/app";
import { initializeAuth, getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyAIT-S7wpTtmAI3O61_4e07DYuqg_MGRyk",
  authDomain: "focus-24f51.firebaseapp.com",
  databaseURL: "https://focus-24f51-default-rtdb.firebaseio.com",
  projectId: "focus-24f51",
  storageBucket: "focus-24f51.firebasestorage.app",
  messagingSenderId: "967520924679",
  appId: "1:967520924679:web:0b267c68d8c9df5419e6a2",
  measurementId: "G-ZFVPJKJ5VC",
};

// Initialize Firebase only if there are no existing apps initialized
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Use React Native persistence for auth
let auth: any;
try {
  const { getReactNativePersistence } = require("firebase/auth");
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (e) {
  auth = getAuth(app);
}

export { auth };
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
