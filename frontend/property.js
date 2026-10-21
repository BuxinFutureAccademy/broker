(() => {
  const parse = (key, fallback = []) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const samples = window.STUDENTSTAY_SAMPLES || [];
  const id = new URLSearchParams(location.search).get('id');
  const item = parse('studentstay.listings').find(listing => listing.id === id) || samples.find(listing => listing.id === id);
  const target = document.querySelector('#propertyDetails');
  if (!item) { target.innerHTML = '<section class="not-found"><h1>We couldn’t find that home</h1><p>The listing may have been removed or the link is incorrect.</p><a href="properties.html">Browse available homes</a></section>'; return; }
  const profiles = parse('studentstay.profiles', {});
  const users = parse('studentstay.users');
  const owner = users.find(person => person.id === item.ownerId) || {};
  const profile = profiles[item.ownerId] || {};
  const ownerName = profile.name || item.ownerName || owner.name || 'StudentStay host';
  const email = profile.email || owner.email || item.ownerEmail || '';
  const phone = profile.phone || owner.phone || item.ownerPhone || '';
  const propertyAddress = item.address || '';
  const fullAddress = [propertyAddress, profile.address, item.city || profile.city].filter((part, index, all) => part && all.indexOf(part) === index).join(', ');
  const photos = (item.photos || []).filter(Boolean);
  const addressQuery = encodeURIComponent(fullAddress || item.city || 'India');
  const mapEmbed = `https://maps.google.com/maps?q=${addressQuery}&output=embed`;
  const mapLink = `https://www.google.com/maps/search/?api=1&query=${addressQuery}`;
  target.innerHTML = `<div class="detail-layout"><section><div class="detail-gallery"><img class="detail-main-image" id="mainPhoto" src="${esc(photos[0] || 'https://images.unsplash.com/photo-1615874694520-474822394e73?auto=format&fit=crop&w=1000&q=80')}" alt="${esc(item.title)}"><div class="detail-thumbs">${photos.map((photo, index) => `<button class="${index === 0 ? 'active' : ''}" type="button" data-photo-index="${index}" aria-label="Show photo ${index + 1}"><img src="${esc(photo)}" alt="${esc(item.title)} photo ${index + 1}"></button>`).join('')}</div></div><section class="map-panel"><h2>Location</h2><p>${esc(fullAddress || item.city || 'Location supplied by the landlord')}</p><iframe class="map-frame" title="Map showing ${esc(item.title)} location" src="${mapEmbed}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe><div class="map-actions"><a href="${mapLink}" target="_blank" rel="noopener">Open directions in Google Maps ↗</a></div><p class="detail-notice">Map position is based on the address provided by the landlord. Confirm the exact location with the landlord before visiting.</p></section></section><aside><section class="detail-content"><span class="detail-badge">${esc(item.badge || item.type || 'For Students')}</span><h1>${esc(item.title)}</h1><p class="detail-location">⌖ ${esc(fullAddress || item.city || 'India')}</p><div class="detail-price">₹${Number(item.rent || 0).toLocaleString('en-IN')} <small>/ month</small></div><div class="detail-divider"></div><h2>About this home</h2><p class="detail-description">${esc(item.description || 'A student-friendly home. Contact the landlord to learn more about the property and availability.')}</p><div class="detail-features">${(item.amenities || []).map(feature => `<span>${esc(feature)}</span>`).join('')}${item.available ? `<span>Available from ${esc(item.available)}</span>` : ''}</div><div class="detail-divider"></div><h2>Property details</h2><p class="detail-description">${esc(item.type || 'Student accommodation')} · ${esc(item.city || profile.city || 'India')}</p><p class="detail-notice">Please contact the landlord to confirm availability, included amenities, and house rules.</p></section><section class="contact-card"><h2>Contact the landlord</h2><div class="owner-row"><span class="owner-avatar">${esc(ownerName.slice(0,1).toUpperCase())}</span><div><b>${esc(ownerName)}</b><small>${owner.id ? 'StudentStay landlord' : 'StudentStay host'}</small></div></div>${phone ? `<a class="contact-line" href="tel:${esc(phone.replace(/[^+\d]/g, ''))}">☎ &nbsp;${esc(phone)}</a>` : '<p class="contact-line">☎ &nbsp;Phone number not provided</p>'}${email ? `<a class="contact-line" href="mailto:${esc(email)}">✉ &nbsp;${esc(email)}</a>` : ''}<button class="primary-button contact-cta" id="requestRoom">Request this room</button><p class="detail-notice" id="requestMessage">Your request will be shared with this landlord.</p></section></aside></div>`;
  const mainPhoto = document.querySelector('#mainPhoto');
  document.querySelectorAll('[data-photo-index]').forEach(button => button.addEventListener('click', () => { const photo = photos[Number(button.dataset.photoIndex)]; if (photo) mainPhoto.src = photo; document.querySelectorAll('[data-photo-index]').forEach(itemButton => itemButton.classList.toggle('active', itemButton === button)); }));
  document.querySelector('#requestRoom').addEventListener('click', () => {
    const session = parse('studentstay.session', null);
    if (!session || session.role !== 'student') { localStorage.setItem('studentstay.pendingListing', item.id); location.href = 'access.html#student'; return; }
    const requests = parse('studentstay.requests');
    if (requests.some(request => request.listingId === item.id && request.studentId === session.id)) { document.querySelector('#requestMessage').textContent = 'You have already requested this room.'; return; }
    requests.push({ id: crypto.randomUUID(), listingId: item.id, studentId: session.id, created: new Date().toISOString(), status: 'New request' });
    localStorage.setItem('studentstay.requests', JSON.stringify(requests));
    document.querySelector('#requestMessage').textContent = 'Request sent. The landlord will see your contact details in their student requests.';
  });
})();
