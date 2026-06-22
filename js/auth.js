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
    ENABLE_IMPORTANT_LOGS_ONLY: true
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
        if (CONFIG.ENABLE_LOGS || CONFIG.ENABLE_IMPORTANT_LOGS_ONLY) {
            console.warn(...args);
        }
    },
    error: (...args) => {
        // Errors always show
        console.error(...args);
    }
};

// ============ CROSS-TAB SYNC PREVENTION ============
const REDIRECT_KEY = 'is_redirecting';
const REDIRECT_TIMESTAMP_KEY = 'redirect_timestamp';
const TAB_ID_KEY = 'tab_id';
const ACTIVE_TAB_KEY = 'active_tab_id';
const AUTH_HANDLED_KEY = 'auth_handled';

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
    // Register on load
    registerActiveTab();
    
    // Update on visibility change
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            registerActiveTab();
        }
    });
    
    // Listen for storage changes from other tabs
    window.addEventListener('storage', (e) => {
        if (e.key === ACTIVE_TAB_KEY) {
            // Another tab became active - silently handle
            if (!isActiveTab() && auth.currentUser) {
                // This tab lost active status - prevent auto-redirect
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
    // If already redirecting, don't redirect again
    if (isRedirecting()) {
        return false;
    }
    
    // Check if a redirect happened recently (within last 3 seconds)
    const lastRedirect = sessionStorage.getItem(REDIRECT_TIMESTAMP_KEY);
    if (lastRedirect) {
        const timeSince = Date.now() - parseInt(lastRedirect);
        if (timeSince < 3000) {
            return false;
        }
    }
    
    // Check if this tab is active
    if (!isActiveTab()) {
        return false;
    }
    
    return true;
}

// Initialize tab sync
setupTabSync();

// ============ INACTIVITY TIMER (20 MINUTES) ============
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
            logger.log("🕐 User inactive for 10 minutes, auto logging out...");
            try {
                await signOut(auth);
                showToast('Logged out due to 10 minutes of inactivity', 'warning');
                sessionStorage.clear();
                localStorage.removeItem(ACTIVE_TAB_KEY);
                window.location.replace('login.html');
            } catch (error) {
                logger.error("Auto logout error:", error);
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
        // Silent - no log
        
        dailyResetTimer = setTimeout(async () => {
            logger.log("🕐 Midnight reached, auto logging out...");
            try {
                await signOut(auth);
                showToast('Session expired - daily reset at midnight', 'warning');
                sessionStorage.clear();
                localStorage.removeItem(ACTIVE_TAB_KEY);
                window.location.replace('login.html');
            } catch (error) {
                logger.error("Daily reset logout error:", error);
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

// Check auth state
export function checkAuthState(redirectToLoginPage = true) {
    let isRedirecting = false;
    
    onAuthStateChanged(auth, (user) => {
        // Prevent multiple executions
        if (authStateChecked && !isInitialAuthCheck) {
            return;
        }
        authStateChecked = true;
        isInitialAuthCheck = false;
        
        if (user) {
            // User is logged in - silent (no log)
            
            // Register this tab as active
            registerActiveTab();
            
            // Start inactivity timer
            resetInactivityTimer();
            
            // Setup daily reset
            setupDailyReset();
            
            // Setup activity listeners (only once)
            if (!window._activityListenersSetup) {
                setupActivityListeners();
                window._activityListenersSetup = true;
            }
            
            // Only redirect if on login page and this tab should redirect
            if (isAuthPage() && shouldRedirect()) {
                setRedirecting(true);
                setTimeout(() => {
                    window.location.replace('dashboard.html');
                }, 100);
            }
        } else {
            // User is NOT logged in - silent
            
            // Clear timers
            if (inactivityTimer) {
                clearTimeout(inactivityTimer);
                inactivityTimer = null;
            }
            if (dailyResetTimer) {
                clearTimeout(dailyResetTimer);
                dailyResetTimer = null;
            }
            
            // Only redirect if not on auth page and redirectToLogin is true
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
        
        // Register this tab as active
        registerActiveTab();
        
        // Start inactivity timer
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

// Logout function
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
        
        // Clear all session data
        sessionStorage.clear();
        localStorage.removeItem(ACTIVE_TAB_KEY);
        
        await signOut(auth);
        showToast('Logged out successfully', 'success');
        window.location.replace('login.html');
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

// Enable/disable logs dynamically
export function setLoggingEnabled(enabled) {
    CONFIG.ENABLE_LOGS = enabled;
}

// Enable/disable important logs only
export function setImportantLogsOnly(enabled) {
    CONFIG.ENABLE_IMPORTANT_LOGS_ONLY = enabled;
}