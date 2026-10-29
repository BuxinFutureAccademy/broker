(() => {
  const API_BASE = 'https://broker-961c.onrender.com/api';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const money = value => `₹${Number(value || 0).toLocaleString('en-IN')}`;
  const token = () => localStorage.getItem('studentstay_token');
  const user = () => { try { return JSON.parse(localStorage.getItem('studentstay_user') || 'null'); } catch { return null; } };
  const photo = value => value || 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=800&q=80';
  const dial = value => String(value || '').replace(/[^\d+]/g, '');

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
    const paint = rows => {
      box.innerHTML = rows.length ? rows.map(row => `<a class="market-card" href="business.html?id=${encodeURIComponent(row.id)}"><img alt="" src="${esc(photo(row.imageUrl || row.logoUrl))}"><div><b>${esc(row.name)}</b><p>${esc(row.category)} · ${esc(row.area || 'Greater Noida')}</p><p>${row.fromPrice == null ? 'No items yet' : `From ${money(row.fromPrice)}`} · ${row.itemCount || 0} listed</p></div></a>`).join('') : '<p>Nothing is listed here yet.</p>';
    };
    const load = query => api(`/market/businesses?kind=${encodeURIComponent(kind)}&q=${encodeURIComponent(query || '')}`).then(paint).catch(error => { box.innerHTML = `<p class="market-note">${esc(error.message)}</p>`; });
    form?.addEventListener('submit', event => { event.preventDefault(); load(new FormData(form).get('q')); });
    load('');
  }

  const businessRoot = document.querySelector('[data-market-business]');
  if (businessRoot) {
    const id = new URLSearchParams(location.search).get('id');
    const box = document.querySelector('#businessDetails');
    const showContact = (node, order) => {
      node.innerHTML = `<b>Request ${esc(order.reference)}</b><p>Status: ${esc(order.status)}. Pay the business directly. This request is saved.</p><div>${contactLinks(order.contact, order.reference, order.itemName)}</div><p><a href="orders.html">See your requests</a></p>`;
    };
    api(`/market/businesses/${encodeURIComponent(id || '')}`).then(row => {
      const action = row.kind === 'service' ? 'Request service' : 'Buy';
      box.innerHTML = `<p><a href="${esc(row.kind)}s.html">← Back</a></p><h1>${esc(row.name)}</h1><p>${esc(row.category)} · ${esc(row.area || 'Greater Noida')}</p><p>${esc(row.description || '')}</p>${row.hours ? `<p>Hours: ${esc(row.hours)}</p>` : ''}<div id="itemList"></div>`;
      const list = document.querySelector('#itemList');
      const items = row.items || [];
      list.innerHTML = items.length ? items.map(item => {
        const blocked = !item.available || item.stock === 0;
        return `<article class="item-row"><img alt="" src="${esc(photo(item.photoUrl))}"><div><b>${esc(item.name)}</b><p>${esc(item.description || '')}</p><p>${money(item.price)}${item.priceNote ? ` · ${esc(item.priceNote)}` : ''}${item.stock == null ? '' : ` · ${item.stock} in stock`}${item.available ? '' : ' · Unavailable'}</p>${blocked ? '' : `<button class="primary-button" type="button" data-buy="${esc(item.id)}">${action}</button>`}<div class="buy-result" data-result="${esc(item.id)}"></div></div></article>`;
      }).join('') : '<p>No items yet.</p>';
      list.querySelectorAll('[data-buy]').forEach(button => button.addEventListener('click', async () => {
        const result = list.querySelector(`[data-result="${button.dataset.buy}"]`);
        if (!token()) {
          result.innerHTML = '<p class="market-note">Sign in with your student account, then come back and tap this button.</p><a href="access.html">Sign in</a>';
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
        box.innerHTML = rows.length ? rows.map(row => `<article class="panel"><h3>${esc(row.reference)} · ${esc(row.itemName)}</h3><p>${esc(row.businessName)} · ${esc(row.status)} · Listed ${money(row.listedTotal)}${row.finalAmount == null ? '' : ` · Final ${money(row.finalAmount)}`}</p><div>${contactLinks(row.contact, row.reference, row.itemName)}</div>${row.status === 'completed' && !row.customerConfirm ? `<form data-confirm="${esc(row.id)}"><label>Amount you paid<input name="amount" inputmode="numeric" placeholder="Optional"></label><button class="primary-button" name="result" value="completed" type="submit">Completed</button> <button class="small-button" name="result" value="not_completed" type="submit">Not completed</button> <button class="small-button" name="result" value="disputed" type="submit">Report a problem</button></form>` : `<p>${row.customerConfirm ? `Your answer: ${esc(row.customerConfirm)}` : 'Waiting for the vendor. Your silence is not a confirmation.'}</p>`}</article>`).join('') : '<p>You have no requests yet.</p>';
        box.querySelectorAll('[data-confirm]').forEach(form => form.addEventListener('submit', async event => {
          event.preventDefault();
          const result = event.submitter?.value || 'completed';
          try {
            await api(`/market/orders/${form.dataset.confirm}/confirm`, { method: 'POST', body: JSON.stringify({ result, amount: new FormData(form).get('amount') }) });
            location.reload();
          } catch (error) { alert(error.message); }
        }));
      };
      api('/market/my-orders').then(paint).catch(error => { box.innerHTML = `<p class="market-note">${esc(error.message)}</p>`; });
    }
  }

  const vendorRoot = document.querySelector('[data-market-vendor]');
  if (vendorRoot) {
    const gate = document.querySelector('#vendorGate');
    const desk = document.querySelector('#vendorDesk');
    const session = user();
    if (!token() || session?.role !== 'vendor') {
      desk.hidden = true;
      gate.hidden = false;
    } else {
      gate.hidden = true;
      desk.hidden = false;
      const businesses = document.querySelector('#vendorBusinesses');
      const orders = document.querySelector('#vendorOrders');
      const paint = rows => {
        businesses.innerHTML = rows.map(row => `<article class="panel"><h3>${esc(row.name)}</h3><p>${esc(row.kind)} · ${esc(row.category)} · ${esc(row.status)}</p><p>${esc(row.phone)} · ${esc(row.area)}</p><form data-item="${esc(row.id)}"><h4>Add an item</h4><input name="name" placeholder="Name" required><input name="price" inputmode="numeric" placeholder="Price in ₹" required><input name="category" placeholder="Category"><textarea name="description" placeholder="Description"></textarea><input name="photoUrl" placeholder="Photo link"><input name="stock" inputmode="numeric" placeholder="Stock, shops only"><button class="primary-button" type="submit">Save item</button></form><div>${(row.items || []).map(item => `<p><b>${esc(item.name)}</b> · ${money(item.price)} · ${item.available ? 'Available' : 'Hidden'}${item.stock == null ? '' : ` · Stock ${item.stock}`} <button type="button" data-hide="${esc(item.id)}" data-available="${item.available ? '1' : '0'}">${item.available ? 'Mark unavailable' : 'Mark available'}</button> <button type="button" data-remove="${esc(item.id)}">Remove</button></p>`).join('')}</div></article>`).join('') || '<p>Add your first business below.</p>';
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
      };
      const paintOrders = rows => {
        const query = (document.querySelector('#orderFilter')?.value || '').trim().toLowerCase();
        const shown = rows.filter(row => !query || `${row.reference} ${row.status} ${row.itemName}`.toLowerCase().includes(query));
        orders.innerHTML = shown.map(row => `<article class="panel"><h3>${esc(row.reference)} · ${esc(row.status)}</h3><p>${esc(row.itemName)} · Qty ${row.quantity} · Listed ${money(row.listedTotal)}</p><p>${esc(row.customer?.name || 'Customer')} · ${esc(row.customer?.phone || 'No phone')}</p>${row.finalAmount == null ? '' : `<p>Final ${money(row.finalAmount)} · Commission ${row.commissionAmount == null ? '—' : money(row.commissionAmount)} (${esc(row.commissionStatus || 'unconfirmed')})</p>`}<form data-status="${esc(row.id)}"><input name="finalAmount" inputmode="numeric" placeholder="Final amount ₹"><button class="small-button" name="status" value="accepted" type="submit">Accept</button> <button class="small-button" name="status" value="completed" type="submit">Completed</button> <button class="small-button" name="status" value="cancelled" type="submit">Cancel</button></form></article>`).join('') || '<p>No requests yet.</p>';
        orders.querySelectorAll('[data-status]').forEach(form => form.addEventListener('submit', async event => {
          event.preventDefault();
          try {
            await api(`/market/orders/${form.dataset.status}`, { method: 'PUT', body: JSON.stringify({ status: event.submitter?.value, finalAmount: new FormData(form).get('finalAmount') }) });
            loadOrders();
          } catch (error) { alert(error.message); }
        }));
      };
      const load = () => api('/market/mine').then(paint).catch(error => { businesses.innerHTML = `<p class="market-note">${esc(error.message)}</p>`; });
      const loadOrders = () => api('/market/vendor/orders').then(rows => { orders.dataset.rows = JSON.stringify(rows); paintOrders(rows); }).catch(error => { orders.innerHTML = `<p class="market-note">${esc(error.message)}</p>`; });
      document.querySelector('#orderFilter')?.addEventListener('input', () => { try { paintOrders(JSON.parse(orders.dataset.rows || '[]')); } catch { /* ignore */ } });
      document.querySelector('#newBusiness')?.addEventListener('submit', async event => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.currentTarget));
        try { await api('/market/businesses', { method: 'POST', body: JSON.stringify(data) }); event.currentTarget.reset(); load(); } catch (error) { alert(error.message); }
      });
      load();
      loadOrders();
    }
    document.querySelector('#vendorRegister')?.addEventListener('submit', async event => {
      event.preventDefault();
      try {
        saveSession(await api('/market/register', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }));
        location.reload();
      } catch (error) { alert(error.message); }
    });
    document.querySelector('#vendorLogin')?.addEventListener('submit', async event => {
      event.preventDefault();
      try {
        saveSession(await api('/market/login', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }));
        location.reload();
      } catch (error) { alert(error.message); }
    });
    document.querySelector('[data-vendor-out]')?.addEventListener('click', () => {
      localStorage.removeItem('studentstay_token');
      localStorage.removeItem('studentstay_user');
      location.href = 'vendor.html';
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
