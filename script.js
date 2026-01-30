/**
 * SecureVote System Core Logic
 * Simulates a full backend environment client-side.
 */

// --- MOCK BACKEND SERVICE ---
class MockBackend {
    constructor() {
        this.STORAGE_KEYS = {
            USERS: 'sv_users',
            CANDIDATES: 'sv_candidates',
            VOTES: 'sv_votes',
            CURRENT_USER: 'sv_session'
        };
        this.init();
    }

    init() {
        // Seed initial data if empty
        if (!localStorage.getItem(this.STORAGE_KEYS.CANDIDATES)) {
            const seedCandidates = [
                {
                    id: 'c1',
                    name: 'Sarah Connor',
                    party: 'Resistance Party',
                    bio: 'Leading the charge for a safer future against automated threats.',
                    policies: ['Universal Basic Income', 'AI Regulation', 'Green Earth Initiative'],
                    image: 'https://ui-avatars.com/api/?name=Sarah+Connor&background=0D8ABC&color=fff&size=256'
                },
                {
                    id: 'c2',
                    name: 'Miles Dyson',
                    party: 'Innovation Alliance',
                    bio: 'Technological advancement is the key to our prosperity.',
                    policies: ['Tech Subsidies', 'Smart Cities', 'Education Reform'],
                    image: 'https://ui-avatars.com/api/?name=Miles+Dyson&background=6D28D9&color=fff&size=256'
                }
            ];
            localStorage.setItem(this.STORAGE_KEYS.CANDIDATES, JSON.stringify(seedCandidates));
        }

        if (!localStorage.getItem(this.STORAGE_KEYS.USERS)) {
            // Default Admin Account
            const admin = {
                id: 'admin',
                name: 'System Admin',
                email: 'admin@securevote.com',
                password: 'admin', // In real app: hash this
                role: 'admin',
                govId: 'ADM-001',
                hasVoted: false
            };
            localStorage.setItem(this.STORAGE_KEYS.USERS, JSON.stringify([admin]));
        }
    }

    // --- User Methods ---
    getUsers() { return JSON.parse(localStorage.getItem(this.STORAGE_KEYS.USERS) || '[]'); }

    registerUser(userData) {
        const users = this.getUsers();
        if (users.find(u => u.email === userData.email || u.govId === userData.govId)) {
            throw new Error('User already registered.');
        }
        users.push({ ...userData, role: 'voter', hasVoted: false });
        localStorage.setItem(this.STORAGE_KEYS.USERS, JSON.stringify(users));
        return userData;
    }

    authenticate(loginId, password) {
        const users = this.getUsers();
        // Login by Email or GovID
        const user = users.find(u => (u.email === loginId || u.govId === loginId) && u.password === password);
        if (user) {
            localStorage.setItem(this.STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
            return user;
        }
        throw new Error('Invalid credentials');
    }

    getCurrentUser() {
        return JSON.parse(localStorage.getItem(this.STORAGE_KEYS.CURRENT_USER));
    }

    logout() {
        localStorage.removeItem(this.STORAGE_KEYS.CURRENT_USER);
    }

    // --- Candidate Methods ---
    getCandidates() { return JSON.parse(localStorage.getItem(this.STORAGE_KEYS.CANDIDATES) || '[]'); }

    addCandidate(candidate) {
        const list = this.getCandidates();
        list.push({ ...candidate, id: 'c' + Date.now() });
        localStorage.setItem(this.STORAGE_KEYS.CANDIDATES, JSON.stringify(list));
    }

    // --- Vote Methods ---
    castVote(userId, candidateId) {
        const users = this.getUsers();
        const userIdx = users.findIndex(u => u.id === userId);

        if (userIdx === -1) throw new Error('User not found');
        if (users[userIdx].hasVoted) throw new Error('Double voting attempt detected!');

        // 1. Record Vote (Anonymized in real ledger)
        const votes = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.VOTES) || '[]');
        const encryptedVote = btoa(`${userId}-${candidateId}-${Date.now()}`); // Mock Encryption
        votes.push({
            hash: encryptedVote,
            candidateId: candidateId,
            timestamp: new Date().toISOString()
        });
        localStorage.setItem(this.STORAGE_KEYS.VOTES, JSON.stringify(votes));

        // 2. Mark User as Voted
        users[userIdx].hasVoted = true;
        localStorage.setItem(this.STORAGE_KEYS.USERS, JSON.stringify(users));

        // 3. Update Session
        const currentUser = this.getCurrentUser();
        currentUser.hasVoted = true;
        localStorage.setItem(this.STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUser));

        return encryptedVote;
    }

    getResults() {
        const votes = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.VOTES) || '[]');
        const candidates = this.getCandidates();

        const results = candidates.map(c => ({
            ...c,
            voteCount: votes.filter(v => v.candidateId === c.id).length
        }));

        const totalVotes = votes.length;

        return { results, totalVotes, voteLog: votes.slice(-5).reverse() }; // Return last 5 votes for ledger
    }

    resetElection() {
        localStorage.removeItem(this.STORAGE_KEYS.VOTES);
        // Reset user voting status
        const users = this.getUsers().map(u => ({ ...u, hasVoted: false }));
        localStorage.setItem(this.STORAGE_KEYS.USERS, JSON.stringify(users));
        // Reset Session
        const currentUser = this.getCurrentUser();
        if (currentUser) {
            currentUser.hasVoted = false;
            localStorage.setItem(this.STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUser));
        }
    }
}

const db = new MockBackend();

// --- UI CONTROLLERS ---

const App = {
    init() {
        this.cacheDOM();
        this.bindEvents();
        this.checkAuth();
        this.render();

        // Live Updates
        setInterval(() => {
            if (this.currentView === 'dashboard') Dashboard.update();
        }, 2000);
    },

    cacheDOM() {
        this.dom = {
            header: document.getElementById('app-header'),
            views: document.querySelectorAll('.view-section'),
            navBtns: document.querySelectorAll('.nav-btn'),
            authForms: document.querySelectorAll('.auth-form'),
            authTabs: document.querySelectorAll('.auth-tabs .tab-btn'),
            userName: document.getElementById('user-name-display'),
            toast: document.getElementById('toast-container'),
            logoutBtn: document.getElementById('logout-btn')
        };
    },

    bindEvents() {
        // Navigation
        this.dom.navBtns.forEach(btn => {
            btn.addEventListener('click', () => this.navigate(btn.dataset.view));
        });

        // Auth Tabs
        this.dom.authTabs.forEach(btn => {
            btn.addEventListener('click', () => {
                this.dom.authTabs.forEach(b => b.classList.remove('active'));
                this.dom.authForms.forEach(f => f.classList.remove('active'));

                btn.classList.add('active');
                if (btn.dataset.tab === 'login') document.getElementById('login-form').classList.add('active');
                else document.getElementById('register-form').classList.add('active');
            });
        });

        // Login Submit
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const id = document.getElementById('login-id').value;
            const pass = document.getElementById('login-password').value;
            try {
                db.authenticate(id, pass);
                this.checkAuth();
                this.showToast('Authentication Successful', 'success');
            } catch (err) {
                this.showToast(err.message, 'error');
            }
        });

        // Register Submit
        document.getElementById('register-form').addEventListener('submit', (e) => {
            e.preventDefault();
            try {
                db.registerUser({
                    id: 'u' + Date.now(),
                    name: document.getElementById('reg-name').value,
                    email: document.getElementById('reg-email').value,
                    govId: document.getElementById('reg-gov-id').value,
                    password: document.getElementById('reg-password').value
                });
                db.authenticate(document.getElementById('reg-email').value, document.getElementById('reg-password').value);
                this.checkAuth();
                this.showToast('Registration Successful', 'success');
            } catch (err) {
                this.showToast(err.message, 'error');
            }
        });

        this.dom.logoutBtn.addEventListener('click', () => {
            db.logout();
            this.checkAuth();
            this.showToast('Logged Out', 'info');
        });
    },

    checkAuth() {
        const user = db.getCurrentUser();
        if (user) {
            this.dom.header.classList.remove('hidden');
            this.dom.userName.textContent = user.name;

            // Handle Admin Link
            const adminBtn = document.querySelector('.nav-btn[data-view="admin"]');
            if (user.role === 'admin') adminBtn.classList.remove('hidden');
            else adminBtn.classList.add('hidden');

            this.navigate('dashboard');
        } else {
            this.dom.header.classList.add('hidden');
            this.navigate('auth');
        }
    },

    navigate(viewName) {
        this.currentView = viewName;

        // Update Nav UI
        this.dom.navBtns.forEach(btn => {
            if (btn.dataset.view === viewName) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        // Switch View
        this.dom.views.forEach(view => {
            if (view.id === `view-${viewName}`) view.classList.remove('hidden');
            else view.classList.add('hidden');
        });

        // Load View Data
        if (viewName === 'dashboard') Dashboard.init();
        if (viewName === 'candidates') Candidates.init();
        if (viewName === 'admin') Admin.init();
    },

    showToast(msg, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = msg;
        toast.style.cssText = `
            background: ${type === 'error' ? '#ef4444' : '#10b981'};
            color: white; padding: 1rem; margin-top: 10px; border-radius: 8px;
            animation: fadeIn 0.3s;
        `;
        this.dom.toast.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
};

// --- SUB-CONTROLLERS ---

const Dashboard = {
    chart: null,

    init() {
        this.update();
    },

    update() {
        const data = db.getResults();

        document.getElementById('total-votes-count').textContent = data.totalVotes;

        // Status Update
        const user = db.getCurrentUser();
        const statusEl = document.getElementById('user-vote-status');
        if (user.hasVoted) {
            statusEl.textContent = 'Voted ✓';
            statusEl.style.color = '#10b981';
        } else {
            statusEl.textContent = 'Not Voted';
            statusEl.style.color = '#ef4444';
        }

        // Ledger Feed
        const feed = document.getElementById('ledger-feed');
        if (data.voteLog.length === 0) {
            feed.innerHTML = '<div class="feed-item">No votes recorded yet.</div>';
        } else {
            feed.innerHTML = data.voteLog.map(v => `
                <div class="feed-item">
                    <i class="fa-solid fa-block-brick"></i> New Block: <span style="font-family:monospace">${v.hash.substring(0, 15)}...</span>
                </div>
            `).join('');
        }

        this.renderChart(data);
    },

    renderChart(data) {
        const ctx = document.getElementById('results-chart').getContext('2d');
        const labels = data.results.map(c => c.name);
        const votes = data.results.map(c => c.voteCount);

        if (this.chart) this.chart.destroy();

        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Votes',
                    data: votes,
                    backgroundColor: ['#4f46e5', '#ec4899', '#10b981', '#f59e0b'],
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }
};

const Candidates = {
    init() {
        const list = db.getCandidates();
        const container = document.getElementById('candidates-grid');

        container.innerHTML = list.map(c => `
            <div class="candidate-card" onclick="Candidates.openModal('${c.id}')">
                <img src="${c.image}" class="card-img-top" alt="${c.name}">
                <span class="party-badge">${c.party}</span>
                <div class="card-body">
                    <h3>${c.name}</h3>
                    <p style="color:var(--text-secondary); margin-top:0.5rem; font-size:0.9rem">
                        ${c.bio.substring(0, 80)}...
                    </p>
                    <button class="secondary-btn full-width" style="margin-top:1rem">View Manifesto</button>
                </div>
            </div>
        `).join('');
    },

    openModal(id) {
        const c = db.getCandidates().find(cand => cand.id === id);
        const modal = document.getElementById('candidate-modal');
        const user = db.getCurrentUser();

        document.getElementById('modal-name').textContent = c.name;
        document.getElementById('modal-party').textContent = c.party;
        document.getElementById('modal-bio').textContent = c.bio;
        document.getElementById('modal-img').src = c.image;
        document.getElementById('modal-policies').innerHTML = c.policies.map(p => `<li>${p}</li>`).join('');

        const voteBtn = document.getElementById('confirm-vote-btn');
        const encVisual = document.getElementById('encryption-visualizer');

        // Reset Modal State
        encVisual.classList.add('hidden');
        if (user.hasVoted) {
            voteBtn.disabled = true;
            voteBtn.textContent = 'Current Status: Voted';
            voteBtn.style.background = '#333';
        } else {
            voteBtn.disabled = false;
            voteBtn.textContent = 'Vote For This Candidate';
            voteBtn.style.background = 'var(--brand-color)';

            // Vote Action
            voteBtn.onclick = () => {
                voteBtn.disabled = true;
                encVisual.classList.remove('hidden');

                // Simulate Encryption Delay
                setTimeout(() => {
                    try {
                        db.castVote(user.id, c.id);
                        App.showToast('Vote Encrypted & Submitted Successfully!', 'success');
                        modal.classList.add('hidden');
                        Candidates.init(); // Refresh UI
                    } catch (err) {
                        App.showToast(err.message, 'error');
                    }
                }, 1500);
            };
        }

        modal.classList.remove('hidden');
        modal.querySelector('.close-modal').onclick = () => modal.classList.add('hidden');
    }
};

const Admin = {
    init() {
        const users = db.getUsers();
        // Allow access only to admin
        if (db.getCurrentUser().role !== 'admin') {
            App.navigate('dashboard');
            return;
        }

        this.renderTable();

        // Bind Actions
        document.getElementById('add-candidate-btn').onclick = () => {
            document.getElementById('add-candidate-modal').classList.remove('hidden');
        };

        const addForm = document.getElementById('add-candidate-form');
        // Remove old listeners to avoid dupes (simple way)
        const newForm = addForm.cloneNode(true);
        addForm.parentNode.replaceChild(newForm, addForm);

        newForm.addEventListener('submit', (e) => {
            e.preventDefault();
            db.addCandidate({
                name: document.getElementById('new-cand-name').value,
                party: document.getElementById('new-cand-party').value,
                bio: 'New candidate profile.',
                policies: ['Policy A', 'Policy B'],
                image: 'https://ui-avatars.com/api/?background=random&color=fff&name=' + document.getElementById('new-cand-name').value
            });
            document.getElementById('add-candidate-modal').classList.add('hidden');
            this.renderTable();
            App.showToast('Candidate Added', 'success');
        });

        document.getElementById('reset-election-btn').onclick = () => {
            if (confirm('Are you sure? This will wipe all votes.')) {
                db.resetElection();
                App.showToast('Election Reset', 'info');
                this.renderTable();
            }
        };

        // Close modal logic
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.modal').classList.add('hidden');
            });
        });
    },

    renderTable() {
        const results = db.getResults().results;
        const tbody = document.getElementById('admin-candidates-table');
        tbody.innerHTML = results.map(r => `
            <tr>
                <td>${r.name}</td>
                <td>${r.party}</td>
                <td>${r.voteCount}</td>
                <td>
                    <button class="icon-btn" style="color:#ef4444" title="Remove (Mock)"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
    }
};

// Start
document.addEventListener('DOMContentLoaded', () => App.init());
