import { 
    auth, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged
} from './firebase.js';

// ============ INACTIVITY TIMER (20 MINUTES) ============
let inactivityTimer = null;
const INACTIVITY_TIMEOUT = 20 * 60 * 1000; // 20 minutes

function resetInactivityTimer() {
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
    }
    
    if (auth.currentUser) {
        inactivityTimer = setTimeout(async () => {
            console.log("User inactive for 20 minutes, auto logging out...");
            try {
                await signOut(auth);
                showToast('Logged out due to 20 minutes of inactivity', 'warning');
                redirectToLogin();
            } catch (error) {
                console.error("Auto logout error:", error);
            }
        }, INACTIVITY_TIMEOUT);
    }
}

function setupActivityListeners() {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click', 'keydown'];
    
    events.forEach(event => {
        window.addEventListener(event, () => {
            if (auth.currentUser) {
                resetInactivityTimer();
            }
        });
    });
    
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && auth.currentUser) {
            resetInactivityTimer();
        }
    });
}

// Helper function to check if current page is login or index
function isAuthPage() {
    const path = window.location.pathname;
    return path.includes('login.html') || path === '/' || path.includes('index.html');
}

// Helper function to redirect to login
function redirectToLogin() {
    if (!isAuthPage()) {
        window.location.href = 'login.html';
    }
}

// Helper function to redirect to dashboard
function redirectToDashboard() {
    if (isAuthPage()) {
        window.location.href = 'dashboard.html';
    }
}

// ============ INACTIVITY TIMER END ============

// Check auth state - FIXED: No infinite redirect loop
export function checkAuthState(redirectToLogin = true) {
    let isRedirecting = false;
    
    onAuthStateChanged(auth, (user) => {
        // Prevent multiple redirects
        if (isRedirecting) return;
        
        if (user) {
            // User is logged in
            resetInactivityTimer();
            
            if (!window._activityListenersSetup) {
                setupActivityListeners();
                window._activityListenersSetup = true;
            }
            
            // Only redirect if on login page
            if (isAuthPage()) {
                isRedirecting = true;
                window.location.href = 'dashboard.html';
            }
        } else {
            // User is NOT logged in
            if (inactivityTimer) {
                clearTimeout(inactivityTimer);
                inactivityTimer = null;
            }
            
            // Only redirect if not on auth page and redirectToLogin is true
            if (redirectToLogin && !isAuthPage() && !window.location.pathname.includes('clear-data.html')) {
                isRedirecting = true;
                window.location.href = 'login.html';
            }
        }
    });
}

// Login function
export async function login(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        
        // Start inactivity timer
        resetInactivityTimer();
        
        if (!window._activityListenersSetup) {
            setupActivityListeners();
            window._activityListenersSetup = true;
        }
        
        showToast('Login successful!', 'success');
        return { success: true, user: userCredential.user };
    } catch (error) {
        let message = 'Login failed! ';
        switch (error.code) {
            case 'auth/invalid-credential':
            case 'auth/user-not-found':
            case 'auth/wrong-password':
                message += 'Invalid email or password.';
                break;
            case 'auth/invalid-email':
                message += 'Invalid email format.';
                break;
            case 'auth/too-many-requests':
                message += 'Too many failed attempts. Try again later.';
                break;
            case 'auth/user-disabled':
                message += 'This account has been disabled. Contact administrator.';
                break;
            default:
                message += error.message;
        }
        showToast(message, 'error');
        return { success: false, error: message };
    }
}

// Logout function
export async function logout() {
    try {
        if (inactivityTimer) {
            clearTimeout(inactivityTimer);
            inactivityTimer = null;
        }
        
        await signOut(auth);
        showToast('Logged out successfully', 'success');
        window.location.href = 'login.html';
    } catch (error) {
        showToast('Error logging out: ' + error.message, 'error');
    }
}

// Show toast notification with styles
function showToast(message, type = 'info') {
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());
    
    // Add toast styles if not exists
    if (!document.querySelector('#toast-styles')) {
        const styles = document.createElement('style');
        styles.id = 'toast-styles';
        styles.textContent = `
            .toast {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: white;
                color: #333;
                padding: 12px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 9999;
                animation: slideIn 0.3s ease;
                font-family: Arial, sans-serif;
                font-size: 14px;
            }
            .toast.success {
                background: #4caf50;
                color: white;
            }
            .toast.error {
                background: #f44336;
                color: white;
            }
            .toast.warning {
                background: #ff9800;
                color: white;
            }
            .toast.info {
                background: #2196f3;
                color: white;
            }
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(styles);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    else if (type === 'error') icon = 'fa-exclamation-circle';
    else if (type === 'warning') icon = 'fa-exclamation-triangle';
    
    toast.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) toast.remove();
    }, 3000);
}

// Get current user
export function getCurrentUser() {
    return auth.currentUser;
}

// Check if user is logged in (synchronous)
export function isLoggedIn() {
    return auth.currentUser !== null;
}