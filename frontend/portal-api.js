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
        if (text.trim().startsWith('<!doctype') || text.trim().startsWith('<html') || text.trim().startsWith('<!DOCTYPE')) {
          throw new Error('Backend is waking up. Please wait 30 seconds and try again.');
        }
        let message = 'Could not complete that. Please try again.';
        try {
          const error = JSON.parse(text);
          if (error.error) message = error.error;
        } catch { /* the server did not return JSON */ }
        throw new Error(message);
      }

      return response.json();
    } catch (error) {
      console.error('API Call Error:', error);
      if (error instanceof TypeError) {
        throw new Error('The server did not answer. Wait a moment and try again.');
      }
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
      const text = await response.text();
      let message = 'The image could not be uploaded.';
      try {
        const error = JSON.parse(text);
        if (error.error) message = error.error;
      } catch { /* keep the plain message */ }
      throw new Error(message);
    }

    return response.json();
  }

  const go = (role) => { location.href = role === 'landlord' ? 'landlord.html' : role === 'admin' ? 'admin.html' : ['restaurant', 'shop', 'service'].includes(role) ? 'owner.html' : 'student.html'; };

  document.querySelectorAll('[data-logout]').forEach(button => button.addEventListener('click', () => {
    localStorage.removeItem('studentstay_token');
    localStorage.removeItem('studentstay_user');
    location.href = 'access.html';
  }));

  const authForm = document.querySelector('#authForm');
  if (authForm) {
    let mode = 'signin';
    let role = 'landlord';
    const tabs = [...document.querySelectorAll('.tab')];
    const roleButtons = [...document.querySelectorAll('#ownerPicker .role-choice')];
    const ownerLabels = { student: 'User', landlord: 'Landlord', restaurant: 'Restaurant owner', shop: 'Shop owner', service: 'Service owner' };
    const businessRole = () => ['restaurant', 'shop', 'service'].includes(role);
    const updateAuth = () => {
      const creating = mode === 'signup';
      const owner = mode === 'owners' || creating;
      const label = ownerLabels[role] || 'Landlord';
      document.querySelector('#authTitle').textContent = creating ? 'Create an account' : owner ? 'Owners' : 'Sign in';
      document.querySelector('#authSubtitle').textContent = creating ? (role === 'student' ? 'This user signs in on the Sign in tab, then chooses a house, food, a shop, or a service.' : 'Select one. Then add your name. This account stays that one type.') : owner ? 'Sign in as a landlord, restaurant owner, shop owner, or service owner.' : 'Sign in with one account. Then choose where to enter.';
      document.querySelector('#authSubmit').textContent = creating ? `Create ${label} account` : owner ? `Sign in as ${label}` : 'Sign in';
      document.querySelector('#authNote').textContent = creating ? (role === 'student' ? 'After this, the user signs in on the Sign in tab.' : 'Select one type, then your name.') : owner ? 'Owners sign in here. New people use Create account.' : 'This sign-in is for a user. Owners use the Owners tab.';
      document.querySelector('#ownerPicker')?.classList.toggle('hidden', !owner);
      document.querySelector('.user-only')?.classList.toggle('hidden', !creating);
      document.querySelector('#forgotPassword')?.classList.toggle('hidden', creating);
      if (creating) document.querySelector('#resetPanel')?.classList.add('hidden');
      document.querySelector('.auth-split')?.classList.toggle('hidden', creating);
      document.querySelector('.alt-signin')?.classList.toggle('hidden', creating);
      document.querySelectorAll('.signup-only').forEach(el => el.classList.toggle('hidden', !creating));
      document.querySelectorAll('.business-only').forEach(el => el.classList.toggle('hidden', !creating || !businessRole()));
      if (authForm.elements.name) authForm.elements.name.required = creating;
      if (authForm.elements.phone) authForm.elements.phone.required = creating && (role === 'landlord' || businessRole());
      if (authForm.elements.city) authForm.elements.city.required = creating && role === 'landlord';
      if (authForm.elements.businessName) authForm.elements.businessName.required = creating && businessRole();
      if (authForm.elements.category) authForm.elements.category.required = creating && businessRole();
      const googleNote = document.querySelector('#altNote');
      if (googleNote) googleNote.textContent = owner ? 'Pick your owner type, then continue with Google.' : 'You can also sign in with Google. Then choose where to enter.';
      authForm.elements.password.autocomplete = creating ? 'new-password' : 'current-password';
      tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.mode === mode));
      roleButtons.forEach(button => button.classList.toggle('active', button.dataset.role === role));
    };

    tabs.forEach(button => button.addEventListener('click', () => {
      mode = button.dataset.mode;
      if (mode !== 'signup' && role === 'student') role = 'landlord';
      updateAuth();
      if (mode === 'signin' && currentUser && token && currentUser.role === 'student') document.querySelector('#enterChoice')?.classList.remove('hidden');
      else document.querySelector('#enterChoice')?.classList.add('hidden');
    }));
    roleButtons.forEach(button => button.addEventListener('click', () => { role = button.dataset.role; updateAuth(); }));
    const params = new URLSearchParams(location.search);
    const requestedRole = (params.get('role') || '').toLowerCase();
    if (params.get('mode') === 'signup') mode = 'signup';
    else if (params.get('mode') === 'owners' || ['landlord', 'restaurant', 'shop', 'service'].includes(requestedRole)) mode = 'owners';
    if (['student', 'landlord', 'restaurant', 'shop', 'service'].includes(requestedRole)) role = requestedRole;
    if (mode === 'signup' && !requestedRole) role = 'student';
    if (location.hash === '#student') showStudentArea();
    updateAuth();
    const resetPanel = document.querySelector('#resetPanel');
    const resetEmailForm = document.querySelector('#resetEmailForm');
    const resetCodeForm = document.querySelector('#resetCodeForm');
    const resetNote = document.querySelector('#resetNote');
    const resetCopy = document.querySelector('#resetCopy');
    let resetEmail = '';
    document.querySelector('#forgotPassword')?.addEventListener('click', () => {
      resetPanel?.classList.remove('hidden');
      const current = String(authForm.elements.email?.value || '').trim();
      if (resetEmailForm?.elements.email && current) resetEmailForm.elements.email.value = current;
    });
    resetEmailForm?.addEventListener('submit', async event => {
      event.preventDefault();
      resetEmail = String(new FormData(resetEmailForm).get('email') || '').trim().toLowerCase();
      if (resetNote) resetNote.textContent = 'Sending the code…';
      try {
        const result = await apiCall('/auth/password/forgot', { method: 'POST', body: JSON.stringify({ email: resetEmail }) });
        if (resetNote) resetNote.textContent = result.message || 'A code is on the way to that email.';
        if (resetCopy) resetCopy.textContent = `Enter the code sent to ${resetEmail}, then choose a new password.`;
        resetEmailForm.classList.add('hidden');
        resetCodeForm?.classList.remove('hidden');
      } catch (error) {
        if (resetNote) resetNote.textContent = error.message;
      }
    });
    resetCodeForm?.addEventListener('submit', async event => {
      event.preventDefault();
      const data = new FormData(resetCodeForm);
      const password = String(data.get('password') || '');
      if (password !== String(data.get('confirm') || '')) {
        if (resetNote) resetNote.textContent = 'The two passwords do not match.';
        return;
      }
      try {
        const result = await apiCall('/auth/password/reset', { method: 'POST', body: JSON.stringify({ email: resetEmail, code: data.get('code'), password }) });
        if (resetNote) resetNote.textContent = result.message || 'Password saved. Sign in with the new one.';
        resetCodeForm.classList.add('hidden');
        if (authForm.elements.email) authForm.elements.email.value = resetEmail;
        authForm.elements.password.value = '';
      } catch (error) {
        if (resetNote) resetNote.textContent = error.message;
      }
    });
    const signedInNote = document.querySelector('#signedInNote');
    if (signedInNote && currentUser && token) {
      const dashboards = { student: 'student.html', landlord: 'landlord.html', admin: 'admin.html', restaurant: 'owner.html', shop: 'owner.html', service: 'owner.html' };
      signedInNote.classList.remove('hidden');
      if (currentUser.role === 'student') {
        signedInNote.innerHTML = `<span>You are signed in as <b>${esc(currentUser.name)}</b>.</span>`;
        if (mode === 'signin') document.querySelector('#enterChoice')?.classList.remove('hidden');
        else document.querySelector('#enterChoice')?.classList.add('hidden');
      } else {
        signedInNote.innerHTML = `<span>You are signed in as <b>${esc(currentUser.name)}</b> (${esc(currentUser.role)}).</span><a href="${dashboards[currentUser.role] || 'student.html'}">Go to dashboard</a>`;
      }
    }

    const finish = response => {
      if (!response) return;
      token = response.access_token;
      currentUser = response.user;
      localStorage.setItem('studentstay_token', token);
      localStorage.setItem('studentstay_user', JSON.stringify(currentUser));
      if (currentUser.role === 'student') {
        document.querySelector('#enterChoice')?.classList.remove('hidden');
        return;
      }
      go(currentUser.role);
    };
    const altNote = document.querySelector('#altNote');
    const say = message => { if (altNote) altNote.textContent = message; else alert(message); };
    document.querySelector('#googleFallback')?.addEventListener('click', () => say('Google sign-in is not turned on yet. Add the Google client ID on the server.'));
    fetch(`${API_BASE}/auth/providers`).then(response => response.ok ? response.json() : null).then(providers => {
      if (!providers?.googleClientId) return;
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = () => {
        const slot = document.querySelector('#googleSlot');
        if (!slot || !window.google?.accounts?.id) return;
        google.accounts.id.initialize({
          client_id: providers.googleClientId,
          callback: async response => {
            try {
              const picked = document.querySelector('#ownerPicker .role-choice.active')?.dataset.role;
              const googleRole = mode === 'owners' ? (picked || role) : 'student';
              finish(await apiCall('/auth/google', { method: 'POST', body: JSON.stringify({ credential: response.credential, role: googleRole }) }));
            } catch (error) { say(error.message); }
          }
        });
        google.accounts.id.renderButton(slot, { theme: 'outline', size: 'large', width: Math.max(240, Math.min(360, slot.parentElement.clientWidth || 320)), text: 'continue_with', shape: 'pill' });
        document.querySelector('#googleFallback')?.classList.add('hidden');
      };
      document.head.appendChild(script);
    }).catch(() => {});

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
        const response = mode === 'signup'
          ? await apiCall('/auth/signup', {
              method: 'POST',
              body: JSON.stringify({
                name: String(form.get('name') || '').trim(),
                email,
                password,
                role,
                phone: String(form.get('phone') || '').trim(),
                city: String(form.get('city') || '').trim(),
                address: String(form.get('address') || '').trim(),
                businessName: String(form.get('businessName') || '').trim(),
                category: String(form.get('category') || '').trim()
              })
            })
          : await apiCall('/auth/login', {
              method: 'POST',
              body: JSON.stringify({ email, password, role: mode === 'owners' ? role : 'student' })
            });

        finish(response);
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
        if (item.status === 'rejected') return `<article class="fee-card rejected"><div><small>NOT ACCEPTED · ${fee}</small><h3>${title}</h3><p>${sector}. Upload a new receipt for this house.</p></div><a class="pay-now" href="${house}">Pay again</a></article>`;
        return `<article class="fee-card ${item.status === 'approved' ? 'approved' : 'waiting'}"><div><small>${item.status === 'approved' ? 'APPROVED' : 'RECEIPT SENT'} · ${fee}</small><h3>${title}</h3><p>${sector}. Next step: contact the broker and send your receipt. The house location stays private.</p></div><a class="pay-now" href="${house}">Contact the broker</a></article>`;
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
    target.innerHTML = items.map(item => `<article class="listing-tile detail-link" data-property-id="${esc(item.id)}" tabindex="0" role="link"><img src="${esc(img(item))}" alt="${esc(item.title)}"><div class="listing-tile-body"><h3>${esc(item.title)}</h3><p>${esc(item.type)} · ${esc(item.sector || item.city || 'Greater Noida')}</p><div class="listing-price">${money(item.rent)} <small>/ month</small></div><p>${esc(item.description)}</p><p>⌖ ${esc((options.owner || currentUser?.role === 'admin') && item.address ? item.address : (item.sector || item.city || 'Greater Noida'))}</p>${options.owner ? `<div class="listing-actions"><button class="small-button" data-edit-listing="${esc(item.id)}">Edit</button><button class="small-button danger" data-delete-listing="${esc(item.id)}">Remove</button></div>` : `<div class="listing-actions"><a class="primary-button" href="property.html?id=${encodeURIComponent(item.id)}">View home</a></div>`}</div></article>`).join('');
    target.querySelectorAll('[data-property-id]').forEach(tile => { tile.addEventListener('click', event => { if (!event.target.closest('button')) location.href = `property.html?id=${encodeURIComponent(tile.dataset.propertyId)}`; }); tile.addEventListener('keydown', event => { if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('button')) { event.preventDefault(); location.href = `property.html?id=${encodeURIComponent(tile.dataset.propertyId)}`; } }); });
    target.querySelectorAll('[data-delete-listing]').forEach(button => button.addEventListener('click', async () => { if (!confirm('Remove this listing?')) return; try { await apiCall(`/listings/${button.dataset.deleteListing}`, { method: 'DELETE' }); refreshLandlord(); } catch (error) { alert(error.message); } }));
    target.querySelectorAll('[data-edit-listing]').forEach(button => button.addEventListener('click', event => {
      event.stopPropagation();
      const item = (window.studentstayRooms || []).find(room => room.id === button.dataset.editListing);
      const form = document.querySelector('#listingForm');
      if (!item || !form) return;
      form.dataset.editId = item.id;
      form.elements.title.value = item.title || '';
      form.elements.type.value = item.type || 'Private room';
      form.elements.rent.value = item.rent || '';
      form.elements.available.value = item.available || '';
      form.elements.sector.value = item.sector || '';
      form.elements.address.value = item.address || '';
      form.elements.description.value = item.description || '';
      document.querySelector('#photoPreview').innerHTML = (item.photos || []).map(photo => `<img alt="" src="${esc(photo)}">`).join('');
      const submit = form.querySelector('button');
      if (submit) submit.textContent = 'Save changes';
      location.hash = '#overview';
    }));
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
        const editingId = form.dataset.editId;
        if (!editingId && !files.length) return alert('Add at least one photo of the room.');
        
        try {
          const photos = files.length ? await Promise.all(files.map(uploadImage)) : [];
          const payload = {
            title: String(data.get('title')).trim(),
            type: String(data.get('type')),
            rent: Number(data.get('rent')),
            available: String(data.get('available')),
            address: String(data.get('address')).trim(),
            sector: String(data.get('sector') || '').trim(),
            city: 'Greater Noida',
            description: String(data.get('description')).trim(),
            photos: photos.map(photo => photo.url)
          };
          if (editingId) {
            await apiCall(`/listings/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
          } else {
            await apiCall('/listings', { method: 'POST', body: JSON.stringify(payload) });
          }
          delete form.dataset.editId;
          form.reset();
          const submit = form.querySelector('button');
          if (submit) submit.textContent = 'Publish room';
          document.querySelector('#photoPreview').innerHTML = '';
          refreshLandlord();
          location.hash = '#rooms';
          alert(editingId ? 'Room updated.' : 'Your room has been published.');
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

      document.querySelector('#landlordStats').innerHTML = `<div class="stat-card"><span class="stat-icon">⌂</span><div><strong>${listings.length}</strong><small>Your rooms</small></div></div><div class="stat-card"><span class="stat-icon">♙</span><div><strong>${unlocks.length}</strong><small>Paid students</small></div></div><div class="stat-card"><span class="stat-icon">✓</span><div><strong>Verified</strong><small>Landlord account</small></div></div>`;
      window.studentstayRooms = listings;
      renderListings('#landlordListings', listings, { owner: true });
      
      const rows = unlocks.map(req => `<div class="request-row"><div><b>${esc(req.student?.name || 'Student')}</b><p>${esc(req.student?.email || '')} · ${esc(req.student?.phone || 'No phone provided')}<br>${esc(req.listing?.title || 'Room')} · ${esc(req.listing?.sector || '')}</p></div><span class="status-pill">Paid</span></div>`).join('');
      document.querySelector('#landlordStudents').innerHTML = rows || '<div class="empty-state">No student has paid the broker fee for your rooms yet.</div>';
    } catch (error) {
      const rooms = document.querySelector('#landlordListings');
      if (rooms) rooms.innerHTML = `<div class="empty-state">${esc(error.message || 'Could not load your rooms.')}</div>`;
    }
  }

  let openPersonId = '';
  function personCard(item) {
    return `<article class="landlord-card"><span class="user-avatar">${esc((item.name || '?').slice(0, 1).toUpperCase())}</span><div><h3>${esc(item.name)}</h3><p>${esc(item.email)}</p><p>${esc(item.phone || 'No phone')} · ${esc(item.city || 'City not added')}</p></div><div class="person-actions"><button class="small-button person-open" type="button" data-person="${esc(item.id)}">View</button><button class="small-button danger" type="button" data-delete-user="${esc(item.id)}" data-delete-role="${esc(item.role)}" data-delete-name="${esc(item.name)}">Delete</button></div></article>`;
  }
  function houseShots(items) {
    const photos = items.flatMap(item => item.photos || []).filter(Boolean).slice(0, 8);
    if (!photos.length) return '';
    return `<div class="person-photos">${photos.map(photo => `<img alt="" src="${esc(photo)}">`).join('')}</div>`;
  }
  function paintReports() {
    const summary = document.querySelector('#reportSummary');
    const rows = document.querySelector('#reportRows');
    if (!summary || !rows || !adminCache) return;
    const from = document.querySelector('#reportFrom')?.value || '';
    const to = document.querySelector('#reportTo')?.value || '';
    const approved = (adminCache.unlocks || []).filter(item => item.status === 'approved').filter(item => {
      const day = String(item.created || '').slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      return true;
    });
    const total = approved.reduce((sum, item) => sum + Number(item.listing?.brokerFee || 0), 0);
    summary.innerHTML = `<div class="stat-card"><span class="stat-icon">₹</span><div><strong>${money(total)}</strong><small>Approved broker fees</small></div></div><div class="stat-card"><span class="stat-icon">▣</span><div><strong>${approved.length}</strong><small>Approved payments</small></div></div>`;
    rows.innerHTML = approved.map(item => `<div class="request-row report-line"><div><b>${money(item.listing?.brokerFee)}</b><p>${esc(item.student?.name || 'Student')} · ${esc(item.listing?.title || 'Home')} · ${esc(item.listing?.sector || '')}<br>${esc(item.ownerName || item.listing?.ownerName || 'Landlord')} · ${item.created ? new Date(item.created).toLocaleDateString() : ''}</p></div><button class="small-button danger" type="button" data-delete-payment="${esc(item.id)}">Delete</button></div>`).join('') || '<div class="empty-state">No approved payments in those dates.</div>';
    bindDeletes(rows);
  }
  function paintPerson() {
    const view = document.querySelector('#personView');
    if (!view || !adminCache || !openPersonId) return;
    const person = (adminCache.users || []).find(item => item.id === openPersonId);
    if (!person) { view.innerHTML = '<div class="empty-state">Choose a student or a landlord.</div>'; return; }
    const title = document.querySelector('#personTitle');
    const lead = document.querySelector('#personLead');
    const back = document.querySelector('#personBack');
    if (title) title.textContent = person.name;
    if (back) { back.href = person.role === 'landlord' ? '#landlords' : '#students'; back.textContent = person.role === 'landlord' ? 'Back to landlords' : 'Back to students'; }
    const listings = adminCache.listings || [];
    const unlocks = (adminCache.unlocks || []).filter(item => item.status === 'approved');
    const remove = `<p><button class="small-button danger" type="button" data-delete-user="${esc(person.id)}" data-delete-role="${esc(person.role)}" data-delete-name="${esc(person.name)}">Delete this ${person.role === 'landlord' ? 'landlord and their houses' : 'student'}</button></p>`;
    if (person.role === 'student') {
      const rented = unlocks.filter(item => item.studentId === person.id || (item.student?.email || '').toLowerCase() === (person.email || '').toLowerCase());
      const homes = rented.map(item => listings.find(home => home.id === item.listing?.id) || item.listing || {});
      if (lead) lead.textContent = `${rented.length} rented house${rented.length === 1 ? '' : 's'}.`;
      view.innerHTML = `${remove}<div class="person-facts"><p><b>Email</b><br>${esc(person.email)}</p><p><b>Phone</b><br>${esc(person.phone || 'No phone')}</p><p><b>City</b><br>${esc(person.city || 'Not added')}</p><p><b>Address</b><br>${esc(person.address || 'Not provided')}</p></div><h3>Houses rented</h3>${houseShots(homes)}${rented.map(item => `<div class="request-row"><div><b>${esc(item.listing?.title || 'Home')}</b><p>${esc(item.listing?.sector || '')} · Rent ${money(item.listing?.rent)} a month</p></div><span class="status-pill">Rented</span></div>`).join('') || '<div class="empty-state">This student has not rented a house yet.</div>'}`;
      bindDeletes(view);
      return;
    }
    const homes = listings.filter(item => item.ownerId === person.id);
    const rented = unlocks.filter(item => item.ownerId === person.id || homes.some(home => home.id === item.listing?.id));
    const rentTotal = rented.reduce((sum, item) => sum + Number(item.listing?.rent || 0), 0);
    if (lead) lead.textContent = `${homes.length} posted. ${rented.length} rented. Rent received ${money(rentTotal)}.`;
    view.innerHTML = `${remove}<div class="person-facts"><p><b>Email</b><br>${esc(person.email)}</p><p><b>Phone</b><br>${esc(person.phone || 'No phone')}</p><p><b>City</b><br>${esc(person.city || 'Not added')}</p><p><b>Address</b><br>${esc(person.address || 'Not provided')}</p><p><b>Houses posted</b><br>${homes.length}</p><p><b>Rent from rented homes</b><br>${money(rentTotal)}</p></div><h3>Houses posted</h3>${houseShots(homes)}${homes.map(item => `<div class="request-row"><div><b>${esc(item.title)}</b><p>${esc(item.sector || item.city || '')} · ${money(item.rent)} / month</p></div></div>`).join('') || '<div class="empty-state">This landlord has not posted a house yet.</div>'}<h3>Who rented</h3>${rented.map(item => `<div class="request-row"><div><b>${esc(item.student?.name || 'Student')}</b><p>${esc(item.listing?.title || 'Home')} · ${esc(item.student?.phone || 'No phone')} · ${money(item.listing?.rent)} / month</p></div></div>`).join('') || '<div class="empty-state">Nobody has rented a house from this landlord yet.</div>'}`;
    bindDeletes(view);
  }
  async function deleteAccount(id, role, name) {
    const text = role === 'landlord' ? `Delete ${name}? Every house they posted will be deleted too.` : `Delete ${name}?`;
    if (!window.confirm(text)) return;
    try {
      await apiCall(`/admin/users/${id}`, { method: 'DELETE' });
      adminCache = null;
      if (openPersonId === id) {
        openPersonId = '';
        location.hash = role === 'landlord' ? 'landlords' : 'students';
      }
      refreshAdmin(document.querySelector('#userSearch')?.value || '');
    } catch (error) { alert(error.message); }
  }
  function bindDeletes(root) {
    root.querySelectorAll('[data-delete-user]').forEach(button => {
      button.onclick = () => deleteAccount(button.dataset.deleteUser, button.dataset.deleteRole, button.dataset.deleteName);
    });
    root.querySelectorAll('[data-delete-payment]').forEach(button => {
      button.onclick = async () => {
        if (!window.confirm('Delete this payment? It will leave the money report.')) return;
        try {
          await apiCall(`/admin/unlocks/${button.dataset.deletePayment}`, { method: 'DELETE' });
          adminCache = null;
          refreshAdmin(document.querySelector('#userSearch')?.value || '');
        } catch (error) { alert(error.message); }
      };
    });
  }
  function showPerson(id) {
    openPersonId = id;
    if (location.hash !== '#person') location.hash = 'person';
    paintPerson();
  }

  let adminCache = null;
  const contactRow = (kind, value) => `<div class="editor-row"><input data-kind="${kind}" value="${esc(value)}"><button class="row-close" type="button" aria-label="Remove">×</button></div>`;
  const paintContactLists = (form, payment) => {
    const saved = payment?.contacts;
    const seed = {
      names: saved ? (saved.names || []) : (payment?.contactName ? [payment.contactName] : []),
      phones: saved ? (saved.phones || []) : [],
      emails: saved ? (saved.emails || []) : [],
    };
    ['names', 'phones', 'emails'].forEach(kind => {
      const box = form.querySelector(`[data-rows="${kind}"]`);
      if (!box) return;
      const values = seed[kind].length ? seed[kind] : [''];
      box.innerHTML = values.map(value => contactRow(kind, value)).join('');
    });
  };
  const readContactLists = form => ({
    names: [...form.querySelectorAll('[data-kind="names"]')].map(input => input.value.trim()).filter(Boolean),
    phones: [...form.querySelectorAll('[data-kind="phones"]')].map(input => input.value.trim()).filter(Boolean),
    emails: [...form.querySelectorAll('[data-kind="emails"]')].map(input => input.value.trim()).filter(Boolean),
  });

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
      document.querySelector('#userRows') && (document.querySelector('#userRows').innerHTML = filtered.map(item => `<tr><td><b>${esc(item.name)}</b></td><td><span class="role-badge">${esc(item.role)}</span></td><td>${esc(item.email)}</td><td>${esc(item.phone || '—')}</td><td>${esc(item.city || '—')}</td><td>${esc(item.address || '—')}</td><td>${item.joined ? new Date(item.joined).toLocaleDateString() : '—'}</td></tr>`).join('') || '<tr><td colspan="7">No matching users.</td></tr>');
      const fill = (selector, role) => {
        const node = document.querySelector(selector);
        if (!node) return;
        const people = filtered.filter(item => item.role === role);
        node.innerHTML = people.map(personCard).join('') || '<div class="empty-state">No matching accounts.</div>';
      };
      fill('#studentCards', 'student');
      fill('#landlordCards', 'landlord');
      document.querySelectorAll('[data-person]').forEach(button => { button.onclick = () => showPerson(button.dataset.person); });
      bindDeletes(document);
      paintReports();
      if (openPersonId) paintPerson();
      const reportFilter = document.querySelector('#reportFilter');
      if (reportFilter && !reportFilter.dataset.bound) {
        reportFilter.dataset.bound = '1';
        reportFilter.addEventListener('change', paintReports);
      }
      const paymentForm = document.querySelector('#paymentForm');
      const qrPreview = document.querySelector('#qrPreview');
      if (paymentForm && payment) {
        const setIdle = (name, value) => {
          const input = paymentForm.elements[name];
          if (input && document.activeElement !== input) input.value = value || '';
        };
        setIdle('contactPhone', payment.contactPhone);
        setIdle('contactEmail', payment.contactEmail);
        if (!paymentForm.dataset.listsReady) {
          paintContactLists(paymentForm, payment);
          paymentForm.dataset.listsReady = '1';
        }
        paymentForm.dataset.qr = payment.qrUrl || '';
        if (qrPreview) {
          qrPreview.innerHTML = payment.qrUrl
            ? `<p class="form-hint">This is the QR students scan.</p><div class="qr-frame admin-qr"><img alt="Payment QR code" src="${esc(payment.qrUrl)}"></div>`
            : '<p class="form-hint">No QR code is saved yet. Choose an image, then save.</p>';
        }
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
        paymentForm.elements.qr?.addEventListener('change', () => {
          const file = paymentForm.elements.qr.files[0];
          const preview = document.querySelector('#qrPreview');
          if (!file || !preview) return;
          preview.innerHTML = `<p class="form-hint">Selected. Save to show this QR to students.</p><div class="qr-frame admin-qr"><img alt="Selected QR code" src="${URL.createObjectURL(file)}"></div>`;
        });
        paymentForm.addEventListener('click', event => {
          const add = event.target.closest('[data-add]');
          if (add) {
            const box = paymentForm.querySelector(`[data-rows="${add.dataset.add}"]`);
            box?.insertAdjacentHTML('beforeend', contactRow(add.dataset.add, ''));
            box?.querySelector('.editor-row:last-child input')?.focus();
            return;
          }
          const close = event.target.closest('.row-close');
          if (!close) return;
          const row = close.closest('.editor-row');
          const box = row?.parentElement;
          row?.remove();
          if (box && !box.children.length) box.insertAdjacentHTML('beforeend', contactRow(box.dataset.rows, ''));
        });
        paymentForm.addEventListener('submit', async event => {
          event.preventDefault();
          const data = new FormData(paymentForm);
          let qrUrl = paymentForm.dataset.qr || '';
          const file = data.get('qr');
          try {
            if (file && file.size) {
              const uploaded = await uploadImage(file);
              if (!uploaded.url) throw new Error('The QR image uploaded, but no link came back.');
              qrUrl = uploaded.url;
            }
            if (!qrUrl) {
              alert('Choose your QR code image, then save.');
              return;
            }
            const lists = readContactLists(paymentForm);
            const saved = await apiCall('/admin/payment', { method: 'PUT', body: JSON.stringify({ qrUrl, contactName: lists.names[0] || '', contactPhone: String(data.get('contactPhone') || ''), contactEmail: String(data.get('contactEmail') || ''), contacts: lists }) });
            paintContactLists(paymentForm, saved || { contacts: lists, contactPhone: data.get('contactPhone'), contactEmail: data.get('contactEmail') });
            paymentForm.dataset.qr = saved?.qrUrl || qrUrl;
            adminCache = null;
            const preview = document.querySelector('#qrPreview');
            if (preview) preview.innerHTML = `<p class="form-hint">Saved. Students can scan this QR.</p><div class="qr-frame admin-qr"><img alt="Payment QR code" src="${esc(paymentForm.dataset.qr)}"></div>`;
            alert('QR code saved. Students can scan it on every house.');
            refreshAdmin();
          } catch (error) { alert(error.message); }
        });
      }
      const searchBox = document.querySelector('#userSearch');
      if (searchBox) {
        if (searchBox.value !== search) searchBox.value = search;
        searchBox.oninput = event => refreshAdmin(event.target.value);
      }
    } catch (error) {
      console.error('Error loading admin data:', error);
    }
  }

  const activityPages = {
    restaurants: { kind: 'restaurant', place: 'restaurant', owner: 'Restaurant owner', did: 'ordered' },
    shop: { kind: 'shop', place: 'shop', owner: 'Shop owner', did: 'bought' },
    services: { kind: 'service', place: 'service', owner: 'Service owner', did: 'requested' },
  };

  const activityWhen = value => {
    if (!value) return '—';
    const text = String(value);
    const stamp = /[zZ]|[+-]\d\d:?\d\d$/.test(text) ? text : `${text}Z`;
    const date = new Date(stamp);
    if (Number.isNaN(date.getTime())) return text;
    return date.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const activityDay = value => {
    if (!value) return 'Unknown day';
    const text = String(value);
    const stamp = /[zZ]|[+-]\d\d:?\d\d$/.test(text) ? text : `${text}Z`;
    const date = new Date(stamp);
    if (Number.isNaN(date.getTime())) return text;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const activityToday = value => activityDay(value) === activityDay(new Date().toISOString());

  const reachLine = (name, phone, email) => {
    const bits = [esc(name || 'Unknown')];
    const dialed = String(phone || '').replace(/[^\d+]/g, '');
    bits.push(dialed ? `<a href="tel:${dialed}">${esc(phone)}</a>` : 'No phone');
    bits.push(email ? `<a href="mailto:${esc(email)}">${esc(email)}</a>` : 'No email');
    return bits.join(' · ');
  };

  let activityCache = null;

  function paintActivity() {
    const rateForm = document.querySelector('#commissionRate');
    if (rateForm && activityCache && document.activeElement !== rateForm.elements.percent) {
      rateForm.elements.percent.value = activityCache.commissionPercent ?? '';
    }
    Object.entries(activityPages).forEach(([id, copy]) => {
      const stats = document.querySelector(`#${id}Stats`);
      const box = document.querySelector(`#${id}Activity`);
      if (!stats || !box) return;
      if (!activityCache) {
        box.innerHTML = '<p class="market-note">Loading…</p>';
        return;
      }
      const orders = (activityCache.orders || []).filter(row => row.kind === copy.kind);
      const listed = new Map((activityCache.places || []).filter(row => row.kind === copy.kind).map(place => [place.id, place]));
      orders.forEach(order => {
        if (listed.has(order.businessId)) return;
        listed.set(order.businessId, {
          id: order.businessId,
          name: order.businessName || 'Unknown',
          area: order.businessArea || '',
          phone: order.businessPhone || '',
          whatsapp: order.businessWhatsapp || '',
          address: order.businessAddress || '',
          ownerName: order.vendorName || '',
          ownerPhone: order.vendorPhone || '',
          ownerEmail: order.vendorEmail || '',
        });
      });
      const todayOrders = orders.filter(order => activityToday(order.created));
      const personKey = order => order.customerId || order.customerEmail || order.customerName || order.id;
      const people = new Set(orders.map(personKey));
      const peopleToday = new Set(todayOrders.map(personKey));
      const received = orders.filter(order => order.finalAmount != null);
      const paid = received.reduce((sum, order) => sum + Number(order.finalAmount || 0), 0);
      stats.innerHTML = `<div class="stat-card"><span class="stat-icon">👤</span><div><strong>${people.size}</strong><small>People who ${copy.did}</small></div></div><div class="stat-card"><span class="stat-icon">▣</span><div><strong>${todayOrders.length}</strong><small>Today · ${peopleToday.size} ${peopleToday.size === 1 ? 'person' : 'people'}</small></div></div><div class="stat-card"><span class="stat-icon">↻</span><div><strong>${orders.length}</strong><small>Times ${copy.did}</small></div></div><div class="stat-card"><span class="stat-icon">₹</span><div><strong>${money(paid)}</strong><small>Money received</small></div></div>`;
      const places = [...listed.values()].sort((a, b) => {
        const last = id => orders.find(order => order.businessId === id)?.created || '';
        return String(last(b.id)).localeCompare(String(last(a.id))) || String(a.name).localeCompare(String(b.name));
      });
      if (!places.length) {
        box.innerHTML = `<div class="empty-state">No ${id === 'shop' ? 'shops' : id} yet.</div>`;
        return;
      }
      box.innerHTML = places.map(place => {
        const rows = orders.filter(order => order.businessId === place.id);
        const placePaid = rows.filter(order => order.finalAmount != null).reduce((sum, order) => sum + Number(order.finalAmount || 0), 0);
        const placePeople = new Set(rows.map(personKey));
        const placeToday = rows.filter(order => activityToday(order.created)).length;
        const days = [];
        rows.forEach(order => {
          const label = activityDay(order.created);
          let day = days.find(item => item.label === label);
          if (!day) {
            day = { label, rows: [] };
            days.push(day);
          }
          day.rows.push(order);
        });
        const body = days.map(day => {
          const dayPaid = day.rows.reduce((sum, order) => sum + Number(order.finalAmount || 0), 0);
          const dayMoney = day.rows.some(order => order.finalAmount != null) ? `${money(dayPaid)} received` : 'none received yet';
          return `<h3 class="activity-day">${esc(day.label)} · ${day.rows.length} ${day.rows.length === 1 ? 'time' : 'times'} · ${dayMoney}</h3>${day.rows.map(order => {
          const receivedText = order.status === 'cancelled' ? 'Cancelled' : (order.finalAmount == null ? 'Has not received the money' : `Received ${money(order.finalAmount)}`);
          const receivedClass = order.status === 'cancelled' ? '' : (order.finalAmount == null ? 'no' : 'yes');
          let confirmText = 'Has not confirmed';
          let confirmClass = 'no';
          if (order.customerConfirm === 'completed') { confirmText = 'Confirmed received'; confirmClass = 'yes'; }
          else if (order.customerConfirm === 'not_completed') { confirmText = 'Did not receive it'; confirmClass = 'bad'; }
          else if (order.customerConfirm === 'disputed') { confirmText = 'Sent a note'; confirmClass = 'bad'; }
          const where = [place.area, place.address].filter(Boolean).join(' · ');
          return `<article class="activity-order"><h3>${esc(order.itemName)} · ${esc(order.reference || '')}</h3><p>${esc(activityWhen(order.created))}${order.quantity > 1 ? ` · ${esc(order.quantity)}` : ''} · Listed ${money(order.listedTotal || order.listedPrice)}</p><p>Customer: ${reachLine(order.customerName, order.customerPhone, order.customerEmail)}</p><p>${esc(copy.place[0].toUpperCase() + copy.place.slice(1))}: ${esc(order.businessName || place.name)}${where ? ` · ${esc(where)}` : ''}${place.phone ? ` · <a href="tel:${String(place.phone).replace(/[^\d+]/g, '')}">${esc(place.phone)}</a>` : ''}</p><div class="activity-flags"><span class="${receivedClass}">${esc(copy.place[0].toUpperCase() + copy.place.slice(1))}: ${esc(receivedText)}</span><span class="${confirmClass}">Customer: ${esc(confirmText)}</span></div>${order.customerNote ? `<p>Note: ${esc(order.customerNote)}</p>` : ''}${order.commissionAmount == null ? '' : `<p>Commission ${money(order.commissionAmount)} · ${esc(order.commissionStatus || 'recorded')}</p>`}</article>`;
        }).join('')}`;
        }).join('');
        return `<article class="activity-place"><h2>${esc(place.name || 'Untitled')}</h2><p class="place-meta">${esc(copy.owner)}: ${reachLine(place.ownerName, place.ownerPhone, place.ownerEmail)}</p><p class="place-meta">${esc(place.category || '')}${place.area ? ` · ${esc(place.area)}` : ''}${place.phone ? ` · <a href="tel:${String(place.phone).replace(/[^\d+]/g, '')}">${esc(place.phone)}</a>` : ''}${place.whatsapp ? ` · WhatsApp ${esc(place.whatsapp)}` : ''}${place.address ? ` · ${esc(place.address)}` : ''}</p><p class="place-count">${placePeople.size} ${placePeople.size === 1 ? 'person' : 'people'} · ${rows.length} ${rows.length === 1 ? 'time' : 'times'} · ${placeToday} today · ${money(placePaid)} received</p>${body || '<div class="empty-state">No activity yet.</div>'}</article>`;
      }).join('');
    });
  }

  async function loadActivity() {
    try {
      activityCache = await apiCall('/market/admin/orders');
      paintActivity();
    } catch (error) {
      Object.keys(activityPages).forEach(id => {
        const box = document.querySelector(`#${id}Activity`);
        if (box) box.innerHTML = `<p class="market-note">${esc(error.message)}</p>`;
      });
    }
  }

  if (document.querySelector('#adminStats')) {
    const session = guard('admin');
    if (session) {
      refreshAdmin();
      loadActivity();
      setInterval(loadActivity, 15000);
      const rateForm = document.querySelector('#commissionRate');
      rateForm?.addEventListener('submit', async event => {
        event.preventDefault();
        try {
          await apiCall('/market/admin/commission', { method: 'PUT', body: JSON.stringify({ percent: new FormData(rateForm).get('percent') }) });
          await loadActivity();
        } catch (error) { alert(error.message); }
      });
    }
  }

  function showWorkspace() {
    const pages = [...document.querySelectorAll('.workspace')];
    if (!pages.length) return;
    const wanted = (location.hash || '#overview').slice(1);
    const current = pages.some(page => page.id === wanted) ? wanted : 'overview';
    pages.forEach(page => { page.hidden = page.id !== current; });
    document.querySelectorAll('.side-nav a[href^="#"]').forEach(link => {
      link.classList.toggle('selected', link.getAttribute('href') === `#${current}`);
    });
  }

  window.addEventListener('hashchange', () => { showWorkspace(); if (location.hash === '#person') paintPerson(); if (location.hash === '#reports') paintReports(); });
  showWorkspace();

  const dial = value => String(value || '').replace(/[^\d+]/g, '');
  fetch(`${API_BASE}/payment`).then(response => response.ok ? response.json() : null).then(payment => {
    const phone = payment?.contactPhone || '';
    const email = payment?.contactEmail || '';
    document.querySelectorAll('[data-admin-contact]').forEach(link => {
      if (phone) {
        link.href = `tel:${dial(phone)}`;
        link.textContent = phone;
      } else if (email) {
        link.href = `mailto:${email}`;
        link.textContent = email;
      }
    });
    const wa = dial(phone).replace(/^\+/, '');
    const intro = 'Hello StudentStay, my name is ______. I am an international student looking for a room in Greater Noida. How can you help me?';
    const mailBody = 'Hello StudentStay,\n\nMy name is ______.\n\nI am an international student looking for a room in Greater Noida.\n\nHow can you help me?';
    document.querySelectorAll('[data-reach="wa"]').forEach(link => {
      if (!wa) return;
      link.hidden = false;
      link.href = `https://wa.me/${wa}?text=${encodeURIComponent(intro)}`;
      link.target = '_blank';
      link.rel = 'noopener';
    });
    document.querySelectorAll('[data-reach="mail"]').forEach(link => {
      if (!email) return;
      link.hidden = false;
      link.href = `mailto:${email}?subject=${encodeURIComponent('How can you help me?')}&body=${encodeURIComponent(mailBody)}`;
    });
  }).catch(() => {});

  document.querySelectorAll('.side-nav a[href^="#"]').forEach(link => {
    link.addEventListener('click', () => {
      document.querySelectorAll('.side-nav a').forEach(item => item.classList.remove('selected'));
      link.classList.add('selected');
    });
  });
})();
