(() => {
  const box = document.querySelector('.account');
  if (!box) return;

  let user = null;
  try { user = JSON.parse(localStorage.getItem('studentstay_user') || 'null'); } catch { user = null; }
  const token = localStorage.getItem('studentstay_token');
  if (!user || !token) return;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const dashboards = { student: 'student.html', landlord: 'landlord.html', admin: 'admin.html', restaurant: 'owner.html', shop: 'owner.html', service: 'owner.html' };
  const dashboard = dashboards[user.role] || 'access.html';
  const initial = esc((user.name || 'U').slice(0, 1).toUpperCase());

  box.classList.add('signed-in');
  box.innerHTML = `
    <a class="icon-btn" href="orders.html" aria-label="Requests"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9"/><path d="M10 21h4"/></svg></a>
    <a class="icon-btn" href="${dashboard}" aria-label="Account"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="3"/><path d="M5 19c1.5-3 3.5-4 7-4s5.5 1 7 4"/></svg></a>
    <a class="account-chip" href="${dashboard}">
      <span class="user-avatar">${initial}</span>
      <span class="account-copy"><b>${esc(user.name)}</b><small>${esc(user.role)}</small></span>
    </a>
    <a class="login" href="${dashboard}">Dashboard</a>
    <button class="signup" type="button" id="siteSignOut">Sign out</button>
  `;

  document.querySelector('#siteSignOut')?.addEventListener('click', () => {
    localStorage.removeItem('studentstay_token');
    localStorage.removeItem('studentstay_user');
    location.href = 'access.html';
  });
})();

(() => {
  if (!document.querySelector('.topbar') || document.querySelector('.phone-nav')) return;
  let user = null;
  try { user = JSON.parse(localStorage.getItem('studentstay_user') || 'null'); } catch { user = null; }
  const token = localStorage.getItem('studentstay_token');
  const dashboards = { student: 'student.html', landlord: 'landlord.html', admin: 'admin.html', restaurant: 'owner.html', shop: 'owner.html', service: 'owner.html' };
  const account = user && token ? (dashboards[user.role] || 'access.html') : 'access.html';
  const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const signed = user && token;
  const sections = [
    { href: 'index.html', label: 'Houses', pages: ['index.html', 'properties.html', 'property.html'] },
    { href: 'food.html', label: 'Restaurants', pages: ['food.html', 'restaurants.html'] },
    { href: 'shop.html', label: 'Shop', pages: ['shop.html', 'shops.html'] },
    { href: 'service.html', label: 'Services', pages: ['service.html', 'services.html'] }
  ];
  let poolHome = '';
  try { poolHome = localStorage.getItem('studentstay_pool') || ''; } catch { poolHome = ''; }
  const here = section => section.pages.includes(page) || ((page === 'business.html' || page === 'orders.html') && poolHome === section.href);
  const current = sections.find(here);
  if (current) {
    try { localStorage.setItem('studentstay_pool', current.href); } catch { /* keep going */ }
  }
  const more = [
    { href: 'contact.html', label: 'Contact us' },
    { href: 'about.html', label: 'About us' },
    { href: 'policy.html', label: 'Privacy and policy' }
  ];
  const top = document.querySelector('.nav');
  if (top) {
    const main = sections.map(section => `<a${here(section) ? ' class="active"' : ''} href="${section.href}">${section.label}</a>`).join('');
    const rest = more.map(item => `<a${page === item.href ? ' class="active"' : ''} href="${item.href}">${item.label}</a>`).join('');
    const gate = signed
      ? `<a href="${account}">Dashboard</a>`
      : `<a href="access.html">Sign in</a><a href="access.html?mode=owners">Owners</a>`;
    top.innerHTML = `<span class="nav-group">${main}</span><span class="nav-group">${rest}${gate}</span>`;
  }
  const nav = document.createElement('nav');
  nav.className = document.body.classList.contains('market-app') ? 'app-tabbar' : 'phone-nav';
  nav.setAttribute('aria-label', 'Phone');
  const youOn = page === 'access.html' || (signed && page === account);
  const you = `<a${youOn ? ' class="on"' : ''} href="${account}"><b>●</b><span>${signed ? 'You' : 'Sign in'}</span></a>`;
  if (document.body.classList.contains('market-app')) {
    const exploreMap = { 'food.html': 'restaurants.html', 'restaurants.html': 'restaurants.html', 'shop.html': 'shops.html', 'shops.html': 'shops.html', 'service.html': 'services.html', 'services.html': 'services.html' };
    const explore = exploreMap[page] || (page === 'business.html' && poolHome === 'food.html' ? 'restaurants.html' : page === 'business.html' && poolHome === 'shop.html' ? 'shops.html' : page === 'business.html' && poolHome === 'service.html' ? 'services.html' : 'properties.html');
    const icon = (path, label, href, on) => `<a class="${on ? 'on' : ''}" href="${href}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="${path}"/></svg><span>${label}</span></a>`;
    nav.innerHTML = [
      icon('M4 11 12 4l8 7v9H4z', 'Home', 'index.html', page === 'index.html'),
      icon('M11 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm8.5 13.5-3.2-3.2', 'Explore', explore, ['properties.html', 'property.html', 'food.html', 'restaurants.html', 'shop.html', 'shops.html', 'service.html', 'services.html', 'business.html'].includes(page)),
      icon('M12 20s-7-4.4-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.6-7 9-7 9z', 'Favorites', 'saved.html', page === 'saved.html'),
      `<button type="button" class="tab-more${youOn ? ' on' : ''}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14"/></svg><span>More</span></button>`
    ].join('');
    document.body.appendChild(nav);
    nav.querySelector('.tab-more')?.addEventListener('click', () => links?.classList.toggle('nav-open'));
    const menu = document.querySelector('.menu');
    const links = document.querySelector('.nav');
    menu?.addEventListener('click', () => links?.classList.toggle('nav-open'));
    return;
  }
  const interestHomes = { houses: 'index.html', restaurants: 'food.html', shops: 'shop.html', services: 'service.html' };
  if (page === 'access.html') {
    const back = interestHomes[new URLSearchParams(location.search).get('interest') || ''];
    if (back) document.querySelectorAll('.brand, .back-home').forEach(link => link.setAttribute('href', back));
  }
  nav.innerHTML = you;
  document.body.appendChild(nav);
  const menu = document.querySelector('.menu');
  const links = document.querySelector('.nav');
  menu?.addEventListener('click', () => links?.classList.toggle('nav-open'));
})();

(() => {
  const dial = value => String(value || '').replace(/[^\d+]/g, '');
  fetch('https://broker-961c.onrender.com/api/payment').then(response => response.ok ? response.json() : null).then(payment => {
    if (!payment) return;
    const phone = payment.contactPhone || '';
    const email = payment.contactEmail || '';
    const name = payment.contactName || 'Admin';
    const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const uniq = list => {
      const out = [];
      list.forEach(item => {
        const text = String(item || '').trim();
        if (text && !out.includes(text)) out.push(text);
      });
      return out;
    };
    const saved = payment.contacts || {};
    const names = uniq([...(saved.names || []), name === 'Admin' ? '' : name]);
    const phones = uniq([phone, ...(saved.phones || [])]);
    const emails = uniq([email, ...(saved.emails || [])]);
    const directory = document.querySelector('#contactDirectory');
    if (directory) {
      const blocks = [];
      if (names.length) blocks.push(`<h3>Names</h3><ul>${names.map(item => `<li>${esc(item)}</li>`).join('')}</ul>`);
      if (phones.length) blocks.push(`<h3>Phone numbers</h3><ul>${phones.map(item => `<li><a href="tel:${dial(item)}">${esc(item)}</a></li>`).join('')}</ul>`);
      if (emails.length) blocks.push(`<h3>Emails</h3><ul>${emails.map(item => `<li>${esc(item)}</li>`).join('')}</ul>`);
      directory.innerHTML = blocks.join('');
      directory.hidden = !blocks.length;
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
      const detail = item.querySelector('small');
      if (detail && phone) detail.textContent = phone;
    });
    document.querySelectorAll('[data-reach="mail"]').forEach(item => {
      if (!email) return;
      item.hidden = false;
      item.href = `mailto:${email}?subject=${encodeURIComponent('How can you help me?')}&body=${encodeURIComponent(mailBody)}`;
      const detail = item.querySelector('small');
      if (detail) detail.textContent = email;
    });
    const call = document.querySelector('#contactCall');
    if (call && phone) {
      call.hidden = false;
      call.href = `tel:${dial(phone)}`;
      const detail = call.querySelector('small');
      if (detail) detail.textContent = phone;
    }
    const who = document.querySelector('#contactWho');
    if (who) who.textContent = names[0] || name;
    const note = document.querySelector('#contactNote');
    if (!note) return;
    if (phone || email) note.textContent = 'Call, WhatsApp, or email. The message already says hello. Add your name, then send it.';
    else if (!('contactPhone' in payment)) note.textContent = 'The number is saved. The server is still updating, so these buttons are off for a minute. Refresh this page and they will open WhatsApp and email.';
    else note.textContent = 'No WhatsApp number or email is saved yet. Add them on the admin Payment QR page.';
  }).catch(() => {});
})();

(() => {
  const key = 'ekvora_saved';
  const read = () => { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } };
  const write = rows => localStorage.setItem(key, JSON.stringify(rows.slice(0, 100)));
  const idOf = card => card?.dataset.itemId || card?.dataset.propertyId || card?.dataset.businessId || '';
  const mark = () => {
    const ids = new Set(read().map(item => item.id));
    document.querySelectorAll('.heart').forEach(button => {
      const id = idOf(button.closest('[data-property-id], [data-business-id]'));
      if (id) button.classList.toggle('saved', ids.has(id));
    });
  };
  document.addEventListener('click', event => {
    const button = event.target.closest('.heart');
    if (!button) return;
    const card = button.closest('[data-property-id], [data-business-id]');
    const id = idOf(card);
    if (!id) return;
    setTimeout(() => {
      const rows = read().filter(item => item.id !== id);
      if (button.classList.contains('saved')) {
        const title = card.querySelector('h3')?.textContent || 'Saved';
        const image = card.querySelector('img')?.getAttribute('src') || '';
        const price = card.querySelector('.price')?.textContent || '';
        const href = card.dataset.propertyId ? `property.html?id=${encodeURIComponent(id)}` : `business.html?id=${encodeURIComponent(card.dataset.businessId || id)}${card.dataset.itemId ? `&item=${encodeURIComponent(card.dataset.itemId)}` : ''}`;
        rows.unshift({ id, title, image, price, href });
      }
      write(rows);
    }, 0);
  }, true);
  if (document.body) {
    mark();
    new MutationObserver(mark).observe(document.body, { childList: true, subtree: true });
  }
})();
