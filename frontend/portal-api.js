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
    if (['student','landlord'].includes(requestedRole)) roleButtons.find(button => button.dataset.role === requestedRole)?.click();
    if (new URLSearchParams(location.search).get('mode') === 'signup') document.querySelector('[data-mode="signup"]').click();
    if (location.hash === '#student') showStudentArea();
    updateAuth();
    const signedInNote = document.querySelector('#signedInNote');
    if (signedInNote && currentUser && token) {
      const dashboards = { student: 'student.html', landlord: 'landlord.html', admin: 'admin.html' };
      signedInNote.classList.remove('hidden');
      signedInNote.innerHTML = `<span>You are signed in as <b>${esc(currentUser.name)}</b> (${esc(currentUser.role)}).</span><a href="${dashboards[currentUser.role] || 'student.html'}">Go to dashboard</a>`;
    }

    const finish = response => {
      if (!response) return;
      token = response.access_token;
      currentUser = response.user;
      localStorage.setItem('studentstay_token', token);
      localStorage.setItem('studentstay_user', JSON.stringify(currentUser));
      go(currentUser.role);
    };
    const altNote = document.querySelector('#altNote');
    const say = message => { if (altNote) altNote.textContent = message; else alert(message); };
    const phoneForm = document.querySelector('#phoneForm');
    const countries = [
      ['India', '+91', 10], ['Nepal', '+977', 10], ['Bangladesh', '+880', 10], ['Nigeria', '+234', 10],
      ['Ghana', '+233', 9], ['Gambia', '+220', 7], ['Kenya', '+254', 9], ['China', '+86', 11],
      ['United States', '+1', 10], ['United Kingdom', '+44', 10], ['UAE', '+971', 9]
    ];
    const countrySelect = phoneForm?.elements.country;
    const localInput = phoneForm?.elements.local;
    const dialCode = document.querySelector('#dialCode');
    const phoneCheck = document.querySelector('#phoneCheck');
    const phoneStatus = document.querySelector('#phoneStatus');
    const sendCode = document.querySelector('#sendCode');
    const stepNumber = document.querySelector('#phoneStepNumber');
    const stepCode = document.querySelector('#phoneStepCode');
    countries.forEach(([name, code, length]) => {
      const option = document.createElement('option');
      option.value = `${code}|${length}`;
      option.textContent = `${name} ${code}`;
      countrySelect?.appendChild(option);
    });
    const chosenCountry = () => {
      const [code, length] = (countrySelect?.value || '+91|10').split('|');
      return { code, length: Number(length) };
    };
    const localDigits = () => (localInput?.value || '').replace(/\D/g, '');
    const fullPhone = () => `${chosenCountry().code}${localDigits()}`;
    const setPhoneStatus = (message, kind) => {
      if (!phoneStatus) return;
      phoneStatus.textContent = message || '';
      phoneStatus.className = `phone-status${kind ? ` ${kind}` : ''}`;
    };
    const refreshPhone = () => {
      const { code, length } = chosenCountry();
      if (dialCode) dialCode.textContent = code;
      const digits = localDigits();
      const ready = digits.length === length;
      if (sendCode && sendCode.dataset.busy !== '1') sendCode.disabled = !ready;
      if (!phoneCheck) return;
      if (!digits.length) {
        phoneCheck.textContent = `Enter ${length} digits after ${code}.`;
        phoneCheck.className = 'phone-check';
      } else if (digits.length < length) {
        phoneCheck.textContent = `${length - digits.length} more digit${length - digits.length === 1 ? '' : 's'} to go.`;
        phoneCheck.className = 'phone-check';
      } else if (digits.length > length) {
        phoneCheck.textContent = `That is too long for ${code}. Use ${length} digits.`;
        phoneCheck.className = 'phone-check bad';
      } else {
        phoneCheck.textContent = `Number looks correct: ${fullPhone()}`;
        phoneCheck.className = 'phone-check ok';
      }
    };
    countrySelect?.addEventListener('change', refreshPhone);
    localInput?.addEventListener('input', () => {
      localInput.value = localDigits();
      refreshPhone();
    });
    refreshPhone();
    document.querySelector('#phoneToggle')?.addEventListener('click', () => {
      phoneForm?.classList.toggle('hidden');
      if (!phoneForm?.classList.contains('hidden')) localInput?.focus();
    });
    document.querySelector('#phoneBack')?.addEventListener('click', () => {
      stepCode?.classList.add('hidden');
      stepNumber?.classList.remove('hidden');
      setPhoneStatus('');
      refreshPhone();
    });
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
              finish(await apiCall('/auth/google', { method: 'POST', body: JSON.stringify({ credential: response.credential, role }) }));
            } catch (error) { say(error.message); }
          }
        });
        google.accounts.id.renderButton(slot, { theme: 'outline', size: 'large', width: Math.max(240, Math.min(360, slot.parentElement.clientWidth || 320)), text: 'continue_with', shape: 'pill' });
        document.querySelector('#googleFallback')?.classList.add('hidden');
      };
      document.head.appendChild(script);
    }).catch(() => {});
    sendCode?.addEventListener('click', async () => {
      if (sendCode.disabled && sendCode.dataset.busy === '1') return;
      const phone = fullPhone();
      const name = phoneForm?.elements.name.value || '';
      sendCode.dataset.busy = '1';
      sendCode.disabled = true;
      sendCode.textContent = 'Sending code...';
      setPhoneStatus(`Sending a text to ${phone}. Wait here.`, '');
      try {
        const response = await apiCall('/auth/phone/send', { method: 'POST', body: JSON.stringify({ phone, role, name }) });
        if (!response) return;
        stepNumber?.classList.add('hidden');
        stepCode?.classList.remove('hidden');
        const sent = document.querySelector('#phoneSent');
        if (sent) sent.textContent = `Code sent to ${response.phone || phone}. Type the 6 digits from the text.`;
        setPhoneStatus('');
        phoneForm.elements.code.value = '';
        phoneForm.elements.code.focus();
      } catch (error) {
        setPhoneStatus(error.message, 'bad');
      } finally {
        sendCode.dataset.busy = '';
        sendCode.textContent = 'Send code';
        refreshPhone();
      }
    });
    phoneForm?.addEventListener('submit', async event => {
      event.preventDefault();
      const verify = document.querySelector('#verifyCode');
      const phone = fullPhone();
      if (verify) { verify.disabled = true; verify.textContent = 'Checking code...'; }
      setPhoneStatus('Checking the code.', '');
      try {
        finish(await apiCall('/auth/phone/verify', { method: 'POST', body: JSON.stringify({ phone, code: phoneForm.elements.code.value, name: phoneForm.elements.name.value, role }) }));
      } catch (error) {
        setPhoneStatus(error.message, 'bad');
      } finally {
        if (verify) { verify.disabled = false; verify.textContent = 'Verify and sign in'; }
      }
    });

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
          go(currentUser.role);
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
    target.innerHTML = items.map(item => `<article class="listing-tile detail-link" data-property-id="${esc(item.id)}" tabindex="0" role="link"><img src="${esc(img(item))}" alt="${esc(item.title)}"><div class="listing-tile-body"><h3>${esc(item.title)}</h3><p>${esc(item.type)} · ${esc(item.sector || item.city || 'Greater Noida')}</p><div class="listing-price">${money(item.rent)} <small>/ month</small></div><p>${esc(item.description)}</p><p>⌖ ${esc(item.unlocked ? (item.address || item.sector || item.city) : (item.sector || item.city || 'Greater Noida'))}</p>${options.owner ? `<div class="listing-actions"><button class="small-button" data-edit-listing="${esc(item.id)}">Edit</button><button class="small-button danger" data-delete-listing="${esc(item.id)}">Remove</button></div>` : `<div class="listing-actions"><a class="primary-button" href="property.html?id=${encodeURIComponent(item.id)}">View home</a></div>`}</div></article>`).join('');
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
      renderListings('#adminListings', listings);
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

  if (document.querySelector('#adminStats')) {
    const session = guard('admin');
    if (session) refreshAdmin();
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
