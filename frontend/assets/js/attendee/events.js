// Browse/search events and show event cards.
const state = { page: 1, limit: 12, search: '', category: '', price: '' };

const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const priceFilter = document.getElementById('priceFilter');
const applyFiltersBtn = document.getElementById('applyFilters');
const eventsContainer = document.getElementById('eventsContainer');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const pageInfo = document.getElementById('pageInfo');

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}
function safeImageURL(value) {
  if (!value) return '';
  try {
    const url = new URL(String(value), window.location.origin);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}
function formatDate(dateString) {
  const date = new Date(dateString);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString(undefined, {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
  });
}

function renderEvents(events) {
  eventsContainer.replaceChildren();
  if (!events || events.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'No events found.';
    eventsContainer.appendChild(empty);
    return;
  }

  for (const event of events) {
    const card = document.createElement('article');
    card.className = 'event-card';
    const imageUrl = safeImageURL(event.image);
    if (imageUrl) {
      const image = document.createElement('img');
      image.src = imageUrl;
      image.alt = String(event.title || 'Event').slice(0, 160);
      image.className = 'event-card-image';
      image.loading = 'lazy';
      image.referrerPolicy = 'no-referrer';
      card.appendChild(image);
    }

    const body = document.createElement('div');
    body.className = 'event-card-body';
    const category = document.createElement('span');
    category.className = 'event-card-category';
    category.textContent = event.category || 'Other';
    const title = document.createElement('h2');
    title.className = 'event-card-title';
    title.textContent = event.title || 'Untitled event';
    const meta = document.createElement('p');
    meta.className = 'event-card-meta';
    const date = document.createElement('span');
    date.textContent = `📅 ${formatDate(event.date)}`;
    const time = document.createElement('span');
    time.textContent = `🕒 ${event.time || ''}`;
    const location = document.createElement('span');
    location.textContent = `📍 ${event.location || ''}, ${event.city || ''}`;
    meta.append(date, time, location);
    const price = document.createElement('p');
    price.className = 'event-card-price';
    const amount = Number(event.price);
    price.textContent = amount === 0 ? 'Free' : Number.isFinite(amount) ? new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount) : 'Price unavailable';
    const link = document.createElement('a');
    link.href = `event-details.html?id=${encodeURIComponent(String(event._id || ''))}`;
    link.className = 'btn btn-primary';
    link.textContent = 'View Details';
    body.append(category, title, meta, price, link);
    card.appendChild(body);
    eventsContainer.appendChild(card);
  }
}

function renderPagination(page, totalPages, totalEvents) {
  pageInfo.textContent = `Page ${page} of ${totalEvents > 0 ? totalPages : 1}`;
  prevPageBtn.disabled = page <= 1;
  nextPageBtn.disabled = page >= totalPages || totalEvents === 0;
}

async function loadEvents() {
  const loading = document.createElement('p');
  loading.className = 'loading';
  loading.textContent = 'Loading events...';
  eventsContainer.replaceChildren(loading);
  const params = new URLSearchParams();
  params.set('page', state.page);
  params.set('limit', state.limit);
  if (state.search) params.set('search', state.search);
  if (state.category) params.set('category', state.category);
  if (state.price) params.set('price', state.price);

  try {
    const data = await apiRequest(`/events?${params.toString()}`, { auth: false });
    renderEvents(data.events || []);
    renderPagination(state.page, data.totalPages || 1, data.totalEvents || 0);
  } catch {
    const error = document.createElement('p');
    error.className = 'error';
    error.textContent = 'Failed to load events. Please try again.';
    eventsContainer.replaceChildren(error);
  }
}

searchInput.addEventListener('input', (event) => {
  state.search = event.target.value.trim();
  state.page = 1;
});
categoryFilter.addEventListener('change', (event) => {
  state.category = event.target.value;
  state.page = 1;
});
priceFilter.addEventListener('change', (event) => {
  state.price = event.target.value;
  state.page = 1;
});
applyFiltersBtn.addEventListener('click', loadEvents);
prevPageBtn.addEventListener('click', () => {
  if (state.page > 1) { state.page--; loadEvents(); }
});
nextPageBtn.addEventListener('click', () => {
  state.page++;
  loadEvents();
});

loadEvents();