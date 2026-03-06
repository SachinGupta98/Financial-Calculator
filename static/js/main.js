lucide.createIcons();

        const formatINR = (num) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(num);

        const views = [
            'dashboard', 'expense', 'goals', 'portfolio', 'tax-opt', 'ai', 'stock', 'currency', 
            'calculator', 'emi', 'sip', 'income-tax', 'retirement', 'compound', 'gst'
        ];

        const titles = {
            'dashboard': 'Welcome to your Financial Dashboard',
            'expense': 'Expense Tracker',
            'goals': 'Financial Goals',
            'portfolio': 'Portfolio Manager',
            'tax-opt': 'Tax Optimizer',
            'ai': 'AI Advisor',
            'stock': 'Stock Market Advisor',
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
                if(el) el.classList.remove('active');
                if(nav) { nav.classList.remove('active', 'bg-primary', 'text-white'); nav.classList.add('text-gray-300'); }
            });

            document.getElementById(`view-${viewId}`).classList.add('active');
            const activeNav = document.getElementById(`nav-${viewId}`);
            if(activeNav) {
                activeNav.classList.remove('text-gray-300');
                activeNav.classList.add('active', 'bg-primary', 'text-white');
            }
            
            document.getElementById('top-title').innerText = titles[viewId] || 'Dashboard';

            // Auto-close sidebar on mobile after clicking a link
            const sidebar = document.getElementById('main-sidebar');
            if(window.innerWidth < 768 && sidebar && !sidebar.classList.contains('-translate-x-full')) {
                sidebar.classList.add('-translate-x-full');
                setTimeout(() => sidebar.classList.add('hidden'), 300);
            }

            if(viewId === 'sip') setTimeout(calculateSIP, 100);
            if(viewId === 'expense') setTimeout(renderExpenseTracker, 50);
            if(viewId === 'portfolio') setTimeout(renderPortfolio, 50);
            if(viewId === 'goals') setTimeout(renderGoals, 50);
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
            if(id === 'budget-modal') {
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
                    renderExpenseTracker();
                    renderPortfolio();
                    renderGoals();
                }
            } catch (err) {
                console.error("Failed to fetch app data", err);
            }
        }

        // --- EXPENSE TRACKER SYSTEM --- //
        let expChartInstance = null;
        async function saveBudgetSettings() {
            const income = parseFloat(document.getElementById('inp-budget-income').value) || 0;
            const budget = parseFloat(document.getElementById('inp-budget-target').value) || 0;
            
            await fetch('/api/settings', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
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
            if(!desc || !amt || !date) return alert("Please fill all fields");

            await fetch('/api/expense', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
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
            
            let totalSpent = 0;
            const categorySums = {};

            // Sort and render table
            tbody.innerHTML = '';
            const sortedExp = [...appData.expenses].sort((a,b) => new Date(b.date) - new Date(a.date));
            
            if(sortedExp.length === 0) {
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
                        <td class="px-6 py-4 text-sm font-medium text-white">${exp.desc}</td>
                        <td class="px-6 py-4 text-sm text-gray-400">
                            <span class="bg-gray-800 px-2.5 py-1 rounded-md border border-gray-700 font-medium">${exp.category}</span>
                        </td>
                        <td class="px-6 py-4 text-sm font-bold text-red-400 text-right">Ext ${formatINR(exp.amount)}</td>
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
            if(pct > 100) pct = 100;
            const bar = document.getElementById('exp-budget-bar');
            bar.style.width = `${pct}%`;
            bar.className = pct >= 90 ? "bg-red-500 h-1.5 rounded-full" : pct >= 75 ? "bg-yellow-500 h-1.5 rounded-full" : "bg-primary h-1.5 rounded-full";

            // Update Chart
            const ctx = document.getElementById('expenseChart').getContext('2d');
            if(expChartInstance) expChartInstance.destroy();
            
            if(Object.keys(categorySums).length > 0) {
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
            if(appData.expenses.length === 0) {
                document.getElementById('ai-insight-content-exp').innerHTML = "Please add some expenses first so AI has data to analyze.";
                return;
            }
            const loader = document.getElementById('ai-insight-loader-exp');
            const content = document.getElementById('ai-insight-content-exp');
            loader.classList.remove('hidden');
            content.classList.add('opacity-50');

            const summary = `Income: ${appData.settings.income}, Budget: ${appData.settings.budget}. Top Expenses: ` + JSON.stringify(appData.expenses.slice(0,10).map(e=>({desc:e.desc, cat:e.category, amt:e.amount})));
            const prompt = `[Context: I am requesting a brief, professional spending habit analysis as an Indian consumer.]\nHere is my data: ${summary}. Keep it concise, highlight areas I am overspending, and suggest 1 actionable cutback.`;

            try {
                const res = await fetch('/api/gemini', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: prompt })
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
            
            if(!name || isNaN(invested) || isNaN(current)) return alert("Please fill all fields");

            await fetch('/api/asset', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ id: idToEdit || null, name, type, invested, current })
            });
            await fetchAppData();
            closeModal();
        }

        async function deleteAsset(id) {
            if(confirm("Are you sure you want to delete this asset?")) {
                await fetch(`/api/asset/${id}`, { method: 'DELETE' });
                await fetchAppData();
            }
        }

        function renderPortfolio() {
            const tbody = document.getElementById('portfolio-table-body');
            let totalInv = 0, totalCur = 0;
            const typeValueMap = {};

            tbody.innerHTML = '';
            
            if(appData.portfolio.length === 0) {
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
                        <td class="px-6 py-5 text-sm font-medium text-white">${ast.name}</td>
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
            
            if(tDiff >= 0) {
                gainEl.parentElement.className = "text-3xl font-bold text-emerald-500 flex items-baseline gap-2";
                gainEl.innerText = "+" + gainEl.innerText;
            } else {
                gainEl.parentElement.className = "text-3xl font-bold text-red-500 flex items-baseline gap-2";
                gainEl.innerText = "-" + gainEl.innerText;
            }

            // Chart
            const ctx = document.getElementById('portfolioChart').getContext('2d');
            if(portChartInstance) portChartInstance.destroy();
            
            if(Object.keys(typeValueMap).length > 0) {
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
                        plugins: { legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 8, padding: 20 } } }
                    }
                });
            }
        }

        async function analyzePortfolio() {
            if(appData.portfolio.length === 0) {
                document.getElementById('ai-insight-content-port').innerHTML = "No portfolio data to analyze.";
                return;
            }
            const loader = document.getElementById('ai-insight-loader-port');
            const content = document.getElementById('ai-insight-content-port');
            loader.classList.remove('hidden');
            content.classList.add('opacity-50');

            let typeMap = {};
            let tCur = 0;
            appData.portfolio.forEach(a => { tCur += a.current; typeMap[a.type] = (typeMap[a.type] || 0) + a.current; });
            const mix = Object.keys(typeMap).map(k => `${k}: ${((typeMap[k]/tCur)*100).toFixed(1)}%`).join(", ");

            const prompt = `[Context: I am requesting a professional portfolio health check.]\nMy total portfolio value is ${formatINR(tCur)}. Allocation mix is: ${mix}. Please provide a 2-paragraph health check identifying if I'm over-exposed in any area, and general risk advice. Keep it readable.`;

            try {
                const res = await fetch('/api/gemini', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: prompt })
                });
                const data = await res.json();
                if (res.ok && data.text) { content.innerHTML = marked.parse(data.text); } 
                else { content.innerHTML = "Analysis failed. Please try again."; }
            } catch (err) { content.innerHTML = "Server connection lost."; }
            
            loader.classList.add('hidden');
            content.classList.remove('opacity-50');
        }

        // --- FINANCIAL GOALS SYSTEM --- //

        async function saveGoal() {
            const title = document.getElementById('inp-gal-name').value;
            const targetAmount = parseFloat(document.getElementById('inp-gal-target').value);
            const savedAmount = parseFloat(document.getElementById('inp-gal-saved').value) || 0;
            const targetDate = document.getElementById('inp-gal-date').value;
            const category = document.getElementById('inp-gal-cat').value;
            const idToEdit = document.getElementById('inp-gal-id').value;

            if(!title || isNaN(targetAmount) || !targetDate) return alert("Please fill required fields (Name, Target Amount, Date).");

            await fetch('/api/goal', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ id: idToEdit || null, title, targetAmount, savedAmount, targetDate, category })
            });
            await fetchAppData();
            closeModal();
        }

        async function deleteGoal(id) {
            if(confirm("Are you sure you want to delete this goal?")) {
                await fetch(`/api/goal/${id}`, { method: 'DELETE' });
                await fetchAppData();
            }
        }

        function editGoal(id) {
            const g = appData.goals.find(g => g.id === id);
            if(g) {
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
            let tTarget=0, tSaved=0;

            grid.innerHTML = '';

            if(appData.goals.length === 0) {
                 grid.innerHTML = `
                    <div class="col-span-full py-12 text-center border-2 border-dashed border-gray-700 rounded-xl bg-gray-900/30">
                        <i data-lucide="flag" class="w-8 h-8 mx-auto text-gray-600 mb-3"></i>
                        <p class="text-gray-500">No active goals found. Create one to start tracking!</p>
                    </div>`;
            } else {
                appData.goals.forEach(g => {
                    tTarget += g.targetAmount;
                    tSaved += g.savedAmount;

                    let pct = (g.savedAmount / g.targetAmount) * 100;
                    if(pct > 100) pct = 100;

                    // Days remaining
                    const daysLeft = Math.ceil((new Date(g.targetDate) - new Date()) / (1000 * 60 * 60 * 24));
                    const timeText = daysLeft < 0 ? 'Overdue' : daysLeft === 0 ? 'Today' : `${daysLeft} days left`;
                    const timeCls = daysLeft < 0 ? 'text-red-400' : 'text-primary';

                    // Icons based on category
                    const icons = {'Purchase': 'shopping-bag', 'Emergency': 'shield-check', 'Investment': 'trending-up', 'Travel': 'plane', 'Debt': 'credit-card'};
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
                                <h3 class="text-white font-bold leading-tight">${g.name}</h3>
                                <p class="text-xs text-gray-500">${g.category}</p>
                            </div>
                        </div>
                        <div class="mt-auto">
                            <div class="flex justify-between items-end mb-2">
                                <span class="text-xl font-bold text-white">${formatINR(g.savedAmount)}</span>
                                <span class="text-sm font-bold text-accent">${pct.toFixed(0)}%</span>
                            </div>
                            <div class="w-full bg-gray-800 rounded-full h-2 mb-3">
                                <div class="bg-accent h-2 rounded-full transition-all duration-1000" style="width: ${pct}%"></div>
                            </div>
                            <div class="flex justify-between items-center text-xs">
                                <span class="text-gray-500">Target: ${formatINR(g.targetAmount)}</span>
                                <span class="${timeCls} font-medium bg-gray-900 px-2 py-1 rounded">${timeText}</span>
                            </div>
                            <button onclick="askStrategy(${g.id})" class="mt-4 w-full py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg text-sm font-medium transition-colors flex items-center justify-center">
                                <i data-lucide="cpu" class="w-3.5 h-3.5 mr-1.5"></i>Get AI Strategy
                            </button>
                        </div>
                    `;
                    grid.appendChild(div);
                });
                lucide.createIcons();
            }

            // Update Top Progress Bar
            document.getElementById('goal-total-saved').innerText = formatINR(tSaved);
            document.getElementById('goal-total-target').innerText = "/ " + formatINR(tTarget);
            let tPct = tTarget > 0 ? (tSaved / tTarget) * 100 : 0;
            if(tPct > 100) tPct = 100;
            document.getElementById('goal-total-pct').innerText = tPct.toFixed(0) + "%";
            document.getElementById('goal-total-bar').style.width = `${tPct}%`;
        }

        async function askStrategy(id) {
            const g = appData.goals.find(g => g.id === id);
            if(!g) return;
            switchView('ai'); // Switch to main AI view
            const daysLeft = Math.ceil((new Date(g.targetDate) - new Date()) / (1000 * 60 * 60 * 24));
            const promptBox = document.getElementById('ai-prompt');
            promptBox.value = `I am trying to achieve the goal: "${g.name}". I need ${formatINR(g.targetAmount)} in ${daysLeft} days. I currently have ${formatINR(g.savedAmount)}. Please give me a strategic, step-by-step month-to-month savings plan to achieve this.`;
            // Trigger
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
            if(Object.keys(exchangeRates).length === 0) return;
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
            
            if (P===0 || R===0 || N===0) return;
            const r = R / 12 / 100, n = N * 12;
            const emi = P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
            const totalPayment = emi * n;
            document.getElementById('emi-result').innerText = formatINR(emi);
            document.getElementById('emi-interest').innerText = formatINR(totalPayment - P);
            document.getElementById('emi-total').innerText = formatINR(totalPayment);
        }

        // SIP
        let sipChartInstance = null;
        function calculateSIP() {
            let P = parseFloat(document.getElementById('sip-amount').value) || 0;
            let R = parseFloat(document.getElementById('sip-rate').value) || 0;
            let Y = parseFloat(document.getElementById('sip-years').value) || 0;
            if (P===0 || R===0 || Y===0) return;
            const i = R / 12 / 100, n = Y * 12;
            const expectedAmount = P * ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
            const amountInvested = P * n;
            const estReturns = expectedAmount - amountInvested;
            
            document.getElementById('sip-invested').innerText = formatINR(amountInvested);
            document.getElementById('sip-returns').innerText = formatINR(estReturns);
            document.getElementById('sip-total').innerText = formatINR(expectedAmount);

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

        // --- INCOME TAX CALCULATOR ---
        function calculateTax() {
            let salary = parseFloat(document.getElementById('tax-salary').value) || 0;
            let other = parseFloat(document.getElementById('tax-other').value) || 0;
            let d80c = parseFloat(document.getElementById('tax-80c').value) || 0;
            let d80d = parseFloat(document.getElementById('tax-80d').value) || 0;
            let dhra = parseFloat(document.getElementById('tax-hra').value) || 0;

            if (d80c > 150000) d80c = 150000;
            
            let gross = salary + other;
            
            let oldNet = gross - 50000 - d80c - d80d - dhra;
            let newNet = gross - 50000; 

            let oldTax = 0;
            if (oldNet <= 250000) oldTax = 0;
            else if (oldNet <= 500000) oldTax = (oldNet - 250000) * 0.05;
            else if (oldNet <= 1000000) oldTax = 12500 + (oldNet - 500000) * 0.20;
            else oldTax = 112500 + (oldNet - 1000000) * 0.30;
            
            if (oldNet <= 500000) oldTax = 0;

            let newTax = 0;
            if (newNet <= 300000) newTax = 0;
            else if (newNet <= 600000) newTax = (newNet - 300000) * 0.05;
            else if (newNet <= 900000) newTax = 15000 + (newNet - 600000) * 0.10;
            else if (newNet <= 1200000) newTax = 45000 + (newNet - 900000) * 0.15;
            else if (newNet <= 1500000) newTax = 90000 + (newNet - 1200000) * 0.20;
            else newTax = 150000 + (newNet - 1500000) * 0.30;

            if (newNet <= 700000) newTax = 0;

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
                if(recIconDiv) recIconDiv.outerHTML = '<i data-lucide="check-circle" class="w-8 h-8 text-emerald-500 mx-auto mb-2"></i>';
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
                if(recIconDiv) recIconDiv.outerHTML = '<i data-lucide="check-circle" class="w-8 h-8 text-primary mx-auto mb-2"></i>';
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
                if(recIconDiv) recIconDiv.outerHTML = '<i data-lucide="minus-circle" class="w-8 h-8 text-gray-400 mx-auto mb-2"></i>';
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

            let futExp = exp * Math.pow(1 + inf/100, yearsToSave);

            let post = 7; // Conservative 7% post-retirement
            let realRate = ((1 + post/100) / (1 + inf/100)) - 1;
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
            let sip = corpus / ( ((Math.pow(1 + iMonthly, monthsSave) - 1) / iMonthly) * (1 + iMonthly) );

            document.getElementById('ret-res-corpus').innerText = formatINR(corpus);
            document.getElementById('ret-res-sip').innerText = formatINR(sip);
            document.getElementById('ret-res-futexp').innerText = formatINR(futExp);
            document.getElementById('ret-res-yrsave').innerText = yearsToSave + " Years";
            document.getElementById('ret-res-yrret').innerText = yearsInRetirement + " Years";
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
            let mnt = PMT * (12/n); 

            labels.push('Year 0');
            investedData.push(currInvested);
            totalData.push(currTotal);

            for (let yr = 1; yr <= t; yr++) {
                for(let p = 1; p <= n; p++) {
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
                        tooltip: { callbacks: { label: function(c) { return c.dataset.label + ': ' + formatINR(c.raw); } } }
                    },
                    scales: {
                        y: {
                            ticks: { callback: function(val) { return '₹' + (val >= 100000 ? (val/100000).toFixed(1) + 'L' : val); } },
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
            } catch(e) { calcVal = 'Error'; calcHist = ''; newNum = true; }
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
            if(act === 'mc') calcMemVal = 0;
            if(act === 'm+') calcMemVal += parseFloat(calcVal);
            if(act === 'm-') calcMemVal -= parseFloat(calcVal);
            if(act === 'mr') { calcVal = String(calcMemVal); newNum = true; }
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
            const toRad = x => isDeg ? x * Math.PI/180 : x;
            
            if(f==='1/x') res = 1/v;
            else if(f==='x2') res = v*v;
            else if(f==='x3') res = v*v*v;
            else if(f==='sqrt') res = Math.sqrt(v);
            else if(f==='cbrt') res = Math.cbrt(v);
            else if(f==='log10') res = Math.log10(v);
            else if(f==='ln') res = Math.log(v);
            else if(f==='10x') res = Math.pow(10, v);
            else if(f==='ex') res = Math.exp(v);
            else if(f==='sin') res = is2nd ? Math.asin(v)*180/Math.PI : Math.sin(toRad(v));
            else if(f==='cos') res = is2nd ? Math.acos(v)*180/Math.PI : Math.cos(toRad(v));
            else if(f==='tan') res = is2nd ? Math.atan(v)*180/Math.PI : Math.tan(toRad(v));
            else if(f==='sinh') res = is2nd ? Math.asinh(v) : Math.sinh(v);
            else if(f==='cosh') res = is2nd ? Math.acosh(v) : Math.cosh(v);
            else if(f==='tanh') res = is2nd ? Math.atanh(v) : Math.tanh(v);
            else if(f==='fact') {
                res = 1; for(let i=2; i<=v; i++) res*=i;
            }
            calcVal = String(parseFloat(res.toFixed(8)));
            newNum = true;
            updateDisplay();
        }

        // --- AI ADVISOR ROUTING ---
        async function askAI(type) {
            const promptInput = document.getElementById(`${type}-prompt`);
            let promptText = promptInput.value.trim();
            if (!promptText) return;

            // Prepend context based on tool used
            if(type === 'tax') promptText = `[Context: I am asking a question regarding Income Tax Optimization in India.]\nUser Query: ${promptText}`;
            if(type === 'stock') promptText = `[Context: I am asking a question regarding Stock Market analysis or strategy.]\nUser Query: ${promptText}`;

            const resultContainer = document.getElementById(`ai-result-${type}`);
            const loader = document.getElementById(`ai-loader-${type}`);
            const responseTextDiv = document.getElementById(`ai-text-${type}`);
            const btn = document.getElementById(`ai-btn-${type}`);

            resultContainer.classList.remove('hidden');
            loader.classList.remove('hidden');
            responseTextDiv.classList.add('hidden');
            
            const originalBtnHTML = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i>';
            lucide.createIcons();

            try {
                const response = await fetch('/api/gemini', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: promptText })
                });
                const data = await response.json();

                loader.classList.add('hidden');
                responseTextDiv.classList.remove('hidden');
                
                if (response.ok && data.text) {
                    responseTextDiv.innerHTML = marked.parse(data.text);
                } else {
                    responseTextDiv.innerHTML = `<p class="text-red-400">Error: ${data.error || 'Failed to connect'}</p>`;
                }
            } catch (error) {
                loader.classList.add('hidden');
                responseTextDiv.classList.remove('hidden');
                responseTextDiv.innerHTML = `<p class="text-red-400">Connection Failed.</p>`;
            }

            btn.disabled = false;
            btn.innerHTML = originalBtnHTML;
            lucide.createIcons();
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

            if(mobileMenuBtn && sidebar) {
                mobileMenuBtn.addEventListener('click', () => {
                    sidebar.classList.remove('hidden');
                    // Small delay to allow display:block to apply before animating transform
                    setTimeout(() => {
                        sidebar.classList.remove('-translate-x-full');
                    }, 10);
                });
            }

            if(mobileCloseBtn && sidebar) {
                mobileCloseBtn.addEventListener('click', () => {
                    sidebar.classList.add('-translate-x-full');
                    // Wait for transition to finish before hiding
                    setTimeout(() => {
                        sidebar.classList.add('hidden');
                    }, 300);
                });
            }
        };