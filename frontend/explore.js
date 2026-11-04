(() => {
  const API = 'https://broker-961c.onrender.com/api';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const money = value => `₹${Number(value || 0).toLocaleString('en-IN')}`;
  const covers = {
    Food: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=700&q=70',
    Item: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=700&q=70',
    Service: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=700&q=70',
    Home: 'https://images.unsplash.com/photo-1615874694520-474822394e73?auto=format&fit=crop&w=700&q=70'
  };
  const houseCard = item => `<article class="property-card" data-property-id="${esc(item.id)}" data-kind="Home" tabindex="0" role="link"><div class="photo"><img src="${esc(item.photos?.[0] || covers.Home)}" alt=""><button class="heart" type="button" aria-label="Save">♥</button></div><div class="property-info"><h3>${esc(item.title)}</h3><p>${esc(item.sector || 'Greater Noida')}</p><div class="price">${money(item.rent)} <small>/ month</small></div></div></article>`;
  const placeCard = (row, kind) => {
    const price = row.fromPrice == null ? '' : `From ${money(row.fromPrice)}`;
    return `<article class="property-card" data-business-id="${esc(row.id)}" data-kind="${esc(kind)}" tabindex="0" role="link"><div class="photo"><img src="${esc(row.imageUrl || row.logoUrl || covers[kind])}" alt=""><button class="heart" type="button" aria-label="Save">♥</button></div><div class="property-info"><h3>${esc(row.name)}</h3><p>${esc(row.area || row.category || 'Greater Noida')}</p><div class="price">${price}</div></div></article>`;
  };
  const state = { homes: [], food: [], items: [], services: [] };
  const hit = (text, query) => !query || String(text || '').toLowerCase().includes(query);
  const paint = query => {
    const q = query.trim().toLowerCase();
    const homes = state.homes.filter(item => hit(`${item.title} ${item.sector} ${item.type}`, q)).slice(0, 8);
    const food = state.food.filter(row => hit(`${row.name} ${row.category} ${row.area} ${(row.itemNames || []).join(' ')}`, q)).slice(0, 8);
    const items = state.items.filter(row => hit(`${row.name} ${row.category} ${row.area} ${(row.itemNames || []).join(' ')}`, q)).slice(0, 8);
    const services = state.services.filter(row => hit(`${row.name} ${row.category} ${row.area} ${(row.itemNames || []).join(' ')}`, q)).slice(0, 8);
    const fill = (id, cards, empty) => {
      const box = document.querySelector(id);
      const section = box?.closest('[data-section]');
      if (!box) return;
      box.innerHTML = cards.length ? cards.join('') : `<div class="empty-state">${empty}</div>`;
      if (section) section.hidden = Boolean(q) && !cards.length;
    };
    fill('#exploreHomes', homes.map(houseCard), q ? 'No homes match that search.' : 'No homes posted yet.');
    fill('#exploreFood', food.map(row => placeCard(row, 'Food')), q ? 'No food matches that search.' : 'No restaurants posted yet.');
    fill('#exploreItems', items.map(row => placeCard(row, 'Item')), q ? 'No items match that search.' : 'No shops posted yet.');
    fill('#exploreServices', services.map(row => placeCard(row, 'Service')), q ? 'No services match that search.' : 'No services posted yet.');
  };
  const open = card => {
    if (card.dataset.propertyId) location.href = `property.html?id=${encodeURIComponent(card.dataset.propertyId)}`;
    else if (card.dataset.businessId) location.href = `business.html?id=${encodeURIComponent(card.dataset.businessId)}`;
  };
  document.querySelector('#exploreMain')?.addEventListener('click', event => {
    const heart = event.target.closest('.heart');
    if (heart) { heart.classList.toggle('saved'); return; }
    const card = event.target.closest('[data-property-id], [data-business-id]');
    if (card) open(card);
  });
  document.querySelector('#exploreQuery')?.addEventListener('input', event => paint(event.target.value || ''));
  const load = (url, key) => fetch(url).then(response => response.ok ? response.json() : []).then(rows => { state[key] = Array.isArray(rows) ? rows : []; }).catch(() => { state[key] = []; });
  Promise.all([
    load(`${API}/listings`, 'homes'),
    load(`${API}/market/businesses?kind=restaurant`, 'food'),
    load(`${API}/market/businesses?kind=shop`, 'items'),
    load(`${API}/market/businesses?kind=service`, 'services')
  ]).then(() => paint(''));
})();
