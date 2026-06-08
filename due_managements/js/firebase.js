// js/firebase.js - সম্পূর্ণ ফাইল এই কোড দিয়ে প্রতিস্থাপন করুন
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    getDocs, 
    getDoc,
    query, 
    orderBy, 
    where, 
    onSnapshot, 
    Timestamp, 
    writeBatch,
    limit
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged, 
    setPersistence, 
    browserLocalPersistence,
    createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// আপনার Firebase Config (আপনি যে config দিয়েছেন সেটি)
const firebaseConfig = {
  apiKey: "AIzaSyAceLr1Q3ivackOnYBozmNyXM87CAySHoM",
  authDomain: "due-managements.firebaseapp.com",
  projectId: "due-managements",
  storageBucket: "due-managements.firebasestorage.app",
  messagingSenderId: "288464910567",
  appId: "1:288464910567:web:93421a45957983862f0a42",
  measurementId: "G-BC63DR49N1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Set persistence (লগইন মনে রাখার জন্য)
setPersistence(auth, browserLocalPersistence);

// সব কিছু export করুন
export { 
    db, 
    auth, 
    collection, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    getDocs, 
    getDoc,
    query, 
    orderBy, 
    where, 
    onSnapshot, 
    Timestamp, 
    writeBatch,
    limit,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    createUserWithEmailAndPassword
};

console.log("✅ Firebase initialized successfully with project:", firebaseConfig.projectId);


