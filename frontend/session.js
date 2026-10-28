(() => {
  const box = document.querySelector('.account');
  if (!box) return;

  let user = null;
  try { user = JSON.parse(localStorage.getItem('studentstay_user') || 'null'); } catch { user = null; }
  const token = localStorage.getItem('studentstay_token');
  if (!user || !token) return;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const dashboards = { student: 'student.html', landlord: 'landlord.html', broker: 'broker.html', admin: 'admin.html' };
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
