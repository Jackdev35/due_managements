import { 
    db, 
    collection, 
    getDocs, 
    query, 
    where, 
    orderBy, 
    limit 
} from './firebase.js';

// Load dashboard data
export async function loadDashboard() {
    showLoading(true);
    
    try {
        // Get customers
        const customersSnap = await getDocs(collection(db, 'customers'));
        const totalCustomers = customersSnap.size;
        
        // Calculate total due
        let totalDue = 0;
        customersSnap.forEach(doc => {
            totalDue += (doc.data().totalDue || 0);
        });
        
        // Get today's date
        const today = new Date().toISOString().split('T')[0];
        
        // Get today's collections
        const todayTransSnap = await getDocs(query(
            collection(db, 'transactions'),
            where('date', '==', today),
            where('type', '==', 'collection')
        ));
        let todayCollection = 0;
        todayTransSnap.forEach(t => {
            todayCollection += (t.data().collectionAmount || 0);
        });
        
        // Get total collections
        const allTransSnap = await getDocs(collection(db, 'transactions'));
        let totalCollections = 0;
        allTransSnap.forEach(t => {
            if (t.data().type === 'collection') {
                totalCollections += (t.data().collectionAmount || 0);
            }
        });
        
        // Update stats
        document.getElementById('totalCustomers').textContent = totalCustomers;
        document.getElementById('totalDue').textContent = '৳' + totalDue.toFixed(2);
        document.getElementById('totalCollections').textContent = '৳' + totalCollections.toFixed(2);
        document.getElementById('todayCollection').textContent = '৳' + todayCollection.toFixed(2);
        
        // Load recent transactions
        await loadRecentTransactions();
        
        // Load charts
        await loadCharts();
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showToast('Error loading dashboard data', 'error');
    }
    
    showLoading(false);
}

// Load recent transactions
async function loadRecentTransactions() {
    const recentTrans = await getDocs(query(
        collection(db, 'transactions'),
        orderBy('date', 'desc'),
        limit(10)
    ));
    
    const tbody = document.getElementById('recentTransactions');
    tbody.innerHTML = '';
    
    recentTrans.forEach(doc => {
        const trans = doc.data();
        const row = tbody.insertRow();
        row.insertCell(0).textContent = trans.date;
        row.insertCell(1).textContent = trans.type === 'due' ? 'Due Added' : 'Collection';
        row.insertCell(2).textContent = trans.type === 'due' ? 
            '৳' + (trans.dueAmount || 0).toFixed(2) : 
            '৳' + (trans.collectionAmount || 0).toFixed(2);
    });
}

// Load charts
async function loadCharts() {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dueData = new Array(12).fill(0);
    const collectionData = new Array(12).fill(0);
    
    const allTrans = await getDocs(collection(db, 'transactions'));
    
    allTrans.forEach(doc => {
        const trans = doc.data();
        if (trans.date) {
            const month = new Date(trans.date).getMonth();
            if (trans.type === 'due') {
                dueData[month] += (trans.dueAmount || 0);
            } else if (trans.type === 'collection') {
                collectionData[month] += (trans.collectionAmount || 0);
            }
        }
    });
    
    // Create due chart
    const dueCtx = document.getElementById('dueChart').getContext('2d');
    new Chart(dueCtx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [{
                label: 'Due Added',
                data: dueData,
                backgroundColor: '#ef4444',
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'top' }
            }
        }
    });
    
    // Create collection chart
    const collectionCtx = document.getElementById('collectionChart').getContext('2d');
    new Chart(collectionCtx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [{
                label: 'Collections',
                data: collectionData,
                backgroundColor: '#10b981',
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'top' }
            }
        }
    });
}

// Utility functions
function showLoading(show) {
    const loader = document.getElementById('loadingOverlay');
    if (loader) {
        loader.style.display = show ? 'flex' : 'none';
    }
}

function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${message}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}