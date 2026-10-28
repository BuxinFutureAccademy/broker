(() => {
  const API_BASE = 'https://broker-961c.onrender.com/api';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const id = new URLSearchParams(location.search).get('id');
  const target = document.querySelector('#propertyDetails');
  const session = () => {
    try { return JSON.parse(localStorage.getItem('studentstay_user') || 'null'); } catch { return null; }
  };

  const render = item => {
    const user = session();
    const photos = (item.photos || []).filter(Boolean);
    const ownerName = item.ownerName || 'StudentStay host';
    const email = item.ownerEmail || '';
    const phone = item.ownerPhone || '';
    const fullAddress = [item.address, item.city].filter((part, index, all) => part && all.indexOf(part) === index).join(', ');
    const addressQuery = encodeURIComponent(fullAddress || item.city || 'India');
    const mapEmbed = `https://maps.google.com/maps?q=${addressQuery}&output=embed`;
    const mapLink = `https://www.google.com/maps/search/?api=1&query=${addressQuery}`;
    target.innerHTML = `<div class="detail-layout"><section><div class="detail-gallery"><img class="detail-main-image" id="mainPhoto" src="${esc(photos[0] || 'https://images.unsplash.com/photo-1615874694520-474822394e73?auto=format&fit=crop&w=1000&q=80')}" alt="${esc(item.title)}"><div class="detail-thumbs">${photos.map((photo, index) => `<button class="${index === 0 ? 'active' : ''}" type="button" data-photo-index="${index}" aria-label="Show photo ${index + 1}"><img src="${esc(photo)}" alt="${esc(item.title)} photo ${index + 1}"></button>`).join('')}</div></div><section class="map-panel"><h2>Location</h2><p>${esc(fullAddress || item.city || 'Location supplied by the landlord')}</p><iframe class="map-frame" title="Map showing ${esc(item.title)} location" src="${mapEmbed}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe><div class="map-actions"><a href="${mapLink}" target="_blank" rel="noopener">Open directions in Google Maps ↗</a></div><p class="detail-notice">Map position is based on the address provided by the landlord. Confirm the exact location with the landlord before visiting.</p></section></section><aside><section class="detail-content"><span class="detail-badge">${esc(item.badge || item.type || 'For Students')}</span><h1>${esc(item.title)}</h1><p class="detail-location">⌖ ${esc(fullAddress || item.city || 'India')}</p><div class="detail-price">₹${Number(item.rent || 0).toLocaleString('en-IN')} <small>/ month</small></div><div class="detail-divider"></div><h2>About this home</h2><p class="detail-description">${esc(item.description || 'A student-friendly home. Contact the landlord to learn more about the property and availability.')}</p><div class="detail-features">${(item.amenities || []).map(feature => `<span>${esc(feature)}</span>`).join('')}${item.available ? `<span>Available from ${esc(item.available)}</span>` : ''}</div><div class="detail-divider"></div><h2>Property details</h2><p class="detail-description">${esc(item.type || 'Student accommodation')} · ${esc(item.city || 'India')}</p></section><section class="contact-card" id="contact"><h2>Contact the landlord</h2><div class="owner-row"><span class="owner-avatar">${esc(ownerName.slice(0, 1).toUpperCase())}</span><div><b>${esc(ownerName)}</b><small>${user ? 'Signed in as ' + user.name : 'Sign in to send a request'}</small></div></div>${phone ? `<a class="contact-line" href="tel:${esc(phone.replace(/[^+\d]/g, ''))}">☎ &nbsp;${esc(phone)}</a>` : '<p class="contact-line">☎ &nbsp;Phone appears after the landlord adds one</p>'}${email ? `<a class="contact-line" href="mailto:${esc(email)}">✉ &nbsp;${esc(email)}</a>` : ''}<button class="primary-button contact-cta" id="requestRoom">Request this room</button><p class="detail-notice" id="requestMessage">${user && user.role === 'student' ? 'Your request is saved to My Requests.' : 'Sign in as a student to send this request to your dashboard.'}</p></section></aside></div>`;
    const mainPhoto = document.querySelector('#mainPhoto');
    document.querySelectorAll('[data-photo-index]').forEach(button => button.addEventListener('click', () => {
      const photo = photos[Number(button.dataset.photoIndex)];
      if (photo) mainPhoto.src = photo;
      document.querySelectorAll('[data-photo-index]').forEach(itemButton => itemButton.classList.toggle('active', itemButton === button));
    }));
    document.querySelector('#requestRoom').addEventListener('click', async () => {
      const message = document.querySelector('#requestMessage');
      const current = session();
      const token = localStorage.getItem('studentstay_token');
      if (!current || current.role !== 'student' || !token) {
        localStorage.setItem('studentstay.pendingListing', item.id);
        location.href = 'access.html#student';
        return;
      }
      if (String(item.id).startsWith('sample-')) {
        message.textContent = 'This sample home is not bookable. Open a live listing from the properties page.';
        return;
      }
      try {
        const response = await fetch(`${API_BASE}/requests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ listing_id: item.id })
        });
        const text = await response.text();
        let payload = {};
        try { payload = JSON.parse(text); } catch { payload = {}; }
        if (!response.ok && response.status !== 400) throw new Error(payload.error || 'The request could not be sent.');
        if (response.status === 400 && payload.error && !/already exists/i.test(payload.error)) throw new Error(payload.error);
        message.textContent = 'Request saved. Open your dashboard to see it under My Requests.';
        document.querySelector('#requestRoom').insertAdjacentHTML('afterend', '<a class="primary-button contact-cta" href="student.html#requests">View my requests</a>');
        document.querySelector('#requestRoom').remove();
      } catch (error) {
        message.textContent = error.message || 'The request could not be sent.';
      }
    });
  };

  const load = async () => {
    const samples = window.STUDENTSTAY_SAMPLES || [];
    try {
      const response = await fetch(`${API_BASE}/listings`);
      if (response.ok) {
        const listings = await response.json();
        const found = listings.find(listing => listing.id === id);
        if (found) return found;
      }
    } catch { /* show a sample if the server is waking up */ }
    return samples.find(listing => listing.id === id);
  };

  load().then(item => {
    if (!item) {
      target.innerHTML = '<section class="not-found"><h1>We couldn’t find that home</h1><p>The listing may have been removed or the link is incorrect.</p><a href="properties.html">Browse available homes</a></section>';
      return;
    }
    render(item);
  });
})();
