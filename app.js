// PASTE YOUR GOOGLE APPS SCRIPT WEB APP URL HERE
const API_URL = "https://script.google.com/macros/s/AKfycbxSQaPQVD0lhiZgB7q7TZy9JFKPXNdI55bHZxZMXvoWkgl6S4O2qhdDBb7o2WwfkTNm5w/exec"; 

let currentUser = "";
let currentPassword = "";

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
            
            document.getElementById("login-screen").style.display = "none";

            // Check if user needs to reset the default "1234" password
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

    if (!newPassword || newPassword === "1234") {
        messageEl.innerText = "Please enter a valid new password.";
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
            currentPassword = newPassword;
            document.getElementById("reset-screen").style.display = "none";
            showDashboard("User");
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
    
    // Check role to show/hide specific buttons
    if (role === "Admin") {
        document.getElementById("admin-btn").style.display = "block";
        document.querySelector('.button-grid button:nth-child(1)').style.display = "none"; // Hide EXPENCE
        document.querySelector('.button-grid button:nth-child(2)').style.display = "none"; // Hide COOKING & CLEANING
    } else {
        document.getElementById("admin-btn").style.display = "none";
        document.querySelector('.button-grid button:nth-child(1)').style.display = "block"; 
        document.querySelector('.button-grid button:nth-child(2)').style.display = "block"; 
    }
}

function goBackToDashboard() {
    document.getElementById("expense-screen").style.display = "none";
    document.getElementById("chore-screen").style.display = "none";
    document.getElementById("pay-details-screen").style.display = "none";
    document.getElementById("expense-review-screen").style.display = "none";
    document.getElementById("admin-screen").style.display = "none"; // Hide admin screen
    document.getElementById("dashboard-screen").style.display = "block";
    
    document.getElementById("expense-message").innerText = "";
    document.getElementById("chore-message").innerText = "";
    document.getElementById("admin-message").innerText = "";
}

function logout() {
    currentUser = "";
    currentPassword = "";
    document.getElementById("dashboard-screen").style.display = "none";
    document.getElementById("login-screen").style.display = "block";
    document.getElementById("userId").value = "";
    document.getElementById("password").value = "";
    document.getElementById("login-message").innerText = "";
}

// --- Expense Tracking Logic ---

// Connect the 1st button (EXPENCE)
document.querySelector('.button-grid button:nth-child(1)').onclick = async () => {
    document.getElementById("dashboard-screen").style.display = "none";
    document.getElementById("expense-screen").style.display = "block";
    await loadActiveUsers();
};

async function loadActiveUsers() {
    const container = document.getElementById("dynamic-split-users");
    container.innerHTML = '<p style="font-size: 14px; color: #333;">Loading users...</p>';
    
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ action: "getActiveUsers" })
        });
        const data = await response.json();
        
        if (data.status === "success") {
            container.innerHTML = "";
            data.users.forEach(user => {
                container.innerHTML += `<label class="split-label"><input type="checkbox" class="split-check" value="${user}" checked> ${user}</label>`;
            });
        } else {
            container.innerHTML = "Error loading users.";
        }
    } catch (error) {
        container.innerHTML = "Connection failed.";
    }
}

async function saveExpense() {
    const expenseFor = document.getElementById("expenseFor").value;
    const amount = document.getElementById("expenseAmount").value;
    const messageEl = document.getElementById("expense-message");

    // Gather all checked users to split with
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
            // Clear the form
            document.getElementById("expenseFor").value = "";
            document.getElementById("expenseAmount").value = "";
            messageEl.style.color = "#27ae60"; // Green success text
            messageEl.innerText = "Expense saved successfully!";
            
            // Automatically go back to dashboard after 1.5 seconds
            setTimeout(() => {
                goBackToDashboard();
                messageEl.style.color = "#d63031"; // Reset color to red for future errors
            }, 1500); 
        } else {
            messageEl.innerText = data.message;
        }
    } catch (error) {
        messageEl.innerText = "Error saving expense.";
    }
}

// --- Chore Tracking Logic ---

// Connect the 2nd button (COOKING & CLEANING)
document.querySelector('.button-grid button:nth-child(2)').onclick = async () => {
    document.getElementById("dashboard-screen").style.display = "none";
    document.getElementById("chore-screen").style.display = "block";
    await loadChores(); // Fetch the dropdown options from Google Sheets
};

async function loadChores() {
    const selectEl = document.getElementById("choreSelect");
    selectEl.innerHTML = '<option value="">Loading...</option>';
    
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ action: "getChores" })
        });
        const data = await response.json();
        
        if (data.status === "success") {
            selectEl.innerHTML = '<option value="">Select Work...</option>';
            data.chores.forEach(chore => {
                // Store the amount inside the option element so we can retrieve it later
                selectEl.innerHTML += `<option value="${chore.name}" data-amount="${chore.amount}">${chore.name}</option>`;
            });
        }
    } catch (error) {
        selectEl.innerHTML = '<option value="">Error loading</option>';
    }
}

// Update the Amount display when the user selects a different chore
document.getElementById("choreSelect").addEventListener("change", function() {
    const selectedOption = this.options[this.selectedIndex];
    const amount = selectedOption.getAttribute("data-amount") || 0;
    document.getElementById("choreAmountDisplay").innerText = `Amount: ₹${amount}`;
});

async function saveChore() {
    const selectEl = document.getElementById("choreSelect");
    const messageEl = document.getElementById("chore-message");
    const selectedOption = selectEl.options[selectEl.selectedIndex];
    
    if (!selectEl.value) {
        messageEl.innerText = "Please select a work category.";
        return;
    }

    messageEl.innerText = "Saving to database...";
    const amount = parseFloat(selectedOption.getAttribute("data-amount"));

    const payload = {
        action: "addChore",
        userId: currentUser,
        choreName: selectEl.value,
        amount: amount
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
                selectEl.selectedIndex = 0;
                document.getElementById("choreAmountDisplay").innerText = "Amount: ₹0";
            }, 1500); 
        } else {
            messageEl.innerText = data.message;
        }
    } catch (error) {
        messageEl.innerText = "Error saving work.";
    }
}

// --- Pay Details Logic ---

// Connect the 3rd button (Pay Detels)
document.querySelector('.button-grid button:nth-child(3)').onclick = async () => {
    document.getElementById("dashboard-screen").style.display = "none";
    document.getElementById("pay-details-screen").style.display = "block";
    
    const contentEl = document.getElementById("pay-details-content");
    contentEl.innerHTML = "Calculating balances...";

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ action: "getAllData" })
        });
        const data = await response.json();

        if (data.status === "success") {
            // The Math Engine (Now 100% Dynamic!)
            const users = data.activeUsers; 
            let balances = {};
            let totalPaid = {};
            let choresEarned = {};
            
            // Automatically set up accounts for all active users
            users.forEach(u => {
                balances[u] = 0;
                totalPaid[u] = 0;
                choresEarned[u] = 0;
            });

            // 1. Calculate Expenses
            data.expenses.forEach(exp => {
                const amount = parseFloat(exp.amount) || 0;
                const payer = exp.paidBy;
                const splitList = exp.splitWith.split(',').map(s => s.trim());
                const splitCount = splitList.length;

                if (splitCount > 0 && users.includes(payer)) {
                    totalPaid[payer] += amount;
                    balances[payer] += amount; 
                    
                    const share = amount / splitCount;
                    splitList.forEach(person => {
                        if (users.includes(person)) {
                            balances[person] -= share;
                        }
                    });
                }
            });

            // 2. Calculate Chores (Cooking & Cleaning)
            data.chores.forEach(chore => {
                const amount = parseFloat(chore.amount) || 0;
                const earner = chore.doneBy;
                
                if (users.includes(earner)) {
                    choresEarned[earner] += amount;
                    balances[earner] += amount; 
                    
                    const others = users.filter(u => u !== earner);
                    if (others.length > 0) {
                        const splitCost = amount / others.length;
                        others.forEach(person => {
                            balances[person] -= splitCost;
                        });
                    }
                }
            });

            // 3. Build the UI Cards
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
        } else {
            contentEl.innerHTML = "Error loading data.";
        }
    } catch (error) {
        contentEl.innerHTML = "Connection failed.";
    }
};

// --- Expense Review Logic ---

// Connect the 4th button (EXPENCE REVIEW)
document.querySelector('.button-grid button:nth-child(4)').onclick = async () => {
    document.getElementById("dashboard-screen").style.display = "none";
    document.getElementById("expense-review-screen").style.display = "block";
    
    const contentEl = document.getElementById("review-content");
    contentEl.innerHTML = "Fetching history from server...";

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ action: "getAllData" })
        });
        const data = await response.json();

        if (data.status === "success") {
            let html = `<h4 style="margin-top:0; border-bottom: 2px solid #2c3e50; padding-bottom: 5px;">💸 Expenses</h4>`;
            
            if (data.expenses.length === 0) {
                html += `<p style="font-size: 14px;">No expenses logged yet.</p>`;
            } else {
                // Reverse array to show newest first
                data.expenses.slice().reverse().forEach(exp => {
                    const d = new Date(exp.date);
                    const dateStr = `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
                    
                    html += `
                    <div style="background: white; padding: 10px; margin-bottom: 8px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                        <div style="display:flex; justify-content:space-between; font-weight:bold; color:#333;">
                            <span>${exp.item}</span>
                            <span style="color:#e74c3c;">₹${exp.amount}</span>
                        </div>
                        <div style="font-size:12px; color:#7f8fa6; margin-top:4px;">
                            ${dateStr} | Paid by: <b>${exp.paidBy}</b> <br>
                            Split: ${exp.splitWith}
                        </div>
                    </div>`;
                });
            }

            html += `<h4 style="margin-top:20px; border-bottom: 2px solid #2c3e50; padding-bottom: 5px;">🧹 Work Log</h4>`;
            
            if (data.chores.length === 0) {
                html += `<p style="font-size: 14px;">No work logged yet.</p>`;
            } else {
                data.chores.slice().reverse().forEach(chore => {
                    const d = new Date(chore.date);
                    const dateStr = `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
                    
                    html += `
                    <div style="background: white; padding: 10px; margin-bottom: 8px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                        <div style="display:flex; justify-content:space-between; font-weight:bold; color:#333;">
                            <span>${chore.item}</span>
                            <span style="color:#27ae60;">+₹${chore.amount}</span>
                        </div>
                        <div style="font-size:12px; color:#7f8fa6; margin-top:4px;">
                            ${dateStr} | Done by: <b>${chore.doneBy}</b>
                        </div>
                    </div>`;
                });
            }

            contentEl.innerHTML = html;
        } else {
            contentEl.innerHTML = "Error loading history.";
        }
    } catch (error) {
        contentEl.innerHTML = "Connection failed.";
    }
};

// --- Admin Logic ---

document.getElementById("admin-btn").onclick = async () => {
    document.getElementById("dashboard-screen").style.display = "none";
    document.getElementById("admin-screen").style.display = "block";
    await loadAdminData();
};

async function loadAdminData() {
    const userSelect = document.getElementById("adminUserSelect");
    const choreSelect = document.getElementById("adminChoreSelect");
    
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ action: "getAdminData" })
        });
        const data = await response.json();

        if (data.status === "success") {
            userSelect.innerHTML = '<option value="">Select a user...</option>';
            data.users.forEach(user => {
                userSelect.innerHTML += `<option value="${user}">${user}</option>`;
            });

            choreSelect.innerHTML = '<option value="">Select work to edit/delete...</option>';
            data.chores.forEach(chore => {
                choreSelect.innerHTML += `<option value="${chore.name}" data-amount="${chore.amount}">${chore.name} (₹${chore.amount})</option>`;
            });
        }
    } catch (error) {
        document.getElementById("admin-message").innerText = "Error loading data.";
    }
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
            await loadAdminData(); // Refresh dropdowns
        }
    } catch (error) {
        messageEl.innerText = "Server connection failed.";
    }
}

// --- Custom Edit Modal Controls ---
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

// --- Admin Work Logic ---
async function adminChore(subAction) {
    const messageEl = document.getElementById("admin-message");
    let payload = { action: "adminChoreAction", subAction: subAction };

    if (subAction === "add") {
        payload.choreName = document.getElementById("newChoreName").value.trim();
        payload.amount = parseFloat(document.getElementById("newChoreAmount").value);
        if (!payload.choreName || !payload.amount) return messageEl.innerText = "Enter work name and amount.";
    } else {
        const select = document.getElementById("adminChoreSelect");
        if (!select.value) return messageEl.innerText = "Select work from the list first.";
        
        if (subAction === "delete") {
            payload.choreName = select.value;
            if (!confirm(`Are you sure you want to delete ${payload.choreName}?`)) return;
        } 
        
        if (subAction === "edit") {
            // OPEN CUSTOM MODAL INSTEAD OF BROWSER PROMPT
            const selectedOpt = select.options[select.selectedIndex];
            document.getElementById("editOldName").value = select.value;
            document.getElementById("editNewName").value = select.value;
            document.getElementById("editNewAmount").value = selectedOpt.getAttribute("data-amount");
            
            document.getElementById("custom-edit-modal").style.display = "flex";
            return; // Stop execution here, wait for modal buttons
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
