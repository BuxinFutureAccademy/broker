(() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const saved = (() => { try { return JSON.parse(localStorage.getItem('studentstay.listings')) || []; } catch { return []; } })();
  const cities = [
    {name:'Delhi',count:'1,200+',image:'photo-1587474260584-136574528ed5',alt:'India Gate in Delhi'},
    {name:'Noida',count:'800+',image:'photo-1486406146926-c627a92ad1ab',alt:'Modern business district'},
    {name:'Bangalore',count:'950+',image:'photo-1596176530529-78163a4f7af2',alt:'Bangalore skyline'},
    {name:'Mumbai',count:'1,100+',image:'photo-1570168007204-dfb528c6958f',alt:'Gateway of India in Mumbai'},
    {name:'Hyderabad',count:'700+',image:'photo-1567157577867-05ccb1388e66',alt:'Historic Indian architecture'}
  ];
  const cityGrid = document.querySelector('#allCities');
  if (cityGrid) cityGrid.innerHTML = cities.map(city => {
    const liveCount = saved.filter(item => `${item.city || ''} ${item.address || ''}`.toLowerCase().includes(city.name.toLowerCase())).length;
    return `<a class="city-card" href="properties.html?city=${encodeURIComponent(city.name)}"><img src="https://images.unsplash.com/${city.image}?auto=format&fit=crop&w=800&q=85" alt="${esc(city.alt)}"><b>${esc(city.name)}</b><small>${liveCount ? `${liveCount} student ${liveCount === 1 ? 'stay' : 'stays'} listed` : `${city.count} properties`}</small></a>`;
  }).join('');

  const featured = window.STUDENTSTAY_SAMPLES || [];
  const cards = [...saved, ...featured];
  const grid = document.querySelector('#allProperties');
  const cityParam = new URLSearchParams(location.search).get('city') || '';
  const search = document.querySelector('#propertyQuery');
  if (search && cityParam) search.value = cityParam;
  const display = (query = '') => {
    const q = query.trim().toLowerCase();
    const filtered = cards.filter(item => !q || `${item.title} ${item.type} ${item.address} ${item.city} ${item.description}`.toLowerCase().includes(q));
    if (document.querySelector('#resultsHeading')) document.querySelector('#resultsHeading').textContent = q ? `Homes in ${query}` : 'Available student homes';
    if (!grid) return;
    if (!filtered.length) { grid.innerHTML = '<div class="catalog-empty">No homes match that search yet. Try a nearby city or another property type.</div>'; return; }
    grid.innerHTML = filtered.map(item => `<article class="property-card detail-link" data-property-id="${esc(item.id)}" tabindex="0" role="link" aria-label="View ${esc(item.title)}"><div class="photo"><img src="${esc(item.photos?.[0] || 'https://images.unsplash.com/photo-1615874694520-474822394e73?auto=format&fit=crop&w=700&q=80')}" alt="${esc(item.title)}"><span class="tag ${item.badge === 'Popular' ? 'green' : item.badge === 'Best Value' ? 'purple' : 'blue'}">${esc(item.badge || item.type || 'For Students')}</span><button class="heart" aria-label="Save property">♥</button></div><div class="property-info"><h3>${esc(item.title)}</h3><p>⌖ ${esc(item.address || item.city)}</p><div class="price">₹${Number(item.rent).toLocaleString('en-IN')} <small>/ month</small></div><p>${esc(item.description)}</p><div class="amenities">${(item.amenities || [item.ownerName || 'Student friendly']).map(a => `<span>${esc(a)}</span>`).join('')}</div></div></article>`).join('');
    grid.querySelectorAll('.detail-link').forEach(tile => { const open = () => { if (tile.dataset.propertyId) location.href = `property.html?id=${encodeURIComponent(tile.dataset.propertyId)}`; }; tile.addEventListener('click', event => { if (!event.target.closest('.heart')) open(); }); tile.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } }); });
    grid.querySelectorAll('.heart').forEach(button => button.addEventListener('click', () => button.classList.toggle('saved')));
  };
  if (grid) display(cityParam);
  document.querySelector('#catalogSearch')?.addEventListener('submit', event => { event.preventDefault(); const query = search.value.trim(); history.replaceState(null, '', query ? `?city=${encodeURIComponent(query)}` : location.pathname); display(query); });
})();
