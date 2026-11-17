const API_BASE = 'http://localhost:5000/api';

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}
function getToken() { return localStorage.getItem('token'); }
function getUser() { const raw = localStorage.getItem('user'); return raw ? JSON.parse(raw) : null; }
function apiHeaders() {
  const token = getToken();
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function fetchJson(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, { headers: apiHeaders(), ...options });
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/organizer/login.html';
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
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' });
}

const organizerDashboard = {
  async init() {
    const user = getUser();
    if (!user || !['organizer', 'admin'].includes(user.role)) {
      window.location.href = '/organizer/login.html';
      return;
    }

    document.getElementById('user-name').textContent = user.name || 'Organizer';
    document.getElementById('user-avatar').textContent = (user.name || 'O').charAt(0).toUpperCase();

    await this.loadStats();
    await this.loadEvents();
    await this.loadSalesReport();

    document.getElementById('btn-logout').addEventListener('click', () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/organizer/login.html';
    });
  },

  async loadStats() {
    try {
      const data = await fetchJson('/events');
      const user = getUser();
      const events = (data.events || []).filter(e => String(e.organizer) === String(user?._id) || user?.role === 'admin');

      const totalEvents = events.length;
      const upcomingEvents = events.filter(e => new Date(e.date) >= new Date().setHours(0,0,0,0)).length;
      const publishedEvents = events.filter(e => e.status === 'published').length;
      const draftEvents = events.filter(e => e.status === 'draft').length;

      const stats = [
        { id: 'stat-total-events', label: 'Total Events', value: totalEvents, icon: '📅', color: 'secondary' },
        { id: 'stat-upcoming-events', label: 'Upcoming Events', value: upcomingEvents, icon: '📆', color: 'success' },
        { id: 'stat-published-events', label: 'Published Events', value: publishedEvents, icon: '🟢', color: 'primary' },
        { id: 'stat-draft-events', label: 'Draft Events', value: draftEvents, icon: '📝', color: 'warning' },
      ];
      stats.forEach((s) => {
        const el = document.getElementById(s.id);
        if (el) {
          el.querySelector('.stat-value').textContent = s.value;
          el.querySelector('.stat-icon').textContent = s.icon;
          el.querySelector('.stat-label').textContent = s.label;
          el.querySelector('.stat-icon').className = `stat-icon stat-card--${s.color}`;
        }
      });
    } catch (err) {
      console.error('Failed to load organizer stats:', err);
    }
  },

  async loadEvents() {
    try {
      const data = await fetchJson('/events');
      const user = getUser();
      const events = (data.events || []).filter(e => String(e.organizer) === String(user?._id) || user?.role === 'admin').slice(0, 10);
      const container = document.getElementById('events-list');
      if (!container) return;
      if (events.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📅</div><div class="empty-state-title">No events</div></div>';
        return;
      }
      container.innerHTML = events.map((e) => {
        const id = encodeURIComponent(String(e._id || ''));
        const status = e.status === 'published' ? 'published' : 'draft';
        return `
          <tr>
            <td>${escapeHTML(e.title)}</td>
            <td>${escapeHTML(formatDate(e.date))}</td>
            <td>${escapeHTML(e.city)}</td>
            <td><span class="badge ${status === 'published' ? 'badge-success' : 'badge-secondary'}">${status}</span></td>
            <td class="table-actions">
              <a href="/organizer/sales-report.html?event=${id}" class="table-link">Sales Report</a>
              <a href="/coordinator/scan.html?event=${id}" class="table-link">Scan</a>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Failed to load organizer events:', err);
    }
  },

  async loadSalesReport() {
    try {
      const container = document.getElementById('sales-report-list');
      if (!container) return;
      container.innerHTML = '<div class="loading"><div class="loading-spinner"></div><div class="loading-text">Loading sales data...</div></div>';
      const data = await fetchJson('/reports/event');
      container.innerHTML = `
        <div class="stat-card mb-3">
          <div class="stat-content">
            <div class="stat-value">${Number(data.ticketsSold) || 0}</div>
            <div class="stat-label">Tickets Sold</div>
          </div>
          <div class="stat-icon">🎫</div>
        </div>
        <div class="stat-card mb-3">
          <div class="stat-content">
            <div class="stat-value">${Number(data.ticketsScanned) || 0}</div>
            <div class="stat-label">Tickets Scanned</div>
          </div>
          <div class="stat-icon">✅</div>
        </div>
      `;
    } catch (err) {
      console.error('Failed to load organizer sales report:', err);
      const container = document.getElementById('sales-report-list');
      if (container) container.innerHTML = '<div class="alert alert-error">Unable to load sales report.</div>';
    }
  },
};

document.addEventListener('DOMContentLoaded', () => organizerDashboard.init());