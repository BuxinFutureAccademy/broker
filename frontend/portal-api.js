(() => {
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

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
      });

      if (response.status === 401 && !endpoint.startsWith('/auth/')) {
        localStorage.removeItem('studentstay_token');
        localStorage.removeItem('studentstay_user');
        window.location.href = 'access.html';
        return null;
      }

      if (!response.ok) {
        const text = await response.text();
        console.error('API Error Response:', text);
        // Check if it's HTML (backend sleeping or error page)
        if (text.trim().startsWith('<!doctype') || text.trim().startsWith('<html')) {
          throw new Error('Backend is waking up. Please wait 30 seconds and try again.');
        }
        try {
          const error = JSON.parse(text);
          throw new Error(error.error || 'API request failed');
        } catch {
          throw new Error('API request failed. Please try again.');
        }
      }

      return response.json();
    } catch (error) {
      console.error('API Call Error:', error);
      throw error;
    }
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

  const go = (role) => { location.href = role === 'landlord' ? 'landlord.html' : role === 'admin' ? 'admin.html' : 'student.html'; };

  document.querySelectorAll('[data-logout]').forEach(button => button.addEventListener('click', () => {
    localStorage.removeItem('studentstay_token');
    localStorage.removeItem('studentstay_user');
    location.href = 'access.html';
  }));

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
      document.querySelector('#authSubtitle').textContent = role === 'admin' ? 'Administrator sign in.' : 'Choose how you use StudentStay.';
      document.querySelector('#authSubmit').textContent = mode === 'signup' ? `Create ${role} account` : `Sign in as ${role[0].toUpperCase()}${role.slice(1)}`;
      document.querySelector('#authNote').textContent = role === 'admin' ? 'Admin access is reserved for the website manager.' : mode === 'signup' ? 'Your account will be created on the server.' : 'New here? Choose Create account to get started.';
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
    const signedInNote = document.querySelector('#signedInNote');
    if (signedInNote && currentUser && token) {
      const dashboards = { student: 'student.html', landlord: 'landlord.html', admin: 'admin.html' };
      signedInNote.classList.remove('hidden');
      signedInNote.innerHTML = `<span>You are signed in as <b>${esc(currentUser.name)}</b> (${esc(currentUser.role)}).</span><a href="${dashboards[currentUser.role] || 'student.html'}">Go to dashboard</a>`;
    }

    authForm.addEventListener('submit', async event => {
      event.preventDefault();
      const form = new FormData(authForm);
      const email = String(form.get('email')).trim().toLowerCase();
      const password = String(form.get('password'));

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

  async function claimPendingRequest() {
    const pending = localStorage.getItem('studentstay.pendingListing');
    if (!pending) return;
    localStorage.removeItem('studentstay.pendingListing');
    if (String(pending).startsWith('sample-')) return;
    try {
      await apiCall('/requests', { method: 'POST', body: JSON.stringify({ listing_id: pending }) });
    } catch (error) {
      if (!/already exists/i.test(error.message || '')) console.error(error);
    }
  }

  async function showStudentArea() {
    if (!currentUser || currentUser.role !== 'student') return;

    try {
      await claimPendingRequest();
      const [listings, unlocks] = await Promise.all([
        apiCall('/listings'),
        apiCall('/unlocks/student')
      ]);

      const listingCountEl = document.querySelector('#listingCount');
      const requestCountEl = document.querySelector('#requestCount');
      if (listingCountEl) listingCountEl.textContent = listings.length;
      if (requestCountEl) requestCountEl.textContent = unlocks.length;

      renderListings('#studentListings', listings, { request: true, studentId: currentUser.id });

      const feeCard = item => {
        const title = esc(item.listing?.title || 'Home');
        const sector = esc(item.listing?.sector || 'Greater Noida');
        const fee = money(item.listing?.brokerFee ?? Math.floor(Number(item.listing?.rent || 0) / 2));
        const house = `property.html?id=${encodeURIComponent(item.listing?.id || '')}`;
        if (item.status === 'approved') return `<article class="fee-card approved"><div><small>APPROVED · ${fee}</small><h3>${title}</h3><p>${sector}. The address and both contacts are open.</p></div><a class="pay-now" href="${house}">Go to the house</a></article>`;
        if (item.status === 'rejected') return `<article class="fee-card rejected"><div><small>NOT ACCEPTED · ${fee}</small><h3>${title}</h3><p>${sector}. Upload a new receipt for this house.</p></div><a class="pay-now" href="${house}">Pay again</a></article>`;
        return `<article class="fee-card waiting"><span class="fee-orb"></span><div><small>BROKER FEE · ${fee}</small><h3>Waiting for admin approval</h3><p>${title} · ${sector}</p></div></article>`;
      };
      const requestsEl = document.querySelector('#studentRequests');
      if (requestsEl) {
        requestsEl.innerHTML = unlocks.map(feeCard).join('') || '<div class="empty-state">You have not paid a broker fee yet. Open a home and tap Pay now.</div>';
        if (location.hash === '#requests') {
          requestsEl.closest('section')?.scrollIntoView({ block: 'start' });
          document.querySelectorAll('.side-nav a').forEach(link => link.classList.toggle('selected', link.getAttribute('href') === '#requests'));
        }
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
    target.innerHTML = items.map(item => `<article class="listing-tile detail-link" data-property-id="${esc(item.id)}" tabindex="0" role="link"><img src="${esc(img(item))}" alt="${esc(item.title)}"><div class="listing-tile-body"><h3>${esc(item.title)}</h3><p>${esc(item.type)} · ${esc(item.sector || item.city || 'Greater Noida')}</p><div class="listing-price">${money(item.rent)} <small>/ month</small></div><p>${esc(item.description)}</p><p>⌖ ${esc(item.unlocked ? (item.address || item.sector || item.city) : (item.sector || item.city || 'Greater Noida'))}</p>${options.owner ? `<div class="listing-actions"><button class="small-button" data-delete-listing="${esc(item.id)}">Remove listing</button></div>` : `<div class="listing-actions"><a class="primary-button" href="property.html?id=${encodeURIComponent(item.id)}">View home</a></div>`}</div></article>`).join('');
    target.querySelectorAll('[data-property-id]').forEach(tile => { tile.addEventListener('click', event => { if (!event.target.closest('button')) location.href = `property.html?id=${encodeURIComponent(tile.dataset.propertyId)}`; }); tile.addEventListener('keydown', event => { if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('button')) { event.preventDefault(); location.href = `property.html?id=${encodeURIComponent(tile.dataset.propertyId)}`; } }); });
    target.querySelectorAll('[data-delete-listing]').forEach(button => button.addEventListener('click', async () => { if (!confirm('Remove this listing?')) return; try { await apiCall(`/listings/${button.dataset.deleteListing}`, { method: 'DELETE' }); refreshLandlord(); } catch (error) { alert(error.message); } }));
    target.querySelectorAll('[data-request-listing]').forEach(button => button.addEventListener('click', async () => { try { await apiCall('/requests', { method: 'POST', body: JSON.stringify({ listing_id: button.dataset.requestListing }) }); alert('Request sent. It is saved under My Requests.'); showStudentArea(); } catch (error) { alert(error.message); } }));
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
              sector: String(data.get('sector') || '').trim(),
              city: 'Greater Noida',
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
      const [listings, unlocks] = await Promise.all([
        apiCall('/listings/landlord'),
        apiCall('/unlocks/landlord')
      ]);

      document.querySelector('#landlordStats').innerHTML = `<div class="stat-card"><span class="stat-icon">⌂</span><div><strong>${listings.length}</strong><small>Active listings</small></div></div><div class="stat-card"><span class="stat-icon">♙</span><div><strong>${unlocks.length}</strong><small>Paid students</small></div></div><div class="stat-card"><span class="stat-icon">✓</span><div><strong>Verified</strong><small>Landlord account</small></div></div>`;
      renderListings('#landlordListings', listings, { owner: true });
      
      const rows = unlocks.map(req => `<div class="request-row"><div><b>${esc(req.student?.name || 'Student')}</b><p>${esc(req.student?.email || '')} · ${esc(req.student?.phone || 'No phone provided')}<br>Unlocked: ${esc(req.listing?.title || 'Property')} · ${esc(req.listing?.sector || '')}</p></div><span class="status-pill">Paid</span></div>`).join('');
      document.querySelector('#landlordStudents').innerHTML = rows || '<div class="empty-state">No student has unlocked your rooms yet.</div>';
    } catch (error) {
      console.error('Error loading landlord data:', error);
    }
  }

  if (document.querySelector('#adminStats')) {
    const session = guard('admin'); if (session) refreshAdmin();
  }

  function personCard(item) {
    return `<article class="landlord-card"><span class="user-avatar">${esc((item.name || '?').slice(0, 1).toUpperCase())}</span><div><h3>${esc(item.name)}</h3><p>${esc(item.email)}</p><p>${esc(item.phone || 'No phone')} · ${esc(item.city || 'City not added')}</p><p>Address: ${esc(item.address || 'Not provided')}</p></div></article>`;
  }

  let adminCache = null;
  async function refreshAdmin(search = '') {
    try {
      if (!adminCache) {
        const [users, stats, listings, unlocks, payment] = await Promise.all([
          apiCall('/admin/users'),
          apiCall('/admin/stats'),
          apiCall('/listings'),
          apiCall('/admin/unlocks'),
          apiCall('/payment')
        ]);
        adminCache = { users, stats, listings, unlocks, payment };
      }
      const { users, stats, listings, unlocks, payment } = adminCache;
      const query = search.toLowerCase();
      const matches = item => `${item.name} ${item.email} ${item.role} ${item.city || ''} ${item.phone || ''} ${item.address || ''} ${item.company || ''}`.toLowerCase().includes(query);
      const filtered = users.filter(item => item.role !== 'broker').filter(matches);

      document.querySelector('#adminStats').innerHTML = `<div class="stat-card"><span class="stat-icon">🎓</span><div><strong>${stats.students}</strong><small>Students</small></div></div><div class="stat-card"><span class="stat-icon">⌂</span><div><strong>${stats.landlords}</strong><small>Landlords</small></div></div><div class="stat-card"><span class="stat-icon">▣</span><div><strong>${stats.listings}</strong><small>Room listings</small></div></div>`;
      document.querySelector('#userRows').innerHTML = filtered.map(item => `<tr><td><b>${esc(item.name)}</b></td><td><span class="role-badge">${esc(item.role)}</span></td><td>${esc(item.email)}</td><td>${esc(item.phone || '—')}</td><td>${esc(item.city || '—')}</td><td>${esc(item.address || '—')}</td><td>${item.joined ? new Date(item.joined).toLocaleDateString() : '—'}</td></tr>`).join('') || '<tr><td colspan="7">No matching users.</td></tr>';
      const fill = (selector, role) => {
        const people = filtered.filter(item => item.role === role);
        document.querySelector(selector).innerHTML = people.map(personCard).join('') || '<div class="empty-state">No matching accounts.</div>';
      };
      fill('#studentCards', 'student');
      fill('#landlordCards', 'landlord');
      renderListings('#adminListings', listings);
      const paymentForm = document.querySelector('#paymentForm');
      if (paymentForm && payment && !paymentForm.dataset.ready) {
        if (paymentForm.elements.contactName) paymentForm.elements.contactName.value = payment.contactName || '';
        if (paymentForm.elements.contactPhone) paymentForm.elements.contactPhone.value = payment.contactPhone || '';
        if (paymentForm.elements.contactEmail) paymentForm.elements.contactEmail.value = payment.contactEmail || '';
        paymentForm.dataset.qr = payment.qrUrl || '';
        paymentForm.dataset.ready = '1';
        if (payment.qrUrl) document.querySelector('#qrPreview').innerHTML = `<div class="qr-frame admin-qr"><img alt="Payment QR code" src="${esc(payment.qrUrl)}"></div>`;
      }
      const receiptList = document.querySelector('#receiptList');
      if (receiptList) {
        receiptList.innerHTML = (unlocks || []).map(item => `<article class="receipt-card ${esc(item.status)}"><a class="receipt-shot" href="${esc(item.receiptUrl)}" target="_blank" rel="noopener"><img alt="Payment receipt" src="${esc(item.receiptUrl)}"></a><div><small>${esc(item.status === 'pending' ? 'WAITING' : item.status.toUpperCase())}</small><h3>${esc(item.student?.name || 'Student')}</h3><p>${esc(item.student?.phone || 'No phone')} · ${esc(item.student?.email || '')}</p><p>${esc(item.listing?.title || 'Home')} · ${esc(item.listing?.sector || '')}</p><p>Expected fee ${money(item.listing?.brokerFee ?? Math.floor(Number(item.listing?.rent || 0) / 2))}, half of ${money(item.listing?.rent)}</p>${item.status === 'pending' ? `<div class="receipt-actions"><button class="pay-now" type="button" data-unlock="${esc(item.id)}" data-status="approved">Approve</button><button class="receipt-reject" type="button" data-unlock="${esc(item.id)}" data-status="rejected">Reject</button></div>` : ''}</div></article>`).join('') || '<div class="empty-state">No receipts yet.</div>';
        receiptList.querySelectorAll('[data-unlock]').forEach(button => button.addEventListener('click', async () => {
          try {
            await apiCall(`/admin/unlocks/${button.dataset.unlock}`, { method: 'PUT', body: JSON.stringify({ status: button.dataset.status }) });
            adminCache = null;
            refreshAdmin(document.querySelector('#userSearch')?.value || '');
          } catch (error) { alert(error.message); }
        }));
      }
      if (paymentForm && !paymentForm.dataset.bound) {
        paymentForm.dataset.bound = '1';
        paymentForm.addEventListener('submit', async event => {
          event.preventDefault();
          const data = new FormData(paymentForm);
          let qrUrl = paymentForm.dataset.qr || '';
          const file = data.get('qr');
          try {
            if (file && file.size) {
              const uploaded = await uploadImage(file);
              qrUrl = uploaded.url;
              paymentForm.dataset.qr = qrUrl;
            }
            await apiCall('/admin/payment', { method: 'PUT', body: JSON.stringify({ qrUrl, contactName: String(data.get('contactName') || ''), contactPhone: String(data.get('contactPhone') || ''), contactEmail: String(data.get('contactEmail') || '') }) });
            adminCache = null;
            alert('Payment details saved.');
            refreshAdmin();
          } catch (error) { alert(error.message); }
        });
      }
      const searchBox = document.querySelector('#userSearch');
      if (searchBox && searchBox.value !== search) searchBox.value = search;
      searchBox.oninput = event => refreshAdmin(event.target.value);
    } catch (error) {
      console.error('Error loading admin data:', error);
    }
  }

  document.querySelectorAll('.side-nav a[href^="#"]').forEach(link => {
    link.addEventListener('click', () => {
      document.querySelectorAll('.side-nav a').forEach(item => item.classList.remove('selected'));
      link.classList.add('selected');
    });
  });
})();
