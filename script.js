"use strict";

/*
  PennyPilot Personal Finance Tracker

  Storage:
  - User accounts: localStorage
  - Transactions: localStorage, separated by user
  - Budgets: localStorage, separated by user

  Important:
  This is a browser-based student project.
  It is not a secure production authentication system.
*/

const STORAGE = {
    users: "pennypilot_users_v3",
    session: "pennypilot_session_v3",
    transactions: "pennypilot_transactions_v3",
    budgets: "pennypilot_budgets_v3"
};

const $ = (id) => document.getElementById(id);

let currentUser = null;
let activeSection = "dashboard";
let authMode = "login";
let calendarYear = new Date().getFullYear();
let calendarMonth = new Date().getMonth();
let selectedCalendarDate = localDateString(new Date());
let pendingConfirmation = null;

/* ---------------- STORAGE HELPERS ---------------- */

function readJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
    } catch (error) {
        console.error("Storage read error:", error);
        return fallback;
    }
}

function writeJSON(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error("Storage write error:", error);
        showToast("Unable to save data. Check browser storage.", "error");
        return false;
    }
}

function getUsers() {
    const users = readJSON(STORAGE.users, []);
    return Array.isArray(users) ? users : [];
}

function getAllTransactions() {
    const all = readJSON(STORAGE.transactions, {});
    return all && typeof all === "object" ? all : {};
}

function getAllBudgets() {
    const all = readJSON(STORAGE.budgets, {});
    return all && typeof all === "object" ? all : {};
}

function getTransactions() {
    if (!currentUser) return [];

    const all = getAllTransactions();
    const rows = all[currentUser.email];

    return Array.isArray(rows) ? rows : [];
}

function saveTransactions(rows) {
    if (!currentUser) return false;

    const all = getAllTransactions();
    all[currentUser.email] = rows;

    return writeJSON(STORAGE.transactions, all);
}

function getBudgets() {
    if (!currentUser) return [];

    const all = getAllBudgets();
    const rows = all[currentUser.email];

    return Array.isArray(rows) ? rows : [];
}

function saveBudgets(rows) {
    if (!currentUser) return false;

    const all = getAllBudgets();
    all[currentUser.email] = rows;

    return writeJSON(STORAGE.budgets, all);
}

/* ---------------- GENERAL HELPERS ---------------- */

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function localDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function todayString() {
    return localDateString(new Date());
}

function formatMoney(value) {
    const amount = Number(value) || 0;

    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

function formatDate(dateString) {
    if (!dateString) return "—";

    const parts = dateString.split("-");

    if (parts.length !== 3) return dateString;

    const date = new Date(
        Number(parts[0]),
        Number(parts[1]) - 1,
        Number(parts[2])
    );

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function monthKey(dateString) {
    return String(dateString || "").slice(0, 7);
}

function currentMonthKey() {
    return todayString().slice(0, 7);
}

function monthLabel(date) {
    return date.toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric"
    });
}

function sumAmounts(rows) {
    return rows.reduce((total, row) => {
        return total + (Number(row.amount) || 0);
    }, 0);
}

function getIncome(rows) {
    return sumAmounts(rows.filter((row) => row.type === "income"));
}

function getExpenses(rows) {
    return sumAmounts(rows.filter((row) => row.type === "expense"));
}

function getMonthTransactions(rows, month) {
    return rows.filter((row) => monthKey(row.date) === month);
}

function newId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function showToast(message, type = "success") {
    const container = $("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    window.setTimeout(() => {
        toast.remove();
    }, 3500);
}

/* ---------------- AUTHENTICATION ---------------- */

function setAuthMode(mode) {
    authMode = mode;

    const isRegister = mode === "register";

    $("loginTab").classList.toggle("active", !isRegister);
    $("registerTab").classList.toggle("active", isRegister);

    $("authName").classList.toggle("hidden", !isRegister);
    $("nameLabel").classList.toggle("hidden", !isRegister);

    $("authName").required = isRegister;
    $("authSubmit").textContent = isRegister ? "Create Account" : "Login";
}

function handleAuthSubmit(event) {
    event.preventDefault();

    const email = $("authEmail").value.trim().toLowerCase();
    const password = $("authPassword").value;
    const name = $("authName").value.trim();

    if (!email || !password) {
        showToast("Enter your email and password.", "error");
        return;
    }

    if (password.length < 4) {
        showToast("Password must contain at least 4 characters.", "error");
        return;
    }

    const users = getUsers();

    if (authMode === "register") {
        if (!name) {
            showToast("Enter your full name.", "error");
            return;
        }

        if (users.some((user) => user.email === email)) {
            showToast("An account with this email already exists.", "error");
            return;
        }

        /*
          This simple password storage is only for a student demo.
          Do not use this authentication approach for real financial data.
        */
        users.push({
            id: newId(),
            name,
            email,
            password
        });

        if (!writeJSON(STORAGE.users, users)) return;

        showToast("Account created successfully.");
        loginUser(users[users.length - 1]);
        return;
    }

    const user = users.find((item) => {
        return item.email === email && item.password === password;
    });

    if (!user) {
        showToast("Incorrect email or password.", "error");
        return;
    }

    loginUser(user);
}

function loginUser(user) {
    currentUser = {
        id: user.id,
        name: user.name,
        email: user.email
    };

    /*
      A failed session save should not prevent this browser session
      from displaying the application.
    */
    try {
        sessionStorage.setItem(STORAGE.session, JSON.stringify(currentUser));
    } catch (error) {
        console.warn("Session could not be saved:", error);
    }

    $("authPage").classList.add("hidden");
    $("appPage").classList.remove("hidden");

    $("welcomeName").textContent = user.name.split(" ")[0];
    $("sidebarUser").textContent = user.name;
    $("userAvatar").textContent = user.name.charAt(0).toUpperCase();

    $("todayDate").textContent = new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });

    showSection("dashboard");
    renderAll();

    $("authForm").reset();
}

function logout() {
    currentUser = null;

    try {
        sessionStorage.removeItem(STORAGE.session);
    } catch (error) {
        console.warn(error);
    }

    $("appPage").classList.add("hidden");
    $("authPage").classList.remove("hidden");

    $("authForm").reset();
    setAuthMode("login");

    showToast("You have logged out.");
}

function restoreSession() {
    try {
        const session = JSON.parse(
            sessionStorage.getItem(STORAGE.session) || "null"
        );

        if (!session || !session.email) return false;

        const user = getUsers().find((item) => {
            return item.email === session.email;
        });

        if (!user) return false;

        loginUser(user);
        return true;
    } catch (error) {
        console.warn("Session restore failed:", error);
        return false;
    }
}

/* ---------------- NAVIGATION ---------------- */

const sectionTitles = {
    dashboard: "Dashboard",
    transactions: "Transactions",
    budgets: "Budgets",
    reports: "Reports & Analytics",
    calendar: "Expense Calendar"
};

function showSection(sectionName) {
    if (!sectionTitles[sectionName]) return;

    activeSection = sectionName;

    document.querySelectorAll(".content-section").forEach((section) => {
        section.classList.add("hidden");
    });

    const target = $(`${sectionName}Section`);

    if (target) target.classList.remove("hidden");

    document.querySelectorAll(".nav-item").forEach((button) => {
        button.classList.toggle(
            "active",
            button.dataset.section === sectionName
        );
    });

    $("pageTitle").textContent = sectionTitles[sectionName];

    if (sectionName === "reports") renderReports();
    if (sectionName === "calendar") renderCalendar();
    if (sectionName === "budgets") renderBudgets();
}

function handleNavigation(event) {
    const navButton = event.target.closest("[data-section]");
    const goButton = event.target.closest("[data-go]");

    if (navButton) {
        showSection(navButton.dataset.section);
    }

    if (goButton) {
        showSection(goButton.dataset.go);
    }
}

/* ---------------- TRANSACTION MODAL ---------------- */

function openTransactionModal(transaction = null) {
    $("transactionForm").reset();
    $("transactionId").value = "";

    $("transactionDate").value = todayString();
    $("transactionType").value = "expense";
    $("expenseNature").value = "necessary";
    $("paymentMethod").value = "Cash";
    $("transactionCategory").value = "Food";

    if (transaction) {
        $("modalTitle").textContent = "Edit Transaction";
        $("transactionId").value = transaction.id;
        $("transactionType").value = transaction.type;
        $("transactionAmount").value = transaction.amount;
        $("transactionDescription").value = transaction.description;
        $("transactionCategory").value = transaction.category;
        $("transactionDate").value = transaction.date;
        $("paymentMethod").value = transaction.paymentMethod || "Cash";
        $("expenseNature").value = transaction.nature || "necessary";
        $("transactionNotes").value = transaction.notes || "";
    } else {
        $("modalTitle").textContent = "Add Transaction";
    }

    $("transactionModal").classList.remove("hidden");
    document.body.style.overflow = "hidden";
}

function closeTransactionModal() {
    $("transactionModal").classList.add("hidden");
    document.body.style.overflow = "";
}

function handleTransactionSubmit(event) {
    event.preventDefault();

    if (!currentUser) return;

    const id = $("transactionId").value;
    const amount = Number($("transactionAmount").value);
    const description = $("transactionDescription").value.trim();
    const date = $("transactionDate").value;

    if (!Number.isFinite(amount) || amount <= 0) {
        showToast("Enter an amount greater than zero.", "error");
        return;
    }

    if (!description) {
        showToast("Enter a transaction description.", "error");
        return;
    }

    if (!date) {
        showToast("Select a transaction date.", "error");
        return;
    }

    const rows = getTransactions();

    const transaction = {
        id: id || newId(),
        type: $("transactionType").value,
        amount,
        description,
        category: $("transactionCategory").value,
        date,
        paymentMethod: $("paymentMethod").value,
        nature: $("expenseNature").value,
        notes: $("transactionNotes").value.trim(),
        updatedAt: new Date().toISOString()
    };

    if (id) {
        const index = rows.findIndex((row) => row.id === id);

        if (index === -1) {
            showToast("Transaction not found.", "error");
            return;
        }

        rows[index] = {
            ...rows[index],
            ...transaction
        };

        if (!saveTransactions(rows)) return;

        showToast("Transaction updated successfully.");
    } else {
        transaction.createdAt = new Date().toISOString();
        rows.push(transaction);

        if (!saveTransactions(rows)) return;

        showToast("Transaction added successfully.");
    }

    closeTransactionModal();
    renderAll();
}

/* ---------------- DELETE CONFIRMATION ---------------- */

function askConfirmation(title, message, callback) {
    $("confirmTitle").textContent = title;
    $("confirmMessage").textContent = message;

    pendingConfirmation = callback;

    $("confirmModal").classList.remove("hidden");
    document.body.style.overflow = "hidden";
}

function closeConfirmation() {
    $("confirmModal").classList.add("hidden");
    pendingConfirmation = null;

    if ($("transactionModal").classList.contains("hidden")) {
        document.body.style.overflow = "";
    }
}

function confirmAction() {
    if (typeof pendingConfirmation !== "function") {
        closeConfirmation();
        return;
    }

    const callback = pendingConfirmation;
    pendingConfirmation = null;

    $("confirmModal").classList.add("hidden");

    try {
        callback();
    } finally {
        if ($("transactionModal").classList.contains("hidden")) {
            document.body.style.overflow = "";
        }
    }
}

function deleteTransaction(id) {
    askConfirmation(
        "Delete Transaction",
        "Are you sure you want to delete this transaction? This action cannot be undone.",
        () => {
            const rows = getTransactions();
            const filtered = rows.filter((row) => row.id !== id);

            if (filtered.length === rows.length) {
                showToast("Transaction not found.", "error");
                return;
            }

            if (!saveTransactions(filtered)) return;

            showToast("Transaction deleted successfully.");
            renderAll();
        }
    );
}

/* ---------------- TRANSACTION TABLES ---------------- */

function transactionRowHTML(transaction, showActions = true) {
    const income = transaction.type === "income";
    const symbol = income ? "↗" : "↘";
    const amountClass = income ? "amount-income" : "amount-expense";
    const sign = income ? "+" : "−";

    const notes = transaction.notes
        ? `<small>${escapeHTML(transaction.notes)}</small>`
        : "";

    const actions = showActions
        ? `
            <td>
                <div class="action-buttons">
                    <button class="icon-btn"
                        data-edit="${escapeHTML(transaction.id)}"
                        title="Edit transaction" aria-label="Edit">✎</button>
                    <button class="icon-btn delete"
                        data-delete="${escapeHTML(transaction.id)}"
                        title="Delete transaction" aria-label="Delete">×</button>
                </div>
            </td>
        `
        : "";

    return `
        <tr>
            <td>
                <div class="transaction-name">
                    <span class="transaction-symbol">${symbol}</span>
                    <div>
                        <strong>${escapeHTML(transaction.description)}</strong>
                        ${notes}
                    </div>
                </div>
            </td>
            <td><span class="category-pill">${escapeHTML(transaction.category)}</span></td>
            <td>${formatDate(transaction.date)}</td>
            <td>
                <span class="type-pill ${income ? "income" : "expense"}">
                    ${income ? "Income" : "Expense"}
                </span>
            </td>
            ${
                showActions
                    ? `<td>${escapeHTML(transaction.paymentMethod || "Cash")}</td>`
                    : ""
            }
            <td class="${amountClass}">${sign}${formatMoney(transaction.amount)}</td>
            ${actions}
        </tr>
    `;
}

function renderRecentTransactions() {
    const rows = [...getTransactions()]
        .sort((a, b) => {
            return b.date.localeCompare(a.date) ||
                String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
        })
        .slice(0, 5);

    $("recentTableBody").innerHTML = rows
        .map((row) => transactionRowHTML(row, false))
        .join("");

    $("recentEmpty").classList.toggle("hidden", rows.length > 0);
}

function getFilteredTransactions() {
    const rows = getTransactions();

    const search = $("searchInput").value.trim().toLowerCase();
    const type = $("typeFilter").value;
    const category = $("categoryFilter").value;
    const fromDate = $("fromDate").value;
    const toDate = $("toDate").value;

    if (fromDate && toDate && fromDate > toDate) {
        return [];
    }

    return rows.filter((row) => {
        const searchText = [
            row.description,
            row.notes,
            row.category,
            row.paymentMethod
        ].join(" ").toLowerCase();

        if (search && !searchText.includes(search)) return false;
        if (type !== "all" && row.type !== type) return false;
        if (category !== "all" && row.category !== category) return false;
        if (fromDate && row.date < fromDate) return false;
        if (toDate && row.date > toDate) return false;

        return true;
    }).sort((a, b) => {
        return b.date.localeCompare(a.date) ||
            String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    });
}

function renderTransactions() {
    const rows = getFilteredTransactions();

    $("transactionsTableBody").innerHTML = rows
        .map((row) => transactionRowHTML(row, true))
        .join("");

    $("transactionEmpty").classList.toggle("hidden", rows.length > 0);

    $("transactionCount").textContent =
        `${rows.length} transaction${rows.length === 1 ? "" : "s"}`;
}

function resetFilters() {
    $("searchInput").value = "";
    $("typeFilter").value = "all";
    $("categoryFilter").value = "all";
    $("fromDate").value = "";
    $("toDate").value = "";

    renderTransactions();
}

function handleTransactionTableClick(event) {
    const editButton = event.target.closest("[data-edit]");
    const deleteButton = event.target.closest("[data-delete]");

    if (editButton) {
        const transaction = getTransactions().find((row) => {
            return row.id === editButton.dataset.edit;
        });

        if (!transaction) {
            showToast("Transaction not found.", "error");
            return;
        }

        openTransactionModal(transaction);
    }

    if (deleteButton) {
        deleteTransaction(deleteButton.dataset.delete);
    }
}

/* ---------------- DASHBOARD ---------------- */

function renderDashboard() {
    const rows = getTransactions();
    const monthRows = getMonthTransactions(rows, currentMonthKey());

    const income = getIncome(rows);
    const expenses = getExpenses(rows);
    const savings = getIncome(monthRows) - getExpenses(monthRows);

    $("totalBalance").textContent = formatMoney(income - expenses);
    $("totalIncome").textContent = formatMoney(income);
    $("totalExpenses").textContent = formatMoney(expenses);
    $("monthlySavings").textContent = formatMoney(savings);

    renderRecentTransactions();
    renderIncomeExpenseChart();
    renderCategoryChart("categoryChart", rows);
}

/* ---------------- CANVAS CHARTS ---------------- */

function setupCanvas(canvas) {
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();

    if (!rect.width || !rect.height) return null;

    const ratio = window.devicePixelRatio || 1;

    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);

    const context = canvas.getContext("2d");

    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    return {
        ctx: context,
        width: rect.width,
        height: rect.height
    };
}

function drawEmptyChart(ctx, width, height, message = "No data available") {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#9793a9";
    ctx.font = "12px DM Sans, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(message, width / 2, height / 2);
}

function drawBarChart(canvasId, labels, firstValues, secondValues) {
    const canvas = $(canvasId);
    const chart = setupCanvas(canvas);

    if (!chart) return;

    const { ctx, width, height } = chart;

    ctx.clearRect(0, 0, width, height);

    const maxValue = Math.max(
        1,
        ...firstValues,
        ...secondValues
    );

    const padding = {
        top: 15,
        right: 12,
        bottom: 35,
        left: 48
    };

    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    ctx.font = "10px DM Sans, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    for (let i = 0; i <= 4; i++) {
        const y = padding.top + plotHeight * i / 4;
        const value = maxValue * (4 - i) / 4;

        ctx.strokeStyle = "#eeeaf6";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();

        ctx.fillStyle = "#9692a8";
        ctx.fillText(
            value >= 1000
                ? `${(value / 1000).toFixed(1)}k`
                : value.toFixed(0),
            padding.left - 8,
            y
        );
    }

    const groupWidth = plotWidth / Math.max(labels.length, 1);
    const barWidth = Math.min(19, groupWidth * .27);

    labels.forEach((label, index) => {
        const center = padding.left + groupWidth * (index + .5);

        const firstHeight = plotHeight *
            (firstValues[index] || 0) / maxValue;

        const secondHeight = plotHeight *
            (secondValues[index] || 0) / maxValue;

        ctx.fillStyle = "#7351e5";
        ctx.beginPath();
        ctx.roundRect(
            center - barWidth - 2,
            padding.top + plotHeight - firstHeight,
            barWidth,
            Math.max(firstHeight, 0),
            4
        );
        ctx.fill();

        ctx.fillStyle = "#27b78a";
        ctx.beginPath();
        ctx.roundRect(
            center + 2,
            padding.top + plotHeight - secondHeight,
            barWidth,
            Math.max(secondHeight, 0),
            4
        );
        ctx.fill();

        ctx.fillStyle = "#8d899e";
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";

        ctx.fillText(
            label,
            center,
            height - 12
        );
    });
}

function renderIncomeExpenseChart() {
    const rows = getMonthTransactions(
        getTransactions(),
        currentMonthKey()
    );

    const income = getIncome(rows);
    const expenses = getExpenses(rows);

    drawBarChart(
        "incomeExpenseChart",
        ["This month"],
        [income],
        [expenses]
    );
}

function getLastSixMonths() {
    const result = [];
    const now = new Date();

    for (let offset = 5; offset >= 0; offset--) {
        const date = new Date(
            now.getFullYear(),
            now.getMonth() - offset,
            1
        );

        const key = `${date.getFullYear()}-${String(
            date.getMonth() + 1
        ).padStart(2, "0")}`;

        result.push({
            key,
            label: date.toLocaleDateString("en-IN", {
                month: "short"
            })
        });
    }

    return result;
}

function renderMonthlyChart() {
    const rows = getTransactions();
    const months = getLastSixMonths();

    const incomes = months.map((month) => {
        return getIncome(getMonthTransactions(rows, month.key));
    });

    const expenses = months.map((month) => {
        return getExpenses(getMonthTransactions(rows, month.key));
    });

    drawBarChart(
        "monthlyChart",
        months.map((month) => month.label),
        incomes,
        expenses
    );
}

function renderCategoryChart(targetId, transactions) {
    const container = $(targetId);
    if (!container) return;

    const expenses = transactions.filter((row) => {
        return row.type === "expense";
    });

    const totals = {};

    expenses.forEach((row) => {
        totals[row.category] =
            (totals[row.category] || 0) + Number(row.amount || 0);
    });

    const entries = Object.entries(totals)
        .sort((a, b) => b[1] - a[1]);

    const total = entries.reduce((sum, item) => sum + item[1], 0);

    if (!entries.length || total === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">◉</div>
                <h3>No expense data</h3>
                <p>Add expenses to see category analysis.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = entries.map(([category, amount], index) => {
        const percentage = amount / total * 100;

        return `
            <div class="category-row">
                <div class="category-info">
                    <strong>${escapeHTML(category)}</strong>
                    <span>${formatMoney(amount)} · ${percentage.toFixed(1)}%</span>
                </div>
                <div class="progress-track">
                    <div class="progress-fill cat-color-${index % 9}"
                         style="width:${percentage.toFixed(2)}%"></div>
                </div>
            </div>
        `;
    }).join("");
}

/* ---------------- BUDGETS ---------------- */

function handleBudgetSubmit(event) {
    event.preventDefault();

    const category = $("budgetCategory").value;
    const amount = Number($("budgetAmount").value);

    if (!Number.isFinite(amount) || amount <= 0) {
        showToast("Enter a budget greater than zero.", "error");
        return;
    }

    const rows = getBudgets();

    const existingIndex = rows.findIndex((row) => {
        return row.category === category;
    });

    const budget = {
        category,
        amount,
        updatedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
        rows[existingIndex] = budget;
    } else {
        rows.push(budget);
    }

    if (!saveBudgets(rows)) return;

    $("budgetForm").reset();

    showToast("Budget saved successfully.");
    renderBudgets();
    renderBudgetAlerts();
}

function renderBudgets() {
    const budgets = getBudgets();
    const rows = getMonthTransactions(getTransactions(), currentMonthKey());

    $("budgetEmpty").classList.toggle("hidden", budgets.length > 0);

    $("budgetsList").innerHTML = budgets.map((budget) => {
        const spent = sumAmounts(rows.filter((row) => {
            return row.type === "expense" &&
                row.category === budget.category;
        }));

        const percentage = spent / budget.amount * 100;
        const safePercentage = Math.min(percentage, 100);

        let color = "#7351e5";

        if (percentage >= 100) {
            color = "#e05260";
        } else if (percentage >= 80) {
            color = "#f0a23e";
        }

        return `
            <article class="budget-card">
                <div class="budget-card-top">
                    <div>
                        <h3>${escapeHTML(budget.category)}</h3>
                        <p>Monthly spending limit</p>
                    </div>
                    <div class="budget-percentage">
                        ${percentage.toFixed(0)}%
                    </div>
                </div>

                <div class="progress-track">
                    <div class="progress-fill"
                         style="width:${safePercentage}%;background:${color}"></div>
                </div>

                <div class="budget-numbers">
                    <span>Spent: <strong>${formatMoney(spent)}</strong></span>
                    <span>Limit: <strong>${formatMoney(budget.amount)}</strong></span>
                </div>

                <div class="budget-numbers">
                    <span>
                        ${
                            spent > budget.amount
                                ? `Over by ${formatMoney(spent - budget.amount)}`
                                : `Remaining ${formatMoney(budget.amount - spent)}`
                        }
                    </span>
                    <button class="budget-delete"
                            data-delete-budget="${escapeHTML(budget.category)}">
                        Remove
                    </button>
                </div>
            </article>
        `;
    }).join("");

    renderBudgetAlerts();
}

function renderBudgetAlerts() {
    const budgets = getBudgets();
    const rows = getMonthTransactions(getTransactions(), currentMonthKey());

    const alerts = [];

    budgets.forEach((budget) => {
        const spent = sumAmounts(rows.filter((row) => {
            return row.type === "expense" &&
                row.category === budget.category;
        }));

        const percentage = spent / budget.amount * 100;

        if (percentage >= 100) {
            alerts.push(`
                <div class="budget-warning danger">
                    ⚠ ${escapeHTML(budget.category)} budget exceeded!
                    Spent ${formatMoney(spent)} of ${formatMoney(budget.amount)}.
                </div>
            `);
        } else if (percentage >= 80) {
            alerts.push(`
                <div class="budget-warning">
                    ⚠ ${escapeHTML(budget.category)} spending reached
                    ${percentage.toFixed(0)}% of your budget.
                </div>
            `);
        }
    });

    $("budgetAlerts").innerHTML = alerts.join("");
}

function handleBudgetClick(event) {
    const button = event.target.closest("[data-delete-budget]");
    if (!button) return;

    const category = button.dataset.deleteBudget;

    askConfirmation(
        "Remove Budget",
        `Remove the budget for ${category}? Your transactions will remain saved.`,
        () => {
            const updated = getBudgets().filter((budget) => {
                return budget.category !== category;
            });

            if (!saveBudgets(updated)) return;

            showToast("Budget removed.");
            renderBudgets();
        }
    );
}

/* ---------------- REPORTS ---------------- */

function renderReports() {
    const rows = getTransactions();

    const income = getIncome(rows);
    const expenses = getExpenses(rows);

    $("reportIncome").textContent = formatMoney(income);
    $("reportExpenses").textContent = formatMoney(expenses);
    $("reportSavings").textContent = formatMoney(income - expenses);
    $("reportCount").textContent = String(rows.length);

    const necessary = sumAmounts(rows.filter((row) => {
        return row.type === "expense" &&
            (row.nature || "necessary") === "necessary";
    }));

    const unnecessary = sumAmounts(rows.filter((row) => {
        return row.type === "expense" &&
            row.nature === "unnecessary";
    }));

    const summaryRows = [
        ["Total Income", income],
        ["Total Expenses", expenses],
        ["Net Balance", income - expenses],
        ["Necessary Expenses", necessary],
        ["Non-essential Expenses", unnecessary]
    ];

    $("reportSummaryBody").innerHTML = summaryRows.map(([label, value]) => {
        return `
            <tr>
                <td class="summary-label">${escapeHTML(label)}</td>
                <td><strong>${formatMoney(value)}</strong></td>
            </tr>
        `;
    }).join("");

    renderMonthlyChart();
    renderCategoryChart("reportCategories", rows);
}

/* ---------------- CALENDAR ---------------- */

function renderCalendar() {
    const firstDay = new Date(calendarYear, calendarMonth, 1);
    const lastDay = new Date(calendarYear, calendarMonth + 1, 0);

    $("calendarMonthTitle").textContent = monthLabel(firstDay);

    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    let html = weekdays.map((day) => {
        return `<div class="calendar-weekday">${day}</div>`;
    }).join("");

    const rows = getTransactions();
    const startOffset = firstDay.getDay();

    const gridStart = new Date(
        calendarYear,
        calendarMonth,
        1 - startOffset
    );

    const totalCells = Math.ceil(
        (startOffset + lastDay.getDate()) / 7
    ) * 7;

    for (let i = 0; i < totalCells; i++) {
        const date = new Date(gridStart);
        date.setDate(gridStart.getDate() + i);

        const key = localDateString(date);
        const dayRows = rows.filter((row) => row.date === key);

        const income = getIncome(dayRows);
        const expenses = getExpenses(dayRows);

        const outside = date.getMonth() !== calendarMonth;
        const selected = key === selectedCalendarDate;
        const isToday = key === todayString();

        html += `
            <button type="button"
                class="calendar-day
                    ${outside ? "outside" : ""}
                    ${selected ? "selected" : ""}
                    ${isToday ? "today" : ""}"
                data-calendar-date="${key}">
                <span class="day-number">${date.getDate()}</span>
                ${
                    income > 0
                        ? `<span class="day-total day-income">+${compactMoney(income)}</span>`
                        : ""
                }
                ${
                    expenses > 0
                        ? `<span class="day-total day-expense">−${compactMoney(expenses)}</span>`
                        : ""
                }
            </button>
        `;
    }

    $("calendarGrid").innerHTML = html;

    renderSelectedDay();
}

function compactMoney(value) {
    if (value >= 100000) {
        return `₹${(value / 100000).toFixed(1)}L`;
    }

    if (value >= 1000) {
        return `₹${(value / 1000).toFixed(1)}k`;
    }

    return `₹${Math.round(value)}`;
}

function renderSelectedDay() {
    const rows = getTransactions()
        .filter((row) => row.date === selectedCalendarDate)
        .sort((a, b) => String(a.description).localeCompare(String(b.description)));

    $("selectedDateTitle").textContent =
        `Transactions · ${formatDate(selectedCalendarDate)}`;

    if (!rows.length) {
        $("dailyTransactions").innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">▦</div>
                <h3>No transactions for this date</h3>
                <p>Select another date or add a transaction.</p>
            </div>
        `;
        return;
    }

    $("dailyTransactions").innerHTML = rows.map((row) => {
        const isIncome = row.type === "income";

        return `
            <div class="daily-transaction">
                <div>
                    <strong>${escapeHTML(row.description)}</strong>
                    <small>
                        ${escapeHTML(row.category)} ·
                        ${escapeHTML(row.paymentMethod || "Cash")}
                    </small>
                </div>
                <strong class="${isIncome ? "amount-income" : "amount-expense"}">
                    ${isIncome ? "+" : "−"}${formatMoney(row.amount)}
                </strong>
            </div>
        `;
    }).join("");
}

function handleCalendarClick(event) {
    const button = event.target.closest("[data-calendar-date]");
    if (!button) return;

    selectedCalendarDate = button.dataset.calendarDate;

    const parts = selectedCalendarDate.split("-");

    calendarYear = Number(parts[0]);
    calendarMonth = Number(parts[1]) - 1;

    renderCalendar();
}

/* ---------------- CSV EXPORT ---------------- */

function csvEscape(value) {
    const string = String(value ?? "");
    return `"${string.replace(/"/g, '""')}"`;
}

function exportTransactionsCSV() {
    if (!currentUser) return;

    const rows = getFilteredTransactions();

    if (!rows.length) {
        showToast("No transactions available to export.", "warning");
        return;
    }

    const headers = [
        "Description",
        "Type",
        "Category",
        "Amount",
        "Date",
        "Payment Method",
        "Nature",
        "Notes"
    ];

    const csvRows = [
        headers.map(csvEscape).join(","),
        ...rows.map((row) => [
            row.description,
            row.type,
            row.category,
            row.amount,
            row.date,
            row.paymentMethod || "Cash",
            row.nature || "necessary",
            row.notes || ""
        ].map(csvEscape).join(","))
    ];

    downloadCSV(csvRows.join("\r\n"), "pennypilot-transactions.csv");
}

function exportAllCSV() {
    if (!currentUser) return;

    const rows = [...getTransactions()].sort((a, b) => {
        return a.date.localeCompare(b.date);
    });

    if (!rows.length) {
        showToast("Add transactions before exporting.", "warning");
        return;
    }

    const headers = [
        "Description",
        "Type",
        "Category",
        "Amount",
        "Date",
        "Payment Method",
        "Nature",
        "Notes"
    ];

    const csvRows = [
        headers.map(csvEscape).join(","),
        ...rows.map((row) => [
            row.description,
            row.type,
            row.category,
            row.amount,
            row.date,
            row.paymentMethod || "Cash",
            row.nature || "necessary",
            row.notes || ""
        ].map(csvEscape).join(","))
    ];

    downloadCSV(csvRows.join("\r\n"), "pennypilot-report.csv");
}

function downloadCSV(content, filename) {
    const blob = new Blob(
        ["\uFEFF", content],
        { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    showToast("CSV file downloaded.");
}

/* ---------------- RENDER ALL ---------------- */

function renderAll() {
    if (!currentUser) return;

    renderDashboard();
    renderTransactions();
    renderBudgets();
    renderReports();

    if (activeSection === "calendar") {
        renderCalendar();
    }
}

/* ---------------- EVENT LISTENERS ---------------- */

function setupEventListeners() {
    $("loginTab").addEventListener("click", () => {
        setAuthMode("login");
    });

    $("registerTab").addEventListener("click", () => {
        setAuthMode("register");
    });

    $("authForm").addEventListener("submit", handleAuthSubmit);

    $("logoutBtn").addEventListener("click", () => {
        askConfirmation(
            "Logout",
            "Are you sure you want to log out?",
            logout
        );
    });

    document.querySelector(".side-nav").addEventListener(
        "click",
        handleNavigation
    );

    document.querySelector(".main-content").addEventListener(
        "click",
        (event) => {
            const goButton = event.target.closest("[data-go]");

            if (goButton) {
                showSection(goButton.dataset.go);
            }
        }
    );

    $("quickAddBtn").addEventListener("click", () => {
        openTransactionModal();
    });

    $("transactionAddBtn").addEventListener("click", () => {
        openTransactionModal();
    });

    $("closeModalBtn").addEventListener(
        "click",
        closeTransactionModal
    );

    $("cancelModalBtn").addEventListener(
        "click",
        closeTransactionModal
    );

    $("transactionModal").addEventListener("click", (event) => {
        if (event.target.hasAttribute("data-close-modal")) {
            closeTransactionModal();
        }
    });

    $("transactionForm").addEventListener(
        "submit",
        handleTransactionSubmit
    );

    $("confirmCancelBtn").addEventListener(
        "click",
        closeConfirmation
    );

    $("confirmYesBtn").addEventListener(
        "click",
        confirmAction
    );

    $("transactionsTableBody").addEventListener(
        "click",
        handleTransactionTableClick
    );

    $("recentTableBody").addEventListener(
        "click",
        handleTransactionTableClick
    );

    [
        "searchInput",
        "typeFilter",
        "categoryFilter",
        "fromDate",
        "toDate"
    ].forEach((id) => {
        $(id).addEventListener("input", renderTransactions);
        $(id).addEventListener("change", renderTransactions);
    });

    $("resetFiltersBtn").addEventListener("click", resetFilters);

    $("exportCsvBtn").addEventListener(
        "click",
        exportTransactionsCSV
    );

    $("reportExportBtn").addEventListener(
        "click",
        exportAllCSV
    );

    $("budgetForm").addEventListener(
        "submit",
        handleBudgetSubmit
    );

    $("budgetsList").addEventListener(
        "click",
        handleBudgetClick
    );

    $("calendarGrid").addEventListener(
        "click",
        handleCalendarClick
    );

    $("prevMonthBtn").addEventListener("click", () => {
        calendarMonth--;

        if (calendarMonth < 0) {
            calendarMonth = 11;
            calendarYear--;
        }

        selectedCalendarDate = localDateString(
            new Date(calendarYear, calendarMonth, 1)
        );

        renderCalendar();
    });

    $("nextMonthBtn").addEventListener("click", () => {
        calendarMonth++;

        if (calendarMonth > 11) {
            calendarMonth = 0;
            calendarYear++;
        }

        selectedCalendarDate = localDateString(
            new Date(calendarYear, calendarMonth, 1)
        );

        renderCalendar();
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            if (!$("confirmModal").classList.contains("hidden")) {
                closeConfirmation();
            } else if (!$("transactionModal").classList.contains("hidden")) {
                closeTransactionModal();
            }
        }
    });

    window.addEventListener("resize", () => {
        if (!currentUser) return;

        window.clearTimeout(window._pennyPilotResizeTimer);

        window._pennyPilotResizeTimer = window.setTimeout(() => {
            renderIncomeExpenseChart();
            renderMonthlyChart();
        }, 150);
    });

    $("footerYear").textContent = String(new Date().getFullYear());
}

/* ---------------- START APPLICATION ---------------- */

document.addEventListener("DOMContentLoaded", () => {
    setupEventListeners();
    setAuthMode("login");

    const restored = restoreSession();

    if (!restored) {
        $("authPage").classList.remove("hidden");
        $("appPage").classList.add("hidden");
    }
});