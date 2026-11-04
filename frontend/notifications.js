(() => {
  const API = 'https://broker-961c.onrender.com/api';
  const box = document.querySelector('#noteList');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const token = localStorage.getItem('studentstay_token');
  let user = null;
  try { user = JSON.parse(localStorage.getItem('studentstay_user') || 'null'); } catch { user = null; }
  const when = value => {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  };
  const paint = notes => {
    if (!box) return;
    if (!notes.length) {
      box.innerHTML = '<div class="empty-state">No updates yet. A new order or a reply will show up here.</div>';
      return;
    }
    box.innerHTML = notes.map(note => `<a class="note-card" href="${esc(note.href)}"><small>${esc(note.label)}</small><b>${esc(note.title)}</b><p>${esc(note.text)}</p><p>${esc(when(note.time))}</p></a>`).join('');
    localStorage.setItem('ekvora_notes_seen', JSON.stringify(notes.map(note => `${note.id}:${note.status}`)));
    document.querySelectorAll('.note-dot').forEach(dot => dot.remove());
  };
  if (!token || !user) {
    if (box) box.innerHTML = '<div class="empty-state">Sign in to see orders, replies, and new requests.</div><p class="block"><a href="access.html">Sign in</a></p>';
    return;
  }
  const get = path => fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } }).then(response => response.ok ? response.json() : []).catch(() => []);
  const orderText = (row, incoming) => {
    const item = row.itemName || 'an item';
    const place = row.businessName || 'the place';
    const who = row.customer?.name || 'Someone';
    if (incoming) {
      if (row.status === 'accepted') return `You accepted ${item} for ${who}.`;
      if (row.status === 'completed') return `${item} for ${who} is marked received.`;
      if (row.status === 'cancelled') return `The order for ${item} was cancelled.`;
      return `${who} ordered ${item}.`;
    }
    if (row.status === 'accepted') return `${place} accepted your order for ${item}.`;
    if (row.status === 'completed') return `${place} marked ${item} as received.`;
    if (row.status === 'cancelled') return `The order for ${item} was cancelled.`;
    if (row.status === 'disputed') return `There is an update on ${item}.`;
    return `You ordered ${item} from ${place}. Waiting for them to accept.`;
  };
  const orderTitle = (row, incoming) => {
    if (row.status === 'accepted') return incoming ? 'You accepted an order' : 'Order accepted';
    if (row.status === 'pending') return incoming ? 'New order' : 'Order sent';
    return 'Order update';
  };
  const fromOrders = (rows, incoming) => (Array.isArray(rows) ? rows : []).map(row => ({
    id: row.id,
    status: row.status || '',
    time: row.updated || row.created,
    label: incoming ? 'Incoming' : 'Your order',
    title: orderTitle(row, incoming),
    text: orderText(row, incoming),
    href: incoming ? 'owner.html' : 'orders.html'
  }));
  const fromRequests = (rows, incoming) => (Array.isArray(rows) ? rows : []).map(row => ({
    id: row.id,
    status: row.status || '',
    time: row.created,
    label: incoming ? 'Incoming' : 'Your request',
    title: incoming ? 'New home request' : 'Home request sent',
    text: incoming
      ? `${row.student?.name || 'A student'} asked about ${row.listing?.title || 'a home'}.`
      : `You asked about ${row.listing?.title || 'a home'}.`,
    href: incoming ? 'landlord.html' : 'student.html'
  }));
  const fromUnlocks = rows => (Array.isArray(rows) ? rows : []).map(row => {
    const title = row.listing?.title || 'a home';
    const status = row.status || '';
    const text = status === 'approved'
      ? `Your payment for ${title} was approved.`
      : status === 'rejected'
        ? `Your payment for ${title} was not approved.`
        : `Receipt sent for ${title}. Waiting for approval.`;
    return { id: row.id, status, time: row.created, label: 'Home', title: status === 'approved' ? 'Payment approved' : status === 'rejected' ? 'Payment not approved' : 'Receipt sent', text, href: 'student.html' };
  });
  const role = user.role;
  const jobs = role === 'student'
    ? [get('/market/my-orders').then(rows => fromOrders(rows, false)), get('/requests/student').then(fromRequests), get('/unlocks/student').then(fromUnlocks)]
    : role === 'landlord'
      ? [get('/requests/landlord').then(rows => fromRequests(rows, true))]
      : ['restaurant', 'shop', 'service'].includes(role)
        ? [get('/market/vendor/orders').then(rows => fromOrders(rows, true))]
        : [];
  if (!jobs.length) {
    paint([]);
    return;
  }
  Promise.all(jobs).then(groups => {
    const notes = groups.flat().filter(note => note.id);
    notes.sort((a, b) => String(b.time || '').localeCompare(String(a.time || '')));
    paint(notes);
  }).catch(() => { if (box) box.innerHTML = '<div class="empty-state">Updates could not load. Refresh this page in a moment.</div>'; });
})();
