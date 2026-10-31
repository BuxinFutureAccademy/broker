(() => {
  document.documentElement.classList.add('sk-arm');

  const card = () => `<article class="property-card sk-card" aria-hidden="true"><div class="photo"></div><div class="property-info"><span class="sk-line"></span><span class="sk-line short"></span><span class="sk-price"></span></div></article>`;
  const cards = count => Array.from({ length: count }, card).join('');
  const line = () => `<div class="sk-row" aria-hidden="true"><span class="sk-line"></span><span class="sk-line short"></span></div>`;
  const lines = count => Array.from({ length: count }, line).join('');
  const stats = count => Array.from({ length: count }, () => `<article class="stat-card sk-stat" aria-hidden="true"><span class="sk-block sk-icon"></span><div><span class="sk-price"></span><span class="sk-line short"></span></div></article>`).join('');
  const detail = () => `<div class="detail-layout sk-detail" aria-hidden="true"><section><div class="sk-hero"></div></section><aside><span class="sk-line short"></span><span class="sk-line"></span><span class="sk-price"></span><span class="sk-line"></span><span class="sk-line"></span><span class="sk-line short"></span></aside></div>`;
  const report = () => `<div class="sk-report" aria-hidden="true"><span class="sk-block sk-hero"></span>${lines(4)}</div>`;

  const hosts = [
    ['#homeProperties', () => cards(6)],
    ['#allProperties', () => cards(6)],
    ['#homePlaces', () => cards(6)],
    ['#marketList', () => cards(6)],
    ['#landlordListings', () => cards(3)],
    ['#studentRequests', () => lines(3)],
    ['#studentHistory', () => lines(4)],
    ['#landlordStudents', () => lines(3)],
    ['#receiptList', () => lines(3)],
    ['#vendorOrders', () => lines(4)],
    ['#orderList', () => lines(3)],
    ['#vendorBusinesses', () => lines(3)],
    ['#adminStats', () => stats(3)],
    ['#ownerStats', () => stats(3)],
    ['#ownerGlance', () => lines(2)],
    ['#studentCards', () => lines(4)],
    ['#landlordCards', () => lines(4)],
    ['#restaurantsActivity', () => lines(4)],
    ['#shopActivity', () => lines(4)],
    ['#servicesActivity', () => lines(4)],
    ['#reportBoard', report],
    ['#propertyDetails', detail],
    ['#businessDetails', detail]
  ];

  const placeholder = node => {
    const text = (node.textContent || '').trim();
    return !node.children.length || node.querySelector('.loading-state, .market-note') || /^loading/i.test(text);
  };

  hosts.forEach(([selector, html]) => {
    const node = document.querySelector(selector);
    if (!node || !placeholder(node)) return;
    node.innerHTML = html();
    node.setAttribute('aria-busy', 'true');
    node.dataset.skHost = '1';
  });

  const frameOf = element => element.closest('.photo, .receipt-shot, .qr-frame, .detail-thumbs button, .detail-gallery');

  const arm = element => {
    if (!element || element.dataset.sk === '1') return;
    const frame = frameOf(element);
    if (!frame || frame.classList.contains('sk-card') || frame.closest('.sk-card, .sk-detail')) return;
    element.dataset.sk = '1';
    const done = () => frame.classList.add('ready');
    if (element.tagName === 'IMG' && element.complete) done();
    else {
      element.addEventListener('load', done, { once: true });
      element.addEventListener('error', done, { once: true });
    }
  };

  const scan = node => {
    if (!node || node.nodeType !== 1) return;
    if (node.tagName === 'IMG' || node.tagName === 'IFRAME') arm(node);
    node.querySelectorAll?.('img, iframe').forEach(arm);
    const host = node.matches?.('[data-sk-host]') ? node : node.closest?.('[data-sk-host]');
    if (host && !host.querySelector('.sk-card, .sk-row, .sk-detail, .sk-stat, .sk-report, .sk-hero, .sk-line')) {
      host.removeAttribute('aria-busy');
      delete host.dataset.skHost;
    }
  };

  scan(document.body);
  if (document.body) {
    new MutationObserver(records => {
      records.forEach(record => record.addedNodes.forEach(scan));
    }).observe(document.body, { childList: true, subtree: true });
  }
})();
