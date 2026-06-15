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
    limit,
    startAfter,        // ✅ যোগ করুন
    endAt,             // ✅ যোগ করুন (অপশনাল)
    endBefore          // ✅ যোগ করুন (অপশনাল)
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

/* =========================
   🔥 Firebase Config
========================= */
const firebaseConfig = {
  apiKey: "AIzaSyAceLr1Q3ivackOnYBozmNyXM87CAySHoM",
  authDomain: "due-managements.firebaseapp.com",
  projectId: "due-managements",
  storageBucket: "due-managements.firebasestorage.app",
  messagingSenderId: "288464910567",
  appId: "1:288464910567:web:93421a45957983862f0a42",
  measurementId: "G-BC63DR49N1"
};

/* =========================
   🚀 Initialize Firebase (SAFE INIT)
========================= */
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/* =========================
   🔐 AUTH PERSISTENCE
   (safe + error handled)
========================= */
setPersistence(auth, browserLocalPersistence)
    .then(() => {
        console.log("🔐 Auth persistence enabled");
    })
    .catch((err) => {
        console.warn("Auth persistence error:", err);
    });

/* =========================
   ⚡ OPTIONAL HELPERS (NEW)
========================= */

// Safe timestamp helper
const now = () => Timestamp.now();

// Batch helper (future scaling)
const batchWrite = () => writeBatch(db);

/* =========================
   EXPORT EVERYTHING
========================= */
export {
    db,
    auth,

    // Firestore
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
    startAfter,      // ✅ এখন এক্সপোর্ট করা হবে

    // Auth
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    createUserWithEmailAndPassword,

    // Helpers
    now,
    batchWrite
};

/* =========================
   INIT LOG (SAFE)
========================= */
console.log("🔥 Firebase initialized:", {
    project: firebaseConfig.projectId,
    status: "ready"
});