(() => {
  const API_BASE = 'https://broker-961c.onrender.com/api';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const money = value => `₹${Number(value || 0).toLocaleString('en-IN')}`;
  const token = () => localStorage.getItem('studentstay_token');
  const user = () => { try { return JSON.parse(localStorage.getItem('studentstay_user') || 'null'); } catch { return null; } };
  const photo = value => value || 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=800&q=80';
  const pools = {
    restaurant: { home: 'food.html', list: 'restaurants.html', name: 'Restaurants', tag: 'Food in Greater Noida' },
    shop: { home: 'shop.html', list: 'shops.html', name: 'Shops', tag: 'Shops in Greater Noida' },
    service: { home: 'service.html', list: 'services.html', name: 'Services', tag: 'Services in Greater Noida' }
  };
  const stayIn = kind => {
    const pool = pools[kind];
    if (!pool) return;
    try { localStorage.setItem('studentstay_pool', pool.home); } catch { /* ignore */ }
    const brand = document.querySelector('.brand');
    if (brand) {
      brand.setAttribute('href', pool.home);
      const small = brand.querySelector('small');
      if (small) small.textContent = pool.tag;
    }
    document.querySelectorAll('.nav a').forEach(link => link.classList.toggle('active', link.getAttribute('href') === pool.home));
    document.querySelectorAll('.phone-nav a').forEach(link => {
      const label = link.querySelector('span')?.textContent || '';
      if (label === 'You' || label === 'Sign in') return;
      link.classList.toggle('on', link.getAttribute('href') === pool.home);
    });
  };
  const dial = value => String(value || '').replace(/[^\d+]/g, '');
  const sectors = ['Alpha 1', 'Alpha 2', 'Beta 1', 'Beta 2', 'Gamma 1', 'Gamma 2', 'Delta 1', 'Delta 2', 'Knowledge Park 1', 'Knowledge Park 2', 'Knowledge Park 3', 'Pari Chowk', 'Omega 1', 'Chi', 'Phi', 'Swarn Nagari'];
  const covers = {
    restaurant: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=900&q=80',
    shop: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=80',
    service: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=900&q=80'
  };
  const fillSectors = select => {
    if (!select || select.dataset.ready === '1') return;
    const current = select.value;
    select.innerHTML = `<option value="">Any sector</option>${sectors.map(name => `<option>${esc(name)}</option>`).join('')}`;
    if ([...select.options].some(option => option.value === current || option.textContent === current)) select.value = current;
    select.dataset.ready = '1';
  };
  const placeCard = (row, kind) => {
    const count = Number(row.itemCount || 0);
    const unit = { restaurant: ['dish', 'dishes'], shop: ['product', 'products'], service: ['service', 'services'] }[kind] || ['item', 'items'];
    const listed = count === 1 ? `1 ${unit[0]}` : `${count} ${unit[1]}`;
    const price = row.fromPrice == null ? 'Price on request' : `From ${money(row.fromPrice)}`;
    const image = row.imageUrl || row.logoUrl || covers[kind] || covers.restaurant;
    return `<article class="property-card detail-link" data-business-id="${esc(row.id)}" tabindex="0" role="link"><div class="photo"><img src="${esc(image)}" alt="${esc(row.name)}"><span class="tag blue">${esc(row.category || (pools[kind] || {}).name || '')}</span><button class="heart" type="button" aria-label="Save">♥</button></div><div class="property-info"><h3>${esc(row.name)}</h3><p>⌖ ${esc(row.area || 'Greater Noida')}</p><div class="price">${price}</div><div class="amenities"><span>${esc(listed)}</span><span>Open</span></div></div></article>`;
  };
  const bindPlaces = box => {
    if (!box || box.dataset.bound === '1') return;
    box.dataset.bound = '1';
    const open = tile => {
      const item = tile.dataset.itemId ? `&item=${encodeURIComponent(tile.dataset.itemId)}` : '';
      location.href = `business.html?id=${encodeURIComponent(tile.dataset.businessId)}${item}`;
    };
    box.addEventListener('click', event => {
      const heart = event.target.closest('.heart');
      if (heart) { event.preventDefault(); event.stopPropagation(); heart.classList.toggle('saved'); return; }
      const tile = event.target.closest('[data-business-id]');
      if (tile) open(tile);
    });
    box.addEventListener('keydown', event => {
      const tile = event.target.closest('[data-business-id]');
      if (tile && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); open(tile); }
    });
  };
  const offerCard = (row, item) => {
    const image = item.photoUrl || row.imageUrl || row.logoUrl || covers.service;
    return `<article class="property-card detail-link" data-business-id="${esc(row.id)}" data-item-id="${esc(item.id)}" tabindex="0" role="link"><div class="photo"><img src="${esc(image)}" alt="${esc(item.name)}"><span class="tag blue">${esc(row.name)}</span></div><div class="property-info"><h3>${esc(item.name)}</h3><p>⌖ ${esc(row.area || 'Greater Noida')}</p><div class="price">${money(item.price)}</div><div class="amenities"><span>${esc(row.category || 'Service')}</span><span>Open</span></div></div></article>`;
  };
  const cardsFor = (rows, kind, area, query) => {
    const posted = rows.filter(row => Array.isArray(row.offers) ? row.offers.length > 0 : Number(row.itemCount) > 0);
    if (kind !== 'service') return posted.filter(row => matchesPlace(row, area, query)).map(row => placeCard(row, kind));
    const cards = [];
    const needle = String(query || '').trim().toLowerCase();
    posted.forEach(row => {
      const offers = Array.isArray(row.offers) ? row.offers : null;
      if (!offers) {
        if (matchesPlace(row, area, query)) cards.push(placeCard(row, kind));
        return;
      }
      const place = String(row.area || '').toLowerCase();
      if (area && !place.includes(area.toLowerCase())) return;
      offers.forEach(item => {
        const blob = `${item.name || ''} ${item.description || ''} ${row.name || ''} ${row.category || ''} ${row.area || ''}`.toLowerCase();
        if (needle && !blob.includes(needle)) return;
        cards.push(offerCard(row, item));
      });
    });
    return cards;
  };
  const matchesPlace = (row, area, query) => {
    const place = String(row.area || '').toLowerCase();
    if (area && !place.includes(area.toLowerCase())) return false;
    if (!query) return true;
    const names = Array.isArray(row.itemNames) ? row.itemNames.join(' ') : '';
    const blob = `${row.name || ''} ${row.category || ''} ${row.description || ''} ${row.area || ''} ${names}`.toLowerCase();
    return blob.includes(query.toLowerCase());
  };

  async function api(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    if (token()) headers.Authorization = `Bearer ${token()}`;
    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const text = await response.text();
    let payload = {};
    try { payload = text ? JSON.parse(text) : {}; } catch { payload = {}; }
    if (!response.ok) throw new Error(payload.error || 'Could not complete that. Please try again.');
    return payload;
  }

  const withServiceOffers = async (kind, rows) => {
    if (kind !== 'service' || rows.every(row => Array.isArray(row.offers))) return rows;
    return Promise.all(rows.map(async row => {
      if (Array.isArray(row.offers)) return row;
      try {
        const full = await api(`/market/businesses/${encodeURIComponent(row.id)}`);
        const offers = (full.items || []).filter(item => item.available !== false).map(item => ({
          id: item.id, name: item.name, description: item.description || '', price: item.price || 0, photoUrl: item.photoUrl || ''
        }));
        return { ...row, offers };
      } catch { return { ...row, offers: [] }; }
    }));
  };

  async function uploadFile(file) {
    const body = new FormData();
    body.append('file', file);
    const response = await fetch(`${API_BASE}/upload`, { method: 'POST', headers: token() ? { Authorization: `Bearer ${token()}` } : {}, body });
    const text = await response.text();
    let payload = {};
    try { payload = text ? JSON.parse(text) : {}; } catch { payload = {}; }
    if (!response.ok || !payload.url) throw new Error(payload.error || 'The photo could not be uploaded.');
    return payload.url;
  }

  const itemPhotos = item => {
    const list = Array.isArray(item?.photoUrls) ? item.photoUrls.filter(Boolean) : [];
    if (list.length) return list.slice(0, 5);
    return item?.photoUrl ? [item.photoUrl] : [];
  };

  const wholeNumber = value => {
    const text = String(value ?? '').trim();
    return /^\d+$/.test(text) ? text : '';
  };

  const keepDigits = field => {
    field.addEventListener('keydown', event => {
      if (['e', 'E', '+', '-', '.'].includes(event.key)) event.preventDefault();
    });
    field.addEventListener('input', () => {
      const next = field.value.replace(/\D/g, '');
      if (next !== field.value) field.value = next;
    });
  };

  const bindPhotos = (form, existing) => {
    const input = form.querySelector('[name="photos"]');
    const picks = form.querySelector('.photo-picks');
    if (!input || !picks) return;
    const chosen = (existing || []).slice(0, 5).map(url => ({ url }));
    const paintPicks = () => {
      picks.innerHTML = chosen.map((entry, index) => `<span class="photo-pick"><img alt="" src="${esc(entry.url || entry.preview)}"><button type="button" data-drop-photo="${index}" aria-label="Remove photo">×</button></span>`).join('');
    };
    paintPicks();
    input.addEventListener('change', () => {
      const files = [...input.files];
      input.value = '';
      let extra = false;
      files.forEach(file => {
        if (!String(file.type || '').startsWith('image/')) return;
        if (chosen.length >= 5) { extra = true; return; }
        chosen.push({ file, preview: URL.createObjectURL(file) });
      });
      if (extra) alert('You can add up to 5 photos.');
      paintPicks();
    });
    picks.addEventListener('click', event => {
      const button = event.target.closest('[data-drop-photo]');
      if (!button) return;
      const entry = chosen[Number(button.dataset.dropPhoto)];
      if (entry?.preview) URL.revokeObjectURL(entry.preview);
      chosen.splice(Number(button.dataset.dropPhoto), 1);
      paintPicks();
    });
    form._photoChoice = chosen;
    form._resetPhotos = () => {
      chosen.forEach(entry => { if (entry.preview) URL.revokeObjectURL(entry.preview); });
      chosen.splice(0, chosen.length);
      (existing || []).slice(0, 5).forEach(url => chosen.push({ url }));
      paintPicks();
    };
  };

  const collectPhotos = async form => {
    const chosen = (form._photoChoice || []).slice(0, 5);
    if (!chosen.length) {
      alert('Add at least one photo. You can add up to 5.');
      return null;
    }
    const urls = [];
    for (const entry of chosen) urls.push(entry.url || await uploadFile(entry.file));
    return urls;
  };

  const saveSession = payload => {
    localStorage.setItem('studentstay_token', payload.access_token);
    localStorage.setItem('studentstay_user', JSON.stringify(payload.user));
  };

  const contactLinks = (contact, reference, itemName) => {
    if (!contact) return '';
    const intro = `Hello, my name is ______. My Ekvora request is ${reference} for ${itemName}.`;
    const wa = dial(contact.whatsapp || contact.phone).replace(/^\+/, '');
    const parts = [];
    if (contact.phone) parts.push(`<a href="tel:${esc(dial(contact.phone))}">Call ${esc(contact.phone)}</a>`);
    if (wa) parts.push(`<a href="https://wa.me/${wa}?text=${encodeURIComponent(intro)}" target="_blank" rel="noopener">WhatsApp</a>`);
    if (contact.address) parts.push(`<span>${esc(contact.address)}</span>`);
    return parts.join('');
  };

  const listRoot = document.querySelector('[data-market-list]');
  if (listRoot) {
    const kind = listRoot.getAttribute('data-market-list');
    const box = document.querySelector('#marketList');
    const form = document.querySelector('#marketSearch');
    const empty = { restaurant: 'No restaurants in that sector yet.', shop: 'No shops in that sector yet.', service: 'No services in that sector yet.' }[kind] || 'Nothing is listed here yet.';
    fillSectors(form?.elements.area);
    const params = new URLSearchParams(location.search);
    if (form?.elements.q && params.get('q')) form.elements.q.value = params.get('q');
    if (form?.elements.area && params.get('area')) form.elements.area.value = params.get('area');
    let rows = [];
    const paint = () => {
      if (!box) return;
      const area = form?.elements.area?.value || '';
      const query = form?.elements.q?.value || '';
      const shown = cardsFor(rows, kind, area, query);
      box.innerHTML = shown.length ? shown.join('') : `<div class="empty-state">${empty}</div>`;
      bindPlaces(box);
    };
    form?.addEventListener('submit', event => { event.preventDefault(); paint(); });
    form?.elements.area?.addEventListener('change', paint);
    api(`/market/businesses?kind=${encodeURIComponent(kind)}`).then(items => withServiceOffers(kind, Array.isArray(items) ? items : [])).then(items => { rows = items; paint(); }).catch(error => { if (box) box.innerHTML = `<p class="market-note">${esc(error.message)}</p>`; });
  }

  const homeRoot = document.querySelector('[data-market-home]');
  if (homeRoot) {
    const kind = homeRoot.getAttribute('data-market-home');
    const box = document.querySelector('#homePlaces');
    const form = document.querySelector('#searchForm');
    const more = document.querySelector('#placeMore');
    const heading = document.querySelector('#placeHeading');
    const caption = document.querySelector('#placeCaption');
    const listPage = homeRoot.getAttribute('data-market-more') || '#';
    const interest = homeRoot.getAttribute('data-market-interest') || '';
    const titles = { restaurant: 'Restaurants', shop: 'Shops', service: 'Services' };
    const empty = { restaurant: 'No restaurants in that Greater Noida sector yet.', shop: 'No shops in that Greater Noida sector yet.', service: 'No services in that Greater Noida sector yet.' };
    fillSectors(form?.elements.area);
    let rows = [];
    const paint = () => {
      if (!box) return;
      const area = form?.elements.area?.value || '';
      const query = String(form?.elements.q?.value || '').trim();
      const shown = cardsFor(rows, kind, area, query);
      box.innerHTML = shown.length ? shown.join('') : `<div class="empty-state">${empty[kind] || 'Nothing in that sector yet.'}</div>`;
      bindPlaces(box);
      if (heading) heading.textContent = area ? `${titles[kind] || 'Places'} in ${area}` : (titles[kind] || 'Places');
      if (caption) caption.textContent = area ? `Showing ${area}.` : 'Every sector in Greater Noida.';
      if (more) more.href = area ? `${listPage}?area=${encodeURIComponent(area)}` : listPage;
    };
    form?.addEventListener('submit', event => {
      event.preventDefault();
      paint();
      document.querySelector('#properties')?.scrollIntoView({ behavior: 'smooth' });
    });
    form?.elements.area?.addEventListener('change', paint);
    if (!token()) {
      document.querySelector('.login')?.addEventListener('click', () => { location.href = interest ? `access.html?interest=${encodeURIComponent(interest)}` : 'access.html'; });
      document.querySelector('.signup')?.addEventListener('click', () => { location.href = 'access.html?mode=owners'; });
    }
    api(`/market/businesses?kind=${encodeURIComponent(kind)}`).then(items => withServiceOffers(kind, Array.isArray(items) ? items : [])).then(items => { rows = items; paint(); }).catch(error => { if (box) box.innerHTML = `<p class="market-note">${esc(error.message)}</p>`; });
  }

  const businessRoot = document.querySelector('[data-market-business]');
  if (businessRoot) {
    const id = new URLSearchParams(location.search).get('id');
    const box = document.querySelector('#businessDetails');
    const orderOpen = (order, kind) => order && order.kind === kind && (order.status === 'pending' || order.status === 'accepted' || (order.status === 'completed' && !order.customerConfirm));
    const orderStatusText = (order) => {
      const who = { restaurant: 'restaurant', shop: 'shop', service: 'service' }[order.kind] || 'place';
      if (order.status === 'pending') return `Waiting for the ${who} to accept ${order.itemName}.`;
      if (order.status === 'accepted') return `The ${who} accepted ${order.itemName}.`;
      if (order.status === 'completed') return `The ${who} marked ${order.itemName} received${order.finalAmount == null ? '' : ` for ${money(order.finalAmount)}`}. Confirm it before you order again.`;
      return order.status;
    };
    api(`/market/businesses/${encodeURIComponent(id || '')}`).then(row => {
      const pool = pools[row.kind] || {};
      const action = row.kind === 'service' ? 'Request service' : (row.kind === 'shop' ? 'Buy' : 'Order');
      const about = { restaurant: 'About this restaurant', shop: 'About this shop', service: 'About this service' }[row.kind] || 'About this place';
      const menu = { restaurant: 'Menu', shop: 'Products', service: 'Services' }[row.kind] || 'Items';
      const back = document.querySelector('#businessBack');
      if (back) {
        back.href = pool.list || pool.home || 'index.html';
        back.textContent = `← Back to ${(pool.name || 'places').toLowerCase()}`;
      }
      document.title = `${row.name} · Ekvora`;
      stayIn(row.kind);
      const items = row.items || [];
      const cover = row.imageUrl || row.logoUrl || covers[row.kind] || photo('');
      const photos = [...new Set([cover, ...items.flatMap(itemPhotos)])];
      const priced = items.filter(item => item.available !== false).map(item => Number(item.price || 0));
      const from = priced.length ? Math.min(...priced) : null;
      const thumbs = photos.map((src, index) => `<button class="${index === 0 ? 'active' : ''}" type="button" data-photo-index="${index}" aria-label="Show photo ${index + 1}"><img src="${esc(src)}" alt=""></button>`).join('');
      const lines = items.length ? items.map(item => {
        const blocked = !item.available || item.stock === 0;
        const note = [item.stock == null ? '' : `${item.stock} in stock`, item.available ? '' : 'Unavailable'].filter(Boolean).join(' · ');
        const shots = itemPhotos(item);
        const shot = shots[0] || covers[row.kind] || cover;
        const extra = shots.length > 1 ? `<div class="offer-thumbs">${shots.map((src, index) => `<button type="button" data-offer-photo="${index}" class="${index === 0 ? 'active' : ''}" aria-label="Photo ${index + 1}"><img alt="" src="${esc(src)}"></button>`).join('')}</div>` : '';
        return `<article class="menu-offer" data-offer="${esc(item.id)}"><span class="photo"><img class="offer-main" alt="" src="${esc(shot)}"></span><div><b>${esc(item.name)}</b>${extra}<p>${esc(item.description || '')}</p><div class="detail-price">${money(item.price)}${item.priceNote ? ` <small>${esc(item.priceNote)}</small>` : ''}</div>${note ? `<p class="detail-notice">${esc(note)}</p>` : ''}${blocked ? '' : `<button class="pay-now" type="button" data-buy="${esc(item.id)}">${action}</button>`}<div class="buy-result" data-result="${esc(item.id)}"></div></div></article>`;
      }).join('') : '<p class="detail-notice">Nothing is listed yet.</p>';
      box.innerHTML = `<div class="detail-layout"><section><div class="detail-gallery"><div class="photo"><img class="detail-main-image" id="mainPhoto" src="${esc(photos[0])}" alt="${esc(row.name)}"></div><div class="detail-thumbs">${thumbs}</div></div><section class="map-panel"><h2>${esc(menu)}</h2><p>${esc(row.area || 'Greater Noida')}</p><article class="menu-live" id="menuLive" hidden></article>${lines}</section></section><aside><section class="detail-content"><span class="detail-badge">${esc(row.category || pool.name || 'Place')}</span><h1>${esc(row.name)}</h1><p class="detail-location">⌖ ${esc(row.area || 'Greater Noida')}</p><div class="detail-price">${from == null ? 'Price on request' : `${money(from)} <small>from</small>`}</div><div class="detail-divider"></div><h2>${esc(about)}</h2><p class="detail-description">${esc(row.description || 'Open this place to see what is offered.')}</p>${row.hours ? `<p class="detail-notice">Hours: ${esc(row.hours)}</p>` : ''}</section><section class="pay-card"><small>${esc(String(pool.name || 'Place').toUpperCase())}</small><h2>${esc(action)}</h2><p>Choose something on the menu. The order stays there and updates while you wait. Confirm it before you order again.</p></section></aside></div>`;
      const mainPhoto = document.querySelector('#mainPhoto');
      const focusId = new URLSearchParams(location.search).get('item');
      const safeId = focusId ? (window.CSS?.escape ? CSS.escape(focusId) : focusId.replace(/[^a-zA-Z0-9-]/g, '')) : '';
      const focus = safeId ? box.querySelector(`[data-offer="${safeId}"]`) : null;
      if (focus) {
        focus.classList.add('offer-focus');
        focus.scrollIntoView({ block: 'center' });
      }
      box.querySelectorAll('[data-offer-photo]').forEach(button => button.addEventListener('click', () => {
        const offer = button.closest('.menu-offer');
        const item = items.find(entry => entry.id === offer?.dataset.offer);
        const src = itemPhotos(item)[Number(button.dataset.offerPhoto)];
        const image = offer?.querySelector('.offer-main');
        if (!src || !image) return;
        const frame = image.closest('.photo');
        frame?.classList.remove('ready');
        image.src = src;
        const show = () => frame?.classList.add('ready');
        if (image.complete) show();
        else image.addEventListener('load', show, { once: true });
        offer.querySelectorAll('[data-offer-photo]').forEach(other => other.classList.toggle('active', other === button));
      }));
      box.querySelectorAll('[data-photo-index]').forEach(button => button.addEventListener('click', () => {
        const src = photos[Number(button.dataset.photoIndex)];
        if (src && mainPhoto) {
          const frame = mainPhoto.closest('.photo');
          frame?.classList.remove('ready');
          mainPhoto.src = src;
          const show = () => frame?.classList.add('ready');
          if (mainPhoto.complete) show();
          else mainPhoto.addEventListener('load', show, { once: true });
        }
        box.querySelectorAll('[data-photo-index]').forEach(other => other.classList.toggle('active', other === button));
      }));
      const liveCard = () => document.querySelector('#menuLive');
      let liveStamp = '';
      const paintLive = order => {
        const card = liveCard();
        const open = orderOpen(order, row.kind) ? order : null;
        box.querySelectorAll('[data-buy]').forEach(button => { button.disabled = !!open; });
        const next = open ? `${open.id}|${open.status}|${open.finalAmount}|${open.customerConfirm}` : '';
        if (next === liveStamp) return;
        if (card && card.contains(document.activeElement)) return;
        liveStamp = next;
        if (!card) return;
        if (!open) { card.hidden = true; card.innerHTML = ''; return; }
        const here = open.businessId === row.id;
        const actions = open.status === 'completed'
          ? `<form class="menu-live-form" data-live-confirm="${esc(open.id)}"><label>Note<textarea name="note" rows="2" placeholder="Optional, unless you are sending a note"></textarea></label><button class="primary-button" name="result" value="completed" type="submit">I received it</button><button class="small-button" name="result" value="not_completed" type="submit">I did not receive it</button><button class="small-button" name="result" value="disputed" type="submit">Send a note</button></form>`
          : '';
        const elsewhere = here ? '' : `<p><a href="business.html?id=${encodeURIComponent(open.businessId)}&item=${encodeURIComponent(open.itemId || '')}">Open that menu</a></p>`;
        card.hidden = false;
        card.innerHTML = `<b>${esc(open.itemName)} · ${esc(open.reference)}</b><p>${esc(orderStatusText(open))}</p>${actions}${elsewhere}<div class="menu-live-contact">${contactLinks(open.contact, open.reference, open.itemName)}</div>`;
      };
      const watch = async () => {
        if (!token()) return;
        try {
          const rows = await api('/market/my-orders');
          const open = (Array.isArray(rows) ? rows : []).find(order => orderOpen(order, row.kind));
          paintLive(open || null);
        } catch { /* keep the status already on the menu */ }
      };
      box.addEventListener('submit', async event => {
        const form = event.target.closest('[data-live-confirm]');
        if (!form || !box.contains(form)) return;
        event.preventDefault();
        const result = event.submitter?.value || 'completed';
        const data = new FormData(form);
        form.querySelectorAll('button').forEach(button => { button.disabled = true; });
        try {
          await api(`/market/orders/${form.dataset.liveConfirm}/confirm`, { method: 'POST', body: JSON.stringify({ result, note: data.get('note') }) });
          await watch();
        } catch (error) {
          form.querySelectorAll('button').forEach(button => { button.disabled = false; });
          alert(error.message);
        }
      });
      box.querySelectorAll('[data-buy]').forEach(button => button.addEventListener('click', async () => {
        const result = box.querySelector(`[data-result="${button.dataset.buy}"]`);
        if (!token()) {
          result.innerHTML = `<p class="market-note">Sign in, then come back and tap this button.</p><a href="access.html?interest=${esc(row.kind === 'restaurant' ? 'restaurants' : row.kind === 'shop' ? 'shops' : 'services')}">Sign in</a>`;
          return;
        }
        button.disabled = true;
        try {
          await api('/market/orders', { method: 'POST', body: JSON.stringify({ itemId: button.dataset.buy, quantity: 1 }) });
          await watch();
          liveCard()?.scrollIntoView({ block: 'nearest' });
        } catch (error) {
          await watch();
          if (liveCard()?.hidden !== false) {
            button.disabled = false;
            result.innerHTML = `<p class="market-note">${esc(error.message)}</p>`;
          }
        }
      }));
      if (token()) {
        watch();
        setInterval(watch, 4000);
      }
    }).catch(error => { box.innerHTML = `<p class="market-note">${esc(error.message)}</p>`; });
  }

  const ordersRoot = document.querySelector('[data-market-orders]');
  if (ordersRoot) {
    const box = document.querySelector('#orderList');
    if (!token()) {
      box.innerHTML = '<p>Sign in to see your requests.</p><a href="access.html">Sign in</a>';
    } else {
      const paint = rows => {
        const answerText = row => {
          if (!row.customerConfirm) return '';
          const said = { completed: 'You confirmed that you received it.', not_completed: 'You said you did not receive it.', disputed: 'You sent a note.' }[row.customerConfirm] || `Your answer: ${row.customerConfirm}`;
          return `${said}${row.customerNote ? ` ${row.customerNote}` : ''}`;
        };
        const confirmBlock = row => {
          const another = { service: 'service', shop: 'product', restaurant: 'meal' }[row.kind] || 'request';
          const ownerWord = { service: 'service owner', shop: 'shop', restaurant: 'restaurant' }[row.kind] || 'business';
          if (row.status === 'pending' || row.status === 'accepted') return `<p>This request is still open. Finish it before you request another ${another}.</p>`;
          if (row.status === 'completed' && !row.customerConfirm) return `<form data-confirm="${esc(row.id)}"><p>The ${ownerWord} marked this received${row.finalAmount == null ? '' : ` for ${money(row.finalAmount)}`}. Confirm it before you request another ${another}.</p><label>Note<textarea name="note" rows="2" placeholder="Optional, unless you are sending a note"></textarea></label><button class="primary-button" name="result" value="completed" type="submit">I received it</button> <button class="small-button" name="result" value="not_completed" type="submit">I did not receive it</button> <button class="small-button" name="result" value="disputed" type="submit">Send a note</button></form>`;
          return `<p>${answerText(row) || 'Waiting for the business. No answer is not a confirmation.'}</p>`;
        };
        box.innerHTML = rows.length ? rows.map(row => `<article class="panel"><h3>${esc(row.reference)} · ${esc(row.itemName)}</h3><p>${esc(row.businessName)} · ${esc(row.status)} · Listed ${money(row.listedTotal)}${row.finalAmount == null ? '' : ` · Final ${money(row.finalAmount)}`}</p><div>${contactLinks(row.contact, row.reference, row.itemName)}</div>${confirmBlock(row)}</article>`).join('') : '<p>You have no requests yet.</p>';
        box.querySelectorAll('[data-confirm]').forEach(form => form.addEventListener('submit', async event => {
          event.preventDefault();
          const result = event.submitter?.value || 'completed';
          try {
            const data = new FormData(form);
            await api(`/market/orders/${form.dataset.confirm}/confirm`, { method: 'POST', body: JSON.stringify({ result, amount: data.get('amount'), note: data.get('note') }) });
            location.reload();
          } catch (error) { alert(error.message); }
        }));
      };
      const kind = new URLSearchParams(location.search).get('kind');
      const back = pools[kind]?.home;
      if (back) document.querySelectorAll('[data-orders-home]').forEach(link => link.setAttribute('href', back));
      api('/market/my-orders').then(rows => paint(kind ? rows.filter(row => row.kind === kind) : rows)).catch(error => { box.innerHTML = `<p class="market-note">${esc(error.message)}</p>`; });
    }
  }

  const ownerRoot = document.querySelector('[data-market-owner]');
  if (ownerRoot) {
    const desk = document.querySelector('#ownerDesk');
    const session = user();
    const ownerRoles = ['restaurant', 'shop', 'service', 'vendor'];
    if (!token() || !ownerRoles.includes(session?.role)) {
      if (desk) desk.innerHTML = '<p>Sign in as a restaurant owner, shop owner, or service owner.</p><a href="access.html?mode=owners">Owners</a>';
    } else {
      const businesses = document.querySelector('#vendorBusinesses');
      const orders = document.querySelector('#vendorOrders');
      const paint = rows => {
        const same = rows.filter(row => session.role === 'vendor' || row.kind === session.role);
        const oldestFirst = same.slice().reverse();
        const profile = oldestFirst.find(row => (row.items || []).length) || oldestFirst[0] || null;
        placeRows = profile ? [profile] : [];
        paintStats();
        const glance = document.querySelector('#ownerGlance');
        if (glance) {
          const placeName = copy.item === 'dish' ? 'restaurant' : copy.item === 'product' ? 'shop' : 'service';
          glance.innerHTML = profile
            ? `<article class="panel profile-glance"><img alt="" src="${esc(profile.imageUrl || covers[profile.kind] || '')}"><div><h2>${esc(profile.name)}</h2><p>Your profile · ${esc(profile.area || 'Sector not set')}</p><a href="#place">Edit profile</a></div></article>`
            : `<article class="panel"><h2>No profile yet</h2><p>Save your ${placeName} profile before you add ${esc(copy.items.toLowerCase())}.</p><p><a href="#place">Open profile</a></p></article>`;
        }
        const profileForm = document.querySelector('#profileForm');
        if (profileForm) {
          profileForm.dataset.id = profile ? profile.id : '';
          const setField = (name, value) => { if (profileForm.elements[name]) profileForm.elements[name].value = value || ''; };
          setField('name', profile?.name);
          setField('category', profile?.category);
          setField('phone', profile?.phone);
          setField('whatsapp', profile?.whatsapp);
          const area = profileForm.elements.area;
          if (area && profile?.area && ![...area.options].some(option => option.value === profile.area)) {
            area.insertAdjacentHTML('beforeend', `<option>${esc(profile.area)}</option>`);
          }
          setField('area', sectors.includes(profile?.area) ? profile.area : (profile?.area || ''));
          setField('hours', profile?.hours);
          setField('address', profile?.address);
          setField('description', profile?.description);
          const preview = document.querySelector('#profilePreview');
          if (preview) {
            preview.hidden = !profile?.imageUrl;
            if (profile?.imageUrl) preview.src = profile.imageUrl;
          }
        }
        const qtyField = value => copy.stock ? `<label>Quantity<input name="stock" type="number" min="0" step="1" inputmode="numeric" ${value == null ? '' : `value="${esc(value)}"`} required></label>` : '';
        const photoBox = `<div class="wide photo-field"><span>Photos</span><input name="photos" type="file" accept="image/*" multiple><small>Add up to 5 photos.</small><div class="photo-picks"></div></div>`;
        const items = profile?.items || [];
        const itemRows = items.map(item => {
          const shots = itemPhotos(item);
          const thumb = shots[0] || covers[profile.kind] || '';
          return `<div class="owner-item"><img class="owner-thumb" alt="" src="${esc(thumb)}"><div><b>${esc(item.name)}</b><p>${money(item.price)}${item.available ? '' : ' · Hidden'}${item.stock == null ? '' : ` · Qty ${esc(item.stock)}`}${shots.length > 1 ? ` · ${shots.length} photos` : ''}</p></div><div class="owner-item-actions"><button class="small-button" type="button" data-edit="${esc(item.id)}">Edit</button><button class="small-button" type="button" data-hide="${esc(item.id)}" data-available="${item.available ? '1' : '0'}">${item.available ? 'Hide' : 'Show'}</button><button class="small-button danger" type="button" data-remove="${esc(item.id)}">Remove</button></div></div><form class="form-grid owner-edit" data-edit-form="${esc(item.id)}" hidden><label>${esc(copy.nameLabel)}<input name="name" value="${esc(item.name)}" required></label><label>${esc(copy.priceLabel)}<input name="price" type="number" min="0" step="1" inputmode="numeric" value="${esc(item.price)}" required></label>${qtyField(item.stock == null ? '' : item.stock)}<label class="wide">Description<textarea name="description" rows="2">${esc(item.description || '')}</textarea></label>${photoBox}<button class="primary-button" type="submit">Save changes</button></form>`;
        }).join('');
        const itemFields = `<label>${esc(copy.nameLabel)}<input name="name" placeholder="${esc(copy.nameLabel)}" required></label><label>${esc(copy.priceLabel)}<input name="price" type="number" min="0" step="1" inputmode="numeric" placeholder="150" required></label>${qtyField(null)}<label class="wide">Description<textarea name="description" rows="2" placeholder="Short description"></textarea></label>${photoBox}`;
        const addForm = !profile
          ? `<p class="empty-state">Save your profile first. Then you can add ${esc(copy.items.toLowerCase())}.</p>`
          : `<button class="add-service" type="button" data-add-toggle><span>+</span>Add a ${esc(copy.item)}</button><form class="form-grid owner-item-form" data-item="${esc(profile.id)}" hidden>${itemFields}<div class="add-service-actions"><button class="primary-button" type="submit">Save ${esc(copy.item)}</button><button class="small-button" type="button" data-add-cancel>Cancel</button></div></form>`;
        const list = `<div class="owner-items">${itemRows || `<p class="empty-state">No ${esc(copy.items.toLowerCase())} yet.</p>`}</div>`;
        businesses.innerHTML = `<article class="panel owner-place">${addForm}${list}</article>`;
        const addToggle = businesses.querySelector('[data-add-toggle]');
        const addSheet = businesses.querySelector('[data-item]');
        addToggle?.addEventListener('click', () => {
          if (addSheet) addSheet.hidden = false;
          addToggle.hidden = true;
          addSheet?.querySelector('[name="name"]')?.focus();
        });
        businesses.querySelector('[data-add-cancel]')?.addEventListener('click', () => {
          addSheet?.reset();
          addSheet?._resetPhotos?.();
          if (addSheet) addSheet.hidden = true;
          if (addToggle) addToggle.hidden = false;
        });
        if (addSheet) bindPhotos(addSheet, []);
        businesses.querySelectorAll('[data-edit-form]').forEach(editor => {
          const item = items.find(entry => entry.id === editor.dataset.editForm);
          bindPhotos(editor, itemPhotos(item));
        });
        businesses.querySelectorAll('input[type="number"]').forEach(keepDigits);
        businesses.querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => {
          const editor = businesses.querySelector(`[data-edit-form="${button.dataset.edit}"]`);
          if (editor) editor.hidden = !editor.hidden;
        }));
        businesses.querySelectorAll('[data-edit-form]').forEach(editor => editor.addEventListener('submit', async event => {
          event.preventDefault();
          const data = new FormData(editor);
          const price = wholeNumber(data.get('price'));
          const quantity = wholeNumber(data.get('stock'));
          if (!price) { alert('Enter the price in numbers.'); return; }
          if (copy.stock && quantity === '') { alert('Enter the quantity in numbers.'); return; }
          const item = (profile.items || []).find(entry => entry.id === editor.dataset.editForm);
          try {
            const photoUrls = await collectPhotos(editor);
            if (!photoUrls) return;
            await api(`/market/items/${editor.dataset.editForm}`, { method: 'PUT', body: JSON.stringify({ name: data.get('name'), price: Number(price), description: data.get('description'), stock: copy.stock ? Number(quantity) : item?.stock, photoUrls, available: item ? item.available : true }) });
            load();
          } catch (error) { alert(error.message); }
        }));
        businesses.querySelectorAll('[data-item]').forEach(form => form.addEventListener('submit', async event => {
          event.preventDefault();
          const data = new FormData(form);
          const price = wholeNumber(data.get('price'));
          const quantity = wholeNumber(data.get('stock'));
          if (!price) { alert('Enter the price in numbers.'); return; }
          if (copy.stock && quantity === '') { alert('Enter the quantity in numbers.'); return; }
          try {
            const photoUrls = await collectPhotos(form);
            if (!photoUrls) return;
            await api(`/market/businesses/${form.dataset.item}/items`, { method: 'POST', body: JSON.stringify({ name: data.get('name'), price: Number(price), description: data.get('description'), stock: copy.stock ? Number(quantity) : null, photoUrls, available: true }) });
            load();
          } catch (error) { alert(error.message); }
        }));
        businesses.querySelectorAll('[data-hide]').forEach(button => button.addEventListener('click', async () => {
          try {
            await api(`/market/items/${button.dataset.hide}`, { method: 'PUT', body: JSON.stringify({ available: button.dataset.available !== '1' }) });
            load();
          } catch (error) { alert(error.message); }
        }));
        businesses.querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', async () => {
          if (!confirm('Remove this item? Past requests stay saved.')) return;
          try { await api(`/market/items/${button.dataset.remove}`, { method: 'DELETE' }); load(); } catch (error) { alert(error.message); }
        }));
      };
      const paintOrders = rows => {
        orderRows = rows;
        paintStats();
        const query = (document.querySelector('#orderFilter')?.value || '').trim().toLowerCase();
        const shown = rows.filter(row => !query || `${row.reference} ${row.status} ${row.itemName} ${row.customer?.name || ''}`.toLowerCase().includes(query));
        const receivedLabel = 'Received';
        const customerAnswer = row => {
          if (!row.customerConfirm) return '';
          const said = row.customerConfirm === 'completed' ? 'The customer confirmed they received it.' : row.customerConfirm === 'not_completed' ? 'The customer said they did not receive it.' : 'The customer sent a note.';
          return `<p>${said}${row.customerNote ? ` ${esc(row.customerNote)}` : ''}</p>`;
        };
        const requestActions = row => {
          if (row.status === 'completed') return `<p>Received ${row.finalAmount == null ? '' : money(row.finalAmount)}.</p>${row.customerConfirm ? '' : '<p>Waiting for the customer to confirm.</p>'}${customerAnswer(row)}`;
          if (row.status === 'cancelled') return '<p>Cancelled.</p>';
          if (row.status === 'disputed') return customerAnswer(row);
          if (row.status !== 'pending' && row.status !== 'accepted') return '';
          const accept = row.status === 'pending' ? '<button class="small-button" name="status" value="accepted" type="submit">Accept</button>' : '';
          return `<form data-status="${esc(row.id)}"><input name="finalAmount" inputmode="numeric" placeholder="Amount received ₹"><button class="primary-button" name="status" value="completed" type="submit">${receivedLabel}</button>${accept}<button class="small-button danger" name="status" value="cancelled" type="submit">Cancel</button></form>`;
        };
        orders.innerHTML = shown.map(row => `<article class="panel owner-request"><div class="request-row"><div><b>${esc(row.itemName)}</b><p>${esc(row.reference)} · ${esc(row.customer?.name || 'Student')} · ${esc(row.customer?.phone || 'No phone')}</p><p>Qty ${esc(row.quantity)} · ${money(row.listedTotal)}${row.finalAmount == null ? '' : ` · Paid ${money(row.finalAmount)}`}</p></div><span class="status-pill">${esc(row.status)}</span></div>${requestActions(row)}</article>`).join('') || '<p class="empty-state">No requests yet.</p>';
        orders.querySelectorAll('[data-status]').forEach(form => form.addEventListener('submit', async event => {
          event.preventDefault();
          try {
            await api(`/market/orders/${form.dataset.status}`, { method: 'PUT', body: JSON.stringify({ status: event.submitter?.value, finalAmount: new FormData(form).get('finalAmount') }) });
            loadOrders();
          } catch (error) { alert(error.message); }
        }));
      };
      const ownerCopy = {
        restaurant: { eyebrow: 'RESTAURANT', title: 'Your restaurant', blurb: 'This page is your profile and your requests.', items: 'Menu', item: 'dish', nameLabel: 'Dish name', priceLabel: 'Price (₹)', hint: 'Tap + to add a dish. Enter the price in numbers and add up to 5 photos.', request: 'Type the amount you received, then press Received. The student confirms it before they can order another meal.', profile: 'Restaurant profile', profileHint: 'Edit the name, the sector, and the photo here. Add dishes with the + button.', stock: false, publicPage: 'food.html', brand: 'Restaurant workspace', category: 'Meals' },
        shop: { eyebrow: 'SHOP', title: 'Your shop', blurb: 'This page is your profile and your requests.', items: 'Products', item: 'product', nameLabel: 'Product name', priceLabel: 'Product price (₹)', hint: 'Tap + to add a product. Enter the price and the quantity in numbers, and add up to 5 photos.', request: 'Type the amount you received, then press Received. The student confirms it before they can buy another product.', profile: 'Shop profile', profileHint: 'Edit the name, the sector, and the photo here. Add products with the + button.', stock: true, publicPage: 'shop.html', brand: 'Shop workspace', category: 'Grocery' },
        service: { eyebrow: 'SERVICE', title: 'Your service', blurb: 'This page is your profile and your requests.', items: 'Services', item: 'service', nameLabel: 'Service name', priceLabel: 'Price (₹)', hint: 'Tap + to add a service. Enter the price in numbers and add up to 5 photos.', request: 'Type the amount you received, then press Received. The student confirms it before they can request another service.', profile: 'Service profile', profileHint: 'Edit the name, the sector, and the photo here. Add services with the + button.', stock: false, publicPage: 'service.html', brand: 'Service workspace', category: 'Help' }
      };
      const copy = ownerCopy[session.role] || ownerCopy.restaurant;
      const setText = (selector, value) => { const node = document.querySelector(selector); if (node) node.textContent = value; };
      setText('#ownerEyebrow', copy.eyebrow);
      setText('#ownerTitle', copy.title);
      setText('#ownerBlurb', copy.blurb);
      setText('#ownerItemsNav', `☰  ${copy.items}`);
      setText('#ownerItemsEyebrow', copy.eyebrow);
      setText('#ownerItemsTitle', copy.items);
      setText('#ownerItemsHint', copy.hint);
      setText('#ownerRequestHint', copy.request);
      setText('#ownerAddTitle', copy.profile);
      setText('#ownerProfileHint', copy.profileHint);
      setText('#ownerProfileEyebrow', copy.eyebrow);
      setText('#ownerBrand', copy.brand);
      const categoryField = document.querySelector('#profileForm [name="category"]');
      if (categoryField) categoryField.placeholder = copy.category;
      setText('#ownerName', session.name || 'Owner');
      setText('#ownerAvatar', (session.name || 'O').slice(0, 1).toUpperCase());
      const publicLink = document.querySelector('#ownerPublic');
      if (publicLink) publicLink.href = copy.publicPage;
      document.title = `${copy.title} · Ekvora`;
      stayIn(session.role);
      setText('#ownerBrand', copy.brand);
      let placeRows = [];
      let orderRows = [];
      const paintStats = () => {
        const box = document.querySelector('#ownerStats');
        if (!box) return;
        const open = orderRows.filter(row => row.status === 'pending' || row.status === 'accepted').length;
        const done = orderRows.filter(row => row.status === 'completed').length;
        const cards = [[String(open), 'Open requests'], [String(done), 'Completed']];
        box.innerHTML = cards.map(([value, label]) => `<article class="stat-card"><span class="stat-icon">●</span><div><strong>${esc(value)}</strong><small>${esc(label)}</small></div></article>`).join('');
      };
      const showOwnerPage = () => {
        const pages = [...document.querySelectorAll('#ownerDesk .workspace')];
        const wanted = (location.hash || '#overview').slice(1);
        const current = pages.some(page => page.id === wanted) ? wanted : 'overview';
        pages.forEach(page => { page.hidden = page.id !== current; });
        document.querySelectorAll('.side-nav a[href^="#"]').forEach(link => link.classList.toggle('selected', link.getAttribute('href') === `#${current}`));
      };
      window.addEventListener('hashchange', showOwnerPage);
      showOwnerPage();
      paintStats();
      const load = () => api('/market/mine').then(paint).catch(error => { businesses.innerHTML = `<p class="market-note">${esc(error.message)}</p>`; });
      let orderStamp = '';
      const loadOrders = () => api('/market/vendor/orders').then(rows => {
        const mine = (Array.isArray(rows) ? rows : []).filter(row => row.kind === session.role);
        const stamp = JSON.stringify(mine);
        if (stamp === orderStamp) return;
        if (orders.contains(document.activeElement)) return;
        orderStamp = stamp;
        orders.dataset.rows = stamp;
        paintOrders(mine);
      }).catch(error => { orders.innerHTML = `<p class="market-note">${esc(error.message)}</p>`; });
      document.querySelector('#orderFilter')?.addEventListener('input', () => { try { paintOrders(JSON.parse(orders.dataset.rows || '[]')); } catch { /* ignore */ } });
      const profilePhoto = document.querySelector('#profileForm [name="photo"]');
      const profilePreview = document.querySelector('#profilePreview');
      profilePhoto?.addEventListener('change', () => {
        const file = profilePhoto.files?.[0];
        if (!file || !profilePreview) return;
        profilePreview.hidden = false;
        profilePreview.src = URL.createObjectURL(file);
      });
      document.querySelector('#profileForm')?.addEventListener('submit', async event => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const button = form.querySelector('button');
        button.disabled = true;
        try {
          const current = placeRows[0];
          const file = data.get('photo');
          const imageUrl = file && file.size ? await uploadFile(file) : (current?.imageUrl || '');
          const body = { kind: session.role === 'vendor' ? (current?.kind || 'restaurant') : session.role, name: data.get('name'), category: data.get('category'), phone: data.get('phone'), whatsapp: data.get('whatsapp'), area: data.get('area'), hours: data.get('hours'), address: data.get('address'), description: data.get('description'), imageUrl, logoUrl: current?.logoUrl || '' };
          if (current) await api(`/market/businesses/${current.id}`, { method: 'PUT', body: JSON.stringify(body) });
          else await api('/market/businesses', { method: 'POST', body: JSON.stringify(body) });
          if (form.elements.photo) form.elements.photo.value = '';
          load();
        } catch (error) { alert(error.message); }
        finally { button.disabled = false; }
      });
      load();
      loadOrders();
      setInterval(loadOrders, 5000);
    }
    document.querySelector('[data-owner-out]')?.addEventListener('click', () => {
      localStorage.removeItem('studentstay_token');
      localStorage.removeItem('studentstay_user');
      location.href = 'access.html';
    });
  }

  const adminRoot = document.querySelector('[data-market-admin]');
  if (adminRoot) {
    const box = document.querySelector('#adminMarket');
    if (user()?.role !== 'admin') {
      box.innerHTML = '<p>Admin sign-in is required.</p>';
    } else {
      const paint = payload => {
        const due = (payload.orders || []).filter(row => row.commissionStatus === 'confirmed' || row.commissionStatus === 'due').reduce((sum, row) => sum + Number(row.commissionAmount || 0), 0);
        box.innerHTML = `<form id="rateForm"><label>Commission percent<input name="percent" value="${esc(payload.commissionPercent)}" inputmode="numeric"></label><button class="primary-button" type="submit">Save rate</button></form><p>Confirmed or due commission: ${money(due)}. Changing the rate does not change sales already recorded.</p>` + (payload.orders || []).map(row => `<article class="panel"><h3>${esc(row.reference)} · ${esc(row.kind)} · ${esc(row.status)}</h3><p>${esc(row.businessName)} · ${esc(row.vendorName)} · ${esc(row.customerName)}</p><p>${esc(row.itemName)} · Final ${row.finalAmount == null ? '—' : money(row.finalAmount)} · Commission ${row.commissionAmount == null ? '—' : money(row.commissionAmount)} · ${esc(row.commissionStatus || 'none')} · Customer ${esc(row.customerConfirm || 'no answer')}</p><form data-commission="${esc(row.id)}"><button class="small-button" name="status" value="due" type="submit">Due</button> <button class="small-button" name="status" value="paid" type="submit">Paid</button> <button class="small-button" name="status" value="waived" type="submit">Waived</button></form></article>`).join('');
        document.querySelector('#rateForm')?.addEventListener('submit', async event => {
          event.preventDefault();
          try { await api('/market/admin/commission', { method: 'PUT', body: JSON.stringify({ percent: new FormData(event.currentTarget).get('percent') }) }); load(); } catch (error) { alert(error.message); }
        });
        box.querySelectorAll('[data-commission]').forEach(form => form.addEventListener('submit', async event => {
          event.preventDefault();
          try { await api(`/market/admin/orders/${form.dataset.commission}/commission`, { method: 'PUT', body: JSON.stringify({ status: event.submitter?.value }) }); load(); } catch (error) { alert(error.message); }
        }));
      };
      const load = () => api('/market/admin/orders').then(paint).catch(error => { box.innerHTML = `<p class="market-note">${esc(error.message)}</p>`; });
      load();
    }
  }
})();
