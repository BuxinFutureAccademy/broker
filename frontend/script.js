(() => {
  const API_BASE = 'https://broker-961c.onrender.com/api';
  const read = key => { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  let listings = [];
  const places = { items: [], food: [], services: [] };
  const rails = {
    houses: document.querySelector('#homeProperties'),
    items: document.querySelector('#homeItems'),
    food: document.querySelector('#homeFood'),
    services: document.querySelector('#homeServices')
  };
  const covers = {
    items: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=700&q=70',
    food: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=700&q=70',
    services: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=700&q=70'
  };
  const card = item => `<article class="property-card detail-link" data-property-id="${esc(item.id)}" data-kind="Home" tabindex="0" role="link"><div class="photo"><img src="${esc(item.photos?.[0] || 'https://images.unsplash.com/photo-1615874694520-474822394e73?auto=format&fit=crop&w=700&q=75')}" alt="${esc(item.title)}"><button class="heart" type="button" aria-label="Save property">♥</button></div><div class="property-info"><h3>${esc(item.title)}</h3><p>${esc(item.sector || 'Greater Noida')} · ${esc(item.type || 'Room')}</p><div class="price">₹${Number(item.rent).toLocaleString('en-IN')} <small>/ month</small></div></div></article>`;
  const placeCard = (row, kind) => `<article class="property-card detail-link" data-business-id="${esc(row.id)}" data-kind="${esc(kind)}" tabindex="0" role="link"><div class="photo"><img src="${esc(row.imageUrl || row.logoUrl || covers[kind])}" alt="${esc(row.name)}"><button class="heart" type="button" aria-label="Save">♥</button></div><div class="property-info"><h3>${esc(row.name)}</h3><p>${esc(row.area || row.category || 'Greater Noida')}</p><div class="price">${row.fromPrice == null ? '' : `From ₹${Number(row.fromPrice).toLocaleString('en-IN')}`}</div></div></article>`;
  const paint = (name, html, empty) => {
    const rail = rails[name];
    if (!rail) return;
    rail.innerHTML = html || `<div class="empty-state">${empty}</div>`;
  };
  const queryText = () => (document.querySelector('[name="q"]')?.value || '').trim().toLowerCase();
  const areaText = () => {
    const sector = document.querySelector('[name="sector"]')?.value || '';
    return /any sector/i.test(sector) ? '' : sector.toLowerCase();
  };
  const rentOk = amount => {
    const band = document.querySelector('[name="rent"]')?.value || '';
    const value = Number(amount || 0);
    if (band === 'low') return value < 5000;
    if (band === 'mid') return value >= 5000 && value <= 12000;
    if (band === 'high') return value > 12000;
    return true;
  };
  const showHouses = () => {
    const q = queryText();
    const area = areaText();
    const typeInput = document.querySelector('[name="type"]')?.value || '';
    const typeQuery = !typeInput || typeInput === 'Any Type' ? '' : typeInput.toLowerCase();
    const rows = listings.filter(item => (!area || (item.sector || '').toLowerCase() === area) && (!typeQuery || (item.type || '').toLowerCase().includes(typeQuery)) && rentOk(item.rent) && (!q || `${item.title} ${item.sector || ''} ${item.type || ''}`.toLowerCase().includes(q)));
    paint('houses', rows.map(card).join(''), 'No homes in that Greater Noida sector yet.');
  };
  const showPlaces = name => {
    const q = queryText();
    const area = areaText();
    const rows = (places[name] || []).filter(row => {
      const place = `${row.area || ''} ${row.address || ''}`.toLowerCase();
      const blob = `${row.name || ''} ${row.category || ''} ${(row.itemNames || []).join(' ')} ${place}`;
      return (!area || place.includes(area)) && (!q || blob.includes(q));
    });
    const label = { items: 'shops', food: 'restaurants', services: 'services' }[name];
    paint(name, rows.map(row => placeCard(row, name)).join(''), `No ${label} match that search yet.`);
  };
  const showAll = () => { showHouses(); ['items', 'food', 'services'].forEach(showPlaces); };
  const kinds = { items: 'shop', food: 'restaurant', services: 'service' };
  fetch(`${API_BASE}/listings`).then(response => response.ok ? response.json() : []).then(items => { listings = Array.isArray(items) ? items : []; showHouses(); }).catch(() => showHouses());
  Object.entries(kinds).forEach(([name, kind]) => {
    fetch(`${API_BASE}/market/businesses?kind=${kind}`).then(response => response.ok ? response.json() : []).then(rows => { places[name] = Array.isArray(rows) ? rows : []; showPlaces(name); }).catch(() => showPlaces(name));
  });
  const pager = document.querySelector('#feedPager');
  const order = ['houses', 'items', 'food', 'services'];
  let feed = 'houses';
  const phone = () => window.matchMedia('(max-width: 899px)').matches;
  const applyFeed = (name, move) => {
    if (!order.includes(name)) return;
    feed = name;
    document.querySelectorAll('[data-feed]').forEach(button => button.classList.toggle('on', button.dataset.feed === name));
    document.querySelectorAll('[data-pane]').forEach(pane => pane.classList.toggle('is-on', pane.dataset.pane === name));
    ['type', 'rent'].forEach(field => { const label = document.querySelector(`[name="${field}"]`)?.closest('label'); if (label) label.hidden = name !== 'houses'; });
    const date = document.querySelector('.date-field');
    if (date) date.hidden = name !== 'houses';
    if (move && phone() && pager) pager.scrollTo({ left: order.indexOf(name) * pager.clientWidth, behavior: 'smooth' });
  };
  document.querySelectorAll('[data-feed]').forEach(button => button.addEventListener('click', () => {
    if (button.tagName === 'A') return;
    applyFeed(button.dataset.feed, true);
  }));
  let scrollTimer;
  pager?.addEventListener('scroll', () => {
    if (!phone()) return;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      const index = Math.round(pager.scrollLeft / Math.max(pager.clientWidth, 1));
      const name = order[index];
      if (name && name !== feed) applyFeed(name, false);
    }, 80);
  });
  const form = document.querySelector('#searchForm');
  form?.querySelector('[name="q"]')?.addEventListener('focus', () => { if (phone()) form.classList.add('filters-open'); });
  document.addEventListener('click', event => { if (form && !form.contains(event.target)) form.classList.remove('filters-open'); });
  form?.addEventListener('submit', event => {
    event.preventDefault();
    showAll();
    if (phone()) form.classList.remove('filters-open');
    pager?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  pager?.addEventListener('click', event => {
    const heart = event.target.closest('.heart');
    if (heart) { event.stopPropagation(); heart.classList.toggle('saved'); return; }
    const house = event.target.closest('[data-property-id]');
    if (house) location.href = `property.html?id=${encodeURIComponent(house.dataset.propertyId)}`;
    const place = event.target.closest('[data-business-id]');
    if (place) location.href = `business.html?id=${encodeURIComponent(place.dataset.businessId)}`;
  });
  const dial = value => String(value || '').replace(/[^\d+]/g, '');
  fetch(`${API_BASE}/payment`).then(response => response.ok ? response.json() : null).then(payment => {
    const link = document.querySelector('#siteContact');
    if (!link || !payment) return;
    const phone = payment.contactPhone || '';
    const email = payment.contactEmail || '';
    const name = payment.contactName || 'Admin';
    const note = link.querySelector('small');
    if (phone) {
      link.href = `tel:${dial(phone)}`;
      if (note) note.textContent = `${name} · ${phone}`;
      else link.textContent = `${name} · ${phone}`;
    } else if (email) {
      link.href = `mailto:${email}`;
      if (note) note.textContent = email;
      else link.textContent = email;
    }
    const wa = dial(phone).replace(/^\+/, '');
    const intro = 'Hello Ekvora, my name is ______. I am an international student looking for a room in Greater Noida. How can you help me?';
    const mailBody = 'Hello Ekvora,\n\nMy name is ______.\n\nI am an international student looking for a room in Greater Noida.\n\nHow can you help me?';
    document.querySelectorAll('[data-reach="wa"]').forEach(item => {
      if (!wa) return;
      item.hidden = false;
      item.href = `https://wa.me/${wa}?text=${encodeURIComponent(intro)}`;
      item.target = '_blank';
      item.rel = 'noopener';
    });
    document.querySelectorAll('[data-reach="mail"]').forEach(item => {
      if (!email) return;
      item.hidden = false;
      item.href = `mailto:${email}?subject=${encodeURIComponent('How can you help me?')}&body=${encodeURIComponent(mailBody)}`;
    });
  }).catch(() => {});
  document.querySelector('.login')?.addEventListener('click', () => { location.href = 'access.html'; });
  document.querySelector('.signup')?.addEventListener('click', () => { location.href = 'access.html?mode=owners'; });
})();
