import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; // Using Firestore instead of Realtime Database

// Your Firebase configuration
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyBzzGM8-sCK73_SXBt6XIvtR_9iwM10Hgc",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "swasthyasetu-update.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "swasthyasetu-update",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "swasthyasetu-update.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "891414147548",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:891414147548:web:3f5037705f750b2c69df19",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-DHWHVF0S1W"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app); // Firestore database

export { auth, db, app };