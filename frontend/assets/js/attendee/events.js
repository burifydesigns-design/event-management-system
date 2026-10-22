// Browse/search events and show event cards.
const state = {
  page: 1,
  limit: 12,
  search: '',
  category: '',
  price: '',
};

const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const priceFilter = document.getElementById('priceFilter');
const applyFiltersBtn = document.getElementById('applyFilters');
const eventsContainer = document.getElementById('eventsContainer');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const pageInfo = document.getElementById('pageInfo');

function formatDate(dateString) {
  const d = new Date(dateString);
  return d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

function renderEvents(events) {
  eventsContainer.innerHTML = '';
  if (!events || events.length === 0) {
    eventsContainer.innerHTML = '<p class="empty">No events found.</p>';
    return;
  }
  for (const event of events) {
    const card = document.createElement('article');
    card.className = 'event-card';
    const imageUrl = event.image ? event.image : '';
    card.innerHTML = `
      ${imageUrl ? `<img src="${imageUrl}" alt="${event.title}" class="event-card-image">` : ''}
      <div class="event-card-body">
        <span class="event-card-category">${event.category || 'Other'}</span>
        <h2 class="event-card-title">${event.title}</h2>
        <p class="event-card-meta">
          <span>📅 ${formatDate(event.date)}</span>
          <span>🕒 ${event.time || ''}</span>
          <span>📍 ${event.location}, ${event.city}</span>
        </p>
        <p class="event-card-price">${event.price === 0 ? 'Free' : '$' + event.price}</p>
        <a href="event-details.html?id=${event._id}" class="btn btn-primary">View Details</a>
      </div>
    `;
    eventsContainer.appendChild(card);
  }
}

function renderPagination(page, totalPages, totalEvents) {
  pageInfo.textContent = `Page ${page} of ${totalEvents > 0 ? totalPages : 1}`;
  prevPageBtn.disabled = page <= 1;
  nextPageBtn.disabled = page >= totalPages || totalEvents === 0;
}

async function loadEvents() {
  eventsContainer.innerHTML = '<p class="loading">Loading events...</p>';
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
  } catch (err) {
    eventsContainer.innerHTML = `<p class="error">Failed to load events: ${err.message}</p>`;
  }
}

searchInput.addEventListener('input', (e) => {
  state.search = e.target.value.trim();
  state.page = 1;
});

categoryFilter.addEventListener('change', (e) => {
  state.category = e.target.value;
  state.page = 1;
});

priceFilter.addEventListener('change', (e) => {
  state.price = e.target.value;
  state.page = 1;
});

applyFiltersBtn.addEventListener('click', () => {
  loadEvents();
});

prevPageBtn.addEventListener('click', () => {
  if (state.page > 1) {
    state.page--;
    loadEvents();
  }
});

nextPageBtn.addEventListener('click', () => {
  state.page++;
  loadEvents();
});

loadEvents();
