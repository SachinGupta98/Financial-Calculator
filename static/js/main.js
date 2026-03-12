lucide.createIcons();

const formatINR = (num) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(num);

const views = [
    'dashboard', 'expense', 'goals', 'portfolio', 'ai', 'currency',
    'calculator', 'emi', 'sip', 'income-tax', 'retirement', 'compound', 'gst'
];

const titles = {
    'dashboard': 'Welcome to your Financial Dashboard',
    'expense': 'Expense Tracker',
    'goals': 'Financial Goals',
    'portfolio': 'Portfolio Manager',
    'ai': 'AI Advisor',
    'currency': 'Currency Converter',
    'calculator': 'Calculator',
    'emi': 'EMI Calculator',
    'sip': 'SIP Calculator',
    'income-tax': 'Income Tax Calculator',
    'retirement': 'Retirement Planner',
    'compound': 'Compound Interest',
    'gst': 'GST/VAT Calculator'
};

function switchView(viewId) {
    views.forEach(id => {
        const el = document.getElementById(`view-${id}`);
        const nav = document.getElementById(`nav-${id}`);
        if (el) el.classList.remove('active');
        if (nav) { nav.classList.remove('active', 'bg-primary', 'text-white'); nav.classList.add('text-gray-300'); }
    });

    document.getElementById(`view-${viewId}`).classList.add('active');
    const activeNav = document.getElementById(`nav-${viewId}`);
    if (activeNav) {
        activeNav.classList.remove('text-gray-300');
        activeNav.classList.add('active', 'bg-primary', 'text-white');
    }

    document.getElementById('top-title').innerText = titles[viewId] || 'Dashboard';

    // Auto-close sidebar on mobile after clicking a link
    const sidebar = document.getElementById('main-sidebar');
    if (window.innerWidth < 768 && sidebar && !sidebar.classList.contains('-translate-x-full')) {
        sidebar.classList.add('-translate-x-full');
        setTimeout(() => sidebar.classList.add('hidden'), 300);
    }

    // Force Budget Setup for new users
    if (viewId === 'expense' && appData) {
        const income = parseFloat(appData.settings?.income || 0);
        const budget = parseFloat(appData.settings?.budget || 0);
        if (income === 0 || budget === 0) {
            openModal('budget-modal');
            const alertBox = document.getElementById('ai-insight-content-exp');
            if (alertBox) {
                alertBox.innerHTML = `<div class="bg-primary/10 p-4 rounded-lg border border-primary/20 text-primary-300">
                    <p class="font-bold flex items-center"><i data-lucide="info" class="w-4 h-4 mr-2"></i> Setup Required</p>
                    <p class="text-[11px] mt-1 leading-relaxed">Please set your monthly income and budget in settings to start tracking effectively.</p>
                </div>`;
                lucide.createIcons();
            }
        }
    }

    if (viewId === 'sip') setTimeout(calculateSIP, 100);
    if (viewId === 'expense') setTimeout(renderExpenseTracker, 50);
    if (viewId === 'portfolio') setTimeout(renderPortfolio, 50);
    if (viewId === 'goals') setTimeout(renderGoals, 50);
}

// --- GLOBAL MODAL CONTROLS --- //
const modalOverlay = document.getElementById('modal-overlay');
function openModal(id) {
    modalOverlay.classList.remove('hidden');
    setTimeout(() => {
        modalOverlay.classList.remove('opacity-0');
        modalOverlay.classList.add('opacity-100');
        const modal = document.getElementById(id);
        document.querySelectorAll('#modal-overlay > div').forEach(el => {
            if (el.id !== id) el.classList.add('hidden');
        });
        modal.classList.remove('hidden');
        modal.classList.remove('scale-95');
        modal.classList.add('scale-100');
    }, 10);
    // Pre-fill budget if opening budget modal
    if (id === 'budget-modal') {
        document.getElementById('inp-budget-income').value = appData.settings.income;
        document.getElementById('inp-budget-target').value = appData.settings.budget;
    }
}
function closeModal() {
    modalOverlay.classList.remove('opacity-100');
    modalOverlay.classList.add('opacity-0');
    document.querySelectorAll('#modal-overlay > div').forEach(el => {
        el.classList.remove('scale-100');
        el.classList.add('scale-95');
    });
    setTimeout(() => {
        modalOverlay.classList.add('hidden');
        document.querySelectorAll('#modal-overlay > div').forEach(el => el.classList.add('hidden'));

        // Clear forms
        document.getElementById('inp-exp-desc').value = '';
        document.getElementById('inp-exp-amt').value = '';

        document.getElementById('inp-ast-name').value = '';
        document.getElementById('inp-ast-invested').value = '';
        document.getElementById('inp-ast-current').value = '';

        document.getElementById('inp-gal-name').value = '';
        document.getElementById('inp-gal-target').value = '';
        document.getElementById('inp-gal-saved').value = '';
        document.getElementById('inp-gal-id').value = '';
        if (document.getElementById('inp-ast-id')) document.getElementById('inp-ast-id').value = '';

        // Reset receipt scan status bar
        const scanStatus = document.getElementById('scan-status');
        if (scanStatus) {
            scanStatus.classList.add('hidden');
            scanStatus.className = 'hidden px-6 py-2 bg-violet-900/30 border-b border-violet-700/30 text-xs text-violet-300 flex items-center gap-2';
        }
        if (document.getElementById('receipt-scan-input')) document.getElementById('receipt-scan-input').value = '';
    }, 300);
}

// --- APP DATA CORE (API Integration) --- //
let appData = {
    expenses: [],
    goals: [],
    portfolio: [],
    settings: { income: 0, budget: 0 }
};

async function fetchAppData() {
    try {
        const res = await fetch('/api/data');
        if (res.ok) {
            appData = await res.json();
            renderDashboard(); // New
            renderExpenseTracker();
            renderPortfolio();
            renderGoals();
            fetchNotifications(); // Auto-load alert badge
        }
    } catch (err) {
        console.error("Failed to fetch app data", err);
    }
}

async function fetchNotifications() {
    const list = document.getElementById('notifications-list');
    const badge = document.getElementById('notif-badge');
    if (list) {
        list.innerHTML = `<div class="flex items-center justify-center py-8"><i data-lucide="loader-2" class="w-6 h-6 animate-spin text-indigo-400"></i></div>`;
        lucide.createIcons();
    }
    try {
        const res = await fetch('/api/notifications');
        if (!res.ok) return;
        const data = await res.json();
        const notifications = data.notifications || [];

        // Update badge
        if (badge) {
            const dangerCount = notifications.filter(n => n.type === 'danger' || n.type === 'warning').length;
            if (dangerCount > 0) {
                badge.textContent = dangerCount;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }

        // Render cards in modal
        if (!list) return;
        const typeConfig = {
            danger: { bg: 'bg-red-900/30', border: 'border-red-700/40', icon: 'text-red-400', badge: 'bg-red-500/20 text-red-300' },
            warning: { bg: 'bg-amber-900/30', border: 'border-amber-700/40', icon: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-300' },
            success: { bg: 'bg-emerald-900/30', border: 'border-emerald-700/40', icon: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300' },
            info: { bg: 'bg-indigo-900/30', border: 'border-indigo-700/40', icon: 'text-indigo-400', badge: 'bg-indigo-500/20 text-indigo-300' }
        };

        list.innerHTML = notifications.map(n => {
            const cfg = typeConfig[n.type] || typeConfig.info;
            return `<div class="flex items-start gap-3 p-3.5 rounded-xl border ${cfg.bg} ${cfg.border}">
                <div class="w-8 h-8 rounded-lg ${cfg.badge} flex items-center justify-center flex-shrink-0 mt-0.5">
                    <i data-lucide="${n.icon}" class="w-4 h-4 ${cfg.icon}"></i>
                </div>
                <div class="min-w-0">
                    <p class="text-sm font-semibold text-white mb-0.5">${n.title}</p>
                    <p class="text-xs text-gray-400 leading-relaxed">${n.msg}</p>
                </div>
            </div>`;
        }).join('');
        lucide.createIcons();
    } catch (err) {
        console.error('Notifications fetch error:', err);
        if (list) list.innerHTML = `<p class="text-xs text-center text-gray-500 py-8">Couldn't load alerts. Refresh to retry.</p>`;
    }
}

// --- EXPENSE TRACKER SYSTEM --- //
let expChartInstance = null;
let categorySums = {};
let totalSpent = 0;
async function saveBudgetSettings() {
    const income = parseFloat(document.getElementById('inp-budget-income').value) || 0;
    const budget = parseFloat(document.getElementById('inp-budget-target').value) || 0;

    await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ income, budget })
    });

    await fetchAppData();
    closeModal();
}

async function saveExpense() {
    const desc = document.getElementById('inp-exp-desc').value;
    const amt = parseFloat(document.getElementById('inp-exp-amt').value);
    const date = document.getElementById('inp-exp-date').value;
    const cat = document.getElementById('inp-exp-cat').value;
    if (!desc || !amt || !date) return alert("Please fill all fields");

    await fetch('/api/expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: desc, amount: amt, date: date, category: cat })
    });
    await fetchAppData();
    closeModal();
}

async function deleteExpense(id) {
    await fetch(`/api/expense/${id}`, { method: 'DELETE' });
    await fetchAppData();
}

function renderExpenseTracker() {
    const tbody = document.getElementById('expense-table-body');
    const inc = appData.settings.income;
    const bgtr = appData.settings.budget;

    totalSpent = 0;
    categorySums = {};

    // Sort and render table
    tbody.innerHTML = '';
    const sortedExp = [...appData.expenses].sort((a, b) => new Date(b.date) - new Date(a.date));

    if (sortedExp.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-gray-500 text-sm">No recent transactions found.</td></tr>`;
        document.getElementById('expenseChartEmpty').classList.remove('hidden');
    } else {
        document.getElementById('expenseChartEmpty').classList.add('hidden');
        sortedExp.forEach(exp => {
            totalSpent += exp.amount;
            categorySums[exp.category] = (categorySums[exp.category] || 0) + exp.amount;

            const tr = document.createElement('tr');
            tr.className = "border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors";
            tr.innerHTML = `
                        <td class="px-6 py-4 text-sm text-gray-300 whitespace-nowrap">${exp.date}</td>
                        <td class="px-6 py-4 text-sm font-medium text-white">${exp.description}</td>
                        <td class="px-6 py-4 text-sm text-gray-400">
                            <span class="bg-gray-800 px-2.5 py-1 rounded-md border border-gray-700 font-medium">${exp.category}</span>
                        </td>
                        <td class="px-6 py-4 text-sm font-bold text-red-400 text-right">${formatINR(exp.amount)}</td>
                        <td class="px-6 py-4 text-right">
                            <button onclick="deleteExpense(${exp.id})" class="text-gray-500 hover:text-red-400"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                        </td>
                    `;
            tbody.appendChild(tr);
        });
        lucide.createIcons();
    }

    // Update Metrics
    document.getElementById('exp-total-income').innerText = formatINR(inc);
    document.getElementById('exp-total-budget').innerText = formatINR(bgtr);
    document.getElementById('exp-total-spent').innerText = formatINR(totalSpent);

    const remaining = inc - totalSpent;
    document.getElementById('exp-total-remaining').innerText = formatINR(remaining);
    document.getElementById('exp-total-remaining').className = remaining >= 0 ? "text-2xl font-bold text-emerald-400" : "text-2xl font-bold text-red-500";

    let pct = (totalSpent / bgtr) * 100;
    if (pct > 100) pct = 100;
    const bar = document.getElementById('exp-budget-bar');
    bar.style.width = `${pct}%`;
    bar.className = pct >= 90 ? "bg-red-500 h-1.5 rounded-full" : pct >= 75 ? "bg-yellow-500 h-1.5 rounded-full" : "bg-primary h-1.5 rounded-full";

    // Update Chart
    const ctx = document.getElementById('expenseChart').getContext('2d');
    if (expChartInstance) expChartInstance.destroy();

    if (Object.keys(categorySums).length > 0) {
        Chart.defaults.color = '#9ca3af';
        Chart.defaults.font.family = 'Inter';

        const colors = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b'];
        expChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(categorySums),
                datasets: [{
                    data: Object.values(categorySums),
                    backgroundColor: colors.slice(0, Object.keys(categorySums).length),
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '70%',
                plugins: { legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 8, padding: 20 } } }
            }
        });
    }
}

async function analyzeExpenses() {
    if (appData.expenses.length === 0) {
        document.getElementById('ai-insight-content-exp').innerHTML = "Please add some expenses first so AI has data to analyze.";
        return;
    }
    const loader = document.getElementById('ai-insight-loader-exp');
    const content = document.getElementById('ai-insight-content-exp');
    loader.classList.remove('hidden');
    content.classList.add('opacity-50');

    const catSummary = Object.keys(categorySums).map(k => `${k}: ${formatINR(categorySums[k])}`).join(", ");
    const recentExp = appData.expenses.slice(0, 5).map(e => `${e.description} (${e.category}): ${formatINR(e.amount)}`).join("; ");

    const prompt = `[Financial Insight Request]
User Data:
- Monthly Income: ${formatINR(appData.settings.income)}
- Monthly Budget: ${formatINR(appData.settings.budget)}
- Total Spent So Far: ${formatINR(totalSpent)}
- Spending by Category: ${catSummary}
- Recent Transactions: ${recentExp}

Task: Provide a BRIEF (max 4-5 bullet points) analysis of this SPECIFIC data.
1. Strictly use Currency: INR (₹). NEVER use Dollars ($).
2. NEVER mention dummy categories like 'Housing' or 'Utilities' unless they are in the data above.
3. Identify which specific category is eating up the budget.
4. Give one actionable tip to save money base on the actual transactions listed.
Keep it extremely concise, professional, and data-driven. Use emojis.`;

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: [{ role: "user", content: prompt }] })
        });
        const data = await res.json();
        if (res.ok && data.text) {
            content.innerHTML = marked.parse(data.text);
        } else {
            content.innerHTML = "Analysis failed. Please try again.";
        }
    } catch (err) {
        content.innerHTML = "Server connection lost.";
    }
    loader.classList.add('hidden');
    content.classList.remove('opacity-50');
}

// --- PORTFOLIO MANAGER SYSTEM --- //
let portChartInstance = null;

async function saveAsset() {
    const name = document.getElementById('inp-ast-name').value;
    const type = document.getElementById('inp-ast-type').value;
    const invested = parseFloat(document.getElementById('inp-ast-invested').value);
    const current = parseFloat(document.getElementById('inp-ast-current').value);
    const idToEdit = document.getElementById('inp-ast-id').value;

    if (!name || isNaN(invested) || isNaN(current)) return alert("Please fill all fields");

    await fetch('/api/asset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: idToEdit || null, name, type, invested, current })
    });
    await fetchAppData();
    closeModal();
}

async function deleteAsset(id) {
    if (confirm("Are you sure you want to delete this asset?")) {
        await fetch(`/api/asset/${id}`, { method: 'DELETE' });
        await fetchAppData();
    }
}

function renderPortfolio() {
    const tbody = document.getElementById('portfolio-table-body');
    let totalInv = 0, totalCur = 0;
    const typeValueMap = {};

    tbody.innerHTML = '';

    if (appData.portfolio.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500 text-sm">No assets in portfolio. Add one to begin tracking.</td></tr>`;
        document.getElementById('portfolioChartEmpty').classList.remove('hidden');
    } else {
        document.getElementById('portfolioChartEmpty').classList.add('hidden');
        appData.portfolio.forEach(ast => {
            totalInv += ast.invested;
            totalCur += ast.current;
            typeValueMap[ast.type] = (typeValueMap[ast.type] || 0) + ast.current;

            const diff = ast.current - ast.invested;
            const isPos = diff >= 0;
            const diffCls = isPos ? 'text-emerald-400' : 'text-red-400';
            const icon = isPos ? 'trending-up' : 'trending-down';

            const tr = document.createElement('tr');
            tr.className = "border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors";
            tr.innerHTML = `
                        <td class="px-6 py-5 text-sm font-medium text-white max-w-[150px] md:max-w-none break-words whitespace-normal">${ast.name}</td>
                        <td class="px-6 py-5 text-sm text-gray-300">
                            <span class="bg-gray-800 px-2 py-1 rounded inline-block min-w-[80px] text-center border border-gray-700">${ast.type}</span>
                        </td>
                        <td class="px-6 py-5 text-sm text-gray-400 text-right">${formatINR(ast.invested)}</td>
                        <td class="px-6 py-5 text-sm font-bold text-white text-right">${formatINR(ast.current)}</td>
                        <td class="px-6 py-5 text-sm font-bold ${diffCls} text-right flex items-center justify-end whitespace-nowrap">
                            <i data-lucide="${icon}" class="w-3 h-3 mr-1"></i> ${formatINR(Math.abs(diff))}
                        </td>
                        <td class="px-6 py-5 text-right">
                             <button onclick="deleteAsset(${ast.id})" class="text-gray-500 hover:text-red-400 bg-gray-900 p-2 rounded-lg border border-gray-800 transition-colors"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                        </td>
                    `;
            tbody.appendChild(tr);
        });
        lucide.createIcons();
    }

    // Metrics
    document.getElementById('port-total-invested').innerText = formatINR(totalInv);
    document.getElementById('port-total-current').innerText = formatINR(totalCur);

    const tDiff = totalCur - totalInv;
    const tPct = totalInv > 0 ? ((tDiff / totalInv) * 100).toFixed(2) : 0;

    const gainEl = document.getElementById('port-total-gain');
    const pctEl = document.getElementById('port-total-pct');

    gainEl.innerText = formatINR(Math.abs(tDiff));
    pctEl.innerText = `(${tPct}%)`;

    if (tDiff >= 0) {
        gainEl.parentElement.className = "text-3xl font-bold text-emerald-500 flex items-baseline gap-2";
        gainEl.innerText = "+" + gainEl.innerText;
    } else {
        gainEl.parentElement.className = "text-3xl font-bold text-red-500 flex items-baseline gap-2";
        gainEl.innerText = "-" + gainEl.innerText;
    }

    // Chart
    const ctx = document.getElementById('portfolioChart').getContext('2d');
    if (portChartInstance) portChartInstance.destroy();

    if (Object.keys(typeValueMap).length > 0) {
        const colors = ['#2563eb', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#6366f1'];
        portChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(typeValueMap),
                datasets: [{
                    data: Object.values(typeValueMap),
                    backgroundColor: colors.slice(0, Object.keys(typeValueMap).length),
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '75%',
                plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, padding: 15 } } }
            }
        });
    }
}




// --- FINANCIAL GOALS SYSTEM --- //

async function saveGoal() {
    const name = document.getElementById('inp-gal-name').value;
    const targetAmount = parseFloat(document.getElementById('inp-gal-target').value);
    const savedAmount = parseFloat(document.getElementById('inp-gal-saved').value) || 0;
    const targetDate = document.getElementById('inp-gal-date').value;
    const category = document.getElementById('inp-gal-cat').value;
    const idToEdit = document.getElementById('inp-gal-id').value;

    if (!name || isNaN(targetAmount) || !targetDate) return alert("Please fill required fields (Name, Target Amount, Date).");

    await fetch('/api/goal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: idToEdit || null, name, targetAmount, savedAmount, targetDate, category })
    });
    await fetchAppData();
    closeModal();
}

async function deleteGoal(id) {
    if (confirm("Are you sure you want to delete this goal?")) {
        await fetch(`/api/goal/${id}`, { method: 'DELETE' });
        await fetchAppData();
    }
}

function editGoal(id) {
    const g = appData.goals.find(g => g.id === id);
    if (g) {
        document.getElementById('inp-gal-name').value = g.name;
        document.getElementById('inp-gal-target').value = g.targetAmount;
        document.getElementById('inp-gal-saved').value = g.savedAmount;
        document.getElementById('inp-gal-date').value = g.targetDate;
        document.getElementById('inp-gal-cat').value = g.category;
        document.getElementById('inp-gal-id').value = g.id;
        openModal('goal-modal');
    }
}

function renderGoals() {
    const grid = document.getElementById('goals-grid');
    if (!grid) return;

    let totalTarget = 0, totalSaved = 0;
    grid.innerHTML = '';

    if (!appData.goals || appData.goals.length === 0) {
        grid.innerHTML = `
                    <div class="col-span-full py-12 text-center border-2 border-dashed border-gray-700 rounded-xl bg-gray-900/30">
                        <i data-lucide="flag" class="w-8 h-8 mx-auto text-gray-600 mb-3"></i>
                        <p class="text-gray-500">No active goals found. Create one to start tracking!</p>
                    </div>`;
    } else {
        appData.goals.forEach(g => {
            const tgtAmt = parseFloat(g.targetAmount) || 0;
            const svdAmt = parseFloat(g.savedAmount) || 0;
            totalTarget += tgtAmt;
            totalSaved += svdAmt;

            let pct = tgtAmt > 0 ? (svdAmt / tgtAmt) * 100 : 0;
            pct = Math.min(100, Math.max(0, pct));

            const daysLeft = Math.ceil((new Date(g.targetDate) - new Date()) / (1000 * 60 * 60 * 24));
            const timeText = daysLeft < 0 ? 'Overdue' : daysLeft === 0 ? 'Today' : `${daysLeft} days left`;
            const timeCls = daysLeft < 0 ? 'text-red-400' : 'text-primary';

            const icons = { 'Purchase': 'shopping-bag', 'Emergency': 'shield-check', 'Investment': 'trending-up', 'Travel': 'plane', 'Debt': 'credit-card' };
            const iconName = icons[g.category] || 'flag';

            const div = document.createElement('div');
            div.className = "goal-card bg-cardbg rounded-xl p-6 shadow-sm flex flex-col relative group";
            div.innerHTML = `
                        <div class="absolute top-4 right-4 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onclick="editGoal(${g.id})" class="text-gray-400 hover:text-white bg-gray-800 p-1.5 rounded"><i data-lucide="edit-2" class="w-3.5 h-3.5"></i></button>
                            <button onclick="deleteGoal(${g.id})" class="text-gray-400 hover:text-red-400 bg-gray-800 p-1.5 rounded"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                        </div>
                        <div class="flex items-center space-x-3 mb-5">
                            <div class="bg-gray-800 p-3 rounded-lg border border-gray-700"><i data-lucide="${iconName}" class="w-5 h-5 text-accent"></i></div>
                            <div>
                                <h3 class="text-white font-bold leading-tight">${g.name || 'Untitled Goal'}</h3>
                                <p class="text-xs text-gray-500">${g.category || 'General'}</p>
                            </div>
                        </div>
                        <div class="mt-auto flex flex-col flex-1 min-h-0">
                            <div class="flex justify-between items-end mb-1">
                                <span class="text-xl font-bold text-white">${formatINR(svdAmt)}</span>
                                <span class="text-sm font-bold text-accent">${Math.round(pct)}%</span>
                            </div>
                            <div class="w-full bg-gray-800 rounded-full h-1.5 mb-3">
                                <div class="bg-gradient-to-r from-primary to-accent h-1.5 rounded-full transition-all duration-500" style="width: ${pct}%"></div>
                            </div>
                            <div class="flex-1 min-h-0 bg-gray-900/50 p-3 rounded border border-gray-800 mb-3 flex flex-col">
                                <div id="ai-insight-content-goal-${g.id}" class="text-xs text-gray-400 italic markdown-content custom-scrollbar overflow-y-auto pr-2 flex-1 relative h-full">Click 'Get AI Strategy' to get a roadmap.</div>
                            </div>
                            <div class="flex justify-between items-center text-xs mt-auto mb-3">
                                <span class="text-gray-500">Target: ${formatINR(tgtAmt)}</span>
                                <span class="${timeCls} font-medium bg-gray-900 px-2 py-1 rounded">${timeText}</span>
                            </div>
                            <button onclick="askStrategy(${g.id})" class="w-full py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg text-sm font-medium transition-colors flex items-center justify-center shrink-0">
                                <i data-lucide="cpu" class="w-3.5 h-3.5 mr-1.5"></i>Get AI Strategy
                            </button>
                        </div>
                    `;
            grid.appendChild(div);
        });
        if (window.lucide) lucide.createIcons();
    }

    const overallProgressPct = totalTarget > 0 ? Math.min(100, (totalSaved / totalTarget) * 100) : 0;
    const totalBar = document.getElementById('goal-total-bar');
    if (totalBar) totalBar.style.width = `${overallProgressPct}%`;

    const totalPctEl = document.getElementById('goal-total-pct');
    if (totalPctEl) totalPctEl.innerText = `${Math.round(overallProgressPct)}%`;

    const totalTargetEl = document.getElementById('goal-total-target');
    if (totalTargetEl) totalTargetEl.innerText = formatINR(totalTarget);

    const totalSavedEl = document.getElementById('goal-total-saved');
    if (totalSavedEl) totalSavedEl.innerText = formatINR(totalSaved);

    // Populate Simulator Dropdown
    const simSelect = document.getElementById('sim-goal-select');
    if (simSelect) {
        const currentVal = simSelect.value;
        simSelect.innerHTML = '<option value="">Select a goal to simulate...</option>';
        if (appData.goals) {
            appData.goals.forEach(g => {
                const opt = document.createElement('option');
                opt.value = g.id;
                opt.innerText = g.name || 'Untitled Goal';
                simSelect.appendChild(opt);
            });
        }
        simSelect.value = currentVal;
    }
}

async function askStrategy(id) {
    const g = appData.goals.find(g => g.id === id);
    if (!g) return;
    switchView('ai'); // Switch to main AI view
    const daysLeft = Math.ceil((new Date(g.targetDate) - new Date()) / (1000 * 60 * 60 * 24));
    const promptBox = document.getElementById('chat-input');
    promptBox.value = `My Goal: "${g.name}". Target: ${formatINR(g.targetAmount)} in ${daysLeft} days. Currently saved: ${formatINR(g.savedAmount)}. Please provide a BRIEF, professional month-by-month roadmap to achieve this goal. Include 3 specific tips to speed up progress.`;
    // Trigger
    setTimeout(() => askAI('ai'), 300);
}

async function askTaxStrategy() {
    const salary = document.getElementById('tax-salary').value;
    const other = document.getElementById('tax-other').value;
    const d80c = document.getElementById('tax-80c').value;
    const d80d = document.getElementById('tax-80d').value;
    const hra = document.getElementById('tax-hra').value;
    const home = document.getElementById('tax-home-interest').value;
    const nps = document.getElementById('tax-nps').value;
    const age = document.getElementById('tax-age').value;

    switchView('ai');
    const promptBox = document.getElementById('chat-input');
    promptBox.value = `[Personalized Tax Strategy Request]
My Financial Profile (FY 2025-26):
- Gross Salary: ${formatINR(salary)}
- Other Income: ${formatINR(other)}
- Age Category: ${age}
- Current Deductions: 80C: ${formatINR(d80c)}, 80D: ${formatINR(d80d)}, 80G: ${formatINR(document.getElementById('tax-80g').value)}, HRA: ${formatINR(hra)}, NPS: ${formatINR(nps)}, Home Loan Int: ${formatINR(home)}

Task: Analyze my profile and provide a BRIEF, expert tax optimization strategy. 
1. Suggest which regime is truly better and why.
2. Identify missing tax-saving opportunities (e.g., 80CCD(1B), Health checkups, etc.).
3. Provide a 3-step action plan to reduce my tax liability for this year.
Use tables for comparisons and emojis for readability. Keep it concise.`;

    setTimeout(() => askAI('ai'), 300);
}

async function askEMIStrategy() {
    const amt = document.getElementById('emi-amount').value;
    const rate = document.getElementById('emi-rate').value;
    const tenure = document.getElementById('emi-tenure').value;
    const monthly = document.getElementById('emi-monthly').innerText;

    switchView('ai');
    const promptBox = document.getElementById('chat-input');
    promptBox.value = `[Loan Strategy Request]
I am looking at a loan of ${formatINR(amt)} at ${rate}% interest for ${tenure} years. My estimated EMI is ${monthly}. 
Task: Provide a BRIEF analysis. 
1. Is this interest rate competitive in the current Indian market?
2. How can I reduce my total interest outflow (e.g., pre-payments)?
3. What is the impact of increasing my EMI by 10%?
Keep it actionable and concise. Use emojis.`;

    setTimeout(() => askAI('ai'), 300);
}

async function askSIPStrategy() {
    const monthly = document.getElementById('sip-amount').value;
    const rate = document.getElementById('sip-rate').value;
    const years = document.getElementById('sip-years').value;
    const fv = document.getElementById('sip-fv').innerText;

    switchView('ai');
    const promptBox = document.getElementById('chat-input');
    promptBox.value = `[SIP Wealth Projection Request]
I am investing ${formatINR(monthly)} per month at an expected return of ${rate}% for ${years} years. The projected future value is ${fv}.
Task: Provide a BRIEF expert insight.
1. Are my return expectations realistic for the Indian equity market?
2. How much more wealth would I gain if I increased my SIP by 10% every year (Step-up SIP)?
3. Suggest a diversified mutual fund category mix for this duration.
Keep it direct and professional. Use emojis.`;

    setTimeout(() => askAI('ai'), 300);
}

async function askRetirementStrategy() {
    const age = document.getElementById('ret-age').value;
    const retAge = document.getElementById('ret-retage').value;
    const exp = document.getElementById('ret-exp').value;
    const corpus = document.getElementById('ret-corpus').innerText;
    const sipReq = document.getElementById('ret-sip').innerText;

    switchView('ai');
    const promptBox = document.getElementById('chat-input');
    promptBox.value = `[Retirement Strategy Request]
I am ${age} years old and plan to retire at ${retAge}. My current monthly expenses are ${formatINR(exp)}. The calculated retirement corpus needed is ${corpus}, requiring a monthly SIP of ${sipReq}.
Task: Provide a BRIEF, high-level retirement roadmap.
1. Is this corpus sufficient considering 6% inflation?
2. Suggest 2 ways to bridge the gap if I can't afford the full SIP right now.
3. Recommend an asset allocation shift as I approach retirement age.
Keep it expert and concise. Use emojis.`;

    setTimeout(() => askAI('ai'), 300);
}

async function askGSTStrategy() {
    const amount = document.getElementById('gst-amount').value;
    const rate = document.getElementById('gst-rate').value;
    const type = document.querySelector('input[name="gst-type"]:checked').value;
    const gstAmt = document.getElementById('gst-tax').innerText;
    const total = document.getElementById('gst-total').innerText;

    switchView('ai');
    const promptBox = document.getElementById('chat-input');
    promptBox.value = `[GST/VAT Insight Request]
I am calculating GST for an initial amount of ${formatINR(amount)} at a rate of ${rate}% (${type === 'add' ? 'Added' : 'Included'}).
GST Amount: ${gstAmt}, Total: ${total}.
Task: Provide a BRIEF expert insight.
1. Are there any recent changes in Indian GST slabs for common goods/services I should know?
2. How can a business owner optimize GST input tax credit (ITC) based on this?
3. Mention 1-2 common filing errors to avoid.
Keep it direct and professional. Use emojis.`;

    setTimeout(() => askAI('ai'), 300);
}

async function askCompoundStrategy() {
    const initial = document.getElementById('cmp-initial').value;
    const monthly = document.getElementById('cmp-monthly').value;
    const rate = document.getElementById('cmp-rate').value;
    const years = document.getElementById('cmp-years').value;
    const total = document.getElementById('cmp-res-total').innerText;

    switchView('ai');
    const promptBox = document.getElementById('chat-input');
    promptBox.value = `[Compound Interest Strategy Request]
Initial Investment: ${formatINR(initial)}, Monthly Contribution: ${formatINR(monthly)}, Interest Rate: ${rate}%, Duration: ${years} years.
Projected Future Value: ${total}.
Task: Provide a BRIEF, POWERFUL insight on compounding.
1. Show me the "Cost of Delay": What if I started 5 years later?
2. How does the "Rule of 72" apply to my interest rate?
3. One pro-tip to maximize this growth (e.g. increasing contributions).
Keep it expert and inspiring. Use emojis.`;

    setTimeout(() => askAI('ai'), 300);
}

// --- CALCULATORS LOGIC ---

// Currency
let exchangeRates = {};
async function fetchRates() {
    try {
        const res = await fetch('https://api.frankfurter.app/latest?from=USD');
        const data = await res.json();
        exchangeRates = data.rates;
        exchangeRates['USD'] = 1;
        calculateCurrency();
    } catch (error) {
        exchangeRates = { 'INR': 83.2, 'EUR': 0.92, 'GBP': 0.79, 'USD': 1 };
        calculateCurrency();
    }
}
function calculateCurrency() {
    if (Object.keys(exchangeRates).length === 0) return;
    let amount = parseFloat(document.getElementById('curr-amount').value) || 0;
    const from = document.getElementById('curr-from').value;
    const to = document.getElementById('curr-to').value;
    const finalAmount = (amount / exchangeRates[from]) * exchangeRates[to];
    const formattedResult = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(finalAmount);
    document.getElementById('curr-result').innerText = formattedResult + ' ' + to;
}

// EMI
function calculateEMI() {
    let P = parseFloat(document.getElementById('emi-amount').value) || 0;
    let R = parseFloat(document.getElementById('emi-rate').value) || 0;
    let N = parseFloat(document.getElementById('emi-tenure').value) || 0;

    if (P === 0 || R === 0 || N === 0) return;
    const r = R / 12 / 100, n = N * 12;
    const emi = P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
    const totalPayment = emi * n;
    document.getElementById('emi-monthly').innerText = formatINR(emi);
    document.getElementById('emi-total-interest').innerText = formatINR(totalPayment - P);
    document.getElementById('emi-total-amt').innerText = formatINR(totalPayment);
}

// SIP
let sipChartInstance = null;
function calculateSIP() {
    let P = parseFloat(document.getElementById('sip-amount').value) || 0;
    let R = parseFloat(document.getElementById('sip-rate').value) || 0;
    let Y = parseFloat(document.getElementById('sip-years').value) || 0;
    if (P === 0 || R === 0 || Y === 0) return;
    const i = R / 12 / 100, n = Y * 12;
    const expectedAmount = P * ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
    const amountInvested = P * n;
    const estReturns = expectedAmount - amountInvested;

    document.getElementById('sip-invested').innerText = formatINR(amountInvested);
    document.getElementById('sip-returns').innerText = formatINR(estReturns);
    document.getElementById('sip-fv').innerText = formatINR(expectedAmount);

    const ctx = document.getElementById('sipChart').getContext('2d');
    if (sipChartInstance) sipChartInstance.destroy();

    Chart.defaults.color = '#9ca3af';
    Chart.defaults.font.family = 'Inter';

    sipChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Invested', 'Est. Returns'],
            datasets: [{
                data: [amountInvested, estReturns],
                backgroundColor: ['#374151', '#10b981'],
                borderWidth: 0,
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '75%',
            plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } } }
        }
    });
}

// GST
function setGSTRate(rate) {
    document.getElementById('gst-rate').value = rate;
    document.querySelectorAll('.gst-btn').forEach(btn => {
        btn.classList.remove('btn-primary', 'bg-primary');
        btn.classList.add('input-dark');
    });
    event.target.classList.remove('input-dark');
    event.target.classList.add('btn-primary');
    calculateGST();
}

function calculateGST() {
    let amount = parseFloat(document.getElementById('gst-amount').value) || 0;
    const rate = parseFloat(document.getElementById('gst-rate').value);
    const type = document.querySelector('input[name="gst-type"]:checked').value;
    let net, tax, total;
    if (type === 'add') {
        net = amount; tax = (amount * rate) / 100; total = amount + tax;
    } else {
        total = amount; tax = amount - (amount * (100 / (100 + rate))); net = amount - tax;
    }
    document.getElementById('gst-net').innerText = formatINR(net);
    document.getElementById('gst-tax').innerText = formatINR(tax);
    document.getElementById('gst-total').innerText = formatINR(total);
}

// --- INCOME TAX CALCULATOR (FY 2025-26) ---
function calculateTax() {
    let salary = parseFloat(document.getElementById('tax-salary').value) || 0;
    let other = parseFloat(document.getElementById('tax-other').value) || 0;
    let d80c = parseFloat(document.getElementById('tax-80c').value) || 0;
    let d80d = parseFloat(document.getElementById('tax-80d').value) || 0;
    let d80g = parseFloat(document.getElementById('tax-80g').value) || 0;
    let dhra = parseFloat(document.getElementById('tax-hra').value) || 0;
    let dhome = parseFloat(document.getElementById('tax-home-interest').value) || 0;
    let dnps = parseFloat(document.getElementById('tax-nps').value) || 0;
    let dtta = parseFloat(document.getElementById('tax-tta').value) || 0;
    let age = document.getElementById('tax-age').value;

    // Standard Deductions FY 25-26
    const SD_OLD = 50000;
    const SD_NEW = 75000;

    // Caps
    if (d80c > 150000) d80c = 150000;
    if (dnps > 50000) dnps = 50000; // 80CCD(1B)
    if (dhome > 200000) dhome = 200000; // Sec 24

    let ttaCap = (age === 'under60' ? 10000 : 50000);
    if (dtta > ttaCap) dtta = ttaCap;

    let gross = salary + other;

    // OLD REGIME CALCULATION
    let oldNet = gross - SD_OLD - d80c - d80d - d80g - dhra - dhome - dnps - dtta;
    if (oldNet < 0) oldNet = 0;

    let oldTax = 0;
    let oldExempt = 250000;
    if (age === 'over60') oldExempt = 300000;
    else if (age === 'over80') oldExempt = 500000;

    if (oldNet <= oldExempt) oldTax = 0;
    else {
        if (age === 'over80') {
            if (oldNet <= 1000000) oldTax = (oldNet - 500000) * 0.20;
            else oldTax = 100000 + (oldNet - 1000000) * 0.30;
        } else if (age === 'over60') {
            if (oldNet <= 500000) oldTax = (oldNet - 300000) * 0.05;
            else if (oldNet <= 1000000) oldTax = 10000 + (oldNet - 500000) * 0.20;
            else oldTax = 110000 + (oldNet - 1000000) * 0.30;
        } else {
            if (oldNet <= 500000) oldTax = (oldNet - 250000) * 0.05;
            else if (oldNet <= 1000000) oldTax = 12500 + (oldNet - 500000) * 0.20;
            else oldTax = 112500 + (oldNet - 1000000) * 0.30;
        }
    }
    // Rebate 87A Old: If taxable income <= 5L
    if (oldNet <= 500000) oldTax = 0;

    // NEW REGIME CALCULATION (FY 2025-26)
    let newNet = gross - SD_NEW;
    if (newNet < 0) newNet = 0;
    let newTax = 0;

    // Slabs: 0-4 (0%), 4-8 (5%), 8-12 (10%), 12-16 (15%), 16-20 (20%), 20-24 (25%), >24 (30%)
    if (newNet <= 400000) newTax = 0;
    else if (newNet <= 800000) newTax = (newNet - 400000) * 0.05;
    else if (newNet <= 1200000) newTax = 20000 + (newNet - 800000) * 0.10;
    else if (newNet <= 1600000) newTax = 60000 + (newNet - 1200000) * 0.15;
    else if (newNet <= 2000000) newTax = 120000 + (newNet - 1600000) * 0.20;
    else if (newNet <= 2400000) newTax = 200000 + (newNet - 2000000) * 0.25;
    else newTax = 300000 + (newNet - 2400000) * 0.30;

    // Rebate 87A New: Effectively tax-free up to 12L income
    if (newNet <= 1200000) newTax = 0;

    oldTax = oldTax * 1.04; // Cess
    newTax = newTax * 1.04;

    document.getElementById('tax-old-tax').innerText = formatINR(oldTax);
    document.getElementById('tax-new-tax').innerText = formatINR(newTax);

    const recBox = document.getElementById('tax-recommendation');
    const recText = document.getElementById('tax-opt-text');
    const saveText = document.getElementById('tax-save-text');
    const newCard = document.getElementById('tax-new-card');
    const oldCard = document.getElementById('tax-old-card');

    const oldIcon = document.createElement('i'); oldIcon.setAttribute('data-lucide', 'check-circle');
    const recIconDiv = recBox.querySelector('svg') || recBox.querySelector('i');

    oldCard.classList.remove('border-primary', 'border-gray-800');
    newCard.classList.remove('border-emerald-500/50', 'border-gray-800');
    oldCard.querySelector('div.absolute')?.classList.add('hidden');
    newCard.querySelector('div.absolute')?.classList.add('hidden');

    if (newTax < oldTax) {
        let save = oldTax - newTax;
        recBox.className = "bg-emerald-500/10 rounded-xl p-5 border border-emerald-500/50 text-center transition-colors";
        if (recIconDiv) recIconDiv.outerHTML = '<i data-lucide="check-circle" class="w-8 h-8 text-emerald-500 mx-auto mb-2"></i>';
        recText.className = "text-emerald-400 font-bold mb-1";
        recText.innerText = "New Regime is Better";
        saveText.innerText = `You save ${formatINR(save)} by choosing the New Regime.`;
        newCard.classList.add('border-emerald-500/50');
        oldCard.classList.add('border-gray-800');
        newCard.querySelector('div.absolute')?.classList.remove('hidden');
        newCard.querySelector('h4').className = "text-emerald-400 font-bold mb-2 uppercase text-xs tracking-widest leading-tight";
        oldCard.querySelector('h4').className = "text-gray-400 font-bold mb-2 uppercase text-xs tracking-widest";
    } else if (oldTax < newTax) {
        let save = newTax - oldTax;
        recBox.className = "bg-primary/10 rounded-xl p-5 border border-primary/50 text-center transition-colors";
        if (recIconDiv) recIconDiv.outerHTML = '<i data-lucide="check-circle" class="w-8 h-8 text-primary mx-auto mb-2"></i>';
        recText.className = "text-primary font-bold mb-1";
        recText.innerText = "Old Regime is Better";
        saveText.innerText = `You save ${formatINR(save)} by choosing the Old Regime.`;
        oldCard.classList.add('border-primary');
        newCard.classList.add('border-gray-800');
        oldCard.querySelector('div.absolute')?.classList.remove('hidden');
        oldCard.querySelector('h4').className = "text-primary font-bold mb-2 uppercase text-xs tracking-widest leading-tight";
        newCard.querySelector('h4').className = "text-gray-400 font-bold mb-2 uppercase text-xs tracking-widest";
    } else {
        recBox.className = "bg-gray-800/50 rounded-xl p-5 border border-gray-700 text-center transition-colors";
        if (recIconDiv) recIconDiv.outerHTML = '<i data-lucide="minus-circle" class="w-8 h-8 text-gray-400 mx-auto mb-2"></i>';
        recText.className = "text-white font-bold mb-1";
        recText.innerText = "Both Regimes are Equal";
        saveText.innerText = "Tax liability is the same in both regimes.";
        oldCard.classList.add('border-gray-800');
        newCard.classList.add('border-gray-800');
    }
    lucide.createIcons();
}

// --- RETIREMENT PLANNER ---
function calculateRetirement() {
    let age = parseInt(document.getElementById('ret-age').value) || 30;
    let retAge = parseInt(document.getElementById('ret-retage').value) || 60;
    let life = parseInt(document.getElementById('ret-life').value) || 85;
    let exp = parseFloat(document.getElementById('ret-exp').value) || 50000;
    let inf = parseFloat(document.getElementById('ret-inf').value) || 6;
    let pre = parseFloat(document.getElementById('ret-pre').value) || 12;

    if (age >= retAge || retAge >= life || exp <= 0) return;

    let yearsToSave = retAge - age;
    let yearsInRetirement = life - retAge;

    let futExp = exp * Math.pow(1 + inf / 100, yearsToSave);

    let post = 7; // Conservative 7% post-retirement
    let realRate = ((1 + post / 100) / (1 + inf / 100)) - 1;
    let rMonthly = realRate / 12;
    let monthsRet = yearsInRetirement * 12;

    let corpus = 0;
    if (rMonthly === 0) {
        corpus = futExp * monthsRet;
    } else {
        corpus = futExp * ((1 - Math.pow(1 + rMonthly, -monthsRet)) / rMonthly);
    }

    let iMonthly = (pre / 100) / 12;
    let monthsSave = yearsToSave * 12;
    let sip = corpus / (((Math.pow(1 + iMonthly, monthsSave) - 1) / iMonthly) * (1 + iMonthly));

    document.getElementById('ret-corpus').innerText = formatINR(corpus);
    document.getElementById('ret-sip').innerText = formatINR(sip);
}

// --- COMPOUND INTEREST ---
let cmpChartInstance = null;
function calculateCompound() {
    let P = parseFloat(document.getElementById('cmp-initial').value) || 0;
    let PMT = parseFloat(document.getElementById('cmp-monthly').value) || 0;
    let r = parseFloat(document.getElementById('cmp-rate').value) || 0;
    let t = parseFloat(document.getElementById('cmp-years').value) || 0;
    let n = parseInt(document.getElementById('cmp-freq').value) || 12;

    if (P < 0 || PMT < 0 || r < 0 || t <= 0) return;

    let labels = [];
    let investedData = [];
    let totalData = [];

    let currInvested = P;
    let currTotal = P;
    let ratePeriodic = (r / 100) / n;
    let mnt = PMT * (12 / n);

    labels.push('Year 0');
    investedData.push(currInvested);
    totalData.push(currTotal);

    for (let yr = 1; yr <= t; yr++) {
        for (let p = 1; p <= n; p++) {
            currTotal = (currTotal + mnt) * (1 + ratePeriodic);
            currInvested += mnt;
        }
        labels.push(`Year ${yr}`);
        investedData.push(currInvested);
        totalData.push(currTotal);
    }

    let finalReturns = currTotal - currInvested;

    document.getElementById('cmp-res-invested').innerText = formatINR(currInvested);
    document.getElementById('cmp-res-returns').innerText = formatINR(finalReturns >= 0 ? finalReturns : 0);
    document.getElementById('cmp-res-total').innerText = formatINR(currTotal);

    const ctx = document.getElementById('compoundChart').getContext('2d');
    if (cmpChartInstance) cmpChartInstance.destroy();

    Chart.defaults.color = '#9ca3af';
    Chart.defaults.font.family = 'Inter';

    cmpChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Total Value',
                    data: totalData,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Amount Invested',
                    data: investedData,
                    borderColor: '#374151',
                    backgroundColor: 'transparent',
                    borderDash: [5, 5],
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { usePointStyle: true, boxWidth: 8 } },
                tooltip: { callbacks: { label: function (c) { return c.dataset.label + ': ' + formatINR(c.raw); } } }
            },
            scales: {
                y: {
                    ticks: { callback: function (val) { return '₹' + (val >= 100000 ? (val / 100000).toFixed(1) + 'L' : val); } },
                    grid: { color: 'rgba(75, 85, 99, 0.2)' }
                },
                x: { grid: { display: false } }
            }
        }
    });
}

// --- SCIENTIFIC CALCULATOR ---
let calcVal = '0';
let calcHist = '';
let calcMemVal = 0;
let isDeg = true; // Rad label means click switches to Deg, but initially it acts as degrees if we want
let is2nd = false;
let newNum = true;

function updateDisplay() {
    document.getElementById('calc-display').innerText = calcVal;
    document.getElementById('calc-history').innerText = calcHist.replace(/\*/g, '×').replace(/\//g, '÷');
}

function calcWrite(char) {
    if (char === 'Math.PI') char = Math.PI;
    if (char === 'Math.random()') char = Math.random();
    let cStr = String(char).substring(0, 10);

    if (newNum) { calcVal = cStr; newNum = false; }
    else { calcVal = calcVal === '0' && cStr !== '.' ? cStr : calcVal + cStr; }
    updateDisplay();
    document.getElementById('btn-ac').innerText = 'C';
}

function calcOp(op) {
    if (!newNum) {
        calcHist += ' ' + calcVal + ' ' + op;
        newNum = true;
    } else if (calcHist.length > 0) {
        calcHist = calcHist.slice(0, -1) + op;
    } else {
        calcHist = calcVal + ' ' + op;
    }
    updateDisplay();
}

function calcEq() {
    if (!calcHist) return;
    calcHist += ' ' + calcVal;
    try {
        let evalSeq = calcHist.replace(/×/g, '*').replace(/÷/g, '/').replace(/\^/g, '**').replace(/E/g, '*10**');
        let result = eval(evalSeq);
        calcVal = String(parseFloat(result.toFixed(8)));
        calcHist = '';
        newNum = true;
    } catch (e) { calcVal = 'Error'; calcHist = ''; newNum = true; }
    updateDisplay();
}

function calcClear() {
    if (calcVal === '0' || document.getElementById('btn-ac').innerText === 'AC') { calcHist = ''; }
    else { calcVal = '0'; document.getElementById('btn-ac').innerText = 'AC'; }
    newNum = true;
    updateDisplay();
}

function calcDel() {
    if (!newNum && calcVal.length > 1) calcVal = calcVal.slice(0, -1);
    else { calcVal = '0'; newNum = true; document.getElementById('btn-ac').innerText = 'AC'; }
    updateDisplay();
}

function calcSign() {
    calcVal = String(parseFloat(calcVal) * -1);
    updateDisplay();
}

function calcPct() {
    calcVal = String(parseFloat(calcVal) / 100);
    updateDisplay();
}

function calcMem(act) {
    if (act === 'mc') calcMemVal = 0;
    if (act === 'm+') calcMemVal += parseFloat(calcVal);
    if (act === 'm-') calcMemVal -= parseFloat(calcVal);
    if (act === 'mr') { calcVal = String(calcMemVal); newNum = true; }
    updateDisplay();
}

function calcToggleDeg() {
    isDeg = !isDeg;
    document.getElementById('btn-deg').innerText = isDeg ? 'Rad' : 'Deg';
}

function calcToggle2nd() {
    is2nd = !is2nd;
    document.getElementById('btn-2nd').classList.toggle('active');
    let supX = '<sup class="text-[10px] ml-0.5">x</sup>';
    document.getElementById('btn-y-x').innerHTML = is2nd ? '<sup>x</sup>√y' : 'y' + supX;
}

function calcFunc(f) {
    let v = parseFloat(calcVal);
    let res = v;
    const toRad = x => isDeg ? x * Math.PI / 180 : x;

    if (f === '1/x') res = 1 / v;
    else if (f === 'x2') res = v * v;
    else if (f === 'x3') res = v * v * v;
    else if (f === 'sqrt') res = Math.sqrt(v);
    else if (f === 'cbrt') res = Math.cbrt(v);
    else if (f === 'log10') res = Math.log10(v);
    else if (f === 'ln') res = Math.log(v);
    else if (f === '10x') res = Math.pow(10, v);
    else if (f === 'ex') res = Math.exp(v);
    else if (f === 'sin') res = is2nd ? Math.asin(v) * 180 / Math.PI : Math.sin(toRad(v));
    else if (f === 'cos') res = is2nd ? Math.acos(v) * 180 / Math.PI : Math.cos(toRad(v));
    else if (f === 'tan') res = is2nd ? Math.atan(v) * 180 / Math.PI : Math.tan(toRad(v));
    else if (f === 'sinh') res = is2nd ? Math.asinh(v) : Math.sinh(v);
    else if (f === 'cosh') res = is2nd ? Math.acosh(v) : Math.cosh(v);
    else if (f === 'tanh') res = is2nd ? Math.atanh(v) : Math.tanh(v);
    else if (f === 'fact') {
        res = 1; for (let i = 2; i <= v; i++) res *= i;
    }
    calcVal = String(parseFloat(res.toFixed(8)));
    newNum = true;
    updateDisplay();
}

// --- AI ADVISOR (Chatbot Logic) ---
let chatHistory = [];

async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;

    // Clear input
    input.value = '';

    // Add user message to UI
    appendMessage('user', message);

    // Prepare context from side panel
    const income = document.getElementById('ai-input-income').value;
    const expenses = document.getElementById('ai-input-expenses').value;
    const savings = document.getElementById('ai-input-savings').value;
    const goal = document.getElementById('ai-input-goal').value;

    let contextStr = `[Financial Context: Income: ${income || 'Not provided'}, Monthly Expenses: ${expenses || 'Not provided'}, Savings: ${savings || 'Not provided'}, Primary Goal: ${goal}]`;

    // Add to history (including context only for the first message or when data changes? Let's just append it to the current message for simplicity)
    const fullPrompt = `${contextStr}\n\nUser Message: ${message}`;
    chatHistory.push({ role: "user", content: fullPrompt });

    // Show typing indicator
    const botMsgId = appendMessage('bot', '<div class="flex items-center space-x-2"><i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>FinPal is thinking...</span></div>', true);
    lucide.createIcons();

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: chatHistory })
        });

        const data = await response.json();

        // Remove loader
        const botMsgDiv = document.getElementById(botMsgId);

        if (response.ok && data.text) {
            botMsgDiv.innerHTML = marked.parse(data.text);
            chatHistory.push({ role: "assistant", content: data.text });
        } else {
            const errMsg = data.error || 'Server responded with an error';
            botMsgDiv.innerHTML = `<p class="text-red-400">❌ AI Error: ${errMsg}</p>`;
        }
    } catch (error) {
        console.error("FinPal Fetch Error:", error);
        const botMsgDiv = document.getElementById(botMsgId);
        botMsgDiv.innerHTML = `<p class="text-red-400">❌ Error: Missing AI connection. ${error.message}</p>`;
    }

    lucide.createIcons();
    scrollChatToBottom();
}

function appendMessage(role, content, isHtml = false) {
    const container = document.getElementById('chat-messages');
    const msgId = 'msg-' + Date.now();

    const msgDiv = document.createElement('div');
    msgDiv.className = `flex items-start space-x-3 ${role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`;

    const icon = role === 'user' ? 'user' : 'bot';
    const bgColor = role === 'user' ? 'bg-primary' : 'bg-slate-800/80';
    const textColor = 'text-gray-300';
    const roundedClass = role === 'user' ? 'rounded-tr-none' : 'rounded-tl-none';

    msgDiv.innerHTML = `
                <div class="w-8 h-8 rounded-lg ${role === 'user' ? 'bg-primary/20' : 'bg-primary/20'} flex items-center justify-center flex-shrink-0">
                    <i data-lucide="${icon}" class="w-4 h-4 text-primary"></i>
                </div>
                <div id="${msgId}" class="max-w-[85%] ${bgColor} rounded-2xl ${roundedClass} px-5 py-3.5 border border-white/5 text-sm ${textColor} shadow-sm leading-relaxed markdown-content">
                    ${isHtml ? content : content.replace(/\n/g, '<br>')}
                </div>
            `;

    container.appendChild(msgDiv);
    lucide.createIcons();
    scrollChatToBottom();
    return msgId;
}

function scrollChatToBottom() {
    const container = document.getElementById('chat-messages');
    container.scrollTop = container.scrollHeight;
}

function clearChat() {
    chatHistory = [];
    const container = document.getElementById('chat-messages');
    container.innerHTML = `
                <div class="flex items-start space-x-3">
                    <div class="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <i data-lucide="bot" class="w-4 h-4 text-primary"></i>
                    </div>
                    <div class="max-w-[85%] bg-slate-800/80 rounded-2xl rounded-tl-none px-5 py-3.5 border border-white/5 text-sm text-gray-300 shadow-sm leading-relaxed">
                        Chat cleared. How can I help you now? 👋
                    </div>
                </div>
            `;
    lucide.createIcons();
}

// --- LEGACY AI CALLS UPDATED FOR CHAT ---
async function askAI(type) {
    // This now just switches view to AI and sets the goal or sends an initial message
    switchView('ai');
    const goalSelect = document.getElementById('ai-input-goal');
    const chatInput = document.getElementById('chat-input');

    if (type === 'tax') {
        goalSelect.value = 'Tax Saving';
        chatInput.value = "I need help optimizing my taxes. What should I do?";
    } else if (type === 'stock') {
        goalSelect.value = 'Stock Market';
        chatInput.value = "Can you analyze the current stock market trends for me?";
    }

    // Trigger send if there's text
    if (chatInput.value) sendChatMessage();
}

// --- UI INITIALIZATION & EVENT LISTENERS ---
window.onload = async () => {
    fetchRates();
    calculateEMI();
    calculateGST();
    calculateCompound();
    calculateRetirement();
    calculateTax();

    // Fetch backend data and render dynamic views
    await fetchAppData();

    // Mobile Sidebar Toggle Logic
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileCloseBtn = document.getElementById('mobile-close-btn');
    const sidebar = document.getElementById('main-sidebar');

    if (mobileMenuBtn && sidebar) {
        mobileMenuBtn.addEventListener('click', () => {
            sidebar.classList.remove('hidden');
            setTimeout(() => sidebar.classList.remove('-translate-x-full'), 10);
        });
    }

    if (mobileCloseBtn && sidebar) {
        mobileCloseBtn.addEventListener('click', () => {
            sidebar.classList.add('-translate-x-full');
            setTimeout(() => sidebar.classList.add('hidden'), 300);
        });
    }

    // Enter key for chat
    const chatField = document.getElementById('chat-input');
    if (chatField) {
        chatField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
            }
        });
    }
};

// --- UPDATED ANALYZE FUNCTIONS ---
// --- UPDATED ANALYZE FUNCTIONS (Data Driven) ---
async function analyzeExpenses() {
    const loader = document.getElementById('ai-insight-loader-exp');
    const content = document.getElementById('ai-insight-content-exp');
    if (!loader || !content) return;

    loader.classList.remove('hidden');

    try {
        const income = appData.settings?.income || 0;
        const budget = appData.settings?.budget || 0;
        const expenses = appData.expenses || [];

        // Compute totals inline
        let totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
        const catSums = {};
        expenses.forEach(e => { catSums[e.category] = (catSums[e.category] || 0) + e.amount; });
        const catSummary = Object.entries(catSums).map(([k, v]) => `${k}: ${formatINR(v)}`).join(', ');
        const recentTx = expenses.slice(-10).map(e => `- ${e.date}: ${e.description} (${e.category}) — ${formatINR(e.amount)}`).join('\n');

        const prompt = `[Expense Analysis Request for Indian User]
Financial Snapshot:
- Monthly Income: ${formatINR(income)}
- Monthly Budget: ${formatINR(budget)}
- Total Spent This Period: ${formatINR(totalSpent)}
- Remaining Budget: ${formatINR(budget - totalSpent)}
- Spending by Category: ${catSummary || 'None'}
- Recent Transactions (last 10):
${recentTx || 'No transactions recorded yet.'}

Task: Analyze this exact data and provide:
1. A brief spending summary table by category.
2. Which category is eating most of the budget.
3. Three specific, actionable tips to save money based on actual transactions.
Use ₹ (INR) only. Use emojis. Be concise and data-driven.`;

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: [{ role: "user", content: prompt }] })
        });
        const data = await response.json();
        content.innerHTML = marked.parse(data.text || "No insights found.");
    } catch (e) {
        content.innerHTML = "Failed to load insights.";
    } finally {
        loader.classList.add('hidden');
        lucide.createIcons();
    }
}

async function analyzePortfolio() {
    const loader = document.getElementById('ai-insight-loader-port');
    const content = document.getElementById('ai-insight-content-port');
    if (!loader || !content) return;

    loader.classList.remove('hidden');

    try {
        const assets = appData.portfolio || [];
        let astStr = assets.map(a => `- ${a.name} (${a.type}): Invested ${formatINR(a.invested)}, Current Value ${formatINR(a.current)}`).join('\n');

        const prompt = `[Portfolio Health Check Request]
My Investment Portfolio:
${astStr || 'No assets added yet.'}

Task: Analyze my portfolio diversification and risk.
1. Evaluate the asset mix.
2. Suggest if I am over-indexed in any category.
3. Provide a 'Health Score' out of 10.
Use emojis and a conversational yet expert tone. ALWAYS use ₹ for values.`;

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: [{ role: "user", content: prompt }] })
        });
        const data = await response.json();
        content.innerHTML = marked.parse(data.text || "No insights found.");
    } catch (e) {
        content.innerHTML = "Failed to load insights.";
    } finally {
        loader.classList.add('hidden');
        lucide.createIcons();
    }
}

// ─────────────────────────────────────────────────────────
// FEATURE 1 — CSV IMPORT
// ─────────────────────────────────────────────────────────
async function importCSV(inputEl) {
    const file = inputEl.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    // Show a loading toast
    showImportToast('⏳ Importing your expenses...', 'info');

    try {
        const res = await fetch('/api/import/expenses', { method: 'POST', body: formData });
        const data = await res.json();
        if (res.ok) {
            showImportToast(`✅ Imported ${data.imported} expenses successfully!${data.skipped > 0 ? ` (${data.skipped} skipped)` : ''}`, 'success');
            await fetchAppData();
        } else {
            showImportToast(`❌ Import failed: ${data.error}`, 'error');
        }
    } catch (e) {
        showImportToast('❌ Network error during import.', 'error');
    } finally {
        inputEl.value = '';  // Reset file input
    }
}

function showImportToast(message, type = 'info') {
    // Remove any existing toast
    document.getElementById('import-toast')?.remove();

    const colors = { info: 'bg-blue-900 border-blue-700 text-blue-200', success: 'bg-green-900 border-green-700 text-green-200', error: 'bg-red-900 border-red-700 text-red-200' };
    const toast = document.createElement('div');
    toast.id = 'import-toast';
    toast.className = `fixed bottom-6 right-6 z-[9999] px-5 py-3 rounded-xl border text-sm font-medium shadow-2xl animate-pulse ${colors[type]}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast?.remove(), 4000);
}

// ─────────────────────────────────────────────────────────
// FEATURE 2 — OCR RECEIPT SCANNING
// ─────────────────────────────────────────────────────────
async function scanReceipt(inputEl) {
    const file = inputEl.files[0];
    if (!file) return;

    // Show scanning status in modal
    const statusBar = document.getElementById('scan-status');
    const statusText = document.getElementById('scan-status-text');
    const btn = document.getElementById('scan-receipt-btn');

    statusBar.classList.remove('hidden');
    statusText.textContent = '🔍 Running OCR on your receipt...';
    btn.disabled = true;
    btn.classList.add('opacity-50');
    lucide.createIcons();

    const formData = new FormData();
    formData.append('image', file);

    try {
        const res = await fetch('/api/scan-receipt', { method: 'POST', body: formData });
        const data = await res.json();

        if (res.ok && !data.error) {
            // Auto-fill the expense form
            if (data.description) document.getElementById('inp-exp-desc').value = data.description;
            if (data.amount) document.getElementById('inp-exp-amt').value = data.amount;
            if (data.date) document.getElementById('inp-exp-date').value = data.date;
            if (data.category) document.getElementById('inp-exp-cat').value = data.category;

            statusBar.classList.remove('bg-violet-900/30', 'border-violet-700/30', 'text-violet-300');
            statusBar.classList.add('bg-green-900/30', 'border-green-700/30', 'text-green-300');
            statusText.textContent = `✅ Found: ${data.description} — ₹${data.amount}. Review and click Save.`;
        } else if (data.error) {
            statusBar.classList.remove('bg-violet-900/30', 'border-violet-700/30', 'text-violet-300');
            statusBar.classList.add('bg-red-900/30', 'border-red-700/30', 'text-red-300');
            statusText.textContent = `⚠️ ${data.error}`;
        }
    } catch (e) {
        statusText.textContent = '❌ Scan failed. Please try again.';
    } finally {
        btn.disabled = false;
        btn.classList.remove('opacity-50');
        inputEl.value = '';  // Reset file input
    }
}

// ═══════════════════════════════════════════════════════════
// FEATURE D — CUSTOM CATEGORIES
// ═══════════════════════════════════════════════════════════

const DEFAULT_CATEGORIES = ['Food & Dining', 'Shopping', 'Entertainment', 'Transport', 'Utilities', 'Healthcare', 'Education', 'Other'];

function buildCategoryDropdown(selectId) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">Select Category</option>';
    const allCats = [...DEFAULT_CATEGORIES, ...(appData.custom_categories || []).map(c => c.name)];
    allCats.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat; opt.textContent = cat;
        if (cat === current) opt.selected = true;
        sel.appendChild(opt);
    });
}

function refreshAllCategoryDropdowns() {
    ['inp-exp-cat', 'inp-limit-cat', 'inp-rec-cat'].forEach(buildCategoryDropdown);
}

function renderCategoriesList() {
    const list = document.getElementById('custom-categories-list');
    if (!list) return;
    const cats = appData.custom_categories || [];
    if (!cats.length) { list.innerHTML = '<p class="text-gray-500 text-sm text-center py-4">No custom categories yet.</p>'; return; }
    list.innerHTML = cats.map(c => `
        <div class="flex items-center justify-between bg-gray-800/60 rounded-xl px-4 py-2.5">
            <div class="flex items-center gap-2">
                <span class="text-lg">${c.emoji}</span>
                <span class="text-sm text-white font-medium">${c.name}</span>
                <span class="w-3 h-3 rounded-full flex-shrink-0" style="background:${c.color}"></span>
            </div>
            <button onclick="deleteCustomCategory(${c.id})" class="text-gray-500 hover:text-red-400 transition">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
        </div>`).join('');
    lucide.createIcons();
}

async function saveCustomCategory() {
    const name = document.getElementById('inp-cat-name').value.trim();
    const emoji = document.getElementById('inp-cat-emoji').value.trim() || '📌';
    const color = document.getElementById('inp-cat-color').value;
    if (!name) return;
    await fetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, emoji, color }) });
    document.getElementById('inp-cat-name').value = '';
    document.getElementById('inp-cat-emoji').value = '';
    await fetchAppData();
    renderCategoriesList();
    refreshAllCategoryDropdowns();
}

async function deleteCustomCategory(id) {
    await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    await fetchAppData();
    renderCategoriesList();
    refreshAllCategoryDropdowns();
    renderExpenseTracker();
}

// Open categories modal — populate list
const _openModalOrig = window.openModal;
window.openModal = function (id) {
    _openModalOrig(id);
    if (id === 'categories-modal') { renderCategoriesList(); refreshAllCategoryDropdowns(); }
    if (id === 'limits-modal') { renderLimitsList(); refreshAllCategoryDropdowns(); }
    if (id === 'recurring-modal') { renderRecurringList(); refreshAllCategoryDropdowns(); buildDayDropdown(); }
    if (id === 'sms-modal') {
        document.getElementById('sms-result-preview').classList.add('hidden');
        document.getElementById('sms-parse-status').classList.add('hidden');
        document.getElementById('inp-sms-text').value = '';
        const btn = document.getElementById('sms-add-btn');
        btn.disabled = true; btn.classList.add('opacity-50', 'cursor-not-allowed');
    }
};

// ═══════════════════════════════════════════════════════════
// FEATURE A — MONTHLY FILTERING
// ═══════════════════════════════════════════════════════════

function initializeYearFilter() {
    const yearSel = document.getElementById('filter-year');
    if (!yearSel) return;
    const years = [...new Set((appData.expenses || []).map(e => e.date?.split('-')[0]).filter(Boolean))].sort().reverse();
    const thisYear = new Date().getFullYear().toString();
    if (!years.includes(thisYear)) years.unshift(thisYear);
    yearSel.innerHTML = '<option value="">All Years</option>' + years.map(y => `<option value="${y}"${y === thisYear ? ' selected' : ''}>${y}</option>`).join('');
    // Default-select current month too
    const monthSel = document.getElementById('filter-month');
    if (monthSel) {
        const m = String(new Date().getMonth() + 1).padStart(2, '0');
        monthSel.value = m;
    }
}

function getFilteredExpenses() {
    const month = document.getElementById('filter-month')?.value || '';
    const year = document.getElementById('filter-year')?.value || '';
    return (appData.expenses || []).filter(e => {
        if (!e.date) return true;
        const [ey, em] = e.date.split('-');
        if (year && ey !== year) return false;
        if (month && em !== month) return false;
        return true;
    });
}

function applyMonthFilter() {
    const filtered = getFilteredExpenses();
    const label = document.getElementById('filter-results-label');
    if (label) label.textContent = `${filtered.length} expense${filtered.length !== 1 ? 's' : ''}`;
    renderExpenseTracker(filtered);
    checkSpendingAlerts(filtered);
}

// Patch renderExpenseTracker to accept optional filtered list
const _renderExpOrig = window.renderExpenseTracker;
window.renderExpenseTracker = function (filteredList) {
    if (filteredList !== undefined) {
        // Temporarily swap appData.expenses, render, then restore
        const orig = appData.expenses;
        appData.expenses = filteredList;
        _renderExpOrig();
        appData.expenses = orig;
    } else {
        _renderExpOrig();
        applyMonthFilter();  // Apply active filter after full render
    }
};

// ═══════════════════════════════════════════════════════════
// FEATURE B — SPENDING ALERTS
// ═══════════════════════════════════════════════════════════

function renderLimitsList() {
    const list = document.getElementById('limits-list');
    if (!list) return;
    const limits = appData.limits || [];
    if (!limits.length) { list.innerHTML = '<p class="text-gray-500 text-sm text-center py-4">No limits set yet.</p>'; return; }
    const filtered = getFilteredExpenses();
    list.innerHTML = limits.map(l => {
        const spent = filtered.filter(e => e.category === l.category).reduce((s, e) => s + e.amount, 0);
        const pct = Math.min(100, Math.round((spent / l.limit) * 100));
        const color = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-green-500';
        return `
        <div class="bg-gray-800/60 rounded-xl px-4 py-3 space-y-1.5">
            <div class="flex items-center justify-between text-sm">
                <span class="text-white font-medium">${l.category}</span>
                <div class="flex items-center gap-2">
                    <span class="${pct >= 100 ? 'text-red-400' : 'text-gray-400'} text-xs">₹${spent.toLocaleString('en-IN')} / ₹${l.limit.toLocaleString('en-IN')}</span>
                    <button onclick="deleteLimit(${l.id})" class="text-gray-500 hover:text-red-400"><i data-lucide="trash-2" class="w-3 h-3"></i></button>
                </div>
            </div>
            <div class="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div class="${color} h-full rounded-full transition-all" style="width:${pct}%"></div>
            </div>
        </div>`;
    }).join('');
    lucide.createIcons();
}

async function saveSpendingLimit() {
    const cat = document.getElementById('inp-limit-cat').value;
    const limit = parseFloat(document.getElementById('inp-limit-amount').value);
    if (!cat || !limit) return;
    await fetch('/api/limits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: cat, limit }) });
    document.getElementById('inp-limit-amount').value = '';
    await fetchAppData();
    renderLimitsList();
}

async function deleteLimit(id) {
    await fetch(`/api/limits/${id}`, { method: 'DELETE' });
    await fetchAppData();
    renderLimitsList();
    checkSpendingAlerts(getFilteredExpenses());
}

function checkSpendingAlerts(filteredExpenses) {
    const limits = appData.limits || [];
    const alertDiv = document.getElementById('overspend-alert');
    const alertMsg = document.getElementById('overspend-msg');
    if (!alertDiv || !limits.length) return;
    const exceeded = limits.filter(l => {
        const spent = (filteredExpenses || appData.expenses || [])
            .filter(e => e.category === l.category).reduce((s, e) => s + e.amount, 0);
        return spent > l.limit;
    });
    if (exceeded.length) {
        alertDiv.classList.remove('hidden');
        alertDiv.classList.add('flex');
        alertMsg.textContent = `Limit exceeded: ${exceeded.map(l => l.category).join(', ')}`;
    } else {
        alertDiv.classList.add('hidden');
        alertDiv.classList.remove('flex');
    }
}

// ═══════════════════════════════════════════════════════════
// FEATURE C — RECURRING EXPENSES
// ═══════════════════════════════════════════════════════════

function buildDayDropdown() {
    const sel = document.getElementById('inp-rec-day');
    if (!sel || sel.children.length > 1) return;
    for (let d = 1; d <= 28; d++) {
        const opt = document.createElement('option');
        opt.value = d; opt.textContent = `${d}${d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'} of month`;
        sel.appendChild(opt);
    }
}

function renderRecurringList() {
    const list = document.getElementById('recurring-list');
    if (!list) return;
    const rec = appData.recurring || [];
    if (!rec.length) { list.innerHTML = '<p class="text-gray-500 text-sm text-center py-4">No recurring expenses set up yet.</p>'; return; }
    list.innerHTML = rec.map(r => `
        <div class="flex items-center justify-between bg-gray-800/60 rounded-xl px-4 py-2.5">
            <div class="flex items-center gap-2">
                <span class="text-cyan-400 text-base">🔁</span>
                <div>
                    <p class="text-sm text-white font-medium">${r.description}</p>
                    <p class="text-xs text-gray-400">${r.category} · ₹${r.amount.toLocaleString('en-IN')} · day ${r.day_of_month}</p>
                </div>
            </div>
            <button onclick="deleteRecurring(${r.id})" class="text-gray-500 hover:text-red-400 transition">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
        </div>`).join('');
    lucide.createIcons();
}

async function saveRecurring() {
    const desc = document.getElementById('inp-rec-desc').value.trim();
    const amt = parseFloat(document.getElementById('inp-rec-amount').value);
    const cat = document.getElementById('inp-rec-cat').value;
    const day = parseInt(document.getElementById('inp-rec-day').value) || 1;
    if (!desc || !amt || !cat) return;
    await fetch('/api/recurring', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: desc, amount: amt, category: cat, day_of_month: day }) });
    document.getElementById('inp-rec-desc').value = '';
    document.getElementById('inp-rec-amount').value = '';
    await fetchAppData();
    renderRecurringList();
    closeModal();
    showImportToast(`✅ Recurring expense "${desc}" added! It will auto-log on day ${day} each month.`, 'success');
}

async function deleteRecurring(id) {
    await fetch(`/api/recurring/${id}`, { method: 'DELETE' });
    await fetchAppData();
    renderRecurringList();
}

async function autoLogRecurring() {
    try {
        const res = await fetch('/api/recurring/log-due', { method: 'POST' });
        const data = await res.json();
        if (data.auto_logged && data.auto_logged.length > 0) {
            await fetchAppData();
            showImportToast(`🔁 Auto-logged: ${data.auto_logged.join(', ')}`, 'success');
        }
    } catch (e) { /* Silent fail */ }
}

// ═══════════════════════════════════════════════════════════
// FEATURE 3E — UPI SMS PARSER
// ═══════════════════════════════════════════════════════════

let _smsResult = null;

async function parseSMS() {
    const sms = document.getElementById('inp-sms-text').value.trim();
    if (!sms) return;
    const status = document.getElementById('sms-parse-status');
    const preview = document.getElementById('sms-result-preview');
    const addBtn = document.getElementById('sms-add-btn');
    status.classList.remove('hidden');
    preview.classList.add('hidden');
    addBtn.disabled = true; addBtn.classList.add('opacity-50', 'cursor-not-allowed');
    try {
        const res = await fetch('/api/parse-sms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sms }) });
        const data = await res.json();
        _smsResult = data;
        if (data.error && !data.amount) {
            document.querySelector('#sms-parse-status span').textContent = `⚠️ ${data.error}`;
            return;
        }
        document.getElementById('sr-desc').textContent = data.description || '—';
        document.getElementById('sr-amount').textContent = `₹${(data.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        document.getElementById('sr-cat').textContent = data.category || '—';
        document.getElementById('sr-date').textContent = data.date || '—';
        preview.classList.remove('hidden');
        addBtn.disabled = false; addBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    } catch (e) {
        document.querySelector('#sms-parse-status span').textContent = '❌ Parse failed. Try again.';
    } finally {
        status.classList.add('hidden');
        lucide.createIcons();
    }
}

async function addExpenseFromSMS() {
    if (!_smsResult) return;
    await fetch('/api/expense', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            description: _smsResult.description, amount: _smsResult.amount,
            date: _smsResult.date, category: _smsResult.category
        })
    });
    await fetchAppData();
    closeModal();
    document.getElementById('inp-sms-text').value = '';
    _smsResult = null;
    showImportToast('✅ Expense added from SMS!', 'success');
}

// ═══════════════════════════════════════════════════════════
// INITIALIZATION — Hook into fetchAppData
// ═══════════════════════════════════════════════════════════
const _fetchDataOrig = window.fetchAppData;
window.fetchAppData = async function () {
    await _fetchDataOrig();
    // Initialize new appData fields if missing
    if (!appData.custom_categories) appData.custom_categories = [];
    if (!appData.limits) appData.limits = [];
    if (!appData.recurring) appData.recurring = [];
    // Populate year dropdown after data loads
    initializeYearFilter();
    // Rebuild all category dropdowns with merged list
    refreshAllCategoryDropdowns();
    // Auto-log any due recurring expenses
    autoLogRecurring();
    // Check spending limits
    checkSpendingAlerts(getFilteredExpenses());
};

// ═══════════════════════════════════════════════════════════
// ANALYTICS TAB LOGIC
// ═══════════════════════════════════════════════════════════

let analyticsCharts = {
    trend: null,
    category: null,
    yearly: null
};

function switchExpenseTab(tab) {
    const overview = document.getElementById('exp-content-overview');
    const analytics = document.getElementById('exp-content-analytics');
    const btnOverview = document.getElementById('btn-exp-tab-overview');
    const btnAnalytics = document.getElementById('btn-exp-tab-analytics');

    if (tab === 'overview') {
        overview.classList.remove('hidden');
        analytics.classList.add('hidden');
        btnOverview.classList.add('border-primary', 'text-white');
        btnOverview.classList.remove('border-transparent', 'text-gray-400');
        btnAnalytics.classList.remove('border-primary', 'text-white');
        btnAnalytics.classList.add('border-transparent', 'text-gray-400');
    } else {
        overview.classList.add('hidden');
        analytics.classList.remove('hidden');
        btnAnalytics.classList.add('border-primary', 'text-white');
        btnAnalytics.classList.remove('border-transparent', 'text-gray-400');
        btnOverview.classList.remove('border-primary', 'text-white');
        btnOverview.classList.add('border-transparent', 'text-gray-400');
        renderAnalytics();
    }
}

function renderAnalytics() {
    const expenses = appData.expenses || [];
    const analyticsContainer = document.getElementById('exp-content-analytics');

    // Clear everything if no expenses found
    if (expenses.length === 0) {
        analyticsContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center py-24 text-center">
                <div class="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4">
                    <i data-lucide="bar-chart-2" class="w-8 h-8 text-gray-600"></i>
                </div>
                <h3 class="text-xl font-bold text-white mb-2">No analytical data available</h3>
                <p class="text-gray-500 max-w-sm">Start adding your expenses in the "Overview" tab to see spending trends, comparison charts, and monthly breakdowns here.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    // Restore the analytics grid structure if it was replaced by empty state
    if (!document.getElementById('analytics-delta-cards')) {
        analyticsContainer.innerHTML = `
            <!-- Delta Summary Cards -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 animate-stagger" id="analytics-delta-cards"></div>

            <!-- Charts Row 1: Trend & Category -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div class="bg-cardbg rounded-xl p-6 border border-gray-800">
                    <h3 class="text-white font-bold mb-4 flex items-center gap-2">
                        <i data-lucide="trending-up" class="w-4 h-4 text-primary"></i> 12-Month Spending Trend
                    </h3>
                    <div class="h-64"><canvas id="analyticsTrendChart"></canvas></div>
                </div>
                <div class="bg-cardbg rounded-xl p-6 border border-gray-800">
                    <h3 class="text-white font-bold mb-4 flex items-center gap-2">
                        <i data-lucide="bar-chart-3" class="w-4 h-4 text-violet-400"></i> Monthly Category Breakdown
                    </h3>
                    <div class="h-64"><canvas id="analyticsCategoryChart"></canvas></div>
                </div>
            </div>

            <!-- Charts Row 2: Heatmap -->
            <div class="grid grid-cols-1 gap-6 mt-6">
                <div class="bg-cardbg rounded-xl p-6 border border-gray-800 overflow-hidden">
                    <h3 class="text-white font-bold mb-4 flex items-center gap-2">
                        <i data-lucide="grid" class="w-4 h-4 text-amber-400"></i> Category Heatmap (Last 6 Months)
                    </h3>
                    <div class="overflow-x-auto">
                        <table id="analyticsHeatmap" class="w-full text-xs text-left border-collapse"></table>
                    </div>
                </div>
            </div>
        `;
        lucide.createIcons();
    }

    // Destroy existing charts to prevent memory leaks
    Object.keys(analyticsCharts).forEach(key => {
        if (analyticsCharts[key]) {
            analyticsCharts[key].destroy();
            analyticsCharts[key] = null;
        }
    });

    renderDeltaCards();
    renderTrendChart();
    renderAnalyticsCategoryChart();
    renderYearlyChart();
    renderHeatmapTable();
}

function renderDeltaCards() {
    const expenses = appData.expenses || [];
    const now = new Date();

    // Proper local month key to match DB YYYY-MM
    const getMonthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    const currMonth = getMonthKey(now);
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = getMonthKey(lastMonthDate);

    const getMonthTotal = (m) => expenses.filter(e => e.date && e.date.startsWith(m)).reduce((sum, e) => sum + e.amount, 0);

    const currTotal = getMonthTotal(currMonth);
    const lastTotal = getMonthTotal(lastMonth);
    const delta = currTotal - lastTotal;
    const deltaPct = lastTotal > 0 ? Math.round((delta / lastTotal) * 100) : (currTotal > 0 ? 100 : 0);

    const cardsContainer = document.getElementById('analytics-delta-cards');
    if (!cardsContainer) return;

    const deltaColor = delta > 0 ? 'text-red-400' : (delta < 0 ? 'text-emerald-400' : 'text-gray-500');
    const deltaIcon = delta > 0 ? 'trending-up' : 'trending-down';

    cardsContainer.innerHTML = `
        <div class="bg-cardbg rounded-xl p-5 border border-gray-800">
            <p class="text-xs text-textMuted uppercase font-medium mb-1">vs Last Month</p>
            <div class="text-2xl font-bold ${deltaColor}">${delta > 0 ? '+' : ''}${formatINR(delta)}</div>
            <div class="text-xs ${deltaColor} flex items-center gap-1 mt-1">
                <i data-lucide="${deltaIcon}" class="w-3 h-3"></i> ${Math.abs(deltaPct)}% ${delta >= 0 ? 'higher' : 'lower'}
            </div>
        </div>
        <div class="bg-cardbg rounded-xl p-5 border border-gray-800">
            <p class="text-xs text-textMuted uppercase font-medium mb-1">Avg. Monthly Spend</p>
            <div class="text-2xl font-bold text-white">${formatINR(calculateAverageSpend())}</div>
            <p class="text-[10px] text-gray-500 mt-1">Calendar avg. (last 6 months)</p>
        </div>
        <div class="bg-cardbg rounded-xl p-5 border border-gray-800">
            <p class="text-xs text-textMuted uppercase font-medium mb-1">Highest Month</p>
            <div class="text-2xl font-bold text-white">${formatINR(calculatePeakMonth().total)}</div>
            <p class="text-[10px] text-gray-500 mt-1">${calculatePeakMonth().month || 'No Data'}</p>
        </div>
        <div class="bg-cardbg rounded-xl p-5 border border-gray-800">
            <p class="text-xs text-textMuted uppercase font-medium mb-1">Projected EOF</p>
            <div class="text-2xl font-bold text-primary">${formatINR(calculateProjectedSpend())}</div>
            <p class="text-[10px] text-gray-500 mt-1">Estimated for ${now.toLocaleString('default', { month: 'short' })}</p>
        </div>
    `;
    lucide.createIcons();
}

function calculateAverageSpend() {
    const expenses = appData.expenses || [];
    if (!expenses.length) return 0;

    // Always compute relative to the CURRENT 6-month calendar window
    const now = new Date();
    let totalSixMonths = 0;
    for (let i = 0; i < 6; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        totalSixMonths += expenses.filter(e => e.date && e.date.startsWith(mKey)).reduce((sum, e) => sum + e.amount, 0);
    }
    return totalSixMonths / 6;
}

function calculatePeakMonth() {
    const expenses = appData.expenses || [];
    if (!expenses.length) return { month: '', total: 0 };

    const monthMap = {};
    expenses.forEach(e => {
        if (!e.date) return;
        const m = e.date.slice(0, 7);
        monthMap[m] = (monthMap[m] || 0) + e.amount;
    });
    let peak = { month: '', total: 0 };
    Object.entries(monthMap).forEach(([m, t]) => {
        if (t > peak.total) {
            const date = new Date(m + '-01');
            peak = { month: date.toLocaleString('default', { month: 'long', year: 'numeric' }), total: t };
        }
    });
    return peak;
}

function calculateProjectedSpend() {
    const expenses = appData.expenses || [];
    const now = new Date();
    const currMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const spent = expenses.filter(e => e.date && e.date.startsWith(currMonth)).reduce((sum, e) => sum + e.amount, 0);
    if (spent === 0) return 0;

    const day = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return (spent / day) * daysInMonth;
}

function renderTrendChart() {
    const ctx = document.getElementById('analyticsTrendChart')?.getContext('2d');
    if (!ctx) return;

    const expenses = appData.expenses || [];
    const monthLabels = [];
    const spendData = [];
    const budgetData = [];
    const budget = parseFloat(appData.settings?.budget || 0);

    for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const mLabel = d.toLocaleString('default', { month: 'short' });
        monthLabels.push(mLabel);

        const total = expenses.filter(e => e.date && e.date.startsWith(mKey)).reduce((sum, e) => sum + e.amount, 0);
        spendData.push(total);
        budgetData.push(budget);
    }

    analyticsCharts.trend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: monthLabels,
            datasets: [{
                label: 'Spending',
                data: spendData,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true
            }, {
                label: 'Budget',
                data: budgetData,
                borderColor: 'rgba(244, 63, 94, 0.5)',
                borderDash: [5, 5],
                borderWidth: 2,
                pointRadius: 0,
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function (context) {
                            return context.dataset.label + ': ' + formatINR(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', callback: value => '₹' + value } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
            }
        }
    });
}

function renderAnalyticsCategoryChart() {
    const ctx = document.getElementById('analyticsCategoryChart')?.getContext('2d');
    if (!ctx) return;

    const expenses = appData.expenses || [];
    const months = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    const categories = [...new Set(expenses.map(e => e.category).filter(Boolean))];
    const colors = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'];

    const datasets = categories.map((cat, idx) => {
        return {
            label: cat,
            data: months.map(m => expenses.filter(e => e.category === cat && e.date && e.date.startsWith(m)).reduce((sum, e) => sum + e.amount, 0)),
            backgroundColor: colors[idx % colors.length]
        };
    });

    analyticsCharts.category = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months.map(m => new Date(m + '-01').toLocaleString('default', { month: 'short' })),
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#94a3b8', boxWidth: 10, padding: 15 } },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return context.dataset.label + ': ' + formatINR(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                x: { stacked: true, grid: { display: false }, ticks: { color: '#94a3b8' } },
                y: { stacked: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }
            }
        }
    });
}

function renderYearlyChart() {
    const ctx = document.getElementById('analyticsYearlyChart')?.getContext('2d');
    if (!ctx) return;

    const expenses = appData.expenses || [];
    const years = [...new Set(expenses.filter(e => e.date).map(e => e.date.substring(0, 4)))].sort();

    if (years.length === 0) return;

    const yearlySpend = years.map(y => {
        return expenses.filter(e => e.date && e.date.startsWith(y)).reduce((sum, e) => sum + e.amount, 0);
    });

    analyticsCharts.yearly = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: years,
            datasets: [{
                label: 'Yearly Spend',
                data: yearlySpend,
                backgroundColor: '#10b981', // green
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return 'Total: ' + formatINR(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', callback: value => '₹' + value.toLocaleString('en-IN') } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
            }
        }
    });
}

function renderHeatmapTable() {
    const table = document.getElementById('analyticsHeatmap');
    if (!table) return;

    const expenses = appData.expenses || [];
    const months = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        months.push(d.toISOString().slice(0, 7));
    }

    const categories = [...new Set(expenses.map(e => e.category).filter(Boolean))].slice(0, 8); // Top 8

    let html = `<thead><tr><th class="px-3 py-2 text-gray-500">Category</th>`;
    months.forEach(m => {
        html += `<th class="px-3 py-2 text-gray-500">${new Date(m + '-01').toLocaleString('default', { month: 'short' })}</th>`;
    });
    html += `</tr></thead><tbody class="divide-y divide-gray-800">`;

    categories.forEach(cat => {
        html += `<tr><td class="px-3 py-3 text-white font-medium">${cat}</td>`;
        months.forEach(m => {
            const val = expenses.filter(e => e.category === cat && e.date && e.date.startsWith(m)).reduce((sum, e) => sum + e.amount, 0);
            const intensity = val > 0 ? Math.min(0.9, 0.1 + (val / 5000)) : 0;
            const bgColor = val > 0 ? `rgba(99, 102, 241, ${intensity})` : 'transparent';
            html += `<td class="px-3 py-3 text-center" style="background: ${bgColor}">${val > 0 ? formatINR(val).replace('₹', '') : '—'}</td>`;
        });
        html += `</tr>`;
    });
    html += `</tbody>`;
    table.innerHTML = html;
}

// ── PREMIUM FEATURES ──────────────────────────────────────────────────

function renderDashboard() {
    updateFinScore();
}

/**
 * Calculates a FinScore (0-100) based on:
 * 1. Savings Rate (40%)
 * 2. Budget Adherence (40%)
 * 3. Account Activity (20%)
 */
function updateFinScore() {
    const expenses = appData.expenses || [];
    const income = parseFloat(appData.settings?.income || 0);
    const budget = parseFloat(appData.settings?.budget || 0);
    const now = new Date();
    const currMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    if (income === 0) {
        document.getElementById('finscore-message').innerText = "Set your income to calculate your score.";
        return;
    }

    const currMonthSpent = expenses
        .filter(e => e.date && e.date.startsWith(currMonth))
        .reduce((sum, e) => sum + e.amount, 0);

    // ── 1. Savings Rate (Goal: 20%+ for full points) ──
    const savings = income - currMonthSpent;
    const savingsRate = income > 0 ? (savings / income) * 100 : 0;
    let savingsScore = (savingsRate / 20) * 40;
    savingsScore = Math.max(0, Math.min(40, savingsScore));

    // ── 2. Budget Adherence (Goal: < 100%, best is ~80%) ──
    const budgetPct = budget > 0 ? (currMonthSpent / budget) * 100 : 0;
    let budgetScore = 0;
    if (budgetPct <= 100) {
        budgetScore = 40;
    } else {
        budgetScore = Math.max(0, 40 - (budgetPct - 100)); // Lose points for overspending
    }

    // ── 3. Activity ──
    const recentExpenses = expenses.filter(e => {
        const d = new Date(e.date);
        const diff = (now - d) / (1000 * 60 * 60 * 24);
        return diff <= 30;
    }).length;
    let activityScore = Math.min(20, recentExpenses * 2);

    const totalScore = Math.round(savingsScore + budgetScore + activityScore);

    // Update UI
    const valueEl = document.getElementById('finscore-value');
    const circleEl = document.getElementById('finscore-circle');
    const msgEl = document.getElementById('finscore-message');
    const budgetPctEl = document.getElementById('finscore-budget-pct');
    const savingsRateEl = document.getElementById('finscore-savings-rate');

    if (valueEl) valueEl.innerText = totalScore;
    if (budgetPctEl) budgetPctEl.innerText = Math.round(budgetPct) + '%';
    if (savingsRateEl) savingsRateEl.innerText = Math.round(savingsRate) + '%';

    // Gauge Animation
    if (circleEl) {
        const circumference = 553;
        const offset = circumference - (totalScore / 100) * circumference;
        circleEl.style.strokeDashoffset = offset;

        // Color coding
        if (totalScore > 75) circleEl.style.color = '#10b981'; // Green
        else if (totalScore > 50) circleEl.style.color = '#6366f1'; // Blue
        else if (totalScore > 25) circleEl.style.color = '#f59e0b'; // Amber
        else circleEl.style.color = '#f43f5e'; // Red
    }

    // Custom messages
    if (msgEl) {
        if (totalScore >= 80) msgEl.innerText = "Excellent! You're managing your finances like a pro.";
        else if (totalScore >= 60) msgEl.innerText = "Good! You're on the right track. Try increasing your savings rate.";
        else if (totalScore >= 40) msgEl.innerText = "Fair. Your budget needs more discipline.";
        else msgEl.innerText = "Health Alert: You're overspending. Review your monthly budget.";
    }

    // ── Update AI Forecast Mini-Card ──
    const forecastAmtEl = document.getElementById('forecast-mini-amt');
    if (forecastAmtEl) {
        const day = now.getDate();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const projected = (currMonthSpent / day) * daysInMonth;
        forecastAmtEl.innerText = formatINR(projected);

        const deltaEl = document.getElementById('forecast-mini-delta');
        if (deltaEl && budget > 0) {
            const diff = budget - projected;
            if (diff >= 0) {
                deltaEl.innerHTML = `<i data-lucide="check-circle" class="w-3 h-3 text-accent"></i> On track to save ${formatINR(diff)}`;
                deltaEl.classList.add('text-accent');
                deltaEl.classList.remove('text-red-400');
            } else {
                deltaEl.innerHTML = `<i data-lucide="alert-triangle" class="w-3 h-3 text-red-400"></i> Likely to overspend by ${formatINR(Math.abs(diff))}`;
                deltaEl.classList.add('text-red-400');
                deltaEl.classList.remove('text-accent');
            }
            lucide.createIcons();
        }
    }
}

async function fetchAILevelForecast() {
    const loader = document.getElementById('forecast-loader');
    const setup = document.getElementById('forecast-setup');
    const result = document.getElementById('forecast-result-container');
    const btn = document.getElementById('btn-run-forecast');

    if (loader) loader.classList.remove('hidden');
    if (setup) setup.classList.add('hidden');
    if (result) result.classList.add('hidden');
    if (btn) btn.disabled = true;

    try {
        const res = await fetch('/api/forecast');
        const data = await res.json();

        if (data.error) {
            alert(data.error);
            if (setup) setup.classList.remove('hidden');
        } else {
            // Update UI with AI data
            const valEl = document.getElementById('forecast-value');
            const confValEl = document.getElementById('forecast-conf-val');
            const confBarEl = document.getElementById('forecast-conf-bar');
            const analysisEl = document.getElementById('forecast-analysis');

            if (valEl) valEl.innerText = formatINR(data.forecast_amount);
            if (confValEl) confValEl.innerText = data.confidence + '%';
            if (confBarEl) confBarEl.style.width = data.confidence + '%';
            if (analysisEl) analysisEl.innerText = data.analysis;

            const tipsList = document.getElementById('forecast-tips');
            if (tipsList) {
                tipsList.innerHTML = '';
                (data.tips || []).forEach(tip => {
                    const li = document.createElement('li');
                    li.className = 'text-xs text-gray-300 flex items-start gap-2';
                    li.innerHTML = `<i data-lucide="check" class="w-3 h-3 text-primary mt-0.5"></i> ${tip}`;
                    tipsList.appendChild(li);
                });
            }

            if (result) result.classList.remove('hidden');
            lucide.createIcons();
        }
    } catch (err) {
        console.error("Forecast failed", err);
        alert("Could not reach AI server. Please try again later.");
        if (setup) setup.classList.remove('hidden');
    } finally {
        if (loader) loader.classList.add('hidden');
        if (btn) btn.disabled = false;
    }
}

function updateSimulator() {
    const goalId = document.getElementById('sim-goal-select').value;
    const extraSave = parseFloat(document.getElementById('sim-save-range').value);

    // Update label
    document.getElementById('sim-save-val').innerText = formatINR(extraSave);

    if (!goalId) {
        document.getElementById('sim-result-time').innerText = '--';
        document.getElementById('sim-result-date').innerText = 'Select a goal above';
        document.getElementById('sim-benefit-tag').classList.add('hidden');
        return;
    }

    const goal = appData.goals.find(g => g.id == goalId);
    if (!goal) return;

    const remaining = goal.targetAmount - goal.savedAmount;
    if (remaining <= 0) {
        document.getElementById('sim-result-time').innerText = 'Achieved!';
        document.getElementById('sim-result-date').innerText = 'You have already reached this goal.';
        document.getElementById('sim-benefit-tag').classList.add('hidden');
        return;
    }

    // Calculate Baseline Savings per month
    // We'll estimate based on target date if we don't have a better "savings" metric
    const targetDate = new Date(goal.targetDate);
    const monthsLeft = Math.max(1, (targetDate - new Date()) / (1000 * 60 * 60 * 24 * 30.44));
    const baselineMonthly = remaining / monthsLeft;

    const newMonthly = baselineMonthly + extraSave;
    const newMonthsLeft = remaining / newMonthly;
    const monthsSaved = monthsLeft - newMonthsLeft;

    // Formatting result
    let timeText = "";
    if (newMonthsLeft >= 12) {
        const yrs = Math.floor(newMonthsLeft / 12);
        const mths = Math.round(newMonthsLeft % 12);
        timeText = `${yrs}y ${mths}m`;
    } else {
        timeText = `${Math.ceil(newMonthsLeft)} months`;
    }

    const newDate = new Date();
    newDate.setMonth(newDate.getMonth() + Math.ceil(newMonthsLeft));

    document.getElementById('sim-result-time').innerText = timeText;
    document.getElementById('sim-result-date').innerText = `Estimated: ${newDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`;

    if (monthsSaved >= 1) {
        const tag = document.getElementById('sim-benefit-tag');
        tag.classList.remove('hidden');
        document.getElementById('sim-months-saved').innerText = Math.floor(monthsSaved);
    } else {
        document.getElementById('sim-benefit-tag').classList.add('hidden');
    }
}

async function exportAnalyticsPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const primaryColor = [10, 132, 255]; // #0A84FF
    const accentColor = [0, 212, 116]; // #00D474

    // Helper to format currency for basic jsPDF fonts
    const pdfInr = (num) => formatINR(num).replace('₹', 'Rs. ');

    // Helper to strip emojis and unsupported characters from AI text
    const cleanPdfText = (txt) => txt.replace(/[\u1F600-\u1F64F\u1F300-\u1F5FF\u1F680-\u1F6FF\u2600-\u26FF\u2700-\u27BF]/g, '').replace(/[^\x00-\x7F]/g, '');

    // Header
    doc.setFillColor(20, 24, 33);
    doc.rect(0, 0, 210, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("FINFLAP", 15, 25);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("PREMIUM FINANCIAL INTELLIGENCE REPORT", 15, 33);

    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(1);
    doc.line(15, 35, 195, 35);

    // Date
    const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.setTextColor(150, 150, 150);
    doc.text(`Generated on ${today}`, 155, 25);

    // Core Summary
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Executive Summary", 15, 55);

    const settings = appData.settings || {};
    const income = settings.monthlyIncome || 0;
    const budget = settings.monthlyBudget || 0;

    const currentMonth = new Date().toISOString().substring(0, 7);
    const monthlyTotal = appData.expenses
        .filter(e => e.date.startsWith(currentMonth))
        .reduce((sum, e) => sum + e.amount, 0);

    const savings = income - monthlyTotal;

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Monthly Income: ${pdfInr(income)}`, 20, 65);
    doc.text(`Current Month Expenses: ${pdfInr(monthlyTotal)}`, 20, 72);

    if (savings > 0) {
        doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
        doc.text(`Estimated Savings: ${pdfInr(savings)}`, 20, 79);
    } else {
        doc.setTextColor(255, 0, 0);
        doc.text(`Overspend: ${pdfInr(Math.abs(savings))}`, 20, 79);
    }

    // Category Breakdown
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Category Breakdown", 15, 95);

    const cats = {};
    const thisMonthExps = appData.expenses.filter(e => e.date.startsWith(currentMonth));
    thisMonthExps.forEach(e => cats[e.category] = (cats[e.category] || 0) + e.amount);

    const catData = Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => [cat, pdfInr(amt)]);

    doc.autoTable({
        startY: 100,
        head: [['Category', 'Total Spent']],
        body: catData,
        theme: 'striped',
        headStyles: { fillColor: primaryColor },
        styles: { font: 'helvetica', fontSize: 10 }
    });

    let yPos = doc.lastAutoTable.finalY + 15;

    // Recent Transactions
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Recent Transactions", 15, yPos);

    const txData = thisMonthExps.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 15).map(e => [
        e.date, e.description, e.category, pdfInr(e.amount)
    ]);

    doc.autoTable({
        startY: yPos + 5,
        head: [['Date', 'Description', 'Category', 'Amount']],
        body: txData,
        theme: 'grid',
        headStyles: { fillColor: [40, 40, 40] },
        styles: { font: 'helvetica', fontSize: 9 }
    });

    yPos = doc.lastAutoTable.finalY + 15;

    // AI Insights (from UI if exists)
    let aiInsight = document.getElementById('ai-insight-content-exp')?.innerText || "";
    aiInsight = cleanPdfText(aiInsight);
    if (aiInsight && aiInsight.length > 50 && !aiInsight.includes("Click 'Refresh Insight'")) {
        if (yPos > 240) { doc.addPage(); yPos = 20; }
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("AI Smart Insights", 15, yPos);

        doc.setFontSize(9);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(60, 60, 60);
        const splitText = doc.splitTextToSize(aiInsight, 170);
        doc.text(splitText, 15, yPos + 8);
    }

    // Footer
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 150, 150);
    doc.text("Confidential Report | Powered by FinFlap AI", 15, 285);
    doc.text("Page 1", 190, 285);

    doc.save(`FinFlap_Report_${currentMonth}.pdf`);
}

// --- VOICE TO EXPENSE SYSTEM --- //

let isVoiceRecording = false;
let voiceRecognition = null;

function startVoiceExpense() {
    if (isVoiceRecording) {
        if (voiceRecognition) voiceRecognition.stop();
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("Voice recognition is not supported in this browser. Please use Chrome or Safari.");
        return;
    }

    const btn = document.getElementById('voice-record-btn');
    const icon = document.getElementById('voice-record-icon');
    const text = document.getElementById('voice-record-text');
    const originalText = text.innerText;

    voiceRecognition = new SpeechRecognition();
    voiceRecognition.lang = 'en-IN'; // Works great for Indian English + Hindi mix
    voiceRecognition.interimResults = false;
    voiceRecognition.maxAlternatives = 1;

    voiceRecognition.onstart = () => {
        isVoiceRecording = true;
        icon.setAttribute('data-lucide', 'radio');
        text.innerText = "Listening...";
        btn.classList.add('animate-pulse', 'bg-purple-600');
        btn.classList.remove('from-indigo-600', 'to-purple-600');
        lucide.createIcons();
    };

    voiceRecognition.onresult = async (event) => {
        const transcript = event.results[0][0].transcript;
        console.log("Voice Transcript Captured:", transcript);

        icon.setAttribute('data-lucide', 'loader-2');
        icon.classList.add('animate-spin');
        text.innerText = "Processing AI...";
        lucide.createIcons();

        try {
            const res = await fetch('/api/parse-voice-expense', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: transcript })
            });
            const data = await res.json();

            if (res.ok && data.success) {
                alert(`✨ Auto-Added via Voice!\n\nCategory: ${data.expense.category}\nDesc: ${data.expense.description}\nAmount: ₹${data.expense.amount}`);
                fetchAppData(); // Refresh all tables and charts immediately
            } else {
                alert(data.error || "Failed to parse voice expense.");
            }
        } catch (err) {
            console.error("API Voice Parse Error:", err);
            alert("Network error connecting to AI parser.");
        } finally {
            resetVoiceExpenseBtn(btn, icon, text, originalText);
        }
    };

    voiceRecognition.onerror = (event) => {
        console.error("Speech error:", event.error);
        if (event.error !== 'aborted') {
            alert(`Microphone Error: ${event.error}. Please ensure microphone permissions are granted.`);
        }
        resetVoiceExpenseBtn(btn, icon, text, originalText);
    };

    voiceRecognition.onend = () => {
        if (text.innerText === "Listening...") {
            resetVoiceExpenseBtn(btn, icon, text, originalText);
        }
    };

    voiceRecognition.start();
}

function resetVoiceExpenseBtn(btn, icon, text, originalText) {
    isVoiceRecording = false;
    icon.setAttribute('data-lucide', 'mic');
    icon.classList.remove('animate-spin');
    text.innerText = originalText;
    btn.classList.remove('animate-pulse', 'bg-purple-600');
    btn.classList.add('from-indigo-600', 'to-purple-600');
    lucide.createIcons();
}
