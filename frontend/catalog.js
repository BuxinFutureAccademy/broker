(() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const sectors = window.GREATER_NOIDA_SECTORS || [];
  const cityGrid = document.querySelector('#allCities');
  const paintCities = source => {
    if (!cityGrid) return;
    cityGrid.innerHTML = sectors.map(name => {
      const liveCount = source.filter(item => (item.sector || '').toLowerCase() === name.toLowerCase()).length;
      return `<a class="city-card sector-card" href="properties.html?city=${encodeURIComponent(name)}"><span class="sector-mark">${esc(name.split(' ')[0])}</span><b>${esc(name)}</b><small>${liveCount ? `${liveCount} home${liveCount === 1 ? '' : 's'}` : 'No homes yet'}</small></a>`;
    }).join('');
  };
  cityGrid?.addEventListener('wheel', event => {
    if (cityGrid.scrollWidth <= cityGrid.clientWidth) return;
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    event.preventDefault();
    cityGrid.scrollLeft += event.deltaY;
  }, { passive: false });
  paintCities([]);

  let cards = [];
  const grid = document.querySelector('#allProperties');
  const cityParam = new URLSearchParams(location.search).get('city') || '';
  const search = document.querySelector('#propertyQuery');
  if (search && cityParam) search.value = cityParam;
  const display = (query = '') => {
    const q = query.trim().toLowerCase();
    const filtered = cards.filter(item => !q || `${item.title} ${item.type} ${item.sector || ''} ${item.description}`.toLowerCase().includes(q));
    if (document.querySelector('#resultsHeading')) document.querySelector('#resultsHeading').textContent = q ? `Homes in ${query}` : 'Homes in Greater Noida';
    if (!grid) return;
    if (!filtered.length) { grid.innerHTML = '<div class="catalog-empty">No homes in that sector yet. A landlord can post the first room.</div>'; return; }
    grid.innerHTML = filtered.map(item => `<article class="property-card detail-link" data-property-id="${esc(item.id)}" tabindex="0" role="link" aria-label="View ${esc(item.title)}"><div class="photo"><img src="${esc(item.photos?.[0] || 'https://images.unsplash.com/photo-1615874694520-474822394e73?auto=format&fit=crop&w=700&q=80')}" alt="${esc(item.title)}"><span class="tag blue">${esc(item.type || 'For Students')}</span><button class="heart" aria-label="Save property">♥</button></div><div class="property-info"><h3>${esc(item.title)}</h3><p>⌖ ${esc(item.sector || 'Greater Noida')}</p><div class="price">₹${Number(item.rent).toLocaleString('en-IN')} <small>/ month</small></div><p>${esc(item.description)}</p></div></article>`).join('');
    grid.querySelectorAll('.detail-link').forEach(tile => { const open = () => { if (tile.dataset.propertyId) location.href = `property.html?id=${encodeURIComponent(tile.dataset.propertyId)}`; }; tile.addEventListener('click', event => { if (!event.target.closest('.heart')) open(); }); tile.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } }); });
    grid.querySelectorAll('.heart').forEach(button => button.addEventListener('click', () => button.classList.toggle('saved')));
  };
  fetch('https://broker-961c.onrender.com/api/listings').then(response => response.ok ? response.json() : []).then(items => {
    cards = Array.isArray(items) ? items : [];
    paintCities(cards);
    if (grid) display(search?.value || cityParam);
  }).catch(() => { if (grid) display(search?.value || cityParam); });
  document.querySelector('#catalogSearch')?.addEventListener('submit', event => { event.preventDefault(); const query = search.value.trim(); history.replaceState(null, '', query ? `?city=${encodeURIComponent(query)}` : location.pathname); display(query); });
})();
