(() => {
  const API_BASE = 'https://broker-961c.onrender.com/api';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const id = new URLSearchParams(location.search).get('id');
  const target = document.querySelector('#propertyDetails');
  const session = () => {
    try { return JSON.parse(localStorage.getItem('studentstay_user') || 'null'); } catch { return null; }
  };
  const token = () => localStorage.getItem('studentstay_token');

  const render = async item => {
    const user = session();
    const photos = (item.photos || []).filter(Boolean);
    const area = item.sector || item.city || 'Greater Noida';
    const unlocked = item.unlocked === true;
    const fullAddress = unlocked ? [item.address, item.city].filter(Boolean).join(', ') : area;
    const map = unlocked ? `<section class="map-panel"><h2>Exact location</h2><p>${esc(fullAddress)}</p><iframe class="map-frame" title="Map showing ${esc(item.title)}" src="https://maps.google.com/maps?q=${encodeURIComponent(fullAddress)}&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe><div class="map-actions"><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}" target="_blank" rel="noopener">Open directions in Google Maps ↗</a></div></section>` : `<section class="map-panel"><h2>Area</h2><p>${esc(area)}, Greater Noida</p><p class="detail-notice">The street address and map stay hidden until the broker fee is approved.</p></section>`;
    let contact = '';
    if (unlocked) {
      const phone = item.ownerPhone || '';
      const email = item.ownerEmail || '';
      contact = `<section class="contact-card" id="contact"><h2>Contact the landlord</h2><div class="owner-row"><span class="owner-avatar">${esc((item.ownerName || 'L').slice(0, 1).toUpperCase())}</span><div><b>${esc(item.ownerName || 'Landlord')}</b><small>Unlocked for you</small></div></div><p class="detail-location">⌖ ${esc(fullAddress)}</p>${phone ? `<a class="contact-line" href="tel:${esc(phone.replace(/[^+\d]/g, ''))}">☎ &nbsp;${esc(phone)}</a>` : '<p class="contact-line">☎ &nbsp;Phone not added yet</p>'}${email ? `<a class="contact-line" href="mailto:${esc(email)}">✉ &nbsp;${esc(email)}</a>` : ''}</section>`;
    } else if (!user) {
      contact = `<section class="contact-card" id="contact"><h2>Broker fee</h2><p class="detail-notice">Sign in as a student before you pay. After approval you will see the exact address and the landlord’s number.</p><a class="primary-button contact-cta" href="access.html#student">Sign in to continue</a></section>`;
    } else if (user.role !== 'student') {
      contact = `<section class="contact-card" id="contact"><h2>Broker fee</h2><p class="detail-notice">Only a student account can pay to unlock a home.</p></section>`;
    } else if (item.unlockStatus === 'pending') {
      contact = `<section class="contact-card" id="contact"><h2>Receipt received</h2><p class="detail-notice">Your payment is waiting for approval. The address and landlord number will appear here after it is approved.</p><a class="primary-button contact-cta" href="student.html#requests">Check status</a></section>`;
    } else {
      let payment = { amount: 0, qrUrl: '', note: '' };
      try {
        const response = await fetch(`${API_BASE}/payment`);
        if (response.ok) payment = await response.json();
      } catch { /* show the form even if the fee details are slow */ }
      contact = `<section class="contact-card" id="contact"><h2>Pay the broker fee</h2><p class="detail-price">₹${Number(payment.amount || 0).toLocaleString('en-IN')}</p><p class="detail-notice">${esc(payment.note || 'Scan the QR, pay, then upload a photo of the receipt.')}</p>${payment.qrUrl ? `<img alt="Payment QR code" src="${esc(payment.qrUrl)}" style="width:180px;height:180px;object-fit:contain;background:#fff;border-radius:8px">` : '<p class="detail-notice">The payment QR is not set yet. Ask the admin to add it.</p>'}<form id="receiptForm" class="form-grid"><label class="wide">Payment receipt<input name="receipt" type="file" accept="image/*" required></label><button class="primary-button wide">Submit receipt</button></form><p class="detail-notice" id="requestMessage"></p></section>`;
    }
    target.innerHTML = `<div class="detail-layout"><section><div class="detail-gallery"><img class="detail-main-image" id="mainPhoto" src="${esc(photos[0] || 'https://images.unsplash.com/photo-1615874694520-474822394e73?auto=format&fit=crop&w=1000&q=80')}" alt="${esc(item.title)}"><div class="detail-thumbs">${photos.map((photo, index) => `<button class="${index === 0 ? 'active' : ''}" type="button" data-photo-index="${index}" aria-label="Show photo ${index + 1}"><img src="${esc(photo)}" alt=""></button>`).join('')}</div></div>${map}</section><aside><section class="detail-content"><span class="detail-badge">${esc(item.type || 'For Students')}</span><h1>${esc(item.title)}</h1><p class="detail-location">⌖ ${esc(area)}</p><div class="detail-price">₹${Number(item.rent || 0).toLocaleString('en-IN')} <small>/ month</small></div><div class="detail-divider"></div><h2>About this home</h2><p class="detail-description">${esc(item.description || '')}</p>${item.available ? `<p class="detail-notice">Available from ${esc(item.available)}</p>` : ''}</section>${contact}</aside></div>`;
    const mainPhoto = document.querySelector('#mainPhoto');
    document.querySelectorAll('[data-photo-index]').forEach(button => button.addEventListener('click', () => {
      const photo = photos[Number(button.dataset.photoIndex)];
      if (photo && mainPhoto) mainPhoto.src = photo;
    }));
    document.querySelector('#receiptForm')?.addEventListener('submit', async event => {
      event.preventDefault();
      const message = document.querySelector('#requestMessage');
      const file = event.currentTarget.elements.receipt.files[0];
      if (!file) return;
      message.textContent = 'Uploading receipt…';
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
        message.textContent = 'Receipt sent. It will show under Broker fee while you wait for approval.';
      } catch (error) {
        message.textContent = error.message || 'Could not send the receipt.';
      }
    });
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
