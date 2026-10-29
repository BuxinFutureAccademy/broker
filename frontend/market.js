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
    if (kind !== 'service') return rows.filter(row => matchesPlace(row, area, query)).map(row => placeCard(row, kind));
    const cards = [];
    const needle = String(query || '').trim().toLowerCase();
    rows.forEach(row => {
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

  const saveSession = payload => {
    localStorage.setItem('studentstay_token', payload.access_token);
    localStorage.setItem('studentstay_user', JSON.stringify(payload.user));
  };

  const contactLinks = (contact, reference, itemName) => {
    if (!contact) return '';
    const intro = `Hello, my name is ______. My StudentStay request is ${reference} for ${itemName}.`;
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
    const showContact = (node, order) => {
      node.innerHTML = `<b>Request ${esc(order.reference)}</b><p>Status: ${esc(order.status)}. Pay the business directly. This request is saved.</p><div>${contactLinks(order.contact, order.reference, order.itemName)}</div><p><a href="orders.html?kind=${esc(order.kind)}">See your requests</a></p>`;
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
      document.title = `${row.name} · StudentStay`;
      stayIn(row.kind);
      const items = row.items || [];
      const cover = row.imageUrl || row.logoUrl || covers[row.kind] || photo('');
      const photos = [...new Set([cover, ...items.map(item => item.photoUrl).filter(Boolean)])];
      const priced = items.filter(item => item.available !== false).map(item => Number(item.price || 0));
      const from = priced.length ? Math.min(...priced) : null;
      const thumbs = photos.map((src, index) => `<button class="${index === 0 ? 'active' : ''}" type="button" data-photo-index="${index}" aria-label="Show photo ${index + 1}"><img src="${esc(src)}" alt=""></button>`).join('');
      const lines = items.length ? items.map(item => {
        const blocked = !item.available || item.stock === 0;
        const note = [item.stock == null ? '' : `${item.stock} in stock`, item.available ? '' : 'Unavailable'].filter(Boolean).join(' · ');
        return `<article class="menu-offer" data-offer="${esc(item.id)}"><img alt="" src="${esc(item.photoUrl || covers[row.kind] || cover)}"><div><b>${esc(item.name)}</b><p>${esc(item.description || '')}</p><div class="detail-price">${money(item.price)}${item.priceNote ? ` <small>${esc(item.priceNote)}</small>` : ''}</div>${note ? `<p class="detail-notice">${esc(note)}</p>` : ''}${blocked ? '' : `<button class="pay-now" type="button" data-buy="${esc(item.id)}">${action}</button>`}<div class="buy-result" data-result="${esc(item.id)}"></div></div></article>`;
      }).join('') : '<p class="detail-notice">Nothing is listed yet.</p>';
      box.innerHTML = `<div class="detail-layout"><section><div class="detail-gallery"><img class="detail-main-image" id="mainPhoto" src="${esc(photos[0])}" alt="${esc(row.name)}"><div class="detail-thumbs">${thumbs}</div></div><section class="map-panel"><h2>${esc(menu)}</h2><p>${esc(row.area || 'Greater Noida')}</p>${lines}</section></section><aside><section class="detail-content"><span class="detail-badge">${esc(row.category || pool.name || 'Place')}</span><h1>${esc(row.name)}</h1><p class="detail-location">⌖ ${esc(row.area || 'Greater Noida')}</p><div class="detail-price">${from == null ? 'Price on request' : `${money(from)} <small>from</small>`}</div><div class="detail-divider"></div><h2>${esc(about)}</h2><p class="detail-description">${esc(row.description || 'Open this place to see what is offered.')}</p>${row.hours ? `<p class="detail-notice">Hours: ${esc(row.hours)}</p>` : ''}</section><section class="pay-card"><small>${esc(String(pool.name || 'Place').toUpperCase())}</small><h2>${esc(action)}</h2><p>Choose something beside the photo. Sign in, then pay this place directly. The phone number stays hidden until you send a request.</p></section></aside></div>`;
      const mainPhoto = document.querySelector('#mainPhoto');
      const focusId = new URLSearchParams(location.search).get('item');
      const safeId = focusId ? (window.CSS?.escape ? CSS.escape(focusId) : focusId.replace(/[^a-zA-Z0-9-]/g, '')) : '';
      const focus = safeId ? box.querySelector(`[data-offer="${safeId}"]`) : null;
      if (focus) {
        focus.classList.add('offer-focus');
        focus.scrollIntoView({ block: 'center' });
      }
      box.querySelectorAll('[data-photo-index]').forEach(button => button.addEventListener('click', () => {
        const src = photos[Number(button.dataset.photoIndex)];
        if (src && mainPhoto) mainPhoto.src = src;
        box.querySelectorAll('[data-photo-index]').forEach(other => other.classList.toggle('active', other === button));
      }));
      box.querySelectorAll('[data-buy]').forEach(button => button.addEventListener('click', async () => {
        const result = box.querySelector(`[data-result="${button.dataset.buy}"]`);
        if (!token()) {
          result.innerHTML = `<p class="market-note">Sign in, then come back and tap this button.</p><a href="access.html?interest=${esc(row.kind === 'restaurant' ? 'restaurants' : row.kind === 'shop' ? 'shops' : 'services')}">Sign in</a>`;
          return;
        }
        button.disabled = true;
        try {
          const order = await api('/market/orders', { method: 'POST', body: JSON.stringify({ itemId: button.dataset.buy, quantity: 1 }) });
          showContact(result, order);
        } catch (error) {
          button.disabled = false;
          result.innerHTML = `<p class="market-note">${esc(error.message)}</p>`;
        }
      }));
    }).catch(error => { box.innerHTML = `<p class="market-note">${esc(error.message)}</p>`; });
  }

  const ordersRoot = document.querySelector('[data-market-orders]');
  if (ordersRoot) {
    const box = document.querySelector('#orderList');
    if (!token()) {
      box.innerHTML = '<p>Sign in to see your requests.</p><a href="access.html">Sign in</a>';
    } else {
      const paint = rows => {
        box.innerHTML = rows.length ? rows.map(row => `<article class="panel"><h3>${esc(row.reference)} · ${esc(row.itemName)}</h3><p>${esc(row.businessName)} · ${esc(row.status)} · Listed ${money(row.listedTotal)}${row.finalAmount == null ? '' : ` · Final ${money(row.finalAmount)}`}</p><div>${contactLinks(row.contact, row.reference, row.itemName)}</div>${row.status === 'completed' && !row.customerConfirm ? `<form data-confirm="${esc(row.id)}"><label>Amount you paid<input name="amount" inputmode="numeric" placeholder="Optional"></label><button class="primary-button" name="result" value="completed" type="submit">Completed</button> <button class="small-button" name="result" value="not_completed" type="submit">Not completed</button> <button class="small-button" name="result" value="disputed" type="submit">Report a problem</button></form>` : `<p>${row.customerConfirm ? `Your answer: ${esc(row.customerConfirm)}` : 'Waiting for the business. No answer is not a confirmation.'}</p>`}</article>`).join('') : '<p>You have no requests yet.</p>';
        box.querySelectorAll('[data-confirm]').forEach(form => form.addEventListener('submit', async event => {
          event.preventDefault();
          const result = event.submitter?.value || 'completed';
          try {
            await api(`/market/orders/${form.dataset.confirm}/confirm`, { method: 'POST', body: JSON.stringify({ result, amount: new FormData(form).get('amount') }) });
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
            ? `<article class="panel profile-glance"><img alt="" src="${esc(profile.imageUrl || covers[profile.kind] || '')}"><div><h2>${esc(profile.name)}</h2><p>${esc(profile.category || copy.eyebrow)} · ${esc(profile.area || 'Sector not set')}</p><a href="#place">Edit profile</a></div></article>`
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
        const stockField = copy.stock ? `<label>In stock<input name="stock" inputmode="numeric" placeholder="How many you have"></label>` : '';
        const items = profile?.items || [];
        const itemRows = items.map(item => `<div class="owner-item"><img class="owner-thumb" alt="" src="${esc(item.photoUrl || covers[profile.kind] || '')}"><div><b>${esc(item.name)}</b><p>${money(item.price)}${item.available ? '' : ' · Hidden'}${item.stock == null ? '' : ` · ${item.stock} in stock`}</p></div><div class="owner-item-actions"><button class="small-button" type="button" data-edit="${esc(item.id)}">Edit</button><button class="small-button" type="button" data-hide="${esc(item.id)}" data-available="${item.available ? '1' : '0'}">${item.available ? 'Hide' : 'Show'}</button><button class="small-button danger" type="button" data-remove="${esc(item.id)}">Remove</button></div></div><form class="form-grid owner-edit" data-edit-form="${esc(item.id)}" hidden><label>Name<input name="name" value="${esc(item.name)}" required></label><label>Price (₹)<input name="price" inputmode="numeric" value="${esc(item.price)}" required></label>${copy.stock ? `<label>In stock<input name="stock" inputmode="numeric" value="${item.stock == null ? '' : esc(item.stock)}"></label>` : ''}<label class="wide">Description<textarea name="description" rows="2">${esc(item.description || '')}</textarea></label><label class="wide photo-field">Replace photo<input name="photo" type="file" accept="image/*"></label><button class="primary-button" type="submit">Save changes</button></form>`).join('');
        const addForm = profile
          ? `<form class="form-grid owner-item-form" data-item="${esc(profile.id)}"><h3>Add a ${esc(copy.item)}</h3><label>Name<input name="name" placeholder="${esc(copy.item)} name" required></label><label>Price (₹)<input name="price" inputmode="numeric" placeholder="150" required></label>${stockField}<label class="wide">Description<textarea name="description" rows="2" placeholder="Short description"></textarea></label><label class="wide photo-field">Photo<input name="photo" type="file" accept="image/*" required></label><button class="primary-button" type="submit">Save ${esc(copy.item)}</button></form>`
          : `<p class="empty-state">Save your profile first. Then you can add ${esc(copy.items.toLowerCase())}.</p>`;
        businesses.innerHTML = `<article class="panel owner-place"><div class="owner-items">${itemRows || `<p class="empty-state">No ${esc(copy.items.toLowerCase())} yet.</p>`}</div>${addForm}</article>`;
        businesses.querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => {
          const editor = businesses.querySelector(`[data-edit-form="${button.dataset.edit}"]`);
          if (editor) editor.hidden = !editor.hidden;
        }));
        businesses.querySelectorAll('[data-edit-form]').forEach(editor => editor.addEventListener('submit', async event => {
          event.preventDefault();
          const data = new FormData(editor);
          const item = (profile.items || []).find(entry => entry.id === editor.dataset.editForm);
          try {
            const file = data.get('photo');
            const photoUrl = file && file.size ? await uploadFile(file) : (item?.photoUrl || '');
            await api(`/market/items/${editor.dataset.editForm}`, { method: 'PUT', body: JSON.stringify({ name: data.get('name'), price: data.get('price'), description: data.get('description'), stock: copy.stock ? (data.get('stock') || null) : item?.stock, photoUrl, available: item ? item.available : true }) });
            load();
          } catch (error) { alert(error.message); }
        }));
        businesses.querySelectorAll('[data-item]').forEach(form => form.addEventListener('submit', async event => {
          event.preventDefault();
          const data = new FormData(form);
          const file = data.get('photo');
          if (!file || !file.size) { alert('Upload a photo.'); return; }
          try {
            const photoUrl = await uploadFile(file);
            await api(`/market/businesses/${form.dataset.item}/items`, { method: 'POST', body: JSON.stringify({ name: data.get('name'), price: data.get('price'), description: data.get('description'), stock: data.get('stock') || null, photoUrl, available: true }) });
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
        orders.innerHTML = shown.map(row => `<article class="panel owner-request"><div class="request-row"><div><b>${esc(row.itemName)}</b><p>${esc(row.reference)} · ${esc(row.customer?.name || 'Student')} · ${esc(row.customer?.phone || 'No phone')}</p><p>Qty ${esc(row.quantity)} · ${money(row.listedTotal)}${row.finalAmount == null ? '' : ` · Paid ${money(row.finalAmount)}`}</p></div><span class="status-pill">${esc(row.status)}</span></div><form data-status="${esc(row.id)}"><input name="finalAmount" inputmode="numeric" placeholder="Amount received ₹"><button class="small-button" name="status" value="accepted" type="submit">Accept</button><button class="small-button" name="status" value="completed" type="submit">Completed</button><button class="small-button danger" name="status" value="cancelled" type="submit">Cancel</button></form></article>`).join('') || '<p class="empty-state">No requests yet.</p>';
        orders.querySelectorAll('[data-status]').forEach(form => form.addEventListener('submit', async event => {
          event.preventDefault();
          try {
            await api(`/market/orders/${form.dataset.status}`, { method: 'PUT', body: JSON.stringify({ status: event.submitter?.value, finalAmount: new FormData(form).get('finalAmount') }) });
            loadOrders();
          } catch (error) { alert(error.message); }
        }));
      };
      const ownerCopy = {
        restaurant: { eyebrow: 'RESTAURANT', title: 'Your restaurant', blurb: 'Keep the restaurant profile, the menu, and the meal requests in one place.', items: 'Menu', item: 'dish', hint: 'Add as many dishes as you want. Each one needs a name, a price, and a photo.', request: 'Accept a meal request, then mark it completed after the student pays you.', profile: 'Restaurant profile', profileHint: 'This is the restaurant people see. Set the sector and the photo here.', stock: false, publicPage: 'food.html', brand: 'Restaurant workspace', category: 'Meals' },
        shop: { eyebrow: 'SHOP', title: 'Your shop', blurb: 'Keep the shop profile, the products, and the purchase requests in one place.', items: 'Products', item: 'product', hint: 'Add as many products as you want. Each one needs a name, a price, a stock count, and a photo.', request: 'Accept a purchase, then mark it completed after the student pays you.', profile: 'Shop profile', profileHint: 'This is the shop people see. Set the sector and the photo here.', stock: true, publicPage: 'shop.html', brand: 'Shop workspace', category: 'Grocery' },
        service: { eyebrow: 'SERVICE', title: 'Your service', blurb: 'Your profile and your requests are here. Services you add are listed under Services, and on the services homepage.', items: 'Services', item: 'service', hint: 'Each service you save is listed here, and on the services homepage. A name, a price, and a photo are enough.', request: 'Accept a request, then mark it completed after the student pays you.', profile: 'Service profile', profileHint: 'Edit the company here: the name, the sector, and the photo. Services are added separately.', stock: false, publicPage: 'service.html', brand: 'Service workspace', category: 'Help' }
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
      document.title = `${copy.title} · StudentStay`;
      stayIn(session.role);
      setText('#ownerBrand', copy.brand);
      let placeRows = [];
      let orderRows = [];
      const paintStats = () => {
        const box = document.querySelector('#ownerStats');
        if (!box) return;
        const items = placeRows.reduce((sum, row) => sum + (row.items || []).length, 0);
        const open = orderRows.filter(row => row.status === 'pending' || row.status === 'accepted').length;
        const done = orderRows.filter(row => row.status === 'completed').length;
        const cards = [[String(open), 'Open requests'], [String(done), 'Completed']];
        if (session.role !== 'service') cards.unshift([String(items), copy.items]);
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
      const loadOrders = () => api('/market/vendor/orders').then(rows => { orders.dataset.rows = JSON.stringify(rows); paintOrders(rows); }).catch(error => { orders.innerHTML = `<p class="market-note">${esc(error.message)}</p>`; });
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
