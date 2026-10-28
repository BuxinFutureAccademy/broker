(() => {
  const API_BASE = 'https://broker-961c.onrender.com/api';
  const read = key => { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  let listings = read('studentstay.listings');
  const grid = document.querySelector('.property-grid');
  const card = item => `<article class="property-card detail-link" data-property-id="${esc(item.id)}" tabindex="0" role="link"><div class="photo"><img src="${esc(item.photos?.[0] || 'https://images.unsplash.com/photo-1615874694520-474822394e73?auto=format&fit=crop&w=700&q=75')}" alt="${esc(item.title)}"><span class="tag blue">${esc(item.type)}</span><button class="heart" aria-label="Save property">♥</button></div><div class="property-info"><h3>${esc(item.title)}</h3><p>⌖ ${esc(item.address || item.city)}</p><div class="price">₹${Number(item.rent).toLocaleString('en-IN')} <small>/ month</small></div><div class="amenities"><span>${esc(item.ownerName || 'StudentStay')}</span><span>${esc(item.available || 'Available')}</span></div></div></article>`;
  const bindHearts = () => grid?.querySelectorAll('.heart').forEach(button => button.addEventListener('click', event => { event.stopPropagation(); const saved = button.classList.toggle('saved'); button.setAttribute('aria-pressed', String(saved)); }));
  let displayed = listings;
  const paint = items => { if (!grid) return; grid.innerHTML = items.map(card).join(''); bindHearts(); };
  if (grid && listings.length) paint(listings);
  fetch(`${API_BASE}/listings`).then(response => response.ok ? response.json() : []).then(items => {
    if (!Array.isArray(items) || !items.length) return;
    listings = items;
    displayed = items;
    paint(items);
  }).catch(() => {});
  const filterCards = () => {
    if (!grid || !listings.length) return;
    const cityInput = document.querySelector('.city-field select').value;
    const typeInput = document.querySelectorAll('.search-field select')[1].value;
    const cityQuery = /^(e\.g\.|any)/i.test(cityInput) ? '' : cityInput.toLowerCase();
    const typeQuery = typeInput === 'Any Type' ? '' : typeInput.toLowerCase();
    displayed = listings.filter(item => (!cityQuery || `${item.city || ''} ${item.address || ''}`.toLowerCase().includes(cityQuery)) && (!typeQuery || item.type.toLowerCase().includes(typeQuery)));
    grid.innerHTML = displayed.length ? displayed.map(card).join('') : '<div class="empty-state">No rooms match those filters yet. Try another city or property type.</div>';
    bindHearts();
  };
  const form = document.querySelector('#searchForm');
  form?.addEventListener('submit', event => { event.preventDefault(); filterCards(); document.querySelector('#properties').scrollIntoView({ behavior: 'smooth' }); });
  document.querySelectorAll('.heart').forEach(button => button.addEventListener('click', event => { event.stopPropagation(); const saved = button.classList.toggle('saved'); button.setAttribute('aria-pressed', String(saved)); }));
  grid?.addEventListener('click', event => { const tile = event.target.closest('[data-property-id]'); if (tile && !event.target.closest('.heart')) location.href = `property.html?id=${encodeURIComponent(tile.dataset.propertyId)}`; });
  grid?.addEventListener('keydown', event => { const tile = event.target.closest('[data-property-id]'); if (tile && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); location.href = `property.html?id=${encodeURIComponent(tile.dataset.propertyId)}`; } });
  const menu = document.querySelector('.menu');
  menu?.addEventListener('click', () => { const nav = document.querySelector('.nav'); const open = nav.classList.toggle('nav-open'); nav.setAttribute('aria-hidden', String(!open)); });
  document.querySelector('.login')?.addEventListener('click', () => { location.href = 'access.html'; });
  document.querySelector('.signup')?.addEventListener('click', () => { location.href = 'access.html?mode=signup'; });
})();
