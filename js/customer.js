// ─── সঠিক ইমপোর্ট ───
import { 
    db, 
    collection, 
    doc, 
    getDoc, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    getDocs, 
    query, 
    orderBy, 
    limit, 
    startAfter, 
    where, 
    writeBatch 
} from './js/firebase.js';

// ─── স্টেট ───
let currentPage = 1, 
    perPage = 50, 
    currentSearchTerm = '', 
    searchDebounceTimer = null, 
    currentDeleteId = null, 
    currentCustomerName = '', 
    isLoading = false, 
    hasMore = true, 
    lastDoc = null, 
    totalCustomersCount = 0;
let allCustomers = [], 
    customerMap = new Map();

// ─── হেলপার ফাংশন ───
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    const colors = {
        success: 'bg-green-500 text-white',
        error: 'bg-red-500 text-white',
        info: 'bg-blue-500 text-white',
        warning: 'bg-yellow-500 text-white'
    };
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle',
        warning: 'fa-exclamation-triangle'
    };
    toast.className = `px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium transition-all duration-300 ${colors[type] || colors.info}`;
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info} mr-2 text-xs"></i>${message}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function escapeHtml(str) { 
    if (!str) return ''; 
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function clearPhoneError() {
    document.getElementById('custPhone')?.classList.remove('phone-input-error');
    const err = document.getElementById('phoneError');
    if (err) { err.classList.add('hidden'); err.innerHTML = ''; }
}

function showPhoneError(msg) {
    document.getElementById('custPhone')?.classList.add('phone-input-error');
    const err = document.getElementById('phoneError');
    if (err) { 
        err.innerHTML = `<i class="fas fa-exclamation-circle text-xs"></i> ${msg}`; 
        err.classList.remove('hidden'); 
    }
}

function formatCurrency(amount) {
    return '৳' + (amount || 0).toFixed(2);
}

// ─── স্ট্যাটস লোড (ফিক্সড) ───
async function loadStats() {
    try {
        // First try to get from stats collection
        const statsDoc = await getDoc(doc(db, 'stats', 'global'));
        if (statsDoc.exists()) {
            const stats = statsDoc.data();
            document.getElementById('totalCustomers').textContent = stats.totalCustomers || 0;
            document.getElementById('activeCustomers').textContent = stats.totalCustomers || 0;
            document.getElementById('totalDue').textContent = formatCurrency(stats.totalDue || 0);
            document.getElementById('totalInvoiceValue').textContent = formatCurrency(stats.totalInvoiceValue || 0);
            document.getElementById('totalCollections').textContent = formatCurrency(stats.totalCollections || 0);
            totalCustomersCount = stats.totalCustomers || 0;
            return;
        }
        
        // Fallback: compute from data
        const customersSnap = await getDocs(collection(db, 'customers'));
        const transactionsSnap = await getDocs(collection(db, 'transactions'));
        
        let totalDue = 0, totalInvoiceValue = 0, totalCollections = 0;
        
        customersSnap.forEach(doc => {
            const d = doc.data();
            totalDue += (d.totalDue || 0);
        });
        
        transactionsSnap.forEach(doc => {
            const t = doc.data();
            if (t.type === 'due') {
                totalInvoiceValue += (t.dueAmount || t.totalAmount || 0);
            } else if (t.type === 'collection') {
                totalCollections += (t.collectionAmount || 0);
            }
        });
        
        document.getElementById('totalCustomers').textContent = customersSnap.size;
        document.getElementById('activeCustomers').textContent = customersSnap.size;
        document.getElementById('totalDue').textContent = formatCurrency(totalDue);
        document.getElementById('totalInvoiceValue').textContent = formatCurrency(totalInvoiceValue);
        document.getElementById('totalCollections').textContent = formatCurrency(totalCollections);
        totalCustomersCount = customersSnap.size;
    } catch (error) { 
        console.error('Stats error:', error);
        showToast('Error loading stats', 'error');
    }
}

// ─── টেবিল রেন্ডার (A-Z সর্ট) ───
function generateRowHTML(customer, sl) {
    const dueClass = (customer.totalDue || 0) >= 10000 ? 'text-red-600 font-bold' : 
                     (customer.totalDue || 0) >= 5000 ? 'text-orange-500 font-semibold' : 
                     'text-green-600';
    
    return `
        <td class="px-3 py-2.5 text-sm font-medium text-center">${sl}</td>
        <td class="px-3 py-2.5">
            <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                    ${(customer.name?.charAt(0) || '?').toUpperCase()}
                </div>
                <span class="font-medium text-xs md:text-sm">${escapeHtml(customer.name)}</span>
            </div>
        </td>
        <td class="px-3 py-2.5 text-xs md:text-sm">${escapeHtml(customer.phone)}</td>
        <td class="px-3 py-2.5 text-xs md:text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">
            ${escapeHtml(customer.address) || '-'}
        </td>
        <td class="px-3 py-2.5 text-right text-purple-600 font-semibold text-xs md:text-sm">
            ${formatCurrency(customer.invoiceValue || 0)}
        </td>
        <td class="px-3 py-2.5 text-right ${dueClass} text-xs md:text-sm">
            ${formatCurrency(customer.totalDue || 0)}
        </td>
        <td class="px-3 py-2.5 text-center">
            <div class="flex items-center justify-center gap-1">
                <button class="edit-customer text-blue-500 hover:text-blue-700 p-1.5 rounded-lg transition-colors" 
                        data-id="${customer.id}">
                    <i class="fas fa-edit text-xs md:text-sm"></i>
                </button>
                <button class="delete-customer text-red-500 hover:text-red-700 p-1.5 rounded-lg transition-colors" 
                        data-id="${customer.id}" 
                        data-name="${escapeHtml(customer.name)}">
                    <i class="fas fa-trash-alt text-xs md:text-sm"></i>
                </button>
            </div>
        </td>
    `;
}

function renderTable() {
    const tbody = document.getElementById('customersTableBody');
    if (!tbody) return;
    
    if (allCustomers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="px-4 py-8 text-center text-gray-500">
                    <i class="fas fa-users text-3xl mb-2 opacity-50 block"></i>
                    No customers found
                </td>
            </tr>
        `;
        return;
    }

    // A-Z sort (case-insensitive)
    const sorted = [...allCustomers].sort((a, b) => 
        (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
    );

    const start = (currentPage - 1) * perPage;
    const end = Math.min(start + perPage, sorted.length);
    const paginated = sorted.slice(start, end);
    
    tbody.innerHTML = '';
    let sl = start + 1;
    for (const customer of paginated) {
        const row = tbody.insertRow();
        row.className = 'customer-row';
        row.dataset.id = customer.id;
        row.innerHTML = generateRowHTML(customer, sl++);
    }
    attachRowEvents();
}

function attachRowEvents() {
    // Row click for details
    document.querySelectorAll('.customer-row').forEach(row => {
        row.removeEventListener('click', rowClickHandler);
        row.addEventListener('click', rowClickHandler);
    });
    
    // Edit button
    document.querySelectorAll('.edit-customer').forEach(btn => {
        btn.removeEventListener('click', editClickHandler);
        btn.addEventListener('click', editClickHandler);
    });
    
    // Delete button
    document.querySelectorAll('.delete-customer').forEach(btn => {
        btn.removeEventListener('click', deleteClickHandler);
        btn.addEventListener('click', deleteClickHandler);
    });
}

function rowClickHandler(e) {
    if (e.target.closest('.edit-customer') || e.target.closest('.delete-customer')) return;
    const cust = customerMap.get(this.dataset.id);
    if (cust) showDetailsModal(cust);
}

function editClickHandler(e) {
    e.stopPropagation();
    const cust = customerMap.get(this.dataset.id);
    if (cust) openEditModal(cust);
}

async function deleteClickHandler(e) {
    e.stopPropagation();
    currentDeleteId = this.dataset.id;
    currentCustomerName = this.dataset.name;
    document.getElementById('deleteModalTitle').innerHTML = 'Delete Customer';
    document.getElementById('deleteModalMessage').innerHTML = `
        Delete "<strong>${currentCustomerName}</strong>"?
        <br><small class="text-gray-400">This will also delete all associated transactions.</small>
    `;
    document.getElementById('deleteModal').classList.remove('hidden');
}

function showDetailsModal(customer) {
    const content = document.getElementById('detailsContent');
    if (!content) return;
    
    content.innerHTML = `
        <div class="space-y-3">
            <div class="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-700">
                <span class="text-xs text-gray-500">Name</span>
                <span class="font-semibold text-sm">${escapeHtml(customer.name)}</span>
            </div>
            <div class="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-700">
                <span class="text-xs text-gray-500">Phone</span>
                <span class="text-sm">${escapeHtml(customer.phone)}</span>
            </div>
            <div class="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-700">
                <span class="text-xs text-gray-500">Address</span>
                <span class="text-sm text-right">${escapeHtml(customer.address || '-')}</span>
            </div>
            <div class="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-700">
                <span class="text-xs text-gray-500">Invoice Value</span>
                <span class="font-semibold text-purple-600">${formatCurrency(customer.invoiceValue || 0)}</span>
            </div>
            <div class="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-700">
                <span class="text-xs text-gray-500">Total Due</span>
                <span class="font-semibold">${formatCurrency(customer.totalDue || 0)}</span>
            </div>
            <div class="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-700">
                <span class="text-xs text-gray-500">Notes</span>
                <span class="text-sm text-right">${escapeHtml(customer.notes || '-')}</span>
            </div>
            <div class="flex justify-between items-center">
                <span class="text-xs text-gray-500">Created</span>
                <span class="text-xs">${customer.createdAt ? new Date(customer.createdAt).toLocaleDateString() : 'N/A'}</span>
            </div>
        </div>
    `;
    document.getElementById('detailsModal').classList.remove('hidden');
}

function openEditModal(customer) {
    clearPhoneError();
    document.getElementById('modalTitle').innerHTML = '<i class="fas fa-user-edit text-primary mr-2"></i> Edit Customer';
    document.getElementById('customerId').value = customer.id;
    document.getElementById('custName').value = customer.name || '';
    document.getElementById('custPhone').value = customer.phone || '';
    document.getElementById('custAddress').value = customer.address || '';
    document.getElementById('custNotes').value = customer.notes || '';
    document.getElementById('customerModal').classList.remove('hidden');
}

// ─── কাস্টমার লোড (পেজিনেশন) ───
async function loadCustomers(reset = true) {
    if (isLoading) return;
    isLoading = true;
    
    const tbody = document.getElementById('customersTableBody');
    if (reset) {
        tbody.innerHTML = Array(5).fill(0).map(() => 
            `<tr><td colspan="7"><div class="skeleton"></div></tr>`
        ).join('');
    }
    
    try {
        let q;
        if (!reset && lastDoc) {
            q = query(collection(db, 'customers'), orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(perPage));
        } else {
            q = query(collection(db, 'customers'), orderBy('createdAt', 'desc'), limit(perPage));
        }
        
        const snapshot = await getDocs(q);
        const customers = [];
        snapshot.forEach(doc => customers.push({ id: doc.id, ...doc.data() }));
        
        if (reset) {
            allCustomers = customers;
            customerMap.clear();
            customers.forEach(c => customerMap.set(c.id, c));
            currentPage = 1;
            hasMore = snapshot.docs.length === perPage;
            lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
        } else {
            allCustomers = [...allCustomers, ...customers];
            customers.forEach(c => customerMap.set(c.id, c));
            hasMore = snapshot.docs.length === perPage;
            if (snapshot.docs.length > 0) lastDoc = snapshot.docs[snapshot.docs.length - 1];
            currentPage++;
        }
        
        renderTable();
        updatePaginationButtons();
        
    } catch (error) {
        console.error('Load error:', error);
        showToast('Error loading customers', 'error');
        if (reset) {
            lastDoc = null;
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-8 text-red-500">
                        <i class="fas fa-exclamation-circle text-2xl mb-2 block"></i>
                        Error loading customers
                    </td>
                </tr>
            `;
        }
    } finally { 
        isLoading = false; 
    }
}

async function loadNextPage() {
    if (!hasMore) {
        showToast('No more customers to load', 'info');
        return;
    }
    if (isLoading) return;
    await loadCustomers(false);
}

async function loadPrevPage() {
    if (currentPage <= 1 || isLoading) return;
    currentPage = 1;
    lastDoc = null;
    await loadCustomers(true);
}

function updatePaginationButtons() {
    const container = document.getElementById('paginationControls');
    if (!container) return;
    
    let totalPages = Math.ceil(totalCustomersCount / perPage);
    if (totalPages === 0 && allCustomers.length > 0) {
        totalPages = Math.ceil(allCustomers.length / perPage);
    }
    
    const html = `
        <button id="prevPageBtn" class="pagination-btn px-2 py-1 rounded-lg text-xs border border-gray-300 dark:border-gray-600 ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-primary hover:text-white'}" 
                ${currentPage === 1 ? 'disabled' : ''}>
            « Prev
        </button>
        <span class="px-2 py-1 text-xs text-gray-600 dark:text-gray-400">
            Page ${currentPage} ${totalPages > 0 ? `of ${totalPages}` : ''}
            <span class="text-gray-400 ml-1">(${allCustomers.length} total)</span>
        </span>
        <button id="nextPageBtn" class="pagination-btn px-2 py-1 rounded-lg text-xs border border-gray-300 dark:border-gray-600 ${!hasMore ? 'opacity-50 cursor-not-allowed' : 'hover:bg-primary hover:text-white'}" 
                ${!hasMore ? 'disabled' : ''}>
            Next »
        </button>
    `;
    container.innerHTML = html;
    
    document.getElementById('prevPageBtn')?.addEventListener('click', (e) => { 
        e.preventDefault(); 
        loadPrevPage(); 
    });
    document.getElementById('nextPageBtn')?.addEventListener('click', (e) => { 
        e.preventDefault(); 
        loadNextPage(); 
    });
}

// ─── সার্চ (পেজিনেশন রিসেট সহ) ───
async function searchCustomers(term) {
    currentSearchTerm = term;
    if (!term.trim()) { 
        await loadCustomers(true); 
        return; 
    }
    
    if (isLoading) return;
    isLoading = true;
    
    const tbody = document.getElementById('customersTableBody');
    tbody.innerHTML = Array(5).fill(0).map(() => 
        `<tr><td colspan="7"><div class="skeleton"></div></tr>`
    ).join('');
    
    try {
        const lower = term.toLowerCase();
        const q = query(collection(db, 'customers'), orderBy('createdAt', 'desc'), limit(200));
        const snap = await getDocs(q);
        
        const results = [];
        snap.forEach(doc => {
            const c = { id: doc.id, ...doc.data() };
            if (c.name?.toLowerCase().includes(lower) || 
                c.phone?.includes(term) || 
                c.address?.toLowerCase().includes(lower)) {
                results.push(c);
            }
        });
        
        allCustomers = results;
        customerMap.clear();
        results.forEach(c => customerMap.set(c.id, c));
        currentPage = 1;
        hasMore = false;
        lastDoc = null;
        
        renderTable();
        updatePaginationButtons();
        
        if (results.length === 0) {
            showToast('No customers found matching "' + term + '"', 'info');
        }
    } catch (error) { 
        console.error('Search error:', error);
        showToast('Search error', 'error');
    } finally { 
        isLoading = false; 
    }
}

// ─── সেভ কাস্টমার (ফিক্সড) ───
async function saveCustomer() {
    const customerId = document.getElementById('customerId').value;
    const phone = document.getElementById('custPhone').value.trim();
    const name = document.getElementById('custName').value.trim();
    const address = document.getElementById('custAddress').value;
    const notes = document.getElementById('custNotes').value;
    
    clearPhoneError();
    
    if (!name) {
        showToast('Name is required', 'error');
        document.getElementById('custName')?.focus();
        return;
    }
    if (!phone) {
        showToast('Phone number is required', 'error');
        document.getElementById('custPhone')?.focus();
        return;
    }
    
    try {
        // Check duplicate phone
        const phoneCheck = await getDocs(query(collection(db, 'customers'), where('phone', '==', phone)));
        
        if (customerId) {
            // Edit mode - check if phone belongs to another customer
            if (!phoneCheck.empty) {
                const existing = phoneCheck.docs[0];
                if (existing.id !== customerId) {
                    showPhoneError('This phone number is already registered to another customer!');
                    showToast('Phone number already exists!', 'error');
                    return;
                }
            }
            
            // Update customer
            await updateDoc(doc(db, 'customers', customerId), {
                name,
                phone,
                address: address || '',
                notes: notes || '',
                searchName: name.toLowerCase(),
                updatedAt: new Date().toISOString()
            });
            
            showToast('Customer updated successfully', 'success');
        } else {
            // Add mode - check duplicate
            if (!phoneCheck.empty) {
                showPhoneError('This phone number is already registered!');
                showToast('Phone number already exists!', 'error');
                return;
            }
            
            // Add new customer with all required fields
            await addDoc(collection(db, 'customers'), {
                name,
                phone,
                address: address || '',
                notes: notes || '',
                searchName: name.toLowerCase(),
                totalDue: 0,
                invoiceValue: 0,  // ← এটা যোগ করতে হবে
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            
            showToast('Customer added successfully', 'success');
        }
        
        closeCustomerModal();
        await loadStats();
        await loadCustomers(true);
        
    } catch (error) {
        console.error('Save error:', error);
        showToast('Error saving customer: ' + error.message, 'error');
    }
}

// ─── ডিলিট কাস্টমার ───
async function deleteCustomer() {
    if (!currentDeleteId) return;
    
    try {
        // Get all transactions for this customer
        const transQuery = await getDocs(query(collection(db, 'transactions'), where('customerId', '==', currentDeleteId)));
        
        // Delete all transactions and customer in batch
        const batch = writeBatch(db);
        transQuery.forEach(d => batch.delete(doc(db, 'transactions', d.id)));
        batch.delete(doc(db, 'customers', currentDeleteId));
        await batch.commit();
        
        showToast(`Deleted ${currentCustomerName}${transQuery.size ? ` + ${transQuery.size} transactions` : ''}`, 'success');
        document.getElementById('deleteModal').classList.add('hidden');
        
        await loadStats();
        await loadCustomers(true);
        
    } catch (error) {
        console.error('Delete error:', error);
        showToast('Delete failed: ' + error.message, 'error');
    }
}

// ─── এক্সপোর্ট ───
function exportToExcel() {
    if (allCustomers.length === 0) { 
        showToast('No customers to export', 'error'); 
        return; 
    }
    
    // A-Z sorted export
    const sorted = [...allCustomers].sort((a, b) => 
        (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
    );
    
    // CSV with BOM for Excel
    let csv = ['\uFEFF"SL","Name","Phone","Address","Invoice Value","Total Due"'];
    sorted.forEach((c, i) => {
        csv.push(`"${i+1}","${c.name || ''}","${c.phone || ''}","${c.address || ''}","${(c.invoiceValue || 0).toFixed(2)}","${(c.totalDue || 0).toFixed(2)}"`);
    });
    
    const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast(`Exported ${sorted.length} customers (A-Z sorted)`, 'success');
}

// ─── মোডাল ক্লোজ ───
function closeCustomerModal() {
    clearPhoneError();
    document.getElementById('customerModal').classList.add('hidden');
    document.getElementById('customerId').value = '';
    document.getElementById('custName').value = '';
    document.getElementById('custPhone').value = '';
    document.getElementById('custAddress').value = '';
    document.getElementById('custNotes').value = '';
    document.getElementById('modalTitle').innerHTML = '<i class="fas fa-user-plus text-primary mr-2"></i> Add Customer';
}

// ─── সার্চ হ্যান্ডলার ───
function handleSearchInput(e) {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    const term = e.target.value;
    searchDebounceTimer = setTimeout(() => searchCustomers(term), 300);
}

// ─── সাইডবার ───
const sidebar = document.getElementById('sidebar');
const menuToggle = document.getElementById('menuToggle');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');

function openSidebar() {
    sidebar.classList.remove('-translate-x-full');
    document.body.classList.add('sidebar-open');
    if (!document.getElementById('sidebarOverlay')) {
        const ov = document.createElement('div');
        ov.id = 'sidebarOverlay';
        ov.className = 'fixed inset-0 bg-black/50 z-40 md:hidden';
        ov.addEventListener('click', closeSidebar);
        document.body.appendChild(ov);
    }
}

function closeSidebar() {
    sidebar.classList.add('-translate-x-full');
    document.body.classList.remove('sidebar-open');
    document.getElementById('sidebarOverlay')?.remove();
}

menuToggle?.addEventListener('click', openSidebar);
closeSidebarBtn?.addEventListener('click', closeSidebar);

window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) {
        sidebar.classList.remove('-translate-x-full');
        document.getElementById('sidebarOverlay')?.remove();
        document.body.classList.remove('sidebar-open');
    } else {
        sidebar.classList.add('-translate-x-full');
    }
});

if (window.innerWidth >= 768) {
    sidebar.classList.remove('-translate-x-full');
} else {
    sidebar.classList.add('-translate-x-full');
}

// ─── ইভেন্ট লিসেনার ───
document.getElementById('addCustomerBtn')?.addEventListener('click', () => { 
    closeCustomerModal(); 
    document.getElementById('customerModal').classList.remove('hidden'); 
});

document.getElementById('saveCustomerBtn')?.addEventListener('click', saveCustomer);
document.getElementById('closeModalBtn')?.addEventListener('click', closeCustomerModal);
document.getElementById('cancelModalBtn')?.addEventListener('click', closeCustomerModal);

document.getElementById('cancelDeleteBtn')?.addEventListener('click', () => {
    document.getElementById('deleteModal').classList.add('hidden');
});

document.getElementById('confirmDeleteBtn')?.addEventListener('click', deleteCustomer);

document.getElementById('exportBtn')?.addEventListener('click', exportToExcel);

document.getElementById('refreshBtn')?.addEventListener('click', () => { 
    document.getElementById('searchInput').value = ''; 
    currentSearchTerm = '';
    loadCustomers(true); 
    loadStats(); 
    showToast('Refreshed successfully', 'success'); 
});

document.getElementById('searchInput')?.addEventListener('input', handleSearchInput);

document.getElementById('darkModeToggle')?.addEventListener('click', () => { 
    document.documentElement.classList.toggle('dark'); 
    document.body.classList.toggle('dark'); 
});

document.getElementById('perPageSelect')?.addEventListener('change', (e) => { 
    perPage = parseInt(e.target.value); 
    loadCustomers(true); 
});

// Modal close on backdrop click
document.getElementById('customerModal')?.addEventListener('click', (e) => { 
    if (e.target === document.getElementById('customerModal')) closeCustomerModal(); 
});

document.getElementById('deleteModal')?.addEventListener('click', (e) => { 
    if (e.target === document.getElementById('deleteModal')) {
        document.getElementById('deleteModal').classList.add('hidden'); 
    }
});

document.getElementById('detailsModal')?.addEventListener('click', (e) => { 
    if (e.target === document.getElementById('detailsModal')) {
        document.getElementById('detailsModal').classList.add('hidden'); 
    }
});

document.getElementById('closeDetailsModalBtn')?.addEventListener('click', () => {
    document.getElementById('detailsModal').classList.add('hidden');
});

document.getElementById('closeDetailsModalFooterBtn')?.addEventListener('click', () => {
    document.getElementById('detailsModal').classList.add('hidden');
});

document.getElementById('custPhone')?.addEventListener('input', clearPhoneError);

// ─── লগআউট ───
const logoutModal = document.getElementById('logoutModal');
const logoutLink = document.getElementById('logoutLink');
const cancelLogout = document.getElementById('cancelLogoutBtn');
const confirmLogout = document.getElementById('confirmLogoutBtn');

if (logoutLink) {
    logoutLink.addEventListener('click', (e) => { 
        e.preventDefault(); 
        logoutModal?.classList.remove('hidden'); 
    });
}

if (cancelLogout) {
    cancelLogout.addEventListener('click', () => logoutModal?.classList.add('hidden'));
}

if (confirmLogout) {
    confirmLogout.addEventListener('click', async () => {
        logoutModal?.classList.add('hidden');
        try {
            const { logout } = await import('./js/auth.js');
            await logout();
        } catch (error) {
            showToast('Logout error: ' + error.message, 'error');
        }
    });
}

// ─── ফুটার ইয়ার ───
document.getElementById('footerYear').textContent = new Date().getFullYear();

// ─── ইনিশিয়ালাইজ ───
loadStats();
loadCustomers(true);