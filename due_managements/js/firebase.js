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
    startAfter,
    endAt,
    endBefore,
    runTransaction,
    increment,
    arrayUnion,
    arrayRemove
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import {
    getAuth,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    setPersistence,
    browserLocalPersistence,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    updateProfile,
    updateEmail,
    updatePassword
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ============ PRODUCTION CHECK ============
const IS_PRODUCTION = window.location.hostname !== 'localhost' && 
                      window.location.hostname !== '127.0.0.1';

// ============ SECURE CONSOLE LOGGING ============
if (IS_PRODUCTION) {
    const originalConsoleLog = console.log;
    const originalConsoleWarn = console.warn;
    const originalConsoleInfo = console.info;
    
    console.log = function() {
        const args = Array.from(arguments);
        if (args.length > 0 && typeof args[0] === 'string') {
            const msg = args[0];
            const allowedPatterns = [
                '✅', '🔐', '🔥', '⚠️', '❌', '🚀',
                'Login successful', 'Logout successful', 'Auth persistence'
            ];
            const shouldShow = allowedPatterns.some(pattern => msg.includes(pattern));
            if (shouldShow) {
                originalConsoleLog.apply(console, args);
            }
        }
    };
    
    console.warn = function() {
        const args = Array.from(arguments);
        if (args.length > 0 && typeof args[0] === 'string') {
            const msg = args[0];
            if (msg.includes('🔒') || msg.includes('⚠️')) {
                originalConsoleWarn.apply(console, args);
            }
        }
    };
    
    console.info = function() {
        return;
    };
}

// ============ DEVTOOLS PROTECTION ============
function protectDevTools() {
    document.addEventListener('keydown', (e) => {
        const blockedKeys = ['F12'];
        const blockedCombos = [
            { ctrl: true, shift: true, key: 'I' },
            { ctrl: true, shift: true, key: 'J' },
            { ctrl: true, key: 'u' },
            { ctrl: true, shift: true, key: 'C' }
        ];
        
        if (blockedKeys.includes(e.key)) {
            e.preventDefault();
            return false;
        }
        
        for (const combo of blockedCombos) {
            if ((combo.ctrl === e.ctrlKey || !combo.ctrl) &&
                (combo.shift === e.shiftKey || !combo.shift) &&
                (combo.alt === e.altKey || !combo.alt) &&
                e.key === combo.key) {
                e.preventDefault();
                return false;
            }
        }
    });
}

if (IS_PRODUCTION) {
    protectDevTools();
}

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
   🚀 Initialize Firebase
========================= */
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/* =========================
   🔐 SECURE DEVICE ID
========================= */
class SecureDeviceID {
    constructor() {
        this.storageKey = 'secure_device_id';
        this.encryptionKey = 'JackDev_Secure_Key_2024_!@#$%';
    }
    
    xorEncrypt(text, key) {
        let result = '';
        for (let i = 0; i < text.length; i++) {
            result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        }
        return btoa(result);
    }
    
    xorDecrypt(encoded, key) {
        try {
            const text = atob(encoded);
            let result = '';
            for (let i = 0; i < text.length; i++) {
                result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
            }
            return result;
        } catch (e) {
            return null;
        }
    }
    
    generateDeviceId() {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return 'device_' + Array.from(array, byte => 
            byte.toString(16).padStart(2, '0')
        ).join('');
    }
    
    getDeviceId() {
        let encryptedId = localStorage.getItem(this.storageKey);
        
        if (!encryptedId) {
            const deviceId = this.generateDeviceId();
            encryptedId = this.xorEncrypt(deviceId, this.encryptionKey);
            localStorage.setItem(this.storageKey, encryptedId);
            return deviceId;
        }
        
        const decrypted = this.xorDecrypt(encryptedId, this.encryptionKey);
        if (decrypted && decrypted.startsWith('device_')) {
            return decrypted;
        }
        
        const deviceId = this.generateDeviceId();
        encryptedId = this.xorEncrypt(deviceId, this.encryptionKey);
        localStorage.setItem(this.storageKey, encryptedId);
        return deviceId;
    }
    
    clearDeviceId() {
        localStorage.removeItem(this.storageKey);
    }
    
    getDeviceInfo() {
        const deviceId = this.getDeviceId();
        let sessionId = sessionStorage.getItem('session_id');
        if (!sessionId) {
            sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('session_id', sessionId);
        }
        return {
            deviceId: deviceId,
            sessionId: sessionId,
            timestamp: Date.now(),
            userAgent: navigator.userAgent.slice(0, 100)
        };
    }
}

const secureDevice = new SecureDeviceID();
const deviceInfo = secureDevice.getDeviceInfo();

/* =========================
   🔐 AUTH PERSISTENCE
========================= */
/*setPersistence(auth, browserLocalPersistence)
    .then(() => {
        console.log("🔐 Auth persistence enabled");
    })
    .catch((err) => {
        console.warn("⚠️ Auth persistence error:", err);
    });
*/
/* =========================
   ⚡ HELPERS
========================= */
const now = () => Timestamp.now();
const batchWrite = () => writeBatch(db);

const runTransactionSafe = async (callback) => {
    try {
        return await runTransaction(db, callback);
    } catch (error) {
        console.error("❌ Transaction error:", error);
        throw error;
    }
};

const getDeviceId = () => secureDevice.getDeviceId();
const getDeviceInfo = () => secureDevice.getDeviceInfo();

/* =========================
   🛡️ SAFE FIRESTORE OPERATIONS
========================= */
const safeFirestore = {
    async getDocSafe(docRef) {
        try {
            return await getDoc(docRef);
        } catch (error) {
            console.error("❌ Firestore getDoc error:", error);
            throw error;
        }
    },
    
    async getDocsSafe(queryRef) {
        try {
            return await getDocs(queryRef);
        } catch (error) {
            console.error("❌ Firestore getDocs error:", error);
            throw error;
        }
    },
    
    async addDocSafe(collectionRef, data) {
        try {
            const docRef = await addDoc(collectionRef, {
                ...data,
                createdAt: Timestamp.now(),
                deviceId: getDeviceId(),
                sessionId: deviceInfo.sessionId
            });
            return docRef;
        } catch (error) {
            console.error("❌ Firestore addDoc error:", error);
            throw error;
        }
    },
    
    async updateDocSafe(docRef, data) {
        try {
            await updateDoc(docRef, {
                ...data,
                updatedAt: Timestamp.now()
            });
        } catch (error) {
            console.error("❌ Firestore updateDoc error:", error);
            throw error;
        }
    },
    
    async deleteDocSafe(docRef) {
        try {
            await deleteDoc(docRef);
        } catch (error) {
            console.error("❌ Firestore deleteDoc error:", error);
            throw error;
        }
    }
};

/* =========================
   📤 EXPORT EVERYTHING
========================= */
export {
    app,
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
    startAfter,
    endAt,
    endBefore,
    runTransaction,
    increment,
    arrayUnion,
    arrayRemove,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    updateProfile,
    updateEmail,
    updatePassword,
    now,
    batchWrite,
    runTransactionSafe,
    getDeviceId,
    getDeviceInfo,
    secureDevice,
    safeFirestore
};

/* =========================
   🔍 INIT LOG (শুধু Development এ)
========================= */

/* =========================
   📤 DEFAULT EXPORT
========================= */
export default {
    app,
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
    startAfter,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    now,
    batchWrite,
    getDeviceId,
    getDeviceInfo,
    safeFirestore
};