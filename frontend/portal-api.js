(() => {
  console.log('portal-api.js loaded');
  const API_BASE = 'https://broker-961c.onrender.com/api'; // Production backend URL
  let token = localStorage.getItem('studentstay_token');
  let currentUser = JSON.parse(localStorage.getItem('studentstay_user') || 'null');

  // Reload user from localStorage on page load
  function loadUserFromStorage() {
    token = localStorage.getItem('studentstay_token');
    currentUser = JSON.parse(localStorage.getItem('studentstay_user') || 'null');
  }

  // Call on page load
  loadUserFromStorage();
  console.log('User loaded:', currentUser);

  const esc = (value = '') => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const money = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;
  const img = item => item.photos?.[0] || 'https://images.unsplash.com/photo-1615874694520-474822394e73?auto=format&fit=crop&w=700&q=75';

  async function apiCall(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    if (response.status === 401) {
      localStorage.removeItem('studentstay_token');
      localStorage.removeItem('studentstay_user');
      window.location.href = 'access.html';
      return null;
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API request failed');
    }

    return response.json();
  }

  async function uploadImage(file) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error('Image upload failed');
    }

    return response.json();
  }

  const go = (role) => { location.href = role === 'landlord' ? 'landlord.html' : role === 'broker' ? 'broker.html' : role === 'admin' ? 'admin.html' : 'access.html#student'; };

  document.querySelectorAll('[data-logout]').forEach(button => button.addEventListener('click', () => {
    localStorage.removeItem('studentstay_token');
    localStorage.removeItem('studentstay_user');
    location.href = 'access.html';
  }));

  const authForm = document.querySelector('#authForm');
  console.log('Auth form found:', !!authForm);
  if (authForm) {
    let mode = 'signin';
    let role = 'student';
    const tabs = [...document.querySelectorAll('.tab')];
    const roleButtons = [...document.querySelectorAll('.role-choice')];
    const nameField = authForm.elements.name;
    const signupFields = [...document.querySelectorAll('.signup-only')];

    const updateAuth = () => {
      document.querySelector('#authTitle').textContent = mode === 'signup' ? `Join as a ${role}` : 'Welcome back';
      document.querySelector('#authSubtitle').textContent = role === 'admin' ? 'Administrator sign in.' : 'Choose how you use StudentStay.';
      document.querySelector('#authSubmit').textContent = mode === 'signup' ? `Create ${role} account` : `Sign in as ${role[0].toUpperCase()}${role.slice(1)}`;
      document.querySelector('#authNote').textContent = role === 'admin' ? 'Admin access is reserved for the website manager.' : mode === 'signup' ? 'Your account will be created on the server.' : 'New here? Choose Create account to get started.';
      nameField.closest('label').classList.toggle('hidden', mode !== 'signup');
      nameField.required = mode === 'signup';
      signupFields.forEach(el => el.classList.toggle('hidden', mode !== 'signup'));
      authForm.elements.phone.required = mode === 'signup' && (role === 'landlord' || role === 'broker');
      authForm.elements.city.required = mode === 'signup' && (role === 'landlord' || role === 'broker');
      authForm.elements.password.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
    };

    tabs.forEach(button => button.addEventListener('click', () => { mode = button.dataset.mode; tabs.forEach(tab => tab.classList.toggle('active', tab === button)); updateAuth(); }));
    roleButtons.forEach(button => button.addEventListener('click', () => { role = button.dataset.role; roleButtons.forEach(item => item.classList.toggle('active', item === button)); if (role === 'admin') mode = 'signin'; tabs.forEach(tab => { tab.classList.toggle('active', tab.dataset.mode === mode); tab.disabled = role === 'admin' && tab.dataset.mode === 'signup'; }); updateAuth(); }));
    const requestedRole = location.hash.slice(1);
    if (['student','landlord','broker','admin'].includes(requestedRole)) roleButtons.find(button => button.dataset.role === requestedRole)?.click();
    if (new URLSearchParams(location.search).get('mode') === 'signup') document.querySelector('[data-mode="signup"]').click();
    if (location.hash === '#student') showStudentArea();
    updateAuth();

    authForm.addEventListener('submit', async event => {
      console.log('Form submitted');
      event.preventDefault();
      console.log('Event prevented');
      const form = new FormData(authForm);
      const email = String(form.get('email')).trim().toLowerCase();
      const password = String(form.get('password'));
      console.log('Email:', email, 'Role:', role);

      if (role === 'admin') {
        try {
          const response = await apiCall('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password, role: 'admin' })
          });
          if (response) {
            token = response.access_token;
            currentUser = response.user;
            localStorage.setItem('studentstay_token', token);
            localStorage.setItem('studentstay_user', JSON.stringify(currentUser));
            go('admin');
          }
        } catch (error) {
          alert(error.message);
        }
        return;
      }

      try {
        let response;
        if (mode === 'signup') {
          response = await apiCall('/auth/signup', {
            method: 'POST',
            body: JSON.stringify({
              name: String(form.get('name')).trim(),
              email,
              password,
              role,
              phone: String(form.get('phone') || '').trim(),
              city: String(form.get('city') || '').trim(),
              address: String(form.get('address') || '').trim()
            })
          });
        } else {
          response = await apiCall('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password, role })
          });
        }

        if (response) {
          token = response.access_token;
          currentUser = response.user;
          localStorage.setItem('studentstay_token', token);
          localStorage.setItem('studentstay_user', JSON.stringify(currentUser));
          go(role);
        }
      } catch (error) {
        alert(error.message);
      }
    });
  }

  async function showStudentArea() {
    if (!currentUser || currentUser.role !== 'student') return;

    try {
      const [listings, requests] = await Promise.all([
        apiCall('/listings'),
        apiCall('/requests/student')
      ]);

      const listingCountEl = document.querySelector('#listingCount');
      const requestCountEl = document.querySelector('#requestCount');
      if (listingCountEl) listingCountEl.textContent = listings.length;
      if (requestCountEl) requestCountEl.textContent = requests.length;

      renderListings('#studentListings', listings, { request: true, studentId: currentUser.id });

      const requestRows = requests.map(r => `<div class="request-row"><div><b>${esc(r.listing?.title || 'Listing removed')}</b><p>Requested ${new Date(r.created).toLocaleDateString()}</p></div><span class="status-pill">${esc(r.status)}</span></div>`).join('');
      const requestsEl = document.querySelector('#studentRequests');
      if (requestsEl) {
        requestsEl.innerHTML = requestRows || '<div class="empty-state">You have not requested a room yet.</div>';
      }
    } catch (error) {
      console.error('Error loading student area:', error);
    }
  }

  // Initialize student dashboard
  const studentPage = document.querySelector('#studentWelcome');
  if (studentPage) {
    const session = guard('student');
    if (session) {
      document.querySelector('#studentHeaderName').textContent = session.name;
      document.querySelector('#studentAvatar').textContent = session.name.slice(0, 1).toUpperCase();
      document.querySelector('#studentWelcome').textContent = session.name.split(' ')[0];

      showStudentArea();
    }
  }

  function renderListings(selector, items, options = {}) {
    const target = document.querySelector(selector); if (!target) return;
    if (!items.length) { target.innerHTML = '<div class="empty-state">No room listings here yet. Add the first property to get started.</div>'; return; }
    target.innerHTML = items.map(item => `<article class="listing-tile detail-link" data-property-id="${esc(item.id)}" tabindex="0" role="link"><img src="${esc(img(item))}" alt="${esc(item.title)}"><div class="listing-tile-body"><h3>${esc(item.title)}</h3><p>${esc(item.type)} · ${esc(item.city || item.address)}</p><div class="listing-price">${money(item.rent)} <small>/ month</small></div><p>${esc(item.description)}</p><p>⌖ ${esc(item.address)}</p>${options.owner ? `<div class="listing-actions"><button class="small-button" data-delete-listing="${esc(item.id)}">Remove listing</button></div>` : options.request ? `<div class="listing-actions"><button class="primary-button" data-request-listing="${esc(item.id)}">Request this room</button></div>` : ''}</div></article>`).join('');
    target.querySelectorAll('[data-property-id]').forEach(tile => { tile.addEventListener('click', event => { if (!event.target.closest('button')) location.href = `property.html?id=${encodeURIComponent(tile.dataset.propertyId)}`; }); tile.addEventListener('keydown', event => { if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('button')) { event.preventDefault(); location.href = `property.html?id=${encodeURIComponent(tile.dataset.propertyId)}`; } }); });
    target.querySelectorAll('[data-delete-listing]').forEach(button => button.addEventListener('click', async () => { if (!confirm('Remove this listing?')) return; try { await apiCall(`/listings/${button.dataset.deleteListing}`, { method: 'DELETE' }); refreshLandlord(); } catch (error) { alert(error.message); } }));
    target.querySelectorAll('[data-request-listing]').forEach(button => button.addEventListener('click', async () => { try { await apiCall('/requests', { method: 'POST', body: JSON.stringify({ listingId: button.dataset.requestListing }) }); showStudentArea(); } catch (error) { alert(error.message); } }));
  }

  function guard(role) {
    loadUserFromStorage();
    if (!currentUser || currentUser.role !== role) {
      location.href = `access.html#${role}`;
      return null;
    }
    return currentUser;
  }

  const landlordPage = document.querySelector('#profileForm');
  if (landlordPage) {
    const session = guard('landlord');
    if (session) {
      document.querySelector('#landlordHeaderName').textContent = session.name;
      document.querySelector('#landlordAvatar').textContent = session.name.slice(0,1).toUpperCase();
      document.querySelector('#landlordWelcome').textContent = session.name.split(' ')[0];
      Object.entries(session).forEach(([key, value]) => { if (landlordPage.elements[key]) landlordPage.elements[key].value = value || ''; });
      
      landlordPage.addEventListener('submit', async event => {
        event.preventDefault();
        const next = Object.fromEntries(new FormData(landlordPage));
        try {
          const updated = await apiCall('/profile', {
            method: 'PUT',
            body: JSON.stringify(next)
          });
          currentUser = updated;
          localStorage.setItem('studentstay_user', JSON.stringify(currentUser));
          document.querySelector('#landlordHeaderName').textContent = updated.name;
          document.querySelector('#landlordWelcome').textContent = updated.name.split(' ')[0];
          alert('Your landlord profile has been saved.');
        } catch (error) {
          alert(error.message);
        }
      });

      const photoInput = document.querySelector('[name="photos"]');
      photoInput.addEventListener('change', () => { const files = [...photoInput.files]; if (files.length > 5) { alert('Choose up to 5 photos.'); photoInput.value = ''; return; } if (files.some(file => !file.type.startsWith('image/'))) { alert('Please upload image files only. Videos are not accepted.'); photoInput.value = ''; return; } document.querySelector('#photoPreview').innerHTML = files.map(file => `<img alt="Selected room photo" src="${URL.createObjectURL(file)}">`).join(''); });

      document.querySelector('#listingForm').addEventListener('submit', async event => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const files = [...data.getAll('photos')].filter(file => file.size && file.type.startsWith('image/'));
        if (files.length > 5) return alert('Choose up to 5 photos.');
        
        try {
          const photos = await Promise.all(files.map(uploadImage));
          const all = await apiCall('/listings', {
            method: 'POST',
            body: JSON.stringify({
              title: String(data.get('title')).trim(),
              type: String(data.get('type')),
              rent: Number(data.get('rent')),
              available: String(data.get('available')),
              address: String(data.get('address')).trim(),
              description: String(data.get('description')).trim(),
              photos: photos.map(p => p.url)
            })
          });
          form.reset();
          document.querySelector('#photoPreview').innerHTML = '';
          refreshLandlord();
          alert('Your room listing has been published.');
        } catch (error) {
          alert(error.message || 'The images could not be uploaded. Try fewer or smaller photos.');
        }
      });

      refreshLandlord();
    }
  }

  async function refreshLandlord() {
    if (!currentUser || !document.querySelector('#landlordListings')) return;
    
    try {
      const [listings, requests] = await Promise.all([
        apiCall('/listings/landlord'),
        apiCall('/requests/landlord')
      ]);

      document.querySelector('#landlordStats').innerHTML = `<div class="stat-card"><span class="stat-icon">⌂</span><div><strong>${listings.length}</strong><small>Active listings</small></div></div><div class="stat-card"><span class="stat-icon">♙</span><div><strong>${requests.length}</strong><small>Student requests</small></div></div><div class="stat-card"><span class="stat-icon">✓</span><div><strong>Verified</strong><small>Landlord account</small></div></div>`;
      renderListings('#landlordListings', listings, { owner: true });
      
      const rows = requests.map(req => `<div class="request-row"><div><b>${esc(req.student?.name || 'Student')}</b><p>${esc(req.student?.email || '')} · ${esc(req.student?.phone || 'No phone provided')}<br>Interested in: ${esc(req.listing?.title || 'Property')}</p></div><span class="status-pill">${new Date(req.created).toLocaleDateString()}</span></div>`).join('');
      document.querySelector('#landlordStudents').innerHTML = rows || '<div class="empty-state">No students have requested your rooms yet.</div>';
    } catch (error) {
      console.error('Error loading landlord data:', error);
    }
  }

  if (document.querySelector('#adminStats')) {
    const session = guard('admin'); if (session) refreshAdmin();
  }

  async function refreshAdmin(search = '') {
    try {
      const [users, stats] = await Promise.all([
        apiCall('/admin/users'),
        apiCall('/admin/stats')
      ]);

      document.querySelector('#adminStats').innerHTML = `<div class="stat-card"><span class="stat-icon">♙</span><div><strong>${stats.total_users}</strong><small>Total users</small></div></div><div class="stat-card"><span class="stat-icon">⌂</span><div><strong>${stats.landlords}</strong><small>Landlords</small></div></div><div class="stat-card"><span class="stat-icon">▣</span><div><strong>${stats.listings}</strong><small>Room listings</small></div></div>`;
      
      const filtered = users.filter(item => `${item.name} ${item.email} ${item.role}`.toLowerCase().includes(search.toLowerCase()));
      document.querySelector('#userRows').innerHTML = filtered.map(item => `<tr><td><b>${esc(item.name)}</b></td><td><span class="role-badge">${esc(item.role)}</span></td><td>${esc(item.email)}</td><td>${esc(item.phone || '—')}</td><td>${item.joined ? new Date(item.joined).toLocaleDateString() : '—'}</td></tr>`).join('') || '<tr><td colspan="5">No matching users.</td></tr>';
      
      const landlords = users.filter(item => item.role === 'landlord');
      document.querySelector('#landlordCards').innerHTML = landlords.map(item => `<article class="landlord-card"><span class="user-avatar">${esc(item.name.slice(0,1).toUpperCase())}</span><div><h3>${esc(item.name)}</h3><p>${esc(item.email)}</p><p>${esc(item.phone || 'No phone')} · ${esc(item.city || 'City not added')}</p><p>Address: ${esc(item.address || 'Not provided')}</p></div></article>`).join('') || '<div class="empty-state">No landlord accounts yet.</div>';
      
      const listings = await apiCall('/listings');
      renderListings('#adminListings', listings);
      
      document.querySelector('#userSearch').oninput = event => refreshAdmin(event.target.value);
    } catch (error) {
      console.error('Error loading admin data:', error);
    }
  }
})();
