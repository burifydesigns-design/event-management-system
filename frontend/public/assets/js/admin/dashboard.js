const API_BASE = 'http://localhost:5000/api';

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}
function getToken() { return localStorage.getItem('token'); }
function getUser() {
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}
function apiHeaders() {
  const token = getToken();
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function fetchJson(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, { headers: apiHeaders(), ...options });
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/admin/login.html';
    throw new Error('Your session has expired. Please sign in again.');
  }
  if (!res.ok) throw new Error('Request failed');
  return res.json();
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(Number(value) || 0);
}
function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString('en-KE', {
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

    document.getElementById('user-name').textContent = user.name || 'Administrator';
    document.getElementById('user-avatar').textContent = (user.name || 'A').charAt(0).toUpperCase();

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
        { id: 'stat-total-users', label: 'Total Users', value: Number(data.totalUsers) || 0, icon: '👥', color: 'primary' },
        { id: 'stat-total-events', label: 'Total Events', value: Number(data.totalEvents) || 0, icon: '📅', color: 'secondary' },
        { id: 'stat-total-regs', label: 'Total Registrations', value: Number(data.totalRegistrations) || 0, icon: '🎫', color: 'accent' },
        { id: 'stat-upcoming-events', label: 'Upcoming Events', value: Number(data.upcomingEvents) || 0, icon: '📆', color: 'success' },
        { id: 'stat-available-seats', label: 'Available Seats', value: Number(data.availableSeats) || 0, icon: '💺', color: 'warning' },
        { id: 'stat-checked-in', label: 'Checked-in Attendees', value: Number(data.checkedInAttendees) || 0, icon: '✅', color: 'primary' },
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
      container.innerHTML = events.map((e) => {
        const status = e.status === 'published' ? 'published' : 'draft';
        return `
          <div class="stat-card mb-2">
            <div class="stat-content">
              <div class="stat-value">${escapeHTML(e.title)}</div>
              <div class="stat-label">${escapeHTML(formatDate(e.date))} · ${escapeHTML(e.city)}</div>
            </div>
            <div class="badge ${status === 'published' ? 'badge-success' : 'badge-secondary'}">${status}</div>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error('Failed to load recent events:', err);
    }
  },

  async loadQuickStats() {
    // Additional quick stats for admin dashboard
  },
};

document.addEventListener('DOMContentLoaded', () => adminDashboard.init());