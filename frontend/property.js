(() => {
  const API_BASE = 'https://broker-961c.onrender.com/api';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const money = value => `₹${Number(value || 0).toLocaleString('en-IN')}`;
  const id = new URLSearchParams(location.search).get('id');
  const target = document.querySelector('#propertyDetails');
  const session = () => {
    try { return JSON.parse(localStorage.getItem('studentstay_user') || 'null'); } catch { return null; }
  };
  const token = () => localStorage.getItem('studentstay_token');
  const dial = value => String(value || '').replace(/[^+\d]/g, '');

  const contactLine = (label, value, href) => value
    ? `<a class="contact-line" href="${esc(href)}">${label} &nbsp;${esc(value)}</a>`
    : '';

  const people = item => {
    const address = [item.address, item.city].filter(Boolean).join(', ');
    return `<section class="contact-card" id="contact"><h2>People who can help</h2><p class="detail-notice">Your broker fee is approved. Call either person about this house.</p><div class="person-block"><div class="owner-row"><span class="owner-avatar broker">${esc((item.brokerName || 'A').slice(0, 1).toUpperCase())}</span><div><b>${esc(item.brokerName || 'StudentStay')}</b><small>Your broker</small></div></div>${contactLine('☎', item.brokerPhone, `tel:${dial(item.brokerPhone)}`)}${contactLine('✉', item.brokerEmail, `mailto:${item.brokerEmail}`)}</div><div class="person-block"><div class="owner-row"><span class="owner-avatar">${esc((item.ownerName || 'L').slice(0, 1).toUpperCase())}</span><div><b>${esc(item.ownerName || 'Landlord')}</b><small>Landlord</small></div></div><p class="detail-location">⌖ ${esc(address)}</p>${contactLine('☎', item.ownerPhone, `tel:${dial(item.ownerPhone)}`)}${contactLine('✉', item.ownerEmail, `mailto:${item.ownerEmail}`)}</div></section>`;
  };

  const waitingCard = () => `<section class="fee-card waiting" id="contact"><span class="fee-orb"></span><div><small>BROKER FEE</small><h2>Waiting for admin approval</h2><p>Your receipt is in. The address, map, and phone numbers open after it is approved.</p><a href="student.html#requests">See your payment</a></div></section>`;

  const payCard = amount => `<section class="pay-card" id="contact"><small>BROKER FEE</small><h2>Pay the broker fee</h2><p class="pay-amount">${money(amount)}</p><p>Pay once for this house. After approval you get the exact address, the map, and both phone numbers.</p><button class="pay-now" type="button" id="openPay">Pay now</button></section>`;

  const openPay = (item, payment) => {
    document.querySelector('#payModal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'payModal';
    modal.className = 'pay-modal';
    modal.innerHTML = `<div class="pay-sheet" role="dialog" aria-modal="true" aria-labelledby="payTitle"><button class="pay-close" type="button" aria-label="Close">×</button><small>STEP 1 · SCAN</small><h2 id="payTitle">Scan the QR code</h2><p class="pay-lead">${esc(payment.note || 'Open any UPI app, scan, and pay the broker fee.')}</p><div class="qr-stage">${payment.qrUrl ? `<div class="qr-frame"><img alt="Payment QR code" src="${esc(payment.qrUrl)}"><span class="qr-scan"></span></div>` : '<p class="pay-missing">The payment QR is not ready yet. Ask the admin to add it.</p>'}<b>${money(payment.amount)}</b></div><div class="pay-step"><small>STEP 2 · UPLOAD</small><h3>Upload the payment receipt</h3><form id="receiptForm"><label class="receipt-drop"><input name="receipt" type="file" accept="image/*" required><span id="receiptLabel">Choose a photo of your receipt</span></label><button class="pay-now" type="submit" ${payment.qrUrl ? '' : 'disabled'}>Submit receipt</button></form><p class="pay-message" id="requestMessage"></p></div></div>`;
    document.body.appendChild(modal);
    document.body.classList.add('pay-open');
    const close = () => { modal.remove(); document.body.classList.remove('pay-open'); };
    modal.querySelector('.pay-close').addEventListener('click', close);
    modal.addEventListener('click', event => { if (event.target === modal) close(); });
    document.addEventListener('keydown', function onKey(event) {
      if (event.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
    });
    const input = modal.querySelector('input[name="receipt"]');
    input?.addEventListener('change', () => {
      modal.querySelector('#receiptLabel').textContent = input.files[0]?.name || 'Choose a photo of your receipt';
    });
    modal.querySelector('#receiptForm').addEventListener('submit', async event => {
      event.preventDefault();
      const message = modal.querySelector('#requestMessage');
      const file = input.files[0];
      const button = event.currentTarget.querySelector('button');
      if (!file) return;
      button.disabled = true;
      message.textContent = 'Sending your receipt…';
      try {
        const body = new FormData();
        body.append('file', file);
        const uploaded = await fetch(`${API_BASE}/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body });
        const uploadPayload = await uploaded.json();
        if (!uploaded.ok) throw new Error(uploadPayload.error || 'Could not upload the receipt.');
        const saved = await fetch(`${API_BASE}/unlocks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
          body: JSON.stringify({ listing_id: item.id, receipt_url: uploadPayload.url })
        });
        const savedPayload = await saved.json();
        if (!saved.ok) throw new Error(savedPayload.error || 'Could not send the receipt.');
        message.textContent = 'Receipt sent. Waiting for admin approval.';
        location.href = 'student.html#requests';
      } catch (error) {
        button.disabled = false;
        message.textContent = error.message || 'Could not send the receipt.';
      }
    });
  };

  const render = async item => {
    const user = session();
    const photos = (item.photos || []).filter(Boolean);
    const area = item.sector || item.city || 'Greater Noida';
    const unlocked = item.unlocked === true;
    const fullAddress = unlocked ? [item.address, item.city].filter(Boolean).join(', ') : area;
    const map = unlocked
      ? `<section class="map-panel"><h2>Exact location</h2><p>${esc(fullAddress)}</p><iframe class="map-frame" title="Map showing ${esc(item.title)}" src="https://maps.google.com/maps?q=${encodeURIComponent(fullAddress)}&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe><div class="map-actions"><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}" target="_blank" rel="noopener">Open directions in Google Maps ↗</a></div></section>`
      : `<section class="map-panel"><h2>Area</h2><p>${esc(area)}, Greater Noida</p><p class="detail-notice">The street and map stay hidden until the broker fee is approved.</p></section>`;
    let aside = '';
    let payment = null;
    if (unlocked) aside = people(item);
    else if (!user) aside = `<section class="pay-card" id="contact"><small>BROKER FEE</small><h2>Pay the broker fee</h2><p>Sign in as a student first. Then you can scan the QR and upload your receipt.</p><a class="pay-now" href="access.html#student">Sign in to pay</a></section>`;
    else if (user.role !== 'student') aside = `<section class="pay-card" id="contact"><small>BROKER FEE</small><h2>Students pay this fee</h2><p>A student account is what unlocks the address and the phone numbers.</p></section>`;
    else if (item.unlockStatus === 'pending') aside = waitingCard();
    else {
      try {
        const response = await fetch(`${API_BASE}/payment`);
        if (response.ok) payment = await response.json();
      } catch { payment = { amount: 0, qrUrl: '', note: '' }; }
      aside = payCard(payment?.amount);
    }
    target.innerHTML = `<div class="detail-layout"><section><div class="detail-gallery"><img class="detail-main-image" id="mainPhoto" src="${esc(photos[0] || 'https://images.unsplash.com/photo-1615874694520-474822394e73?auto=format&fit=crop&w=1000&q=80')}" alt="${esc(item.title)}"><div class="detail-thumbs">${photos.map((photo, index) => `<button class="${index === 0 ? 'active' : ''}" type="button" data-photo-index="${index}" aria-label="Show photo ${index + 1}"><img src="${esc(photo)}" alt=""></button>`).join('')}</div></div>${map}</section><aside><section class="detail-content"><span class="detail-badge">${esc(item.type || 'For Students')}</span><h1>${esc(item.title)}</h1><p class="detail-location">⌖ ${esc(unlocked ? fullAddress : area)}</p><div class="detail-price">${money(item.rent)} <small>/ month</small></div><div class="detail-divider"></div><h2>About this home</h2><p class="detail-description">${esc(item.description || '')}</p>${item.available ? `<p class="detail-notice">Available from ${esc(item.available)}</p>` : ''}</section>${aside}</aside></div>`;
    const mainPhoto = document.querySelector('#mainPhoto');
    document.querySelectorAll('[data-photo-index]').forEach(button => button.addEventListener('click', () => {
      const photo = photos[Number(button.dataset.photoIndex)];
      if (photo && mainPhoto) mainPhoto.src = photo;
    }));
    document.querySelector('#openPay')?.addEventListener('click', () => openPay(item, payment || { amount: 0, qrUrl: '', note: '' }));
  };

  const load = async () => {
    const headers = {};
    if (token()) headers.Authorization = `Bearer ${token()}`;
    const response = await fetch(`${API_BASE}/listings`, { headers });
    if (!response.ok) return null;
    const listings = await response.json();
    return listings.find(listing => listing.id === id) || null;
  };

  load().then(item => {
    if (!item) {
      target.innerHTML = '<section class="not-found"><h1>We couldn’t find that home</h1><p>The listing may have been removed or the link is incorrect.</p><a href="properties.html">Browse available homes</a></section>';
      return;
    }
    render(item);
  }).catch(() => {
    target.innerHTML = '<section class="not-found"><h1>The homes are waking up</h1><p>Wait a few seconds and refresh this page.</p></section>';
  });
})();
