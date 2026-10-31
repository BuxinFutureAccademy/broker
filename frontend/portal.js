(() => {
  const KEYS = { users: 'studentstay.users', profiles: 'studentstay.profiles', listings: 'studentstay.listings', requests: 'studentstay.requests', session: 'studentstay.session' };
  const read = (key, fallback = []) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const esc = (value = '') => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const user = () => read(KEYS.session, null);
  const go = (role) => { location.href = role === 'landlord' ? 'landlord.html' : role === 'admin' ? 'admin.html' : 'access.html#student'; };
  const money = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;
  const imageToDataUrl = async file => {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close?.();
    return canvas.toDataURL('image/jpeg', 0.82);
  };
  const getListings = () => read(KEYS.listings);
  const getRequests = () => read(KEYS.requests);
  const currentListings = (owner) => getListings().filter(item => item.ownerId === owner);
  const img = item => item.photos?.[0] || 'https://images.unsplash.com/photo-1615874694520-474822394e73?auto=format&fit=crop&w=700&q=75';

  document.querySelectorAll('[data-logout]').forEach(button => button.addEventListener('click', () => { localStorage.removeItem(KEYS.session); location.href = 'access.html'; }));
  const authForm = document.querySelector('#authForm');
  if (authForm) {
    let mode = 'signin';
    let role = 'student';
    const tabs = [...document.querySelectorAll('.tab')];
    const roleButtons = [...document.querySelectorAll('.role-choice')];
    const nameField = authForm.elements.name;
    const signupFields = [...document.querySelectorAll('.signup-only')];
    const updateAuth = () => {
      document.querySelector('#authTitle').textContent = mode === 'signup' ? `Join as a ${role}` : 'Welcome back';
      document.querySelector('#authSubtitle').textContent = role === 'admin' ? 'Administrator sign in.' : 'Choose how you use Ekvora.';
      document.querySelector('#authSubmit').textContent = mode === 'signup' ? `Create ${role} account` : `Sign in as ${role[0].toUpperCase()}${role.slice(1)}`;
      document.querySelector('#authNote').textContent = role === 'admin' ? 'Admin access is reserved for the website manager.' : mode === 'signup' ? 'Your account is saved in this browser for this demo.' : 'New here? Choose Create account to get started.';
      nameField.closest('label').classList.toggle('hidden', mode !== 'signup');
      nameField.required = mode === 'signup';
      signupFields.forEach(el => el.classList.toggle('hidden', mode !== 'signup'));
      authForm.elements.phone.required = mode === 'signup' && role === 'landlord';
      authForm.elements.city.required = mode === 'signup' && role === 'landlord';
      authForm.elements.password.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
    };
    tabs.forEach(button => button.addEventListener('click', () => { mode = button.dataset.mode; tabs.forEach(tab => tab.classList.toggle('active', tab === button)); updateAuth(); }));
    roleButtons.forEach(button => button.addEventListener('click', () => { role = button.dataset.role; roleButtons.forEach(item => item.classList.toggle('active', item === button)); if (role === 'admin') mode = 'signin'; tabs.forEach(tab => { tab.classList.toggle('active', tab.dataset.mode === mode); tab.disabled = role === 'admin' && tab.dataset.mode === 'signup'; }); updateAuth(); }));
    const requestedRole = location.hash.slice(1);
    if (['student','landlord','admin'].includes(requestedRole)) roleButtons.find(button => button.dataset.role === requestedRole)?.click();
    if (new URLSearchParams(location.search).get('mode') === 'signup') document.querySelector('[data-mode="signup"]').click();
    if (location.hash === '#student') showStudentArea();
    updateAuth();
    authForm.addEventListener('submit', event => {
      event.preventDefault();
      const form = new FormData(authForm);
      const email = String(form.get('email')).trim().toLowerCase();
      const password = String(form.get('password'));
      if (role === 'admin') {
        if (email !== 'admin@studentstay.local' || password !== 'admin123') return alert('Demo admin login: admin@studentstay.local / admin123');
        write(KEYS.session, { id: 'demo-admin', role: 'admin', name: 'Site administrator', email }); go('admin'); return;
      }
      const users = read(KEYS.users);
      if (mode === 'signup') {
        if (users.some(item => item.email === email)) return alert('An account with this email already exists. Sign in instead.');
        const newUser = { id: crypto.randomUUID(), role, name: String(form.get('name')).trim(), email, password, phone: String(form.get('phone') || '').trim(), city: String(form.get('city') || '').trim(), joined: new Date().toISOString() };
        users.push(newUser); write(KEYS.users, users);
        if (role === 'landlord') { const profiles = read(KEYS.profiles); profiles[newUser.id] = { name: newUser.name, email, phone: newUser.phone, city: newUser.city, address: '' }; write(KEYS.profiles, profiles); }
        write(KEYS.session, newUser); go(role); return;
      }
      const found = users.find(item => item.email === email && item.password === password && item.role === role);
      if (!found) return alert('No matching demo account found. Create an account first, or check your email and password.');
      write(KEYS.session, found); role === 'student' ? showStudentArea() : go(role);
    });
  }

  function showStudentArea() {
    const session = user(); if (!session || session.role !== 'student') return;
    const pendingListing = localStorage.getItem('studentstay.pendingListing');
    if (pendingListing) {
      const requests = getRequests();
      if (!requests.some(request => request.listingId === pendingListing && request.studentId === session.id)) requests.push({ id: crypto.randomUUID(), listingId: pendingListing, studentId: session.id, created: new Date().toISOString(), status: 'New request' });
      write(KEYS.requests, requests); localStorage.removeItem('studentstay.pendingListing');
    }
    document.querySelector('.auth-card')?.classList.add('hidden');
    const area = document.querySelector('#studentArea'); if (!area) return;
    area.classList.remove('hidden');
    document.querySelector('#studentGreeting').textContent = `Hello, ${session.name.split(' ')[0]}`;
    const myRequests = getRequests().filter(request => request.studentId === session.id);
    document.querySelector('#studentStats').innerHTML = `<div class="stat-card"><span class="stat-icon">⌂</span><div><strong>${getListings().length}</strong><small>Available homes</small></div></div><div class="stat-card"><span class="stat-icon">▣</span><div><strong>${myRequests.length}</strong><small>Your requests</small></div></div><div class="stat-card"><span class="stat-icon">✓</span><div><strong>Free</strong><small>Ekvora support</small></div></div>`;
    renderListings('#studentListings', getListings(), { request: true, studentId: session.id });
    const requests = myRequests.map(r => { const listing = getListings().find(item => item.id === r.listingId); return `<div class="request-row"><div><b>${esc(listing?.title || 'Listing removed')}</b><p>Requested ${new Date(r.created).toLocaleDateString()}</p></div><span class="status-pill">${esc(r.status)}</span></div>`; }).join('');
    document.querySelector('#studentRequests').innerHTML = requests || '<div class="empty-state">You have not requested a room yet.</div>';
  }

  function renderListings(selector, items, options = {}) {
    const target = document.querySelector(selector); if (!target) return;
    if (!items.length) { target.innerHTML = '<div class="empty-state">No room listings here yet. Add the first property to get started.</div>'; return; }
    target.innerHTML = items.map(item => `<article class="listing-tile detail-link" data-property-id="${esc(item.id)}" tabindex="0" role="link"><img src="${esc(img(item))}" alt="${esc(item.title)}"><div class="listing-tile-body"><h3>${esc(item.title)}</h3><p>${esc(item.type)} · ${esc(item.city || item.address)}</p><div class="listing-price">${money(item.rent)} <small>/ month</small></div><p>${esc(item.description)}</p><p>⌖ ${esc(item.address)}</p>${options.owner ? `<div class="listing-actions"><button class="small-button" data-delete-listing="${esc(item.id)}">Remove listing</button></div>` : options.request ? `<div class="listing-actions"><button class="primary-button" data-request-listing="${esc(item.id)}">Request this room</button></div>` : ''}</div></article>`).join('');
    target.querySelectorAll('[data-property-id]').forEach(tile => { tile.addEventListener('click', event => { if (!event.target.closest('button')) location.href = `property.html?id=${encodeURIComponent(tile.dataset.propertyId)}`; }); tile.addEventListener('keydown', event => { if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('button')) { event.preventDefault(); location.href = `property.html?id=${encodeURIComponent(tile.dataset.propertyId)}`; } }); });
    target.querySelectorAll('[data-delete-listing]').forEach(button => button.addEventListener('click', () => { if (!confirm('Remove this listing from the demo site?')) return; write(KEYS.listings, getListings().filter(item => item.id !== button.dataset.deleteListing)); refreshLandlord(); }));
    target.querySelectorAll('[data-request-listing]').forEach(button => button.addEventListener('click', () => { const requests = getRequests(); if (requests.some(req => req.listingId === button.dataset.requestListing && req.studentId === options.studentId)) return alert('You already requested this room.'); requests.push({ id: crypto.randomUUID(), listingId: button.dataset.requestListing, studentId: options.studentId, created: new Date().toISOString(), status: 'New request' }); write(KEYS.requests, requests); showStudentArea(); }));
  }

  function guard(role) { const session = user(); if (!session || session.role !== role) { location.href = `access.html#${role}`; return null; } return session; }
  const landlordPage = document.querySelector('#profileForm');
  if (landlordPage) {
    const session = guard('landlord');
    if (session) {
      const profiles = read(KEYS.profiles); const profile = profiles[session.id] || { name: session.name, email: session.email, phone: session.phone, city: session.city, address: '' };
      document.querySelector('#landlordHeaderName').textContent = profile.name || session.name;
      document.querySelector('#landlordAvatar').textContent = (profile.name || 'L').slice(0,1).toUpperCase();
      document.querySelector('#landlordWelcome').textContent = (profile.name || 'landlord').split(' ')[0];
      Object.entries(profile).forEach(([key, value]) => { if (landlordPage.elements[key]) landlordPage.elements[key].value = value || ''; });
      landlordPage.addEventListener('submit', event => { event.preventDefault(); const next = Object.fromEntries(new FormData(landlordPage)); const all = read(KEYS.profiles); all[session.id] = next; write(KEYS.profiles, all); const users = read(KEYS.users).map(item => item.id === session.id ? { ...item, name: next.name, phone: next.phone, city: next.city } : item); write(KEYS.users, users); write(KEYS.session, { ...session, name: next.name }); document.querySelector('#landlordHeaderName').textContent = next.name; document.querySelector('#landlordWelcome').textContent = next.name.split(' ')[0]; alert('Your landlord profile has been saved.'); });
      const photoInput = document.querySelector('[name="photos"]');
      photoInput.addEventListener('change', () => { const files = [...photoInput.files]; if (files.length > 5) { alert('Choose up to 5 photos.'); photoInput.value = ''; return; } if (files.some(file => !file.type.startsWith('image/'))) { alert('Please upload image files only. Videos are not accepted.'); photoInput.value = ''; return; } document.querySelector('#photoPreview').innerHTML = files.map(file => `<img alt="Selected room photo" src="${URL.createObjectURL(file)}">`).join(''); });
      document.querySelector('#listingForm').addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); const files = [...data.getAll('photos')].filter(file => file.size && file.type.startsWith('image/')); if (files.length > 5) return alert('Choose up to 5 photos.'); try { const photos = await Promise.all(files.map(imageToDataUrl)); const all = getListings(); all.unshift({ id: crypto.randomUUID(), ownerId: session.id, ownerName: profile.name || session.name, title: String(data.get('title')).trim(), type: String(data.get('type')), rent: Number(data.get('rent')), available: String(data.get('available')), address: String(data.get('address')).trim(), city: profile.city || '', description: String(data.get('description')).trim(), photos, created: new Date().toISOString() }); write(KEYS.listings, all); form.reset(); document.querySelector('#photoPreview').innerHTML = ''; refreshLandlord(); alert('Your room listing has been published.'); } catch { alert('The images could not be saved in this browser. Try fewer or smaller photos.'); } });
      refreshLandlord();
    }
  }
  function refreshLandlord() {
    const session = user(); if (!session || !document.querySelector('#landlordListings')) return;
    const listings = currentListings(session.id); const requests = getRequests().filter(req => listings.some(item => item.id === req.listingId));
    document.querySelector('#landlordStats').innerHTML = `<div class="stat-card"><span class="stat-icon">⌂</span><div><strong>${listings.length}</strong><small>Active listings</small></div></div><div class="stat-card"><span class="stat-icon">♙</span><div><strong>${requests.length}</strong><small>Student requests</small></div></div><div class="stat-card"><span class="stat-icon">✓</span><div><strong>Verified</strong><small>Landlord account</small></div></div>`;
    renderListings('#landlordListings', listings, { owner: true });
    const allUsers = read(KEYS.users); const profiles = read(KEYS.profiles);
    const rows = requests.map(req => { const student = allUsers.find(item => item.id === req.studentId); const listing = listings.find(item => item.id === req.listingId); return `<div class="request-row"><div><b>${esc(student?.name || 'Student')}</b><p>${esc(student?.email || '')} · ${esc(student?.phone || 'No phone provided')}<br>Interested in: ${esc(listing?.title || 'Property')}</p></div><span class="status-pill">${new Date(req.created).toLocaleDateString()}</span></div>`; }).join('');
    document.querySelector('#landlordStudents').innerHTML = rows || '<div class="empty-state">No students have requested your rooms yet.</div>';
  }

  if (document.querySelector('#adminStats')) {
    const session = guard('admin'); if (session) refreshAdmin();
  }
  function refreshAdmin(search = '') {
    const users = read(KEYS.users); const landlords = users.filter(item => item.role === 'landlord'); const students = users.filter(item => item.role === 'student'); const listings = getListings();
    document.querySelector('#adminStats').innerHTML = `<div class="stat-card"><span class="stat-icon">♙</span><div><strong>${users.length}</strong><small>Total users</small></div></div><div class="stat-card"><span class="stat-icon">⌂</span><div><strong>${landlords.length}</strong><small>Landlords</small></div></div><div class="stat-card"><span class="stat-icon">▣</span><div><strong>${listings.length}</strong><small>Room listings</small></div></div>`;
    const filtered = users.filter(item => `${item.name} ${item.email} ${item.role}`.toLowerCase().includes(search.toLowerCase()));
    document.querySelector('#userRows').innerHTML = filtered.map(item => `<tr><td><b>${esc(item.name)}</b></td><td><span class="role-badge">${esc(item.role)}</span></td><td>${esc(item.email)}</td><td>${esc(item.phone || '—')}</td><td>${item.joined ? new Date(item.joined).toLocaleDateString() : '—'}</td></tr>`).join('') || '<tr><td colspan="5">No matching users.</td></tr>';
    const profiles = read(KEYS.profiles);
    document.querySelector('#landlordCards').innerHTML = landlords.map(item => { const profile = profiles[item.id] || item; return `<article class="landlord-card"><span class="user-avatar">${esc((profile.name || 'L').slice(0,1).toUpperCase())}</span><div><h3>${esc(profile.name || item.name)}</h3><p>${esc(profile.email || item.email)}</p><p>${esc(profile.phone || item.phone || 'No phone')} · ${esc(profile.city || item.city || 'City not added')}</p><p>Address: ${esc(profile.address || 'Not provided')}</p><p>${currentListings(item.id).length} listing(s)</p></div></article>`; }).join('') || '<div class="empty-state">No landlord accounts yet.</div>';
    renderListings('#adminListings', listings);
    document.querySelector('#userSearch').oninput = event => refreshAdmin(event.target.value);
  }
})();
