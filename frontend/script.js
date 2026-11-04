(() => {
  const API_BASE = 'https://broker-961c.onrender.com/api';
  const read = key => { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  let listings = [];
  let displayed = [];
  const grid = document.querySelector('#homeProperties') || document.querySelector('.property-grid');
  const card = item => `<article class="property-card detail-link" data-property-id="${esc(item.id)}" tabindex="0" role="link"><div class="photo"><img src="${esc(item.photos?.[0] || 'https://images.unsplash.com/photo-1615874694520-474822394e73?auto=format&fit=crop&w=700&q=75')}" alt="${esc(item.title)}"><button class="heart" type="button" aria-label="Save property">♥</button></div><div class="property-info"><h3>${esc(item.title)}</h3><p>${esc(item.sector || 'Greater Noida')} · ${esc(item.type || 'Room')}</p><p>⌖ Greater Noida</p><div class="price">₹${Number(item.rent).toLocaleString('en-IN')} <small>/ month</small></div></div></article>`;
  const bindHearts = () => grid?.querySelectorAll('.heart').forEach(button => button.addEventListener('click', event => { event.stopPropagation(); const saved = button.classList.toggle('saved'); button.setAttribute('aria-pressed', String(saved)); }));
  const paint = items => {
    if (!grid) return;
    grid.innerHTML = items.length ? items.map(card).join('') : '<div class="empty-state">No homes posted in Greater Noida yet.</div>';
    bindHearts();
  };
  fetch(`${API_BASE}/listings`).then(response => response.ok ? response.json() : []).then(items => {
    listings = Array.isArray(items) ? items : [];
    displayed = listings;
    paint(listings);
  }).catch(() => paint([]));
  const rentOk = amount => {
    const band = document.querySelector('[name="rent"]')?.value || '';
    const value = Number(amount || 0);
    if (band === 'low') return value < 5000;
    if (band === 'mid') return value >= 5000 && value <= 12000;
    if (band === 'high') return value > 12000;
    return true;
  };
  let hub = 'houses';
  const pages = { houses: 'properties.html', items: 'shop.html', food: 'food.html', services: 'service.html' };
  document.querySelectorAll('[data-hub]').forEach(button => button.addEventListener('click', event => {
    const page = pages[button.dataset.hub];
    if (!page) return;
    event.preventDefault();
    const q = (document.querySelector('[name="q"]')?.value || '').trim();
    const sector = document.querySelector('[name="sector"]')?.value || '';
    const area = /any sector/i.test(sector) ? '' : sector;
    const params = new URLSearchParams();
    if (button.dataset.hub === 'houses') {
      if (q || area) params.set('city', q || area);
    } else {
      if (q) params.set('q', q);
      if (area) params.set('area', area);
    }
    location.href = params.toString() ? `${page}?${params}` : page;
  }));
  const filterCards = () => {
    if (!grid) return;
    const sectorInput = document.querySelector('[name="sector"]')?.value || '';
    const typeInput = document.querySelector('[name="type"]')?.value || '';
    const q = (document.querySelector('[name="q"]')?.value || '').trim().toLowerCase();
    const sectorQuery = /any sector/i.test(sectorInput) ? '' : sectorInput.toLowerCase();
    const typeQuery = !typeInput || typeInput === 'Any Type' ? '' : typeInput.toLowerCase();
    displayed = listings.filter(item => (!sectorQuery || (item.sector || '').toLowerCase() === sectorQuery) && (!typeQuery || (item.type || '').toLowerCase().includes(typeQuery)) && rentOk(item.rent) && (!q || `${item.title} ${item.sector || ''} ${item.type || ''}`.toLowerCase().includes(q)));
    grid.innerHTML = displayed.length ? displayed.map(card).join('') : '<div class="empty-state">No homes in that Greater Noida sector yet.</div>';
    bindHearts();
  };
  const form = document.querySelector('#searchForm');
  form?.addEventListener('submit', event => {
    event.preventDefault();
    const q = form.elements.q?.value.trim() || '';
    const sector = form.elements.sector?.value || '';
    const area = /any sector/i.test(sector) ? '' : sector;
    const pages = { items: 'shop.html', food: 'food.html', services: 'service.html' };
    if (pages[hub]) {
      location.href = `${pages[hub]}?q=${encodeURIComponent(q)}&area=${encodeURIComponent(area)}`;
      return;
    }
    filterCards();
    document.querySelector('#properties')?.scrollIntoView({ behavior: 'smooth' });
  });
  document.querySelectorAll('.heart').forEach(button => button.addEventListener('click', event => { event.stopPropagation(); const saved = button.classList.toggle('saved'); button.setAttribute('aria-pressed', String(saved)); }));
  grid?.addEventListener('click', event => { const tile = event.target.closest('[data-property-id]'); if (tile && !event.target.closest('.heart')) location.href = `property.html?id=${encodeURIComponent(tile.dataset.propertyId)}`; });
  grid?.addEventListener('keydown', event => { const tile = event.target.closest('[data-property-id]'); if (tile && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); location.href = `property.html?id=${encodeURIComponent(tile.dataset.propertyId)}`; } });
  const dial = value => String(value || '').replace(/[^\d+]/g, '');
  fetch(`${API_BASE}/payment`).then(response => response.ok ? response.json() : null).then(payment => {
    const link = document.querySelector('#siteContact');
    if (!link || !payment) return;
    const phone = payment.contactPhone || '';
    const email = payment.contactEmail || '';
    const name = payment.contactName || 'Admin';
    if (phone) {
      link.href = `tel:${dial(phone)}`;
      link.textContent = `${name} · ${phone}`;
    } else if (email) {
      link.href = `mailto:${email}`;
      link.textContent = email;
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
