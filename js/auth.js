import { 
    auth, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged
} from './firebase.js';

// ============ CONFIGURATION ============
const CONFIG = {
    // Set to false to disable all console logs
    ENABLE_LOGS: false,
    // Set to true to show only important logs (errors, warnings)
    ENABLE_IMPORTANT_LOGS_ONLY: false
};

// Custom logger - controls all console output
const logger = {
    log: (...args) => {
        if (CONFIG.ENABLE_LOGS) {
            console.log(...args);
        }
    },
    info: (...args) => {
        if (CONFIG.ENABLE_LOGS) {
            console.info(...args);
        }
    },
    warn: (...args) => {
        // Only show warnings if explicitly enabled
        if (CONFIG.ENABLE_LOGS && CONFIG.ENABLE_IMPORTANT_LOGS_ONLY) {
            console.warn(...args);
        }
    },
    error: (...args) => {
        // Only show errors if explicitly enabled
        if (CONFIG.ENABLE_LOGS && CONFIG.ENABLE_IMPORTANT_LOGS_ONLY) {
            console.error(...args);
        }
    },
    // Special method for critical errors that always show
    critical: (...args) => {
        console.error('🚨 CRITICAL:', ...args);
    }
};

// ============ CROSS-TAB SYNC PREVENTION ============
const REDIRECT_KEY = 'is_redirecting';
const REDIRECT_TIMESTAMP_KEY = 'redirect_timestamp';
const TAB_ID_KEY = 'tab_id';
const ACTIVE_TAB_KEY = 'active_tab_id';

// Generate unique tab ID
function generateTabId() {
    return 'tab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Get or create tab ID
let tabId = sessionStorage.getItem(TAB_ID_KEY);
if (!tabId) {
    tabId = generateTabId();
    sessionStorage.setItem(TAB_ID_KEY, tabId);
}

// Register this tab as active
function registerActiveTab() {
    localStorage.setItem(ACTIVE_TAB_KEY, tabId);
    localStorage.setItem('tab_last_active_' + tabId, Date.now().toString());
}

// Check if this tab is the active one
function isActiveTab() {
    const activeTab = localStorage.getItem(ACTIVE_TAB_KEY);
    return activeTab === tabId;
}

// Handle tab activation/deactivation
function setupTabSync() {
    registerActiveTab();
    
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            registerActiveTab();
        }
    });
    
    window.addEventListener('storage', (e) => {
        if (e.key === ACTIVE_TAB_KEY) {
            if (!isActiveTab() && auth.currentUser) {
                sessionStorage.setItem(REDIRECT_KEY, 'false');
            }
        }
    });
}

function isRedirecting() {
    return sessionStorage.getItem(REDIRECT_KEY) === 'true';
}

function setRedirecting(value) {
    sessionStorage.setItem(REDIRECT_KEY, value ? 'true' : 'false');
    if (value) {
        sessionStorage.setItem(REDIRECT_TIMESTAMP_KEY, Date.now().toString());
    }
}

function shouldRedirect() {
    if (isRedirecting()) {
        return false;
    }
    
    const lastRedirect = sessionStorage.getItem(REDIRECT_TIMESTAMP_KEY);
    if (lastRedirect) {
        const timeSince = Date.now() - parseInt(lastRedirect);
        if (timeSince < 3000) {
            return false;
        }
    }
    
    if (!isActiveTab()) {
        return false;
    }
    
    return true;
}

// Initialize tab sync
setupTabSync();

// ============ INACTIVITY TIMER (10 MINUTES) ============
let inactivityTimer = null;
let dailyResetTimer = null;
const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes

function getTimeUntilMidnight() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return midnight.getTime() - now.getTime();
}

function resetInactivityTimer() {
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
        inactivityTimer = null;
    }
    
    if (auth.currentUser) {
        inactivityTimer = setTimeout(async () => {
            try {
                await signOut(auth);
                showToast('Logged out due to 10 minutes of inactivity', 'warning');
                sessionStorage.clear();
                localStorage.removeItem(ACTIVE_TAB_KEY);
                window.location.replace('login.html');
            } catch (error) {
                // Silent error - no console log
            }
        }, INACTIVITY_TIMEOUT);
    }
}

function setupDailyReset() {
    if (dailyResetTimer) {
        clearTimeout(dailyResetTimer);
        dailyResetTimer = null;
    }
    
    if (auth.currentUser) {
        const timeUntilMidnight = getTimeUntilMidnight();
        
        dailyResetTimer = setTimeout(async () => {
            try {
                await signOut(auth);
                showToast('Session expired - daily reset at midnight', 'warning');
                sessionStorage.clear();
                localStorage.removeItem(ACTIVE_TAB_KEY);
                window.location.replace('login.html');
            } catch (error) {
                // Silent error - no console log
            }
        }, timeUntilMidnight);
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
    if (!isAuthPage() && !isRedirecting()) {
        setRedirecting(true);
        localStorage.removeItem(ACTIVE_TAB_KEY);
        setTimeout(() => {
            window.location.replace('login.html');
        }, 100);
    }
}

// Helper function to redirect to dashboard
function redirectToDashboard() {
    if (isAuthPage() && shouldRedirect()) {
        setRedirecting(true);
        setTimeout(() => {
            window.location.replace('dashboard.html');
        }, 100);
    }
}

// ============ AUTH STATE HANDLER ============
let authStateChecked = false;
let isInitialAuthCheck = true;

export function checkAuthState(redirectToLoginPage = true) {
    onAuthStateChanged(auth, (user) => {
        if (authStateChecked && !isInitialAuthCheck) {
            return;
        }
        authStateChecked = true;
        isInitialAuthCheck = false;
        
        if (user) {
            registerActiveTab();
            resetInactivityTimer();
            setupDailyReset();
            
            if (!window._activityListenersSetup) {
                setupActivityListeners();
                window._activityListenersSetup = true;
            }
            
            if (isAuthPage() && shouldRedirect()) {
                setRedirecting(true);
                setTimeout(() => {
                    window.location.replace('dashboard.html');
                }, 100);
            }
        } else {
            if (inactivityTimer) {
                clearTimeout(inactivityTimer);
                inactivityTimer = null;
            }
            if (dailyResetTimer) {
                clearTimeout(dailyResetTimer);
                dailyResetTimer = null;
            }
            
            if (redirectToLoginPage && !isAuthPage() && 
                !window.location.pathname.includes('clear-data.html') &&
                !isRedirecting()) {
                setRedirecting(true);
                setTimeout(() => {
                    window.location.replace('login.html');
                }, 100);
            }
        }
    });
}

// Login function
export async function login(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        registerActiveTab();
        resetInactivityTimer();
        setupDailyReset();
        
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

// ============ URL ACCESS CONTROL FUNCTIONS ============

/**
 * ফাংশন 1: চেক করে ইউজার লগইন আছে কিনা এবং পেজ অ্যাক্সেস কন্ট্রোল করে
 * ব্যবহার: protectedPage() কে প্রতিটি পেজের শুরুতে কল করুন
 */
export function protectedPage() {
    return new Promise((resolve) => {
        // Check if already redirecting
        if (isRedirecting()) {
            resolve(false);
            return;
        }
        
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe();
            
            if (user) {
                // User logged in - grant access
                resolve(true);
            } else {
                // User not logged in - redirect to login
                if (!isRedirecting()) {
                    setRedirecting(true);
                    showToast('Please login to access this page', 'warning');
                    setTimeout(() => {
                        window.location.replace('login.html');
                    }, 100);
                }
                resolve(false);
            }
        });
    });
}

/**
 * ফাংশন 2: চেক করে ইউজার লগইন নেই কিনা এবং পেজ অ্যাক্সেস কন্ট্রোল করে
 * ব্যবহার: publicPage() কে login/register পেজের শুরুতে কল করুন
 */
export function publicPage() {
    return new Promise((resolve) => {
        // Check if already redirecting
        if (isRedirecting()) {
            resolve(false);
            return;
        }
        
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe();
            
            if (user) {
                // User logged in - redirect to dashboard
                if (shouldRedirect()) {
                    setRedirecting(true);
                    showToast('You are already logged in', 'info');
                    setTimeout(() => {
                        window.location.replace('dashboard.html');
                    }, 100);
                }
                resolve(false);
            } else {
                // User not logged in - grant access
                resolve(true);
            }
        });
    });
}

// ============ PAGE GUARD MIXIN / DECORATOR ============

/**
 * পেজ গার্ড - যেকোনো পেজের জন্য সহজ ব্যবহার
 * @param {string} type - 'protected' অথবা 'public'
 */
export function pageGuard(type = 'protected') {
    try {
        if (type === 'protected') {
            return protectedPage();
        } else if (type === 'public') {
            return publicPage();
        } else {
            // Unknown type - treat as protected
            return protectedPage();
        }
    } catch (error) {
        // Silent error - show toast and redirect
        showToast('Page access error. Redirecting to login.', 'error');
        setTimeout(() => {
            window.location.replace('login.html');
        }, 100);
        return Promise.resolve(false);
    }
}

// ============ AUTO PAGE GUARD (সব পেজের জন্য) ============

/**
 * পেজের নাম অনুযায়ী অটো গার্ড
 * page-name: 'login' বা 'dashboard' বা অন্য কিছু
 */
export function autoPageGuard(pageName) {
    const protectedPages = ['dashboard', 'profile', 'settings', 'admin', 'home'];
    const publicPages = ['login', 'register', 'index', 'forgot-password'];
    
    if (protectedPages.includes(pageName)) {
        return protectedPage();
    } else if (publicPages.includes(pageName)) {
        return publicPage();
    } else {
        // ডিফল্ট: protected
        return protectedPage();
    }
}

// ============ URL BASED REDIRECT CONTROL ============

/**
 * URL এর উপর ভিত্তি করে রিডাইরেক্ট কন্ট্রোল
 * কোন URL এ কি হবে তা কনফিগার করুন
 */
export function setupUrlRedirectControl() {
    const currentPath = window.location.pathname;
    const currentPage = currentPath.split('/').pop() || 'index.html';
    
    // পেজ ক্যাটাগরি ডিটেক্ট করুন
    const publicPages = ['login.html', 'register.html', 'index.html', 'forgot-password.html'];
    const isProtectedPage = !publicPages.includes(currentPage);
    const isPublicPage = publicPages.includes(currentPage);
    
    // অটো গার্ড অ্যাপ্লাই করুন
    if (isProtectedPage) {
        protectedPage();
    } else if (isPublicPage) {
        publicPage();
    }
}

// ============ ROUTER GUARD (স্পা এর জন্য) ============

/**
 * SPA (Single Page Application) এর জন্য রাউটার গার্ড
 * @param {string} route - রাউটের নাম
 * @param {Function} callback - রাউট লোড হওয়ার পর কলব্যাক
 */
export function routerGuard(route, callback) {
    const protectedRoutes = ['/dashboard', '/profile', '/settings'];
    const publicRoutes = ['/login', '/register', '/'];
    
    onAuthStateChanged(auth, (user) => {
        if (protectedRoutes.includes(route)) {
            if (user) {
                callback(true);
            } else {
                showToast('Please login first', 'warning');
                window.location.href = '/login.html';
            }
        } else if (publicRoutes.includes(route)) {
            if (user) {
                showToast('Already logged in', 'info');
                window.location.href = '/dashboard.html';
            } else {
                callback(true);
            }
        } else {
            callback(true);
        }
    });
}

// ============ LOGOUT FUNCTION ============
export async function logout() {
    try {
        if (inactivityTimer) {
            clearTimeout(inactivityTimer);
            inactivityTimer = null;
        }
        if (dailyResetTimer) {
            clearTimeout(dailyResetTimer);
            dailyResetTimer = null;
        }
        
        sessionStorage.clear();
        localStorage.removeItem(ACTIVE_TAB_KEY);
        
        await signOut(auth);
        showToast('Logged out successfully', 'success');
        window.location.replace('login.html');
    } catch (error) {
        showToast('Error logging out: ' + error.message, 'error');
    }
}

// ============ TOAST NOTIFICATION ============
function showToast(message, type = 'info') {
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());
    
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
                max-width: 400px;
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

// ============ USER HELPERS ============
export function getCurrentUser() {
    return auth.currentUser;
}

export function isLoggedIn() {
    return auth.currentUser !== null;
}

// ============ LOG CONFIGURATION ============
export function setLoggingEnabled(enabled) {
    CONFIG.ENABLE_LOGS = enabled;
}

export function setImportantLogsOnly(enabled) {
    CONFIG.ENABLE_IMPORTANT_LOGS_ONLY = enabled;
}

export function getLogConfig() {
    return {
        enabled: CONFIG.ENABLE_LOGS,
        importantOnly: CONFIG.ENABLE_IMPORTANT_LOGS_ONLY
    };
}
