// PASTE YOUR GOOGLE APPS SCRIPT WEB APP URL HERE
const API_URL = "https://script.google.com/macros/s/AKfycbxSQaPQVD0lhiZgB7q7TZy9JFKPXNdI55bHZxZMXvoWkgl6S4O2qhdDBb7o2WwfkTNm5w/exec"; 

let currentUser = "";
let currentPassword = "";
let currentRole = ""; 

// Chat Globals
let chatPollingInterval;
let dashboardPollingInterval;
let lastKnownChatCount = parseInt(localStorage.getItem("roombook_chat_count")) || 0;

// --- NEW: Local Data Cache ---
let cachedAppData = JSON.parse(localStorage.getItem("messkhata_data")) || null;
let cachedUsers = JSON.parse(localStorage.getItem("messkhata_users")) || null;
let cachedChoresList = JSON.parse(localStorage.getItem("messkhata_chores_list")) || null;

// --- Auto-Login Check ---
window.addEventListener('load', () => {
    const savedUser = localStorage.getItem("messkhata_user");
    const savedPass = localStorage.getItem("messkhata_pass");
    const savedRole = localStorage.getItem("messkhata_role");

    if (savedUser && savedPass) {
        currentUser = savedUser;
        currentPassword = savedPass;
        currentRole = savedRole;
        
        document.getElementById("login-screen").style.display = "none";
        showDashboard(currentRole);
    }
});

// --- Global Custom Dropdown Logic ---
function toggleDropdown(id) {
    document.querySelectorAll('.dropdown-content').forEach(el => {
        if (el.id !== id) el.style.display = 'none';
    });
    const el = document.getElementById(id);
    el.style.display = el.style.display === "block" ? "none" : "block";
}

window.onclick = function(event) {
    if (!event.target.matches('.dropdown-btn')) {
        document.querySelectorAll('.dropdown-content').forEach(el => {
            el.style.display = 'none';
        });
    }
}

// --- Login Logic ---
async function login() {
    const userIdInput = document.getElementById("userId").value;
    const passwordInput = document.getElementById("password").value;
    const messageEl = document.getElementById("login-message");

    if (!userIdInput || !passwordInput) {
        messageEl.innerText = "Please enter ID and Password.";
        return;
    }

    messageEl.innerText = "Loading...";

    const payload = {
        action: "login",
        userId: userIdInput,
        password: passwordInput
    };

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        const data = await response.json();

        if (data.status === "success") {
            currentUser = userIdInput;
            currentPassword = passwordInput;
            currentRole = data.role;
            
            localStorage.setItem("messkhata_user", currentUser);
            localStorage.setItem("messkhata_pass", currentPassword);
            localStorage.setItem("messkhata_role", currentRole);
            
            document.getElementById("login-screen").style.display = "none";

            if (data.needsPasswordReset) {
                document.getElementById("reset-screen").style.display = "block";
            } else {
                showDashboard(data.role);
            }
        } else {
            messageEl.innerText = data.message;
        }
    } catch (error) {
        messageEl.innerText = "Error connecting to server.";
    }
}

async function changePassword() {
    const newPassword = document.getElementById("newPassword").value;
    const messageEl = document.getElementById("reset-message");

    if (!newPassword || newPassword === "1234" || newPassword.toLowerCase() === "pro") {
        messageEl.innerText = "Please enter a valid, new password.";
        return;
    }

    messageEl.innerText = "Saving...";

    const payload = {
        action: "changePassword",
        userId: currentUser,
        oldPassword: currentPassword,
        newPassword: newPassword
    };

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        const data = await response.json();

        if (data.status === "success") {
            document.getElementById("reset-screen").style.display = "none";
            logout(); 
            const loginMsg = document.getElementById("login-message");
            loginMsg.style.color = "#27ae60"; 
            loginMsg.innerText = "Password updated successfully! Please log in again.";
            document.getElementById("newPassword").value = "";
        } else {
            messageEl.innerText = data.message;
        }
    } catch (error) {
        messageEl.innerText = "Error saving password.";
    }
}

function showDashboard(role) {
    document.getElementById("dashboard-screen").style.display = "block";
    document.getElementById("welcome-text").innerText = `Welcome, ${currentUser}`;
    
    if (role === "Admin") {
        document.getElementById("admin-btn").style.display = "block";
        document.querySelector('.button-grid button:nth-child(1)').style.display = "none"; 
        document.querySelector('.button-grid button:nth-child(2)').style.display = "none"; 
    } else {
        document.getElementById("admin-btn").style.display = "none";
        document.querySelector('.button-grid button:nth-child(1)').style.display = "block"; 
        document.querySelector('.button-grid button:nth-child(2)').style.display = "block"; 
    }

    checkNewMessagesBadge();
    dashboardPollingInterval = setInterval(checkNewMessagesBadge, 10000);
}

function goBackToDashboard() {
    if (chatPollingInterval) clearInterval(chatPollingInterval);
    
    document.querySelectorAll('.dropdown-content').forEach(el => el.style.display = 'none');
    document.getElementById("expense-screen").style.display = "none";
    document.getElementById("chore-screen").style.display = "none";
    document.getElementById("pay-details-screen").style.display = "none";
    document.getElementById("expense-review-screen").style.display = "none";
    document.getElementById("admin-screen").style.display = "none"; 
    document.getElementById("chat-screen").style.display = "none"; 
    
    checkNewMessagesBadge();
    if (!dashboardPollingInterval) dashboardPollingInterval = setInterval(checkNewMessagesBadge, 10000);
    
    document.getElementById("dashboard-screen").style.display = "block";
    document.getElementById("expense-message").innerText = "";
    document.getElementById("chore-message").innerText = "";
    document.getElementById("admin-message").innerText = "";
}

function logout() {
    currentUser = "";
    currentPassword = "";
    
    localStorage.removeItem("messkhata_user");
    localStorage.removeItem("messkhata_pass");
    localStorage.removeItem("messkhata_role");
    
    document.getElementById("dashboard-screen").style.display = "none";
    document.getElementById("login-screen").style.display = "block";
    document.getElementById("userId").value = "";
    document.getElementById("password").value = "";
    document.getElementById("login-message").innerText = "";
}

// --- Expense Tracking Logic ---

document.querySelector('.button-grid button:nth-child(1)').onclick = async () => {
    document.getElementById("dashboard-screen").style.display = "none";
    document.getElementById("expense-screen").style.display = "block";
    await loadActiveUsers();
};

async function loadActiveUsers() {
    const container = document.getElementById("dynamic-split-users");
    
    if (cachedUsers) {
        renderSplitUsers(cachedUsers, container);
    } else {
        container.innerHTML = '<div style="text-align: center;"><img src="loding.png" class="custom-loader-img" style="width: 80px; margin: 10px auto;" alt="Loading..."></div>';
    }
    
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ action: "getActiveUsers" })
        });
        const data = await response.json();
        
        if (data.status === "success") {
            cachedUsers = data.users;
            localStorage.setItem("messkhata_users", JSON.stringify(data.users));
            renderSplitUsers(data.users, container);
        }
    } catch (error) {
        if (!cachedUsers) container.innerHTML = "Connection failed.";
    }
}

function renderSplitUsers(users, container) {
    container.innerHTML = "";
    users.forEach(user => {
        container.innerHTML += `<label class="split-label"><input type="checkbox" class="split-check" value="${user}" checked> ${user}</label>`;
    });
}

async function saveExpense() {
    const expenseFor = document.getElementById("expenseFor").value;
    const amount = document.getElementById("expenseAmount").value;
    const messageEl = document.getElementById("expense-message");

    const checkboxes = document.querySelectorAll('.split-check:checked');
    let splitWith = [];
    checkboxes.forEach((cb) => {
        splitWith.push(cb.value);
    });

    if (!expenseFor || !amount || splitWith.length === 0) {
        messageEl.innerText = "Please fill all details and select at least one person.";
        return;
    }

    messageEl.innerText = "Saving to database...";

    const payload = {
        action: "addExpense",
        userId: currentUser,
        expenseFor: expenseFor,
        amount: parseFloat(amount),
        splitWith: splitWith.join(", ")
    };

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        const data = await response.json();

        if (data.status === "success") {
            document.getElementById("expenseFor").value = "";
            document.getElementById("expenseAmount").value = "";
            messageEl.style.color = "#27ae60"; 
            messageEl.innerText = "Expense saved successfully!";
            
            setTimeout(() => {
                goBackToDashboard();
                messageEl.style.color = "#d63031"; 
            }, 1500); 
        } else {
            messageEl.innerText = data.message;
        }
    } catch (error) {
        messageEl.innerText = "Error saving expense.";
    }
}

// --- Chore Tracking Logic ---

document.querySelector('.button-grid button:nth-child(2)').onclick = async () => {
    document.getElementById("dashboard-screen").style.display = "none";
    document.getElementById("chore-screen").style.display = "block";
    await loadChores(); 
    await loadChoreActiveUsers(); 
};

async function loadChoreActiveUsers() {
    const container = document.getElementById("dynamic-chore-split-users");
    
    if (cachedUsers) {
        renderChoreSplitUsers(cachedUsers, container);
    } else {
        container.innerHTML = '<div style="text-align: center;"><img src="loding.png" class="custom-loader-img" style="width: 80px; margin: 10px auto;" alt="Loading..."></div>';
    }
    
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ action: "getActiveUsers" })
        });
        const data = await response.json();
        
        if (data.status === "success") {
            cachedUsers = data.users;
            localStorage.setItem("messkhata_users", JSON.stringify(data.users));
            renderChoreSplitUsers(data.users, container);
        }
    } catch (error) {
        if (!cachedUsers) container.innerHTML = "Connection failed.";
    }
}

function renderChoreSplitUsers(users, container) {
    container.innerHTML = "";
    users.forEach(user => {
        if (user !== currentUser) {
            container.innerHTML += `<label class="split-label"><input type="checkbox" class="chore-split-check" value="${user}" checked> ${user}</label>`;
        }
    });
}

async function loadChores() {
    const optionsEl = document.getElementById("choreOptions");
    document.getElementById("choreSelectBtn").innerText = "Select Work...";
    document.getElementById("choreSelect").value = "";
    
    if (cachedChoresList) {
        renderChoreOptions(cachedChoresList, optionsEl);
    } else {
        optionsEl.innerHTML = '<div class="dropdown-item">Loading...</div>';
    }
    
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ action: "getChores" })
        });
        const data = await response.json();
        
        if (data.status === "success") {
            cachedChoresList = data.chores;
            localStorage.setItem("messkhata_chores_list", JSON.stringify(data.chores));
            renderChoreOptions(data.chores, optionsEl);
        }
    } catch (error) {
        if (!cachedChoresList) optionsEl.innerHTML = '<div class="dropdown-item">Error loading</div>';
    }
}

function renderChoreOptions(chores, optionsEl) {
    optionsEl.innerHTML = '';
    chores.forEach(chore => {
        optionsEl.innerHTML += `<div class="dropdown-item" onclick="selectCustomChore('${chore.name}', ${chore.amount})">${chore.name}</div>`;
    });
}

function selectCustomChore(name, amount) {
    document.getElementById("choreSelect").value = name;
    document.getElementById("choreSelectAmount").value = amount;
    document.getElementById("choreSelectBtn").innerText = name;
    document.getElementById("choreAmountDisplay").innerText = `Amount: ₹${amount}`;
    document.getElementById("choreOptions").style.display = "none";
}

async function saveChore() {
    const selectedName = document.getElementById("choreSelect").value;
    const messageEl = document.getElementById("chore-message");
    
    const checkboxes = document.querySelectorAll('.chore-split-check:checked');
    let splitWith = [];
    checkboxes.forEach((cb) => {
        splitWith.push(cb.value);
    });

    if (!selectedName || splitWith.length === 0) {
        messageEl.innerText = "Please select work and at least one person to pay.";
        return;
    }

    messageEl.innerText = "Saving to database...";
    const amount = parseFloat(document.getElementById("choreSelectAmount").value);

    const payload = {
        action: "addChore",
        userId: currentUser,
        choreName: selectedName,
        amount: amount,
        splitWith: splitWith.join(", ") 
    };

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        const data = await response.json();

        if (data.status === "success") {
            messageEl.style.color = "#27ae60";
            messageEl.innerText = "Work logged successfully!";
            setTimeout(() => {
                goBackToDashboard();
                messageEl.style.color = "#d63031";
                document.getElementById("choreAmountDisplay").innerText = "Amount: ₹0";
                document.getElementById("choreSelectBtn").innerText = "Select Work...";
            }, 1500); 
        } else {
            messageEl.innerText = data.message;
        }
    } catch (error) {
        messageEl.innerText = "Error saving work.";
    }
}

// --- Pay Details Logic ---
document.querySelector('.button-grid button:nth-child(3)').onclick = async () => {
    document.getElementById("dashboard-screen").style.display = "none";
    document.getElementById("pay-details-screen").style.display = "block";
    const contentEl = document.getElementById("pay-details-content");

    if (cachedAppData) {
        renderPayDetails(cachedAppData, contentEl);
    } else {
        contentEl.innerHTML = '<div style="text-align: center;"><img src="loding.png" class="custom-loader-img" alt="Calculating..."><p style="color: #2c3e50; margin-top: 10px; font-weight: bold;">Calculating balances...</p></div>';
    }

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ action: "getAllData" })
        });
        const data = await response.json();

        if (data.status === "success") {
            cachedAppData = data;
            localStorage.setItem("messkhata_data", JSON.stringify(data));
            renderPayDetails(data, contentEl);
        }
    } catch (error) {
        if (!cachedAppData) contentEl.innerHTML = "Connection failed.";
    }
};

function renderPayDetails(data, contentEl) {
    const users = data.activeUsers; 
    let balances = {};
    let totalPaid = {};
    let choresEarned = {};
    
    users.forEach(u => { balances[u] = 0; totalPaid[u] = 0; choresEarned[u] = 0; });

    data.expenses.forEach(exp => {
        const amount = parseFloat(exp.amount) || 0;
        const payer = exp.paidBy;
        const splitList = exp.splitWith.split(',').map(s => s.trim());
        const splitCount = splitList.length;

        if (splitCount > 0 && users.includes(payer)) {
            totalPaid[payer] += amount;
            balances[payer] += amount; 
            const share = amount / splitCount;
            splitList.forEach(person => { if (users.includes(person)) balances[person] -= share; });
        }
    });

    data.chores.forEach(chore => {
        const amount = parseFloat(chore.amount) || 0;
        const earner = chore.doneBy;
        const splitList = chore.splitWith ? chore.splitWith.split(',').map(s => s.trim()) : users.filter(u => u !== earner);
        const splitCount = splitList.length;
        
        if (users.includes(earner)) {
            choresEarned[earner] += amount;
            balances[earner] += amount; 
            if (splitCount > 0) {
                const splitCost = amount / splitCount;
                splitList.forEach(person => { if (users.includes(person)) balances[person] -= splitCost; });
            }
        }
    });

    let html = `<h3 style="margin-top:0; text-align:center; color:#2c3e50;">Balance Sheet</h3>`;
    users.forEach(user => {
        const balance = balances[user];
        const isOwed = balance > 0;
        const color = isOwed ? "#27ae60" : (balance < 0 ? "#e74c3c" : "#2c3e50");
        const statusText = isOwed ? "Gets Back" : (balance < 0 ? "Owes" : "Settled");
        html += `
        <div style="background: white; padding: 15px; margin-bottom: 12px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <h4 style="margin: 0 0 10px 0; font-size: 18px; color: #333;">${user}</h4>
            <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 5px;">
                <span>Total Paid:</span> <span>₹${totalPaid[user].toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 5px;">
                <span>Work Earned:</span> <span>₹${choresEarned[user].toFixed(2)}</span>
            </div>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 8px 0;">
            <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; color: ${color};">
                <span>${statusText}:</span> <span>₹${Math.abs(balance).toFixed(2)}</span>
            </div>
        </div>`;
    });
    contentEl.innerHTML = html;
}

// --- Expense Review Logic (Crash Fix & Infinite Scroll) ---

// 1. Declare these variables globally so they are never "undefined"
let currentHistoryData = { expenses: [], chores: [] };
let currentHistoryTab = 'expenses';
let currentHistoryFilter = 'all';
let currentHistoryItemsToShow = 20;

document.querySelector('.button-grid button:nth-child(4)').onclick = async () => {
    document.getElementById("dashboard-screen").style.display = "none";
    document.getElementById("expense-review-screen").style.display = "block";
    const contentEl = document.getElementById("review-content");

    // 2. Set Tab UI
    document.getElementById("tab-btn-expenses").style.background = "var(--accent)";
    document.getElementById("tab-btn-expenses").style.color = "white";
    document.getElementById("tab-btn-chores").style.background = "rgba(255,255,255,0.6)";
    document.getElementById("tab-btn-chores").style.color = "#333";
    
    // 3. Set Filter UI manually without triggering a premature render crash
    document.getElementById("filter-btn-all").style.background = "#3498db";
    document.getElementById("filter-btn-all").style.color = "white";
    document.getElementById("filter-btn-me").style.background = "transparent";
    document.getElementById("filter-btn-me").style.color = "#333";
    
    currentHistoryTab = 'expenses';
    currentHistoryFilter = 'all';
    currentHistoryItemsToShow = 20; 

    // 4. NOW it is safe to load and render the data
    if (cachedAppData) {
        currentHistoryData = cachedAppData;
        renderHistoryContent();
    } else {
        contentEl.innerHTML = '<div style="text-align: center;"><img src="loding.png" class="custom-loader-img" alt="Loading..."><p style="color: #2c3e50; margin-top: 10px; font-weight: bold;">Fetching history...</p></div>';
    }

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ action: "getAllData" })
        });
        const data = await response.json();

        if (data.status === "success") {
            currentHistoryData = data;
            cachedAppData = data;
            localStorage.setItem("messkhata_data", JSON.stringify(data));
            renderHistoryContent();
        }
    } catch (error) {
        if (!cachedAppData) contentEl.innerHTML = "Connection failed.";
    }
};

function renderHistoryContent() {
    const contentEl = document.getElementById("review-content");
    const filterValue = currentHistoryFilter;
    let html = '';
    let dataList = [];

    // Protect against accidentally typing a space during login
    const me = String(currentUser).trim();

    if (currentHistoryTab === 'expenses') {
        dataList = currentHistoryData.expenses || [];
        if (filterValue === 'me') {
            // Restored your original working exact-match logic with crash protection
            dataList = dataList.filter(exp => 
                exp.paidBy === me || 
                (exp.splitWith && String(exp.splitWith).includes(me))
            );
        }
    } else {
        dataList = currentHistoryData.chores || [];
        if (filterValue === 'me') {
            // Restored your original working exact-match logic with crash protection
            dataList = dataList.filter(chore => 
                chore.doneBy === me || 
                (chore.splitWith && String(chore.splitWith).includes(me))
            );
        }
    }

    let displayList = dataList.slice().reverse().slice(0, currentHistoryItemsToShow);

    if (displayList.length === 0) {
        html = `<p style="font-size: 14px;">No history found for this view.</p>`;
    } else {
        displayList.forEach(item => {
            const d = new Date(item.date);
            const dateStr = `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
            
            if (currentHistoryTab === 'expenses') {
                html += `
                <div style="background: white; padding: 10px; margin-bottom: 8px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <div style="display:flex; justify-content:space-between; font-weight:bold; color:#333;">
                        <span>${item.item}</span>
                        <span style="color:#e74c3c;">₹${item.amount}</span>
                    </div>
                    <div style="font-size:12px; color:#7f8fa6; margin-top:4px;">
                        ${dateStr} | Paid by: <b>${item.paidBy}</b> <br>
                        Split: ${item.splitWith}
                    </div>
                </div>`;
            } else {
                const splitText = item.splitWith ? `<br>Paid by: ${item.splitWith}` : "";
                html += `
                <div style="background: white; padding: 10px; margin-bottom: 8px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <div style="display:flex; justify-content:space-between; font-weight:bold; color:#333;">
                        <span>${item.item}</span>
                        <span style="color:#27ae60;">+₹${item.amount}</span>
                    </div>
                    <div style="font-size:12px; color:#7f8fa6; margin-top:4px;">
                        ${dateStr} | Done by: <b>${item.doneBy}</b> ${splitText}
                    </div>
                </div>`;
            }
        });
    }
    contentEl.innerHTML = html;
}

function switchHistoryTab(tab) {
    currentHistoryTab = tab;
    currentHistoryItemsToShow = 20; 
    if (tab === 'expenses') {
        document.getElementById("tab-btn-expenses").style.background = "var(--accent)";
        document.getElementById("tab-btn-expenses").style.color = "white";
        document.getElementById("tab-btn-chores").style.background = "rgba(255,255,255,0.6)";
        document.getElementById("tab-btn-chores").style.color = "#333";
    } else {
        document.getElementById("tab-btn-chores").style.background = "var(--accent)";
        document.getElementById("tab-btn-chores").style.color = "white";
        document.getElementById("tab-btn-expenses").style.background = "rgba(255,255,255,0.6)";
        document.getElementById("tab-btn-expenses").style.color = "#333";
    }
    document.getElementById("review-content").scrollTop = 0; 
    renderHistoryContent();
}

function switchHistoryFilter(filter) {
    currentHistoryFilter = filter;
    currentHistoryItemsToShow = 20; 
    if (filter === 'all') {
        document.getElementById("filter-btn-all").style.background = "#3498db";
        document.getElementById("filter-btn-all").style.color = "white";
        document.getElementById("filter-btn-me").style.background = "transparent";
        document.getElementById("filter-btn-me").style.color = "#333";
    } else {
        document.getElementById("filter-btn-me").style.background = "#3498db";
        document.getElementById("filter-btn-me").style.color = "white";
        document.getElementById("filter-btn-all").style.background = "transparent";
        document.getElementById("filter-btn-all").style.color = "#333";
    }
    document.getElementById("review-content").scrollTop = 0; 
    renderHistoryContent();
}

// --- INFINITE SCROLL LISTENER ---
document.getElementById("review-content").addEventListener("scroll", function() {
    if (this.scrollTop + this.clientHeight >= this.scrollHeight - 10) {
        
        let maxData = 0;
        if (currentHistoryTab === 'expenses' && currentHistoryData.expenses) {
            maxData = currentHistoryData.expenses.length;
        } else if (currentHistoryData.chores) {
            maxData = currentHistoryData.chores.length;
        }

        if (currentHistoryItemsToShow < maxData) {
            currentHistoryItemsToShow += 20; 
            renderHistoryContent(); 
        }
    }
});

// --- Admin Logic ---

document.getElementById("admin-btn").onclick = async () => {
    document.getElementById("dashboard-screen").style.display = "none";
    document.getElementById("admin-screen").style.display = "block";
    await loadAdminData();
};

async function loadAdminData() {
    const userOptions = document.getElementById("adminUserOptions");
    const choreOptions = document.getElementById("adminChoreOptions");
    
    document.getElementById("adminUserSelectBtn").innerText = "Select a user...";
    document.getElementById("adminUserSelect").value = "";
    
    document.getElementById("adminChoreSelectBtn").innerText = "Select work to edit/delete...";
    document.getElementById("adminChoreSelect").value = "";
    
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ action: "getAdminData" })
        });
        const data = await response.json();

        if (data.status === "success") {
            userOptions.innerHTML = '';
            data.users.forEach(user => {
                userOptions.innerHTML += `<div class="dropdown-item" onclick="selectAdminUser('${user}')">${user}</div>`;
            });

            choreOptions.innerHTML = '';
            data.chores.forEach(chore => {
                choreOptions.innerHTML += `<div class="dropdown-item" onclick="selectAdminChore('${chore.name}', ${chore.amount})">${chore.name} (₹${chore.amount})</div>`;
            });
        }
    } catch (error) {
        document.getElementById("admin-message").innerText = "Error loading data.";
    }
}

function selectAdminUser(name) {
    document.getElementById("adminUserSelect").value = name;
    document.getElementById("adminUserSelectBtn").innerText = name;
    document.getElementById("adminUserOptions").style.display = "none";
}

function selectAdminChore(name, amount) {
    document.getElementById("adminChoreSelect").value = name;
    document.getElementById("adminChoreSelectAmount").value = amount;
    document.getElementById("adminChoreSelectBtn").innerText = `${name} (₹${amount})`;
    document.getElementById("adminChoreOptions").style.display = "none";
}

async function adminUser(subAction) {
    const messageEl = document.getElementById("admin-message");
    let targetUser = "";

    if (subAction === "add") {
        targetUser = document.getElementById("newUsername").value.trim();
        if (!targetUser) return messageEl.innerText = "Enter a username to add.";
    } else {
        targetUser = document.getElementById("adminUserSelect").value;
        if (!targetUser) return messageEl.innerText = "Select a user from the list first.";
    }

    if (subAction === "delete" && !confirm(`Are you sure you want to lock ${targetUser} out of the app?`)) return;

    messageEl.innerText = "Processing...";
    messageEl.style.color = "#333";

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ action: "adminUserAction", subAction: subAction, targetUser: targetUser })
        });
        const data = await response.json();
        
        messageEl.innerText = data.message;
        messageEl.style.color = data.status === "success" ? "#27ae60" : "#e74c3c";
        
        if (data.status === "success") {
            document.getElementById("newUsername").value = "";
            await loadAdminData(); 
        }
    } catch (error) {
        messageEl.innerText = "Server connection failed.";
    }
}

function closeEditModal() {
    document.getElementById("custom-edit-modal").style.display = "none";
}

async function saveEditedChore() {
    const oldName = document.getElementById("editOldName").value;
    const newName = document.getElementById("editNewName").value.trim();
    const newAmount = parseFloat(document.getElementById("editNewAmount").value);
    const messageEl = document.getElementById("admin-message");

    if (!newName || !newAmount) {
        alert("Please fill in both name and amount.");
        return;
    }

    closeEditModal();
    messageEl.innerText = "Processing edit...";
    messageEl.style.color = "#333";

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({
                action: "adminChoreAction",
                subAction: "edit",
                oldName: oldName,
                newName: newName,
                amount: newAmount
            })
        });
        const data = await response.json();
        
        messageEl.innerText = data.message;
        messageEl.style.color = data.status === "success" ? "#27ae60" : "#e74c3c";
        
        if (data.status === "success") await loadAdminData();
    } catch (error) {
        messageEl.innerText = "Server connection failed.";
    }
}

async function adminChore(subAction) {
    const messageEl = document.getElementById("admin-message");
    let payload = { action: "adminChoreAction", subAction: subAction };

    if (subAction === "add") {
        payload.choreName = document.getElementById("newChoreName").value.trim();
        payload.amount = parseFloat(document.getElementById("newChoreAmount").value);
        if (!payload.choreName || !payload.amount) return messageEl.innerText = "Enter work name and amount.";
    } else {
        const selectedName = document.getElementById("adminChoreSelect").value;
        const selectedAmount = document.getElementById("adminChoreSelectAmount").value;
        
        if (!selectedName) return messageEl.innerText = "Select work from the list first.";
        
        if (subAction === "delete") {
            payload.choreName = selectedName;
            if (!confirm(`Are you sure you want to delete ${payload.choreName}?`)) return;
        } 
        
        if (subAction === "edit") {
            document.getElementById("editOldName").value = selectedName;
            document.getElementById("editNewName").value = selectedName;
            document.getElementById("editNewAmount").value = selectedAmount;
            
            document.getElementById("custom-edit-modal").style.display = "flex";
            return; 
        }
    }

    messageEl.innerText = "Processing...";
    messageEl.style.color = "#333";

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        
        messageEl.innerText = data.message;
        messageEl.style.color = data.status === "success" ? "#27ae60" : "#e74c3c";
        
        if (data.status === "success") {
            document.getElementById("newChoreName").value = "";
            document.getElementById("newChoreAmount").value = "";
            await loadAdminData(); 
        }
    } catch (error) {
        messageEl.innerText = "Server connection failed.";
    }
}

// --- Live Chat Engine ---

document.getElementById("chat-nav-btn").onclick = () => {
    if (dashboardPollingInterval) clearInterval(dashboardPollingInterval);
    
    document.getElementById("dashboard-screen").style.display = "none";
    document.getElementById("chat-screen").style.display = "block";
    
    document.getElementById("chat-badge").style.display = "none";
    
    loadChatMessages();
    chatPollingInterval = setInterval(loadChatMessages, 1500); 
};

async function checkNewMessagesBadge() {
    try {
        const response = await fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "getChat" }) });
        const data = await response.json();
        if (data.status === "success" && data.totalMessages > lastKnownChatCount) {
            document.getElementById("chat-badge").style.display = "inline-block";
        }
    } catch (error) { console.log("Badge check failed"); }
}

async function loadChatMessages() {
    try {
        const response = await fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "getChat" }) });
        const data = await response.json();
        
        if (data.status === "success") {
            lastKnownChatCount = data.totalMessages;
            localStorage.setItem("roombook_chat_count", lastKnownChatCount);
            
            const chatBox = document.getElementById("chat-box");
            
            const currentElementCount = chatBox.querySelectorAll('.chat-bubble').length;
            if (data.messages.length === currentElementCount && currentElementCount !== 0) return;

            let html = '';
            data.messages.forEach(msg => {
                const d = new Date(msg.date);
                let timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                let dateStr = `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
                let fullDateTime = `${dateStr} • ${timeStr}`;
                
                let formattedText = msg.message.replace(/(@\w+)/g, '<span class="tag-highlight">$1</span>');

                if (msg.role === "Admin") {
                    html += `
                    <div class="chat-bubble msg-admin">
                        <span style="font-size: 18px;">📢</span><br>
                        ${formattedText}
                        <div style="font-size: 10px; opacity: 0.8; margin-top: 5px; font-weight: normal;">${fullDateTime}</div>
                    </div>`;
                } else if (msg.sender === currentUser) {
                    html += `
                    <div class="chat-bubble msg-mine">
                        <span class="chat-meta">${fullDateTime}</span>
                        ${formattedText}
                    </div>`;
                } else {
                    html += `
                    <div class="chat-bubble msg-other">
                        <span class="chat-meta">${msg.sender} • ${fullDateTime}</span>
                        ${formattedText}
                    </div>`;
                }
            });
            
            chatBox.innerHTML = html;
            chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
        }
    } catch (error) { console.log("Chat load failed"); }
}

async function sendChatMessage() {
    const inputEl = document.getElementById("chatInput");
    const text = inputEl.value.trim();
    if (!text) return;

    inputEl.value = ""; 
    
    const chatBox = document.getElementById("chat-box");
    chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });

    try {
        await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({
                action: "sendChat",
                userId: currentUser,
                role: currentRole, 
                message: text
            })
        });
        loadChatMessages();
    } catch (error) {
        alert("Failed to send message.");
    }
}

document.getElementById("chatInput").addEventListener("keypress", function(event) {
    if (event.key === "Enter") sendChatMessage();
});

if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", () => {
        const chatScreen = document.getElementById("chat-screen");
        
        if (chatScreen.style.display === "block") {
            chatScreen.style.height = window.visualViewport.height + "px";
            window.scrollTo(0, 0); 
            document.body.scrollTop = 0;
            
            const chatBox = document.getElementById("chat-box");
            chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
        }
    });
}

// --- Custom PWA Install Engine ---
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    if (!sessionStorage.getItem('pwa_banner_dismissed')) {
        document.getElementById('pwa-install-banner').style.display = 'block';
    }
});

document.getElementById('pwa-install-btn').addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            console.log('User accepted the PWA install prompt');
        }
        deferredPrompt = null;
        document.getElementById('pwa-install-banner').style.display = 'none';
    }
});

function dismissInstallBanner() {
    document.getElementById('pwa-install-banner').style.display = 'none';
    sessionStorage.setItem('pwa_banner_dismissed', 'true');
}

window.addEventListener('appinstalled', () => {
    document.getElementById('pwa-install-banner').style.display = 'none';
    deferredPrompt = null;
});

// --- NATIVE APP BACK BUTTON LOGIC ---
let backPressTimer = null;

window.history.pushState({ page: 'messkhata' }, "");

window.addEventListener('popstate', (e) => {
    const dashboard = document.getElementById("dashboard-screen");
    const login = document.getElementById("login-screen");
    
    if (dashboard.style.display === "none" && login.style.display === "none") {
        goBackToDashboard();
        window.history.pushState({ page: 'messkhata' }, "");
    } 
    else if (dashboard.style.display === "block") {
        if (backPressTimer) {
            window.history.back(); 
        } else {
            showExitWarning();
            window.history.pushState({ page: 'messkhata' }, "");
            
            backPressTimer = setTimeout(() => {
                backPressTimer = null;
            }, 2000); 
        }
    } 
    else {
         window.history.pushState({ page: 'messkhata' }, "");
    }
});

function showExitWarning() {
    let warning = document.createElement("div");
    warning.innerText = "Press back again to exit";
    
    warning.style.position = "fixed";
    warning.style.bottom = "80px";
    warning.style.left = "50%";
    warning.style.transform = "translateX(-50%)";
    warning.style.background = "rgba(0, 0, 0, 0.8)";
    warning.style.color = "white";
    warning.style.padding = "10px 20px";
    warning.style.borderRadius = "20px";
    warning.style.zIndex = "10000";
    warning.style.fontSize = "14px";
    warning.style.transition = "opacity 0.3s ease";
    
    document.body.appendChild(warning);
    
    setTimeout(() => {
        warning.style.opacity = "0";
        setTimeout(() => warning.remove(), 300);
    }, 2000);
}
