import { 
    auth, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from './firebase.js';

// Check auth state
export function checkAuthState(redirectToLogin = true) {
    onAuthStateChanged(auth, (user) => {
        if (!user && redirectToLogin && !window.location.pathname.includes('login.html')) {
            window.location.href = 'login.html';
        } else if (user && window.location.pathname.includes('login.html')) {
            window.location.href = 'dashboard.html';
        }
    });
}

// Login function
export async function login(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        showToast('Login successful!', 'success');
        return { success: true, user: userCredential.user };
    } catch (error) {
        let message = 'Login failed! ';
        switch (error.code) {
            case 'auth/user-not-found':
                message += 'User not found.';
                break;
            case 'auth/wrong-password':
                message += 'Wrong password.';
                break;
            case 'auth/invalid-email':
                message += 'Invalid email.';
                break;
            default:
                message += error.message;
        }
        showToast(message, 'error');
        return { success: false, error: message };
    }
}

// js/auth.js - এ নিচের কোড যোগ করুন
import { createUserWithEmailAndPassword } from './firebase.js';

// Super User Creation Function
export async function createSuperUser() {
    const adminEmail = "admin@info.com";
    const adminPassword = "Admin@123456";
    const adminName = "Super Admin";
    
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
        
        // Admin ইউজারের জন্য আলাদা collection এ সংরক্ষণ করুন
        const adminData = {
            uid: userCredential.user.uid,
            email: adminEmail,
            name: adminName,
            role: "super_admin",
            createdAt: new Date().toISOString()
        };
        
        // Firestore এ admin ডকুমেন্ট তৈরি করুন
        const adminRef = doc(db, 'admins', userCredential.user.uid);
        await setDoc(adminRef, adminData);
        
        console.log("Super User Created Successfully!");
        showToast("Super Admin Created! Email: " + adminEmail, "success");
        return true;
    } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
            console.log("Super User already exists");
            showToast("Super User already exists! Try login.", "info");
        } else {
            console.error("Error:", error);
            showToast("Error creating super user", "error");
        }
        return false;
    }
}

// Auto-create super user on first load (development only)
export async function initSuperUser() {
    // শুধুমাত্র development এ ব্যবহার করুন
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        await createSuperUser();
    }
}

// Logout function
export async function logout() {
    try {
        await signOut(auth);
        showToast('Logged out successfully', 'success');
        window.location.href = 'login.html';
    } catch (error) {
        showToast('Error logging out: ' + error.message, 'error');
    }
}

// Show toast notification
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i> ${message}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Get current user
export function getCurrentUser() {
    return auth.currentUser;
}