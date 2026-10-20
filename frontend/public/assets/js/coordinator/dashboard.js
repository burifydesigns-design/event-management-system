const API_BASE = 'http://localhost:5000/api';

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
    window.location.href = '/coordinator/login.html';
  }
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const coordinatorDashboard = {
  async init() {
    const user = getUser();
    if (!user || !['coordinator', 'organizer', 'admin'].includes(user.role)) {
      window.location.href = '/coordinator/login.html';
      return;
    }

    document.getElementById('user-name').textContent = user.name;
    document.getElementById('user-avatar').textContent = user.name.charAt(0).toUpperCase();

    await this.loadStats();
    await this.loadEvents();

    document.getElementById('btn-logout').addEventListener('click', () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/coordinator/login.html';
    });
  },

  async loadStats() {
    try {
      const [events, registrations] = await Promise.all([
        fetchJson('/events'),
        fetchJson('/registrations'),
      ]);
      const evts = events.events || [];
      const regs = registrations.registrations || registrations || [];

      const stats = [
        { id: 'stat-events', label: 'Events Managed', value: evts.length, icon: '📅', color: 'secondary' },
        { id: 'stat-total-regs', label: 'Total Registrations', value: regs.length, icon: '🎫', color: 'accent' },
        { id: 'stat-upcoming-events', label: 'Upcoming Events', value: evts.filter(e => new Date(e.date) >= new Date().setHours(0,0,0,0)).length, icon: '📆', color: 'success' },
        { id: 'stat-checked-in', label: 'Checked In', value: regs.filter(r => r.checkedIn).length, icon: '✅', color: 'primary' },
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
      console.error('Failed to load coordinator stats:', err);
    }
  },

  async loadEvents() {
    try {
      const data = await fetchJson('/events');
      const container = document.getElementById('events-list');
      if (!container) return;
      const events = (data.events || []).slice(0, 10);
      if (events.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📅</div><div class="empty-state-title">No events</div></div>';
        return;
      }
      container.innerHTML = events.map((e) => `
        <tr>
          <td>${e.title}</td>
          <td>${formatDate(e.date)}</td>
          <td>${e.city}</td>
          <td><span class="badge ${e.status === 'published' ? 'badge-success' : 'badge-secondary'}">${e.status}</span></td>
          <td class="table-actions">
            <a href="/coordinator/scan.html?event=${e._id}" class="table-link">Scan Tickets</a>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('Failed to load events:', err);
    }
  },
};

document.addEventListener('DOMContentLoaded', () => coordinatorDashboard.init());