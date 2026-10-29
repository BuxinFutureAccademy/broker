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
    const open = tile => { location.href = `business.html?id=${encodeURIComponent(tile.dataset.businessId)}`; };
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
      const shown = rows.filter(row => matchesPlace(row, area, query));
      box.innerHTML = shown.length ? shown.map(row => placeCard(row, kind)).join('') : `<div class="empty-state">${empty}</div>`;
      bindPlaces(box);
    };
    form?.addEventListener('submit', event => { event.preventDefault(); paint(); });
    form?.elements.area?.addEventListener('change', paint);
    api(`/market/businesses?kind=${encodeURIComponent(kind)}`).then(items => { rows = Array.isArray(items) ? items : []; paint(); }).catch(error => { if (box) box.innerHTML = `<p class="market-note">${esc(error.message)}</p>`; });
  }

  const homeRoot = document.querySelector('[data-market-home]');
  if (homeRoot) {
    const kind = homeRoot.getAttribute('data-market-home');
    const box = document.querySelector('#homePlaces');
    const form = document.querySelector('#searchForm');
    const row = document.querySelector('#sectorRow');
    const more = document.querySelector('#placeMore');
    const heading = document.querySelector('#placeHeading');
    const caption = document.querySelector('#placeCaption');
    const listPage = homeRoot.getAttribute('data-market-more') || '#';
    const interest = homeRoot.getAttribute('data-market-interest') || '';
    const titles = { restaurant: 'Restaurants', shop: 'Shops', service: 'Services' };
    const empty = { restaurant: 'No restaurants in that Greater Noida sector yet.', shop: 'No shops in that Greater Noida sector yet.', service: 'No services in that Greater Noida sector yet.' };
    fillSectors(form?.elements.area);
    if (row) {
      row.innerHTML = sectors.map(name => `<button class="sector-card" type="button" data-sector="${esc(name)}"><span class="sector-mark">${esc(name.split(' ')[0])}</span><b>${esc(name)}</b><small>Greater Noida</small></button>`).join('');
    }
    let rows = [];
    const paint = () => {
      if (!box) return;
      const area = form?.elements.area?.value || '';
      const query = String(form?.elements.q?.value || '').trim();
      const shown = rows.filter(item => matchesPlace(item, area, query));
      box.innerHTML = shown.length ? shown.map(item => placeCard(item, kind)).join('') : `<div class="empty-state">${empty[kind] || 'Nothing in that sector yet.'}</div>`;
      bindPlaces(box);
      if (heading) heading.textContent = area ? `${titles[kind] || 'Places'} in ${area}` : (titles[kind] || 'Places');
      if (caption) caption.textContent = area ? `Showing ${area}.` : 'Every sector in Greater Noida.';
      if (more) more.href = area ? `${listPage}?area=${encodeURIComponent(area)}` : listPage;
      row?.querySelectorAll('[data-sector]').forEach(card => card.classList.toggle('on', card.dataset.sector === area));
    };
    form?.addEventListener('submit', event => {
      event.preventDefault();
      paint();
      document.querySelector('#properties')?.scrollIntoView({ behavior: 'smooth' });
    });
    form?.elements.area?.addEventListener('change', paint);
    row?.addEventListener('click', event => {
      const card = event.target.closest('[data-sector]');
      if (!card || !form?.elements.area) return;
      form.elements.area.value = form.elements.area.value === card.dataset.sector ? '' : card.dataset.sector;
      paint();
      document.querySelector('#properties')?.scrollIntoView({ behavior: 'smooth' });
    });
    if (!token()) {
      document.querySelector('.login')?.addEventListener('click', () => { location.href = interest ? `access.html?interest=${encodeURIComponent(interest)}` : 'access.html'; });
      document.querySelector('.signup')?.addEventListener('click', () => { location.href = 'access.html?mode=owners'; });
    }
    api(`/market/businesses?kind=${encodeURIComponent(kind)}`).then(items => { rows = Array.isArray(items) ? items : []; paint(); }).catch(error => { if (box) box.innerHTML = `<p class="market-note">${esc(error.message)}</p>`; });
  }

  const businessRoot = document.querySelector('[data-market-business]');
  if (businessRoot) {
    const id = new URLSearchParams(location.search).get('id');
    const box = document.querySelector('#businessDetails');
    const showContact = (node, order) => {
      node.innerHTML = `<b>Request ${esc(order.reference)}</b><p>Status: ${esc(order.status)}. Pay the business directly. This request is saved.</p><div>${contactLinks(order.contact, order.reference, order.itemName)}</div><p><a href="orders.html?kind=${esc(order.kind)}">See your requests</a></p>`;
    };
    api(`/market/businesses/${encodeURIComponent(id || '')}`).then(row => {
      const action = row.kind === 'service' ? 'Request service' : 'Buy';
      stayIn(row.kind);
      box.innerHTML = `<p><a href="${esc((pools[row.kind] || {}).list || '#')}">← Back</a></p><h1>${esc(row.name)}</h1><p>${esc(row.category)} · ${esc(row.area || 'Greater Noida')}</p><p>${esc(row.description || '')}</p>${row.hours ? `<p>Hours: ${esc(row.hours)}</p>` : ''}<div id="itemList"></div>`;
      const list = document.querySelector('#itemList');
      const items = row.items || [];
      list.innerHTML = items.length ? items.map(item => {
        const blocked = !item.available || item.stock === 0;
        return `<article class="item-row"><img alt="" src="${esc(photo(item.photoUrl))}"><div><b>${esc(item.name)}</b><p>${esc(item.description || '')}</p><p>${money(item.price)}${item.priceNote ? ` · ${esc(item.priceNote)}` : ''}${item.stock == null ? '' : ` · ${item.stock} in stock`}${item.available ? '' : ' · Unavailable'}</p>${blocked ? '' : `<button class="primary-button" type="button" data-buy="${esc(item.id)}">${action}</button>`}<div class="buy-result" data-result="${esc(item.id)}"></div></div></article>`;
      }).join('') : '<p>No items yet.</p>';
      list.querySelectorAll('[data-buy]').forEach(button => button.addEventListener('click', async () => {
        const result = list.querySelector(`[data-result="${button.dataset.buy}"]`);
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
        placeRows = rows;
        paintStats();
        const stockField = copy.stock ? `<label>In stock<input name="stock" inputmode="numeric" placeholder="How many you have"></label>` : '';
        businesses.innerHTML = rows.map(row => `<article class="panel owner-place"><div class="panel-heading"><div><span class="eyebrow">${esc(row.category || copy.eyebrow)}</span><h2>${esc(row.name)}</h2><p>${esc(row.phone || 'No phone yet')} · ${esc(row.area || 'Greater Noida')}</p></div><label class="owner-sector">Sector<select data-area="${esc(row.id)}">${sectors.includes(row.area) ? '' : `<option value="">${esc(row.area || 'Choose a sector')}</option>`}${sectors.map(name => `<option${row.area === name ? ' selected' : ''}>${esc(name)}</option>`).join('')}</select></label></div><div class="owner-items">${(row.items || []).map(item => `<div class="owner-item"><div><b>${esc(item.name)}</b><p>${money(item.price)}${item.available ? '' : ' · Hidden'}${item.stock == null ? '' : ` · ${item.stock} in stock`}</p></div><div class="owner-item-actions"><button class="small-button" type="button" data-hide="${esc(item.id)}" data-available="${item.available ? '1' : '0'}">${item.available ? 'Hide' : 'Show'}</button><button class="small-button danger" type="button" data-remove="${esc(item.id)}">Remove</button></div></div>`).join('') || `<p class="empty-state">No ${esc(copy.items.toLowerCase())} yet.</p>`}</div><form class="form-grid owner-item-form" data-item="${esc(row.id)}"><label>${esc(copy.item[0].toUpperCase() + copy.item.slice(1))} name<input name="name" placeholder="${esc(copy.item)} name" required></label><label>Price (₹)<input name="price" inputmode="numeric" placeholder="150" required></label><label>Category<input name="category" placeholder="Optional"></label>${stockField}<label class="wide">Description<textarea name="description" rows="2" placeholder="Short description"></textarea></label><label class="wide">Photo link<input name="photoUrl" placeholder="https://"></label><button class="primary-button" type="submit">Save ${esc(copy.item)}</button></form></article>`).join('') || `<p class="empty-state">Add your first ${esc(copy.item === 'dish' ? 'restaurant' : copy.item === 'product' ? 'shop' : 'service')} from Add a place.</p>`;
        businesses.querySelectorAll('[data-item]').forEach(form => form.addEventListener('submit', async event => {
          event.preventDefault();
          const data = Object.fromEntries(new FormData(form));
          try {
            await api(`/market/businesses/${form.dataset.item}/items`, { method: 'POST', body: JSON.stringify({ ...data, available: true, stock: data.stock || null }) });
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
        businesses.querySelectorAll('[data-area]').forEach(select => select.addEventListener('change', async () => {
          const row = placeRows.find(item => item.id === select.dataset.area);
          if (!row || !select.value || select.value === row.area) return;
          try {
            await api(`/market/businesses/${row.id}`, { method: 'PUT', body: JSON.stringify({ kind: row.kind, name: row.name, category: row.category, phone: row.phone, whatsapp: row.whatsapp || '', address: row.address || '', area: select.value, hours: row.hours || '', description: row.description || '', imageUrl: row.imageUrl || '', logoUrl: row.logoUrl || '' }) });
            load();
          } catch (error) { alert(error.message); }
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
        restaurant: { eyebrow: 'RESTAURANT', title: 'Your restaurant', blurb: 'Put dishes on the menu and answer meal requests.', items: 'Menu', item: 'dish', hint: 'Each dish needs a name and a price in rupees.', request: 'Accept a meal request, then mark it completed after the student pays you.', add: 'Add another restaurant', stock: false, publicPage: 'food.html', brand: 'Restaurant workspace' },
        shop: { eyebrow: 'SHOP', title: 'Your shop', blurb: 'List products, keep the stock count, and answer purchase requests.', items: 'Products', item: 'product', hint: 'Each product needs a name, a price, and how many you have.', request: 'Accept a purchase, then mark it completed after the student pays you.', add: 'Add another shop', stock: true, publicPage: 'shop.html', brand: 'Shop workspace' },
        service: { eyebrow: 'SERVICE', title: 'Your service', blurb: 'List what you offer and answer requests for help.', items: 'Services', item: 'service', hint: 'Each service needs a name and a price in rupees.', request: 'Accept a request, then mark it completed after the student pays you.', add: 'Add another service', stock: false, publicPage: 'service.html', brand: 'Service workspace' }
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
      setText('#ownerAddTitle', copy.add);
      setText('#ownerBrand', copy.brand);
      setText('#ownerName', session.name || 'Owner');
      setText('#ownerAvatar', (session.name || 'O').slice(0, 1).toUpperCase());
      const publicLink = document.querySelector('#ownerPublic');
      if (publicLink) publicLink.href = copy.publicPage;
      document.title = `${copy.title} · StudentStay`;
      stayIn(session.role);
      setText('#ownerBrand', copy.brand);
      const kindField = document.querySelector('#newBusiness [name="kind"]');
      if (kindField && ['restaurant', 'shop', 'service'].includes(session.role)) {
        [...kindField.options].forEach(option => { if (option.value !== session.role) option.remove(); });
        kindField.value = session.role;
      }
      let placeRows = [];
      let orderRows = [];
      const paintStats = () => {
        const box = document.querySelector('#ownerStats');
        if (!box) return;
        const items = placeRows.reduce((sum, row) => sum + (row.items || []).length, 0);
        const open = orderRows.filter(row => row.status === 'pending' || row.status === 'accepted').length;
        const done = orderRows.filter(row => row.status === 'completed').length;
        const cards = [[String(placeRows.length), 'Places'], [String(items), copy.items], [String(open), 'Open requests'], [String(done), 'Completed']];
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
      document.querySelector('#newBusiness')?.addEventListener('submit', async event => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.currentTarget));
        try { await api('/market/businesses', { method: 'POST', body: JSON.stringify(data) }); event.currentTarget.reset(); if (kindField && ['restaurant', 'shop', 'service'].includes(session.role)) kindField.value = session.role; load(); } catch (error) { alert(error.message); }
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
