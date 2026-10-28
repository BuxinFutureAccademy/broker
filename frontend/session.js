(() => {
  const box = document.querySelector('.account');
  if (!box) return;

  let user = null;
  try { user = JSON.parse(localStorage.getItem('studentstay_user') || 'null'); } catch { user = null; }
  const token = localStorage.getItem('studentstay_token');
  if (!user || !token) return;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const dashboards = { student: 'student.html', landlord: 'landlord.html', admin: 'admin.html' };
  const dashboard = dashboards[user.role] || 'access.html';
  const initial = esc((user.name || 'U').slice(0, 1).toUpperCase());

  box.classList.add('signed-in');
  box.innerHTML = `
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
  const dashboards = { student: 'student.html', landlord: 'landlord.html', admin: 'admin.html' };
  const account = user && token ? (dashboards[user.role] || 'access.html') : 'access.html';
  const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const on = (...names) => names.includes(page) ? ' class="on"' : '';
  const signed = user && token;
  const nav = document.createElement('nav');
  nav.className = 'phone-nav';
  nav.setAttribute('aria-label', 'Phone');
  const youOn = page === 'access.html' || (signed && page === account);
  nav.innerHTML = `<a${on('index.html')} href="index.html"><b>⌂</b><span>Home</span></a><a${on('properties.html','property.html')} href="properties.html"><b>▣</b><span>Properties</span></a><a${on('about.html')} href="about.html"><b>✦</b><span>About</span></a><a${on('contact.html')} href="contact.html"><b>✉</b><span>Contact</span></a><a${youOn ? ' class="on"' : ''} href="${account}"><b>●</b><span>${signed ? 'You' : 'Sign in'}</span></a>`;
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
    const wa = dial(phone).replace(/^\+/, '');
    const intro = 'Hello StudentStay, my name is ______. I am an international student looking for a room in Greater Noida. How can you help me?';
    const mailBody = 'Hello StudentStay,\n\nMy name is ______.\n\nI am an international student looking for a room in Greater Noida.\n\nHow can you help me?';
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
    if (who) who.textContent = name;
    const note = document.querySelector('#contactNote');
    if (!note) return;
    if (phone || email) note.textContent = 'Call, WhatsApp, or email. The message already says hello. Add your name, then send it.';
    else if (!('contactPhone' in payment)) note.textContent = 'The number is saved. The server is still updating, so these buttons are off for a minute. Refresh this page and they will open WhatsApp and email.';
    else note.textContent = 'No WhatsApp number or email is saved yet. Add them on the admin Payment QR page.';
  }).catch(() => {});
})();
