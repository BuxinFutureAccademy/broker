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

  const brokerCard = item => {
    const name = item.brokerName || 'StudentStay';
    const phone = item.brokerPhone || '';
    const email = item.brokerEmail || '';
    const area = item.sector || item.city || 'Greater Noida';
    const intro = `Hello, my name is ______. I paid the StudentStay broker fee for ${item.title || 'a room'} in ${area}. I am sending my receipt. Please tell me the next step.`;
    const wa = dial(phone).replace(/^\+/, '');
    const go = (label, value, href, extra) => value
      ? `<a class="broker-go${extra || ''}" href="${esc(href)}"${extra ? ' target="_blank" rel="noopener"' : ''}>${label}<span>${esc(value)}</span></a>`
      : '';
    const actions = [
      go('Call', phone, `tel:${dial(phone)}`),
      go('WhatsApp', phone, `https://wa.me/${wa}?text=${encodeURIComponent(intro)}`, ' wa'),
      go('Email', email, `mailto:${esc(email)}?subject=${encodeURIComponent('Broker fee receipt')}&body=${encodeURIComponent(intro)}`)
    ].filter(Boolean).join('');
    return `<section class="contact-card broker-spot" id="contact"><p class="broker-arrow"><b>→</b> Here is the broker</p><h2>Next step</h2><p class="detail-notice">Call, WhatsApp, or email. Send your receipt. The house location and the landlord’s number stay private.</p><div class="person-block"><div class="owner-row"><span class="owner-avatar broker">${esc(name.slice(0, 1).toUpperCase())}</span><div><b>${esc(name)}</b><small>Your broker</small></div></div><div class="broker-actions">${actions || '<p class="detail-notice">The broker contact is not saved yet. Open the Contact page.</p>'}</div></div></section>`;
  };

  const feeOf = item => {
    const listed = Number(item.brokerFee);
    if (Number.isFinite(listed) && item.brokerFee != null && item.brokerFee !== '') return listed;
    return Math.floor(Number(item.rent || 0) / 2);
  };
  const dealHtml = item => {
    const rent = Number(item.rent || 0);
    const fee = feeOf(item);
    const saved = Math.max(rent - fee, 0);
    return `<div class="deal"><span class="spark s1"></span><span class="spark s2"></span><span class="spark s3"></span><span class="deal-badge">50% OFF</span><div class="deal-prices"><span class="was">${money(rent)}</span><strong>${money(fee)}</strong></div><p class="deal-save">You save ${money(saved)} on the broker fee</p></div>`;
  };
  const payCard = item => `<section class="pay-card" id="contact"><small>BROKER FEE</small><h2>Pay the broker fee</h2>${dealHtml(item)}<p>One QR for every house. After you pay, contact the broker and send your receipt. The house location and the landlord’s number stay private.</p><button class="pay-now" type="button" id="openPay">Pay now</button></section>`;

  const openPay = (item, payment) => {
    document.querySelector('#payModal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'payModal';
    modal.className = 'pay-modal';
    const fee = feeOf(item);
    modal.innerHTML = `<div class="pay-sheet" role="dialog" aria-modal="true" aria-labelledby="payTitle"><button class="pay-close" type="button" aria-label="Close">×</button><small>STEP 1 · SCAN</small><h2 id="payTitle">Scan the QR code</h2><p class="pay-lead">Student offer on this house. Scan the QR and enter ${money(fee)}.</p>${dealHtml(item)}<div class="qr-stage">${payment.qrUrl ? `<div class="qr-frame"><img alt="Payment QR code" src="${esc(payment.qrUrl)}"><span class="qr-scan"></span></div>` : '<p class="pay-missing">The payment QR is not ready yet. Ask the admin to add it.</p>'}</div><div class="pay-step"><small>STEP 2 · UPLOAD</small><h3>Upload the payment receipt</h3><form id="receiptForm"><label class="receipt-drop"><input name="receipt" type="file" accept="image/*" required><span id="receiptLabel">Choose a photo of your receipt</span></label><button class="pay-now" type="submit" ${payment.qrUrl ? '' : 'disabled'}>Submit receipt</button></form><p class="pay-message" id="requestMessage"></p></div></div>`;
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
        message.textContent = 'Receipt sent. Contact the broker and send them this receipt.';
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
    const showHouse = item.unlocked === true && user?.role !== 'student';
    const fullAddress = showHouse ? [item.address, item.city].filter(Boolean).join(', ') : area;
    const paid = user?.role === 'student' && (item.unlockStatus === 'pending' || item.unlockStatus === 'approved');
    const map = showHouse
      ? `<section class="map-panel"><h2>Exact location</h2><p>${esc(fullAddress)}</p><iframe class="map-frame" title="Map showing ${esc(item.title)}" src="https://maps.google.com/maps?q=${encodeURIComponent(fullAddress)}&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe><div class="map-actions"><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}" target="_blank" rel="noopener">Open directions in Google Maps ↗</a></div></section>`
      : `<section class="map-panel"><h2>Area</h2><p>${esc(area)}, Greater Noida</p><p class="detail-notice">The street and the map stay private.</p></section>`;
    let aside = '';
    let payment = null;
    if (paid) aside = brokerCard(item);
    else if (showHouse) aside = `<section class="pay-card" id="contact"><small>THIS HOUSE</small><h2>Posted by the landlord</h2><p>${esc(fullAddress)}</p></section>`;
    else if (!user) aside = `<section class="pay-card" id="contact"><small>BROKER FEE</small><h2>Pay the broker fee</h2>${dealHtml(item)}<p>Sign in as a student, pay the fee, then contact the broker and send your receipt.</p><a class="pay-now" href="access.html#student">Sign in to pay</a></section>`;
    else if (user.role !== 'student') aside = `<section class="pay-card" id="contact"><small>BROKER FEE</small><h2>Students pay this fee</h2><p>After they pay, they contact the broker and send the receipt. The house location stays private.</p></section>`;
    else {
      try {
        const response = await fetch(`${API_BASE}/payment`);
        if (response.ok) payment = await response.json();
      } catch { payment = { amount: 0, qrUrl: '', note: '' }; }
      aside = payCard(item);
    }
    target.innerHTML = `<div class="detail-layout"><section><div class="detail-gallery"><img class="detail-main-image" id="mainPhoto" src="${esc(photos[0] || 'https://images.unsplash.com/photo-1615874694520-474822394e73?auto=format&fit=crop&w=1000&q=80')}" alt="${esc(item.title)}"><div class="detail-thumbs">${photos.map((photo, index) => `<button class="${index === 0 ? 'active' : ''}" type="button" data-photo-index="${index}" aria-label="Show photo ${index + 1}"><img src="${esc(photo)}" alt=""></button>`).join('')}</div></div>${map}</section><aside><section class="detail-content"><span class="detail-badge">${esc(item.type || 'For Students')}</span><h1>${esc(item.title)}</h1><p class="detail-location">⌖ ${esc(showHouse ? fullAddress : area)}</p><div class="detail-price">${money(item.rent)} <small>/ month</small></div><div class="detail-divider"></div><h2>About this home</h2><p class="detail-description">${esc(item.description || '')}</p>${item.available ? `<p class="detail-notice">Available from ${esc(item.available)}</p>` : ''}</section>${aside}</aside></div>`;
    const mainPhoto = document.querySelector('#mainPhoto');
    document.querySelectorAll('[data-photo-index]').forEach(button => button.addEventListener('click', () => {
      const photo = photos[Number(button.dataset.photoIndex)];
      if (photo && mainPhoto) mainPhoto.src = photo;
    }));
    document.querySelector('#openPay')?.addEventListener('click', () => openPay(item, payment || { amount: 0, qrUrl: '', note: '' }));
    if (location.hash === '#contact') document.querySelector('#contact')?.scrollIntoView({ block: 'center' });
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
