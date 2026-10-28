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
  const mark = name => page === name ? ' class="on"' : '';
  const nav = document.createElement('nav');
  nav.className = 'phone-nav';
  nav.setAttribute('aria-label', 'Phone');
  nav.innerHTML = `<a${mark('index.html')} href="index.html"><b>⌂</b><span>Home</span></a><a${page === 'properties.html' || page === 'property.html' ? ' class="on"' : ''} href="properties.html"><b>▣</b><span>Homes</span></a><a href="index.html#help"><b>✉</b><span>Contact</span></a><a${page === 'access.html' || account !== 'access.html' && page === account ? ' class="on"' : ''} href="${account}"><b>●</b><span>${user && token ? 'You' : 'Sign in'}</span></a>`;
  document.body.appendChild(nav);
})();
