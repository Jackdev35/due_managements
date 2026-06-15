import { 
    db, 
    collection, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    getDocs, 
    query, 
    orderBy 
} from './firebase.js';

// Load all customers
export async function loadCustomers(searchTerm = '') {
    const customersSnap = await getDocs(query(
        collection(db, 'customers'),
        orderBy('createdAt', 'desc')
    ));
    
    const tbody = document.getElementById('customersTableBody');
    tbody.innerHTML = '';
    
    customersSnap.forEach(docSnap => {
        const customer = { id: docSnap.id, ...docSnap.data() };
        
        // Filter by search term
        if (searchTerm && !customer.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
            !customer.phone.includes(searchTerm)) {
            return;
        }
        
        const row = tbody.insertRow();
        row.insertCell(0).textContent = customer.name;
        row.insertCell(1).textContent = customer.phone;
        row.insertCell(2).textContent = customer.address || '-';
        row.insertCell(3).textContent = '৳' + (customer.totalDue || 0).toFixed(2);
        
        const actions = row.insertCell(4);
        actions.className = 'action-buttons';
        actions.innerHTML = `
            <button class="edit-customer" data-id="${customer.id}">
                <i class="fas fa-edit"></i>
            </button>
            <button class="delete-customer" data-id="${customer.id}">
                <i class="fas fa-trash"></i>
            </button>
        `;
    });
    
    // Add event listeners to buttons
    document.querySelectorAll('.edit-customer').forEach(btn => {
        btn.addEventListener('click', () => editCustomer(btn.dataset.id));
    });
    
    document.querySelectorAll('.delete-customer').forEach(btn => {
        btn.addEventListener('click', () => deleteCustomer(btn.dataset.id));
    });
}

// Add new customer
export async function addCustomer(customerData) {
    try {
        const docRef = await addDoc(collection(db, 'customers'), {
            ...customerData,
            totalDue: 0,
            createdAt: new Date().toISOString()
        });
        showToast('Customer added successfully', 'success');
        return { success: true, id: docRef.id };
    } catch (error) {
        showToast('Error adding customer: ' + error.message, 'error');
        return { success: false, error: error.message };
    }
}

// Edit customer
export async function editCustomer(customerId) {
    const docRef = doc(db, 'customers', customerId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
        const customer = docSnap.data();
        // Populate modal form
        document.getElementById('customerId').value = customerId;
        document.getElementById('custName').value = customer.name;
        document.getElementById('custPhone').value = customer.phone;
        document.getElementById('custAddress').value = customer.address || '';
        document.getElementById('custNotes').value = customer.notes || '';
        
        openModal('customerModal');
    }
}

// Update customer
export async function updateCustomer(customerId, customerData) {
    try {
        const docRef = doc(db, 'customers', customerId);
        await updateDoc(docRef, customerData);
        showToast('Customer updated successfully', 'success');
        return { success: true };
    } catch (error) {
        showToast('Error updating customer: ' + error.message, 'error');
        return { success: false, error: error.message };
    }
}

// Delete customer
export async function deleteCustomer(customerId) {
    if (confirm('Are you sure you want to delete this customer? This will also delete all transactions.')) {
        try {
            await deleteDoc(doc(db, 'customers', customerId));
            showToast('Customer deleted successfully', 'success');
            loadCustomers();
        } catch (error) {
            showToast('Error deleting customer: ' + error.message, 'error');
        }
    }
}

// Save customer (add or update)
export async function saveCustomer() {
    const customerId = document.getElementById('customerId').value;
    const customerData = {
        name: document.getElementById('custName').value,
        phone: document.getElementById('custPhone').value,
        address: document.getElementById('custAddress').value,
        notes: document.getElementById('custNotes').value
    };
    
    if (!customerData.name || !customerData.phone) {
        showToast('Please fill required fields', 'error');
        return;
    }
    
    let result;
    if (customerId) {
        result = await updateCustomer(customerId, customerData);
    } else {
        result = await addCustomer(customerData);
    }
    
    if (result.success) {
        closeModal('customerModal');
        loadCustomers();
    }
}

// Helper functions
function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${message}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    document.getElementById('customerId').value = '';
    document.getElementById('custName').value = '';
    document.getElementById('custPhone').value = '';
    document.getElementById('custAddress').value = '';
    document.getElementById('custNotes').value = '';
}