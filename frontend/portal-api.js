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
        let code = '';
        try {
          const error = JSON.parse(text);
          if (error.error) message = error.error;
          if (error.code) code = error.code;
        } catch { /* the server did not return JSON */ }
        const failure = new Error(message);
        failure.code = code;
        throw failure;
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

    let policyAccepted = false;
    let policyWait = null;
    const askPolicy = () => {
      if (policyAccepted) return Promise.resolve(true);
      if (policyWait) return policyWait;
      const modal = document.querySelector('#policyGate');
      if (!modal) return Promise.resolve(false);
      modal.classList.remove('hidden');
      policyWait = new Promise(resolve => {
        const accept = modal.querySelector('[data-policy-accept]');
        const cancel = modal.querySelector('[data-policy-cancel]');
        const finishChoice = ok => {
          modal.classList.add('hidden');
          accept?.removeEventListener('click', onAccept);
          cancel?.removeEventListener('click', onCancel);
          policyWait = null;
          if (ok) {
            policyAccepted = true;
            if (authForm.elements.policy) authForm.elements.policy.checked = true;
          }
          resolve(ok);
        };
        const onAccept = () => finishChoice(true);
        const onCancel = () => finishChoice(false);
        accept?.addEventListener('click', onAccept);
        cancel?.addEventListener('click', onCancel);
      });
      return policyWait;
    };
    const ensurePolicyForSignup = async () => {
      if (mode !== 'signup' || policyAccepted) return;
      const ok = await askPolicy();
      if (ok) return;
      mode = 'signin';
      if (role === 'student') role = 'landlord';
      updateAuth();
    };

    tabs.forEach(button => button.addEventListener('click', () => {
      mode = button.dataset.mode;
      if (mode !== 'signup' && role === 'student') role = 'landlord';
      updateAuth();
      if (mode === 'signin' && currentUser && token && currentUser.role === 'student') document.querySelector('#enterChoice')?.classList.remove('hidden');
      else document.querySelector('#enterChoice')?.classList.add('hidden');
      ensurePolicyForSignup();
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
    ensurePolicyForSignup();
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
              const googleRole = mode === 'owners' ? (picked || role) : mode === 'signup' ? role : 'student';
              const send = accepted => apiCall('/auth/google', { method: 'POST', body: JSON.stringify({ credential: response.credential, role: googleRole, acceptedPolicy: !!accepted }) });
              try {
                finish(await send(policyAccepted));
              } catch (error) {
                if (error.code !== 'policy_required') throw error;
                const ok = await askPolicy();
                if (!ok) {
                  say('This Google email is new. Accept the Privacy and policy before the account opens.');
                  return;
                }
                finish(await send(true));
              }
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
        if (mode === 'signup') {
          if (!(await askPolicy())) return;
          finish(await apiCall('/auth/signup', {
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
              category: String(form.get('category') || '').trim(),
              acceptedPolicy: true
            })
          }));
          return;
        }
        const found = await apiCall('/auth/email', { method: 'POST', body: JSON.stringify({ email }) });
        if (!found?.exists) {
          if (!(await askPolicy())) {
            alert('This email is not an account yet. Accept the Privacy and policy before it can open.');
            return;
          }
          if (mode === 'owners') {
            mode = 'signup';
            updateAuth();
            const note = document.querySelector('#authNote');
            if (note) note.textContent = 'This email is new. Add your name. The Privacy and policy is accepted. Then open the account.';
            return;
          }
          const raw = email.split('@')[0] || 'Student';
          const name = raw.replace(/[._-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()).slice(0, 100) || 'Student';
          finish(await apiCall('/auth/signup', {
            method: 'POST',
            body: JSON.stringify({ name, email, password, role: 'student', city: 'Greater Noida', acceptedPolicy: true })
          }));
          return;
        }
        finish(await apiCall('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password, role: mode === 'owners' ? role : 'student' })
        }));
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
      const [listings, unlocks, orders] = await Promise.all([
        apiCall('/listings'),
        apiCall('/unlocks/student'),
        apiCall('/market/my-orders').catch(() => [])
      ]);

      const listingCountEl = document.querySelector('#listingCount');
      const requestCountEl = document.querySelector('#requestCount');
      if (listingCountEl) listingCountEl.textContent = listings.length;
      if (requestCountEl) requestCountEl.textContent = unlocks.length;

      renderListings('#studentListings', listings.filter(item => !item.taken), { request: true, studentId: currentUser.id });

      const feeCard = item => {
        const title = esc(item.listing?.title || 'Home');
        const sector = esc(item.listing?.sector || 'Greater Noida');
        const fee = money(item.listing?.brokerFee ?? Math.floor(Number(item.listing?.rent || 0) / 2));
        const house = `property.html?id=${encodeURIComponent(item.listing?.id || '')}#contact`;
        if (item.status === 'rejected') return `<article class="fee-card rejected"><div><small>NOT ACCEPTED · ${fee}</small><h3>${title}</h3><p>${sector}. Upload a new receipt for this house.</p></div><a class="pay-now" href="${house.replace('#contact', '')}">Pay again</a></article>`;
        return `<article class="fee-card ${item.status === 'approved' ? 'approved' : 'waiting'}"><div><small>${item.status === 'approved' ? 'APPROVED' : 'RECEIPT SENT'} · ${fee}</small><h3>${title}</h3><p>${sector}. Next step: contact the broker and send your receipt. The house location stays private.</p><p class="broker-arrow"><b>→</b> The broker’s number and WhatsApp are on the next page.</p></div><a class="pay-now" href="${house}">Contact the broker</a></article>`;
      };
      const requestsEl = document.querySelector('#studentRequests');
      if (requestsEl) {
        requestsEl.innerHTML = unlocks.map(feeCard).join('') || '<div class="empty-state">You have not paid a broker fee yet. Open a home and tap Pay now.</div>';
        if (location.hash === '#requests' || location.hash === '#history') {
          document.querySelector(location.hash)?.scrollIntoView({ block: 'start' });
          document.querySelectorAll('.side-nav a').forEach(link => link.classList.toggle('selected', link.getAttribute('href') === location.hash));
        }
      }
      const historyEl = document.querySelector('#studentHistory');
      if (historyEl) {
        const when = value => {
          if (!value) return '';
          const text = String(value);
          const stamp = /[zZ]|[+-]\d\d:?\d\d$/.test(text) ? text : `${text}Z`;
          const date = new Date(stamp);
          return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        };
        const houseRows = unlocks.map(item => ({
          at: item.created || '',
          html: `<div class="request-row"><div><b>House · ${esc(item.listing?.title || 'Home')}</b><p>${esc(item.listing?.sector || 'Greater Noida')} · Broker fee ${money(item.listing?.brokerFee ?? Math.floor(Number(item.listing?.rent || 0) / 2))} · ${esc(item.status === 'approved' ? 'Approved' : item.status === 'rejected' ? 'Not accepted' : 'Receipt sent')}<br>${esc(when(item.created))}</p></div></div>`
        }));
        const kindName = { restaurant: 'Restaurant', shop: 'Shop', service: 'Service' };
        const orderRows = (orders || []).map(item => ({
          at: item.created || '',
          html: `<div class="request-row"><div><b>${esc(kindName[item.kind] || 'Order')} · ${esc(item.itemName || 'Item')}</b><p>${esc(item.businessName || '')} · ${item.finalAmount == null ? 'Money not entered yet' : money(item.finalAmount)} · ${esc(item.status || '')}<br>${esc(when(item.created))}</p></div></div>`
        }));
        const rows = [...houseRows, ...orderRows].sort((a, b) => String(b.at).localeCompare(String(a.at)));
        historyEl.innerHTML = rows.map(row => row.html).join('') || '<div class="empty-state">Nothing here yet. A house, a meal, a shop purchase, or a service will show up after you do it.</div>';
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
    target.innerHTML = items.map(item => {
      const paid = options.paidIds?.has(item.id);
      const takenNote = !options.owner ? '' : item.taken
        ? `<p class="taken-note">${paid ? 'A broker fee was approved. This room is off the site. The student who paid can still open it.' : 'This room is taken. Students no longer see it.'}</p>`
        : paid
          ? `<p class="taken-alert">A student paid the broker fee. It leaves the site when the admin approves that fee.</p>`
          : '';
      const takenButton = !options.owner || (item.taken && paid) ? '' : `<button class="small-button" type="button" data-mark-taken="${esc(item.id)}" data-taken="${item.taken ? '0' : '1'}">${item.taken ? 'Open this room' : 'This room is taken'}</button>`;
      return `<article class="listing-tile detail-link" data-property-id="${esc(item.id)}" tabindex="0" role="link"><img src="${esc(img(item))}" alt="${esc(item.title)}"><div class="listing-tile-body"><h3>${esc(item.title)}</h3><p>${esc(item.type)} · ${esc(item.sector || item.city || 'Greater Noida')}</p><div class="listing-price">${money(item.rent)} <small>/ month</small></div><p>${esc(item.description)}</p><p>⌖ ${esc((options.owner || currentUser?.role === 'admin') && item.address ? item.address : (item.sector || item.city || 'Greater Noida'))}</p>${takenNote}${options.owner ? `<div class="listing-actions">${takenButton}<button class="small-button" data-edit-listing="${esc(item.id)}">Edit</button><button class="small-button danger" data-delete-listing="${esc(item.id)}">Remove</button></div>` : `<div class="listing-actions"><a class="primary-button" href="property.html?id=${encodeURIComponent(item.id)}">View home</a></div>`}</div></article>`;
    }).join('');
    target.querySelectorAll('[data-property-id]').forEach(tile => { tile.addEventListener('click', event => { if (!event.target.closest('button')) location.href = `property.html?id=${encodeURIComponent(tile.dataset.propertyId)}`; }); tile.addEventListener('keydown', event => { if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('button')) { event.preventDefault(); location.href = `property.html?id=${encodeURIComponent(tile.dataset.propertyId)}`; } }); });
    target.querySelectorAll('[data-delete-listing]').forEach(button => button.addEventListener('click', async () => { if (!confirm('Remove this listing?')) return; try { await apiCall(`/listings/${button.dataset.deleteListing}`, { method: 'DELETE' }); refreshLandlord(); } catch (error) { alert(error.message); } }));
    target.querySelectorAll('[data-mark-taken]').forEach(button => button.addEventListener('click', async event => {
      event.stopPropagation();
      try {
        await apiCall(`/listings/${button.dataset.markTaken}/taken`, { method: 'PUT', body: JSON.stringify({ taken: button.dataset.taken === '1' }) });
        refreshLandlord();
      } catch (error) { alert(error.message); }
    }));
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
      const paidIds = new Set(unlocks.filter(item => item.status === 'approved').map(item => item.listing?.id).filter(Boolean));
      renderListings('#landlordListings', listings, { owner: true, paidIds });
      
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
  const reportSources = [
    { id: 'house', label: 'Houses', cut: 'Broker fee' },
    { id: 'restaurant', label: 'Restaurants', cut: '10% of the sale' },
    { id: 'shop', label: 'Shop', cut: '10% of the sale' },
    { id: 'service', label: 'Services', cut: '10% of the sale' },
  ];
  const reportState = { mode: 'day', day: '', week: '', month: '', from: '', to: '', source: 'all', pay: 'all' };

  function reportRange() {
    const now = new Date();
    if (!reportState.day) reportState.day = dayKey(now);
    if (!reportState.week) reportState.week = weekKey(now);
    if (!reportState.month) reportState.month = dayKey(now).slice(0, 7);
    if (!reportState.from) reportState.from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    if (!reportState.to) reportState.to = dayKey(now);
    if (reportState.mode === 'week') {
      const start = weekStart(reportState.week);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return { start, end };
    }
    if (reportState.mode === 'month') {
      const match = /^(\d{4})-(\d{2})$/.exec(reportState.month);
      const year = match ? Number(match[1]) : now.getFullYear();
      const month = match ? Number(match[2]) - 1 : now.getMonth();
      return { start: new Date(year, month, 1), end: new Date(year, month + 1, 1) };
    }
    if (reportState.mode === 'range') {
      let start = new Date(`${reportState.from}T00:00:00`);
      let end = new Date(`${reportState.to}T00:00:00`);
      if (Number.isNaN(start.getTime())) start = new Date(now.getFullYear(), now.getMonth(), 1);
      if (Number.isNaN(end.getTime())) end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (start > end) { const swap = start; start = end; end = swap; }
      end.setDate(end.getDate() + 1);
      return { start, end };
    }
    const start = new Date(`${reportState.day}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }

  function reportPeriodText() {
    const { start, end } = reportRange();
    const last = new Date(end.getTime() - 1);
    if (reportState.mode === 'day') return writtenDay(start);
    if (reportState.mode === 'month') return start.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    return `${writtenDay(start)} – ${writtenDay(last)}`;
  }

  function moveReport(step) {
    reportRange();
    if (reportState.mode === 'week') {
      const start = weekStart(reportState.week);
      start.setDate(start.getDate() + step * 7);
      reportState.week = weekKey(start);
    } else if (reportState.mode === 'month') {
      const match = /^(\d{4})-(\d{2})$/.exec(reportState.month);
      const date = new Date(match ? Number(match[1]) : new Date().getFullYear(), (match ? Number(match[2]) - 1 : new Date().getMonth()) + step, 1);
      reportState.month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    } else if (reportState.mode === 'range') {
      const from = new Date(`${reportState.from}T00:00:00`);
      const to = new Date(`${reportState.to}T00:00:00`);
      const span = Math.max(1, Math.round((to - from) / 86400000) + 1);
      from.setDate(from.getDate() + step * span);
      to.setDate(to.getDate() + step * span);
      reportState.from = dayKey(from);
      reportState.to = dayKey(to);
    } else {
      const date = new Date(`${reportState.day}T00:00:00`);
      date.setDate(date.getDate() + step);
      reportState.day = dayKey(date);
    }
    paintReports(true);
  }

  function moneyLines() {
    const houses = (adminCache?.unlocks || []).filter(item => item.status === 'approved' || item.status === 'pending').map(item => {
      const rent = Number(item.listing?.rent || 0);
      const profit = Number(item.listing?.brokerFee ?? Math.floor(rent / 2));
      const owner = item.ownerName || item.listing?.ownerName || 'Landlord';
      return {
        id: item.id,
        kind: 'house',
        paid: item.status === 'approved',
        waived: false,
        created: item.created,
        who: item.student?.name || 'Student',
        detail: [item.listing?.title || 'Home', item.listing?.sector, owner].filter(Boolean).join(' · '),
        baseLabel: 'House rent',
        base: rent,
        profit,
        phone: item.student?.phone || '',
        email: item.student?.email || '',
        ownerId: item.ownerId || '',
        studentId: item.studentId || '',
        businessId: '',
      };
    });
    const sales = (activityCache?.orders || []).filter(order => order.status !== 'cancelled' && order.commissionAmount != null).map(order => ({
      id: order.id,
      kind: order.kind,
      paid: order.commissionStatus === 'paid',
      waived: order.commissionStatus === 'waived',
      created: order.created,
      who: order.businessName || 'Place',
      detail: [order.itemName, order.customerName ? `Customer ${order.customerName}` : ''].filter(Boolean).join(' · '),
      baseLabel: 'They received',
      base: Number(order.finalAmount || 0),
      profit: Number(order.commissionAmount || 0),
      phone: order.businessPhone || order.vendorPhone || '',
      email: order.vendorEmail || '',
      ownerId: '',
      studentId: order.customerId || '',
      businessId: order.businessId || '',
    }));
    return [...houses, ...sales];
  }

  function linesInReport(lines) {
    const { start, end } = reportRange();
    return lines.filter(row => {
      const date = orderDate(row.created);
      return date && date >= start && date < end;
    });
  }

  function moneyLine(row) {
    const source = reportSources.find(item => item.id === row.kind) || { label: 'Payment' };
    const state = row.waived ? 'waived' : row.paid ? 'paid' : 'pending';
    const stateLabel = row.waived ? 'Not charged' : row.paid ? 'Paid' : 'Pending';
    const dialed = String(row.phone || '').replace(/[^\d+]/g, '');
    const contact = [
      dialed ? `<a href="tel:${dialed}">${esc(row.phone)}</a>` : 'No phone',
      row.email ? `<a href="mailto:${esc(row.email)}">${esc(row.email)}</a>` : 'No email',
    ].join(' · ');
    const remove = row.kind === 'house' ? `<button class="money-remove" type="button" data-delete-payment="${esc(row.id)}">Remove</button>` : '';
    return `<article class="money-line ${state}">
      <div class="money-kind ${esc(row.kind)}">${esc(source.label)}</div>
      <div class="money-who">
        <b>${esc(row.who)}</b>
        <p>${esc(row.detail)}</p>
        <p>${contact} · ${esc(activityWhen(row.created))}</p>
      </div>
      <div class="money-figures">
        <span>${esc(row.baseLabel)}<strong>${money(row.base)}</strong></span>
        <span>My profit<strong>${money(row.profit)}</strong></span>
      </div>
      <div class="money-sign" role="group" aria-label="Sign ${esc(row.who)}">
        <button type="button" data-report-sign="paid" data-report-id="${esc(row.id)}" data-report-kind="${esc(row.kind)}" aria-pressed="${row.paid ? 'true' : 'false'}">Paid</button>
        <button type="button" data-report-sign="pending" data-report-id="${esc(row.id)}" data-report-kind="${esc(row.kind)}" aria-pressed="${!row.paid && !row.waived ? 'true' : 'false'}">Pending</button>
      </div>
      <div class="money-actions">
        <span class="money-state ${state}">${stateLabel}</span>
        <button class="money-open" type="button" data-report-open data-report-kind="${esc(row.kind)}" data-report-owner="${esc(row.ownerId)}" data-report-student="${esc(row.studentId)}" data-report-business="${esc(row.businessId)}">Open</button>
        ${remove}
      </div>
    </article>`;
  }

  function paintReports(force) {
    const board = document.querySelector('#reportBoard');
    if (!board || !adminCache) return;
    if (!force && board.contains(document.activeElement) && document.activeElement.matches('input')) return;
    const all = moneyLines();
    const dated = linesInReport(all);
    const ranged = dated.filter(row => reportState.source === 'all' || row.kind === reportState.source);
    const live = ranged.filter(row => !row.waived);
    const collected = live.filter(row => row.paid).reduce((sum, row) => sum + row.profit, 0);
    const waiting = live.filter(row => !row.paid).reduce((sum, row) => sum + row.profit, 0);
    const spend = live.reduce((sum, row) => sum + row.base, 0);
    const visible = ranged.filter(row => reportState.pay === 'all' || (reportState.pay === 'paid' ? row.paid : !row.paid && !row.waived));
    const unpaid = ranged.filter(row => !row.paid && !row.waived).sort((a, b) => b.profit - a.profit);
    const modes = [['day', 'Today'], ['week', 'This week'], ['month', 'This month'], ['range', 'Choose dates']];
    const moveNames = { day: ['Previous day', 'Next day'], week: ['Previous week', 'Next week'], month: ['Previous month', 'Next month'], range: ['Earlier', 'Later'] };
    const fields = reportState.mode === 'week'
      ? `<label>Week<input name="reportWeek" type="week" value="${esc(reportState.week)}"></label>`
      : reportState.mode === 'month'
        ? `<label>Month<input name="reportMonth" type="month" value="${esc(reportState.month)}"></label>`
        : reportState.mode === 'range'
          ? `<label>From<input name="reportFrom" type="date" value="${esc(reportState.from)}"></label><label>To<input name="reportTo" type="date" value="${esc(reportState.to)}"></label>`
          : `<label>Day<input name="reportDay" type="date" value="${esc(reportState.day)}"></label>`;
    const sourceCards = reportSources.map(item => {
      const rows = linesInReport(all).filter(row => row.kind === item.id && !row.waived);
      const mine = rows.reduce((sum, row) => sum + row.profit, 0);
      const due = rows.filter(row => !row.paid).reduce((sum, row) => sum + row.profit, 0);
      const dueCount = rows.filter(row => !row.paid).length;
      return `<button type="button" class="money-source${reportState.source === item.id ? ' on' : ''}" data-report-source="${item.id}"><span>${esc(item.label)}</span><strong>${money(mine)}</strong><small>${esc(item.cut)}</small><small>${dueCount ? `${dueCount} not paid · ${money(due)}` : 'All signed paid'}</small></button>`;
    }).join('');
    const payChips = [['all', 'All lines'], ['pending', 'Not paid yet'], ['paid', 'Paid']].map(([id, label]) => `<button type="button" class="${reportState.pay === id ? 'on' : ''}" data-report-pay="${id}">${label}</button>`).join('');
    const dueList = unpaid.length && reportState.pay !== 'paid'
      ? `<section class="money-due"><h2>Who has not paid</h2><div class="money-due-list">${unpaid.map(row => `<button type="button" data-report-open data-report-kind="${esc(row.kind)}" data-report-owner="${esc(row.ownerId)}" data-report-student="${esc(row.studentId)}" data-report-business="${esc(row.businessId)}"><b>${esc(row.who)}</b><span>${money(row.profit)} pending</span><small>${esc(row.detail)}</small></button>`).join('')}</div></section>`
      : '';
    const groups = new Map();
    visible.forEach(row => {
      const date = orderDate(row.created);
      const key = date ? dayKey(date) : 'none';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });
    const days = [...groups.keys()].sort((a, b) => b.localeCompare(a)).map(key => {
      const rows = groups.get(key).sort((a, b) => Number(a.paid) - Number(b.paid) || b.profit - a.profit);
      const title = key === 'none' ? 'No date' : new Date(`${key}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
      const dayPaid = rows.filter(row => row.paid && !row.waived).reduce((sum, row) => sum + row.profit, 0);
      const dayDue = rows.filter(row => !row.paid && !row.waived).reduce((sum, row) => sum + row.profit, 0);
      return `<section class="money-day"><div class="money-day-head"><h2>${esc(title)}</h2><p>Collected ${money(dayPaid)} · Still to collect ${money(dayDue)}</p></div>${rows.map(moneyLine).join('')}</section>`;
    }).join('');
    let empty = '';
    if (!visible.length) {
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
      const monthRows = all.filter(row => {
        const date = orderDate(row.created);
        return date && date >= monthStart && date < monthEnd && !row.waived;
      });
      const monthProfit = monthRows.reduce((sum, row) => sum + row.profit, 0);
      empty = `<div class="empty-state">${reportState.mode === 'day' && monthRows.length ? `Nothing is dated ${esc(reportPeriodText())}. This month has ${money(monthProfit)} on the books.` : 'No money in these dates.'}</div>`;
    }
    const loading = activityCache ? '' : '<p class="market-note">Restaurant, shop, and service money is still loading.</p>';
    const scrollY = window.scrollY;
    board.innerHTML = `<div class="money-report">
      <div class="money-toolbar">
        <div class="period-switch">${modes.map(([id, label]) => `<button type="button" class="${reportState.mode === id ? 'on' : ''}" data-report-mode="${id}">${label}</button>`).join('')}</div>
        <div class="period-move"><button type="button" data-report-shift="-1">${moveNames[reportState.mode][0]}</button><button type="button" data-report-shift="1">${moveNames[reportState.mode][1]}</button></div>
        <p class="period-summary">${esc(reportPeriodText())}. Broker fees, and 10% from restaurants, shops, and services.</p>
        <div class="period-fields">${fields}</div>
        <div class="period-switch money-pay">${payChips}</div>
      </div>
      <div class="money-hero">
        <div class="money-collected"><span>Collected</span><strong>${money(collected)}</strong><small>Signed paid. This is in your account.</small></div>
        <div class="money-side">
          <div><span>Still to collect</span><strong>${money(waiting)}</strong><small>${unpaid.length} not signed paid</small></div>
          <div><span>My profit</span><strong>${money(collected + waiting)}</strong><small>Broker fees plus 10%</small></div>
          <div><span>Customer spend</span><strong>${money(spend)}</strong><small>House rent and sales. This is not all yours.</small></div>
        </div>
      </div>
      <div class="money-sources"><button type="button" class="money-source${reportState.source === 'all' ? ' on' : ''}" data-report-source="all"><span>All</span><strong>${money(dated.filter(row => !row.waived).reduce((sum, row) => sum + row.profit, 0))}</strong><small>Every source</small><small>${dated.filter(row => !row.paid && !row.waived).length ? `${dated.filter(row => !row.paid && !row.waived).length} not paid` : 'Nothing pending'}</small></button>${sourceCards}</div>
      ${loading}
      ${dueList}
      <section class="money-ledger"><h2>Daily lines</h2>${days || empty}</section>
    </div>`;
    bindDeletes(board);
    window.scrollTo(0, scrollY);
  }

  async function signMoney(kind, id, status) {
    if (kind === 'house') {
      await apiCall(`/admin/unlocks/${id}`, { method: 'PUT', body: JSON.stringify({ status: status === 'paid' ? 'approved' : 'pending' }) });
      adminCache = null;
      await refreshAdmin();
      return;
    }
    const saved = await apiCall(`/market/admin/orders/${id}/commission`, { method: 'PUT', body: JSON.stringify({ status: status === 'paid' ? 'paid' : 'pending' }) });
    const row = (activityCache?.orders || []).find(item => item.id === id);
    if (row) row.commissionStatus = saved?.commissionStatus || (status === 'paid' ? 'paid' : 'pending');
    paintReports(true);
  }

  function openMoney(button) {
    const kind = button.dataset.reportKind;
    const owner = button.dataset.reportOwner || '';
    const student = button.dataset.reportStudent || '';
    const business = button.dataset.reportBusiness || '';
    if (kind === 'house') {
      if (owner) {
        openView({ id: owner, kind: 'landlord' });
        if (student) {
          viewState.payer = student;
          paintView();
        }
        return;
      }
      if (student) showPerson(student);
      return;
    }
    if (business) openView({ id: business, kind });
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
      const paid = (adminCache.unlocks || []).filter(item => item.studentId === person.id || (item.student?.email || '').toLowerCase() === (person.email || '').toLowerCase());
      const rented = paid.filter(item => item.status === 'approved');
      const homes = rented.map(item => listings.find(home => home.id === item.listing?.id) || item.listing || {});
      if (lead) lead.textContent = `${paid.length} receipt${paid.length === 1 ? '' : 's'}.`;
      view.innerHTML = `${remove}<div class="person-facts"><p><b>Email</b><br>${esc(person.email)}</p><p><b>Phone</b><br>${esc(person.phone || 'No phone')}</p><p><b>City</b><br>${esc(person.city || 'Not added')}</p><p><b>Address</b><br>${esc(person.address || 'Not provided')}</p></div><h3>Receipts</h3>${paid.map(receiptArticle).join('') || '<div class="empty-state">This student has not sent a receipt yet.</div>'}<h3>Houses rented</h3>${houseShots(homes)}${rented.map(item => `<div class="request-row"><div><b>${esc(item.listing?.title || 'Home')}</b><p>${esc(item.listing?.sector || '')} · Rent ${money(item.listing?.rent)} a month</p></div><span class="status-pill">Rented</span></div>`).join('') || '<div class="empty-state">This student has not rented a house yet.</div>'}`;
      bindDeletes(view);
      bindReceiptActions(view);
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
    const ownsHouse = (adminCache?.listings || []).some(item => item.ownerId === id);
    const text = role === 'landlord' || ownsHouse ? `Delete ${name}? Every house they posted will be deleted too.` : `Delete ${name}?`;
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
  function receiptArticle(item, options = {}) {
    const shot = item.receiptUrl ? `<a class="receipt-shot" href="${esc(item.receiptUrl)}" target="_blank" rel="noopener"><img alt="Payment receipt" src="${esc(item.receiptUrl)}"></a>` : '';
    const label = item.status === 'approved' ? 'Approved' : item.status === 'rejected' ? 'Not accepted' : 'Waiting';
    const place = [item.listing?.sector, options.full ? item.listing?.address : ''].filter(Boolean).join(' · ');
    const buttons = [];
    if (item.status === 'pending') {
      buttons.push(`<button class="pay-now" type="button" data-unlock="${esc(item.id)}" data-status="approved">Approve</button>`);
      buttons.push(`<button class="receipt-reject" type="button" data-unlock="${esc(item.id)}" data-status="rejected">Reject</button>`);
    }
    if (options.view && item.studentId) buttons.push(`<button class="small-button" type="button" data-view-payer="${esc(item.studentId)}">View</button>`);
    const actions = buttons.length ? `<div class="receipt-actions">${buttons.join('')}</div>` : '';
    return `<article class="activity-order${shot ? ' receipt-line' : ''}">${shot}<div><h3>${esc(item.listing?.title || 'Home')} · ${esc(item.student?.name || 'Student')}</h3><p>${esc(place)} · ${label} · Broker fee ${money(item.listing?.brokerFee)} · ${esc(activityWhen(item.created))}</p>${actions}</div></article>`;
  }
  function bindReceiptActions(root) {
    root.querySelectorAll('[data-unlock]').forEach(button => button.addEventListener('click', async () => {
      try {
        await apiCall(`/admin/unlocks/${button.dataset.unlock}`, { method: 'PUT', body: JSON.stringify({ status: button.dataset.status }) });
        adminCache = null;
        await refreshAdmin(document.querySelector('#userSearch')?.value || '');
      } catch (error) { alert(error.message); }
    }));
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
      renderLandlords(filtered.filter(item => item.role === 'landlord'));
      document.querySelectorAll('[data-person]').forEach(button => { button.onclick = () => showPerson(button.dataset.person); });
      bindDeletes(document);
      paintReports();
      if (openPersonId) paintPerson();
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
      if (viewState.target?.kind === 'landlord') paintView();
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

  const viewState = { mode: 'day', day: '', week: '', month: '', from: '', to: '', target: null, payer: null };

  const orderDate = value => {
    if (!value) return null;
    const text = String(value);
    const stamp = /[zZ]|[+-]\d\d:?\d\d$/.test(text) ? text : `${text}Z`;
    const date = new Date(stamp);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const dayKey = date => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const weekKey = date => {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = d.getDay() || 7;
    d.setDate(d.getDate() + 4 - day);
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
  };

  const weekStart = value => {
    const match = /^(\d{4})-W(\d{2})$/.exec(value || '');
    if (!match) return new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - ((new Date().getDay() + 6) % 7));
    const year = Number(match[1]);
    const week = Number(match[2]);
    const jan4 = new Date(year, 0, 4);
    const day = jan4.getDay() || 7;
    const monday = new Date(jan4);
    monday.setDate(jan4.getDate() - day + 1 + (week - 1) * 7);
    monday.setHours(0, 0, 0, 0);
    return monday;
  };

  const viewRange = () => {
    const now = new Date();
    if (!viewState.day) viewState.day = dayKey(now);
    if (!viewState.week) viewState.week = weekKey(now);
    if (!viewState.month) viewState.month = dayKey(now).slice(0, 7);
    if (!viewState.from) viewState.from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    if (!viewState.to) viewState.to = dayKey(now);
    if (viewState.mode === 'week') {
      const start = weekStart(viewState.week);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return { start, end };
    }
    if (viewState.mode === 'month') {
      const match = /^(\d{4})-(\d{2})$/.exec(viewState.month);
      const year = match ? Number(match[1]) : now.getFullYear();
      const month = match ? Number(match[2]) - 1 : now.getMonth();
      return { start: new Date(year, month, 1), end: new Date(year, month + 1, 1) };
    }
    if (viewState.mode === 'range') {
      let start = new Date(`${viewState.from}T00:00:00`);
      let end = new Date(`${viewState.to}T00:00:00`);
      if (start > end) { const swap = start; start = end; end = swap; }
      end.setDate(end.getDate() + 1);
      return { start, end };
    }
    const start = new Date(`${viewState.day}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  };

  const inView = value => {
    const date = orderDate(value);
    if (!date) return false;
    const { start, end } = viewRange();
    return date >= start && date < end;
  };

  const tenPercent = amount => Math.floor((Number(amount || 0) * 10 + 50) / 100);

  const writtenDay = date => date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const periodText = () => {
    const { start, end } = viewRange();
    const last = new Date(end.getTime() - 1);
    if (viewState.mode === 'day') return writtenDay(start);
    if (viewState.mode === 'month') return start.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    return `${writtenDay(start)} – ${writtenDay(last)}`;
  };

  function movePeriod(step) {
    viewRange();
    if (viewState.mode === 'week') {
      const start = weekStart(viewState.week);
      start.setDate(start.getDate() + step * 7);
      viewState.week = weekKey(start);
    } else if (viewState.mode === 'month') {
      const match = /^(\d{4})-(\d{2})$/.exec(viewState.month);
      const date = new Date(match ? Number(match[1]) : new Date().getFullYear(), (match ? Number(match[2]) - 1 : new Date().getMonth()) + step, 1);
      viewState.month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    } else if (viewState.mode === 'range') {
      const from = new Date(`${viewState.from}T00:00:00`);
      const to = new Date(`${viewState.to}T00:00:00`);
      const span = Math.max(1, Math.round((to - from) / 86400000) + 1);
      from.setDate(from.getDate() + step * span);
      to.setDate(to.getDate() + step * span);
      viewState.from = dayKey(from);
      viewState.to = dayKey(to);
    } else {
      const date = new Date(`${viewState.day}T00:00:00`);
      date.setDate(date.getDate() + step);
      viewState.day = dayKey(date);
    }
    paintView();
  }

  const periodControls = () => {
    const modes = [['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['range', 'Any dates']];
    const buttons = modes.map(([mode, label]) => `<button type="button" data-period="${mode}" class="${viewState.mode === mode ? 'on' : ''}">${label}</button>`).join('');
    const move = viewState.mode === 'week'
      ? ['Previous week', 'Next week']
      : viewState.mode === 'month'
        ? ['Previous month', 'Next month']
        : viewState.mode === 'range'
          ? ['Earlier dates', 'Later dates']
          : ['Previous day', 'Next day'];
    const { start } = viewRange();
    const field = viewState.mode === 'week'
      ? `<label>Pick any day in that week<input name="weekDay" type="date" value="${esc(dayKey(start))}"></label>`
      : viewState.mode === 'month'
        ? `<label>Month<input name="month" type="month" value="${esc(viewState.month)}"></label>`
        : viewState.mode === 'range'
          ? `<label>From<input name="from" type="date" value="${esc(viewState.from)}"></label><label>To<input name="to" type="date" value="${esc(viewState.to)}"></label>`
          : `<label>Day<input name="day" type="date" value="${esc(viewState.day)}"></label>`;
    return `<div class="period-switch">${buttons}</div><p class="period-summary">${esc(periodText())}. Only the customers and the money from these dates.</p><div class="period-move"><button type="button" data-shift="-1">${move[0]}</button><button type="button" data-shift="1">${move[1]}</button></div><div class="period-fields">${field}</div>`;
  };

  function renderLandlords(people) {
    const box = document.querySelector('#landlordCards');
    if (!box) return;
    const seen = new Set(people.map(person => person.id));
    const owners = (adminCache?.listings || []).map(home => home.ownerId).filter(Boolean);
    (adminCache?.users || []).forEach(user => {
      if (seen.has(user.id) || !owners.includes(user.id)) return;
      seen.add(user.id);
      people.push(user);
    });
    if (!people.length) { box.innerHTML = '<div class="empty-state">No landlords yet.</div>'; return; }
    const head = `<div class="directory-head"><span>Name</span><span>Location</span><span>Contact</span><span></span></div>`;
    box.innerHTML = `<div class="directory">${head}${people.map(person => {
      const homes = (adminCache?.listings || []).filter(item => item.ownerId === person.id);
      const sectors = [...new Set(homes.map(item => item.sector || item.city).filter(Boolean))];
      const location = person.address || sectors.join(', ') || person.city || 'Greater Noida';
      return `<article class="directory-row"><div><b>${esc(person.name)}</b><p>${esc(person.email || 'No email')}</p></div><div>${esc(location)}</div><div>${esc(person.phone || 'No phone')}</div><div class="person-actions"><button class="small-button person-open" type="button" data-view-landlord="${esc(person.id)}">View</button><button class="small-button danger" type="button" data-delete-user="${esc(person.id)}" data-delete-role="${esc(person.role)}" data-delete-name="${esc(person.name)}">Delete</button></div></article>`;
    }).join('')}</div>`;
    bindDeletes(box);
  }

  async function deletePlace(id, kind, name) {
    const label = kind === 'restaurant' ? 'restaurant' : kind === 'service' ? 'service' : 'shop';
    if (!window.confirm(`Delete ${name}? This ${label} will be removed.`)) return;
    try {
      await apiCall(`/market/admin/businesses/${id}`, { method: 'DELETE' });
      if (viewState.target?.id === id) {
        viewState.target = null;
        const modal = document.querySelector('#placeView');
        if (modal) modal.hidden = true;
      }
      await loadActivity();
    } catch (error) { alert(error.message); }
  }

  function openView(target) {
    viewState.target = target;
    viewState.payer = null;
    const modal = document.querySelector('#placeView');
    if (modal) modal.hidden = false;
    paintView();
  }

  function paintView() {
    const body = document.querySelector('#placeViewBody');
    const target = viewState.target;
    if (!body || !target) return;
    viewRange();
    if (target.kind === 'landlord') paintLandlordView(body, target.id);
    else paintPlaceView(body, target);
  }

  function paintPlaceView(body, target) {
    const copy = Object.values(activityPages).find(item => item.kind === target.kind) || activityPages.restaurants;
    const orders = (activityCache?.orders || []).filter(row => row.businessId === target.id);
    const place = (activityCache?.places || []).find(row => row.id === target.id) || {
      name: orders[0]?.businessName || 'Place',
      area: orders[0]?.businessArea || '',
      address: orders[0]?.businessAddress || '',
      phone: orders[0]?.businessPhone || '',
      whatsapp: orders[0]?.businessWhatsapp || '',
      ownerName: orders[0]?.vendorName || '',
      ownerPhone: orders[0]?.vendorPhone || '',
      ownerEmail: orders[0]?.vendorEmail || '',
      category: '',
    };
    const rows = orders.filter(order => order.status !== 'cancelled' && inView(order.created));
    const people = new Set(rows.map(order => order.customerId || order.customerEmail || order.customerName || order.id));
    const paid = rows.reduce((sum, order) => sum + Number(order.finalAmount || 0), 0);
    const where = [place.area, place.address].filter(Boolean).join(' · ') || 'Greater Noida';
    const list = rows.map(order => `<article class="activity-order"><h3>${esc(order.itemName)} · ${esc(order.reference || '')}</h3><p>${esc(activityWhen(order.created))}${order.quantity > 1 ? ` · ${esc(order.quantity)}` : ''}</p><p>Customer: ${reachLine(order.customerName, order.customerPhone, order.customerEmail)}</p><p>${order.finalAmount == null ? 'Money not received yet' : `Received ${money(order.finalAmount)}`} · ${esc(order.customerConfirm === 'completed' ? 'Customer confirmed' : order.customerConfirm === 'not_completed' ? 'Customer did not receive it' : order.customerConfirm === 'disputed' ? 'Customer sent a note' : 'Customer has not confirmed')}</p>${order.customerNote ? `<p>Note: ${esc(order.customerNote)}</p>` : ''}</article>`).join('') || '<div class="empty-state">No customers in these dates.</div>';
    body.innerHTML = `<div class="place-modal-head"><div><span class="eyebrow">${esc(copy.place.toUpperCase())}</span><h2 id="placeViewTitle">${esc(place.name || 'Place')}</h2><p>${esc(where)}</p><p>Contact ${esc(place.phone || place.ownerPhone || 'No phone')}${place.whatsapp ? ` · WhatsApp ${esc(place.whatsapp)}` : ''}</p><p>${esc(copy.owner)}: ${reachLine(place.ownerName, place.ownerPhone, place.ownerEmail)}</p></div><button class="outline-button" type="button" data-close-view>Close</button></div>${periodControls()}<div class="stat-row"><div class="stat-card"><span class="stat-icon">👤</span><div><strong>${people.size}</strong><small>Customers</small></div></div><div class="stat-card"><span class="stat-icon">▣</span><div><strong>${rows.length}</strong><small>Times</small></div></div><div class="stat-card"><span class="stat-icon">₹</span><div><strong>${money(paid)}</strong><small>Money received</small></div></div><div class="stat-card"><span class="stat-icon">%</span><div><strong>${money(tenPercent(paid))}</strong><small>10% commission</small></div></div></div>${list}`;
  }

  function paintPayerView(body, studentId) {
    const user = (adminCache?.users || []).find(item => item.id === studentId);
    const unlocks = (adminCache?.unlocks || []).filter(item => item.studentId === studentId || (user && (item.student?.email || '').toLowerCase() === (user.email || '').toLowerCase()));
    const name = user?.name || unlocks[0]?.student?.name || 'Student';
    const phone = user?.phone || unlocks[0]?.student?.phone || 'No phone';
    const email = user?.email || unlocks[0]?.student?.email || 'No email';
    const rented = unlocks.filter(item => item.status === 'approved');
    const head = `<div class="place-modal-head"><div><span class="eyebrow">WHO PAID</span><h2>${esc(name)}</h2><p>${esc(phone)} · ${esc(email)}</p></div><div class="person-actions"><button class="outline-button" type="button" data-back-payer>Back</button><button class="outline-button" type="button" data-close-view>Close</button></div></div>`;
    if (!activityCache) {
      body.innerHTML = `${head}<p class="market-note">Loading houses, restaurants, shops, and services…</p>`;
      apiCall('/market/admin/orders').then(data => {
        activityCache = data;
        paintActivity();
        if (viewState.payer === studentId) paintView();
      }).catch(error => {
        if (viewState.payer === studentId) body.insertAdjacentHTML('beforeend', `<p class="market-note">${esc(error.message)}</p>`);
      });
      return;
    }
    const mail = String(email || '').toLowerCase();
    const orders = (activityCache.orders || []).filter(order => order.customerId === studentId || (mail && mail !== 'no email' && String(order.customerEmail || '').toLowerCase() === mail));
    const confirmText = order => order.customerConfirm === 'completed' ? 'Customer confirmed' : order.customerConfirm === 'not_completed' ? 'Customer did not receive it' : order.customerConfirm === 'disputed' ? 'Customer sent a note' : 'Customer has not confirmed';
    const ordersFor = (kind, label, empty) => {
      const rows = orders.filter(order => order.kind === kind);
      const html = rows.map(order => `<article class="activity-order"><h3>${esc(label)} · ${esc(order.itemName || 'Item')}</h3><p>${esc(order.businessName || '')} · ${esc(activityWhen(order.created))}</p><p>${order.finalAmount == null ? 'Money not entered yet' : `Received ${money(order.finalAmount)}`} · ${esc(order.status || '')} · ${esc(confirmText(order))}</p>${order.customerNote ? `<p>Note: ${esc(order.customerNote)}</p>` : ''}</article>`).join('') || `<div class="empty-state">${empty}</div>`;
      return `<h3>${label}</h3>${html}`;
    };
    const homes = rented.map(item => `<div class="request-row"><div><b>${esc(item.listing?.title || 'Home')}</b><p>${esc([item.listing?.sector, item.listing?.address].filter(Boolean).join(' · '))} · Rent ${money(item.listing?.rent)} a month · Broker fee ${money(item.listing?.brokerFee)}</p></div><span class="status-pill">Rented</span></div>`).join('') || '<div class="empty-state">This person has not rented a house.</div>';
    body.innerHTML = `${head}<h3>Houses rented</h3>${homes}<h3>Deposits</h3>${unlocks.map(item => receiptArticle(item, { full: true })).join('') || '<div class="empty-state">No broker fee yet.</div>'}${ordersFor('restaurant', 'Restaurant', 'No restaurant orders.')}${ordersFor('shop', 'Shop', 'No shop purchases.')}${ordersFor('service', 'Service', 'No service requests.')}`;
    bindReceiptActions(body);
  }

  function paintLandlordView(body, id) {
    if (viewState.payer) {
      paintPayerView(body, viewState.payer);
      return;
    }
    const person = (adminCache?.users || []).find(item => item.id === id);
    if (!person) { body.innerHTML = '<div class="empty-state">That landlord is not on the list.</div>'; return; }
    const homes = (adminCache?.listings || []).filter(item => item.ownerId === person.id);
    const unlocks = (adminCache?.unlocks || []).filter(item => (item.ownerId === person.id || homes.some(home => home.id === item.listing?.id)) && inView(item.created));
    const approved = unlocks.filter(item => item.status === 'approved');
    const people = new Set(approved.map(item => item.studentId || item.student?.email || item.id));
    const paid = approved.reduce((sum, item) => sum + Number(item.listing?.brokerFee || 0), 0);
    const sectors = [...new Set(homes.map(item => item.sector || item.city).filter(Boolean))].join(', ');
    const list = unlocks.map(item => receiptArticle(item, { view: true })).join('') || '<div class="empty-state">No students paid in these dates.</div>';
    const houses = homes.map(item => `<p>${esc(item.title)} · ${esc(item.sector || item.city || '')} · ${money(item.rent)} / month${item.taken ? ' · Taken' : ''}</p>`).join('') || '<p>No houses posted.</p>';
    body.innerHTML = `<div class="place-modal-head"><div><span class="eyebrow">LANDLORD</span><h2 id="placeViewTitle">${esc(person.name)}</h2><p>${esc(person.address || person.city || sectors || 'Greater Noida')}</p><p>Contact ${esc(person.phone || 'No phone')} · ${esc(person.email || 'No email')}</p></div><button class="outline-button" type="button" data-close-view>Close</button></div><h3>Houses</h3>${houses}${periodControls()}<div class="stat-row"><div class="stat-card"><span class="stat-icon">👤</span><div><strong>${people.size}</strong><small>Students who paid</small></div></div><div class="stat-card"><span class="stat-icon">▣</span><div><strong>${approved.length}</strong><small>Approved fees</small></div></div><div class="stat-card"><span class="stat-icon">₹</span><div><strong>${money(paid)}</strong><small>Broker fees</small></div></div></div><h3>Receipts</h3>${list}`;
    bindReceiptActions(body);
  }

  function paintActivity() {
    Object.entries(activityPages).forEach(([id, copy]) => {
      const box = document.querySelector(`#${id}Activity`);
      if (!box) return;
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
      const places = [...listed.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)));
      if (!places.length) {
        box.innerHTML = `<div class="empty-state">No ${id === 'shop' ? 'shops' : id} yet.</div>`;
        return;
      }
      const head = `<div class="directory-head"><span>Name</span><span>Location</span><span>Contact</span><span></span></div>`;
      box.innerHTML = `<div class="directory">${head}${places.map(place => {
        const location = [place.area, place.address].filter(Boolean).join(' · ') || 'Greater Noida';
        return `<article class="directory-row"><div><b>${esc(place.name || 'Untitled')}</b><p>${esc(place.category || copy.place)}</p></div><div>${esc(location)}</div><div>${esc(place.phone || place.ownerPhone || 'No phone')}</div><div class="person-actions"><button class="small-button person-open" type="button" data-view-place="${esc(place.id)}" data-view-kind="${esc(copy.kind)}">View</button><button class="small-button danger" type="button" data-delete-place="${esc(place.id)}" data-delete-kind="${esc(copy.kind)}" data-delete-name="${esc(place.name || 'Untitled')}">Delete</button></div></article>`;
      }).join('')}</div>`;
    });
  }

  async function loadActivity() {
    try {
      activityCache = await apiCall('/market/admin/orders');
      paintActivity();
      const placeWindow = document.querySelector('#placeView');
      if (!placeWindow || placeWindow.hidden) paintReports();
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
      document.addEventListener('click', event => {
        const reportMode = event.target.closest('[data-report-mode]');
        if (reportMode) {
          reportState.mode = reportMode.dataset.reportMode;
          paintReports(true);
          return;
        }
        const reportShift = event.target.closest('[data-report-shift]');
        if (reportShift) {
          moveReport(Number(reportShift.dataset.reportShift));
          return;
        }
        const reportSource = event.target.closest('[data-report-source]');
        if (reportSource) {
          reportState.source = reportSource.dataset.reportSource || 'all';
          paintReports(true);
          return;
        }
        const reportPay = event.target.closest('[data-report-pay]');
        if (reportPay) {
          reportState.pay = reportPay.dataset.reportPay || 'all';
          paintReports(true);
          return;
        }
        const reportSign = event.target.closest('[data-report-sign]');
        if (reportSign) {
          signMoney(reportSign.dataset.reportKind, reportSign.dataset.reportId, reportSign.dataset.reportSign).catch(error => alert(error.message));
          return;
        }
        const reportOpen = event.target.closest('[data-report-open]');
        if (reportOpen) {
          openMoney(reportOpen);
          return;
        }
        const remove = event.target.closest('[data-delete-place]');
        if (remove) {
          deletePlace(remove.dataset.deletePlace, remove.dataset.deleteKind, remove.dataset.deleteName);
          return;
        }
        const place = event.target.closest('[data-view-place]');
        if (place) {
          openView({ id: place.dataset.viewPlace, kind: place.dataset.viewKind });
          return;
        }
        const landlord = event.target.closest('[data-view-landlord]');
        if (landlord) {
          openView({ id: landlord.dataset.viewLandlord, kind: 'landlord' });
          return;
        }
        const payer = event.target.closest('[data-view-payer]');
        if (payer) {
          viewState.payer = payer.dataset.viewPayer;
          paintView();
          return;
        }
        if (event.target.closest('[data-back-payer]')) {
          viewState.payer = null;
          paintView();
          return;
        }
        const shift = event.target.closest('[data-shift]');
        if (shift) {
          movePeriod(Number(shift.dataset.shift));
          return;
        }
        const period = event.target.closest('[data-period]');
        if (period) {
          viewState.mode = period.dataset.period;
          paintView();
          return;
        }
        if (event.target.closest('[data-close-view]') || event.target.id === 'placeView') {
          viewState.target = null;
          viewState.payer = null;
          const modal = document.querySelector('#placeView');
          if (modal) modal.hidden = true;
        }
      });
      document.addEventListener('change', event => {
        const name = event.target.name || '';
        if (!name.startsWith('report')) return;
        const value = event.target.value;
        if (!value) return;
        if (name === 'reportDay') reportState.day = value;
        else if (name === 'reportWeek') reportState.week = value;
        else if (name === 'reportMonth') reportState.month = value;
        else if (name === 'reportFrom') reportState.from = value;
        else if (name === 'reportTo') reportState.to = value;
        else return;
        paintReports(true);
      });
      document.querySelector('#placeView')?.addEventListener('change', event => {
        const name = event.target.name;
        const value = event.target.value;
        if (!value) return;
        if (name === 'weekDay') {
          const picked = new Date(`${value}T00:00:00`);
          if (Number.isNaN(picked.getTime())) return;
          viewState.week = weekKey(picked);
        } else if (name === 'day' || name === 'week' || name === 'month' || name === 'from' || name === 'to') {
          viewState[name] = value;
        } else return;
        paintView();
      });
      document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        viewState.target = null;
        viewState.payer = null;
        const modal = document.querySelector('#placeView');
        if (modal) modal.hidden = true;
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
