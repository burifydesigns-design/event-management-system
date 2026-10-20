const API_BASE = 'http://localhost:5000/api';

function getToken() {
  return localStorage.getItem('token');
}

function getUser() {
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

function apiHeaders() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function fetchJson(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: apiHeaders(),
    ...options,
  });
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/admin/login.html';
  }
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

const adminDashboard = {
  async init() {
    const user = getUser();
    if (!user || user.role !== 'admin') {
      window.location.href = '/admin/login.html';
      return;
    }

    document.getElementById('user-name').textContent = user.name;
    document.getElementById('user-avatar').textContent = user.name.charAt(0).toUpperCase();

    await this.loadStats();
    await this.loadRecentEvents();
    await this.loadQuickStats();

    document.getElementById('btn-logout').addEventListener('click', () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/admin/login.html';
    });
  },

  async loadStats() {
    try {
      const data = await fetchJson('/admin/dashboard');
      const cards = [
        { id: 'stat-total-users', label: 'Total Users', value: data.totalUsers || 0, icon: '👥', color: 'primary' },
        { id: 'stat-total-events', label: 'Total Events', value: data.totalEvents || 0, icon: '📅', color: 'secondary' },
        { id: 'stat-total-regs', label: 'Total Registrations', value: data.totalRegistrations || 0, icon: '🎫', color: 'accent' },
        { id: 'stat-upcoming-events', label: 'Upcoming Events', value: data.upcomingEvents || 0, icon: '📆', color: 'success' },
        { id: 'stat-available-seats', label: 'Available Seats', value: data.availableSeats || 0, icon: '💺', color: 'warning' },
        { id: 'stat-checked-in', label: 'Checked-in Attendees', value: data.checkedInAttendees || 0, icon: '✅', color: 'primary' },
      ];
      cards.forEach((card) => {
        const el = document.getElementById(card.id);
        if (el) {
          el.querySelector('.stat-value').textContent = card.value;
          el.querySelector('.stat-icon').textContent = card.icon;
          el.querySelector('.stat-label').textContent = card.label;
          el.querySelector('.stat-icon').className = `stat-icon stat-card--${card.color}`;
        }
      });
    } catch (err) {
      console.error('Failed to load admin stats:', err);
    }
  },

  async loadRecentEvents() {
    try {
      const data = await fetchJson('/events');
      const container = document.getElementById('recent-events-list');
      if (!container) return;
      const events = (data.events || []).slice(0, 5);
      if (events.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📅</div><div class="empty-state-title">No events found</div></div>';
        return;
      }
      container.innerHTML = events.map((e) => `
        <div class="stat-card mb-2">
          <div class="stat-content">
            <div class="stat-value">${e.title}</div>
            <div class="stat-label">${formatDate(e.date)} · ${e.city}</div>
          </div>
          <div class="badge ${e.status === 'published' ? 'badge-success' : 'badge-secondary'}">${e.status}</div>
        </div>
      `).join('');
    } catch (err) {
      console.error('Failed to load recent events:', err);
    }
  },

  async loadQuickStats() {
    // Additional quick stats for admin dashboard
  },
};

document.addEventListener('DOMContentLoaded', () => adminDashboard.init());