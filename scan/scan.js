/*
 * Demo Kit demo kit — site recon bookmarklet.
 * Reads the current page's DOM only (no requests) and builds a site profile the
 * Gem uses to design scenes: render mode, CSP probe, brand colors, products,
 * navigation links, selector candidates, martech tags. Results accumulate per
 * tab session so the presenter can run it on home -> product page -> cart and
 * copy one merged JSON at the end.
 */
(() => {
  'use strict';
  const VER = 'scan 0.6';
  const L = '__LANG__' === 'en' ? 'en' : 'ko';
  const KEY = '__demokitSiteScan';
  const STORE = '__demokit_scan_pages';
  window[KEY]?.destroy();
  let TT = null;
  try { if (window.trustedTypes?.createPolicy) TT = window.trustedTypes.createPolicy('demokit-site-scan', { createHTML: (x) => x }); } catch { TT = null; }
  const setHTML = (el, html) => { el.innerHTML = TT ? TT.createHTML(html) : html; };

  const PRICE = /(₩|\$|¥|€|£)\s?\d[\d,]*(\.\d+)?|\d[\d,]*(\.\d+)?\s?(원|円|KRW|JPY|USD|EUR)/;
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const abs = (u) => { try { return new URL(u, location.href).href; } catch { return null; } };
  const sameHost = (u) => { try { const h = new URL(u).hostname; return h === location.hostname || h.endsWith('.' + location.hostname.replace(/^www\./, '')); } catch { return false; } };
  const parsePrice = (s) => { const m = String(s || '').replace(/,/g, '').match(/\d+(\.\d+)?/); return m ? Number(m[0]) : null; };
  const currencyOf = (s) => /₩|원|KRW/.test(s) ? 'KRW' : /¥|円|JPY/.test(s) ? 'JPY' : /\$|USD/.test(s) ? 'USD' : /€|EUR/.test(s) ? 'EUR' : /£/.test(s) ? 'GBP' : null;

  // ── selector candidates: [unique path, simple tag.class]
  const okName = (c) => /^[A-Za-z_][\w-]*$/.test(c) && c.length < 40 && !/^(is-|js-|has-|active|selected|hover|focus|ng-|css-|sc-|jsx-|svelte-|v-)/.test(c) && !/\d{3,}/.test(c);
  function sel(el) {
    if (!el || el === document.body) return [];
    const simple = (n) => { let s = n.tagName.toLowerCase(); const cls = [...n.classList].filter(okName).slice(0, 2); if (cls.length) s += '.' + cls.map((c) => CSS.escape(c)).join('.'); return s; };
    if (el.id && okName(el.id) && document.querySelectorAll('#' + CSS.escape(el.id)).length === 1) return ['#' + el.id, simple(el)];
    const parts = []; let cur = el;
    for (let depth = 0; cur && cur !== document.body && depth < 4; depth++) {
      if (cur.id && okName(cur.id)) { parts.unshift('#' + CSS.escape(cur.id)); break; }
      parts.unshift(simple(cur));
      if (document.querySelectorAll(parts.join(' > ')).length === 1) break;
      cur = cur.parentElement;
    }
    const out = [parts.join(' > '), simple(el)];
    return [...new Set(out)];
  }
  const visible = (el) => { try { const r = el.getBoundingClientRect(); return !!r && r.width > 0 && r.height > 0; } catch { return false; } };
  const first = (list, pred) => { for (const el of list) { if (pred(el)) return el; } return null; };

  // ── frameworks / render mode
  const has = (q) => !!document.querySelector(q);
  const rootEl = document.querySelector('#root, #app, #__next, #__nuxt, [data-reactroot]');
  const frameworks = {
    next: !!window.__NEXT_DATA__ || has('#__next'),
    nuxt: !!window.__NUXT__ || has('#__nuxt'),
    react: !!window.React || has('[data-reactroot]') || !!(rootEl && Object.keys(rootEl).some((k) => k.startsWith('__react'))),
    vue: !!window.Vue || !!(rootEl && (rootEl.__vue__ || rootEl.__vue_app__)) || has('[data-v-app]'),
    angular: has('[ng-version]'),
    sfcc: !!window.dw || has('script[src*="demandware"]') || has('link[href*="demandware"]'),
    shopify: !!window.Shopify,
    cafe24: !!window.CAFE24 || has('script[src*="cafe24"]'),
    wordpress: has('meta[name="generator"][content*="WordPress"]'),
    jquery: !!window.jQuery,
  };
  const rootFw = !!rootEl && (Object.keys(rootEl).some((k) => k.startsWith('__react')) || !!rootEl.__vue__ || !!rootEl.__vue_app__);
  const spa = frameworks.next || frameworks.nuxt || frameworks.angular || rootFw || has('[data-reactroot]');

  // ── martech tags on the page (window globals / script hosts)
  const tags = {
    braze: !!(window.braze || window.appboy || has('script[src*="braze"]')),
    bloomreach_exponea: !!(window.exponea || has('script[src*="exponea"]')),
    moengage: !!(window.Moengage || window.moe || has('script[src*="moengage"]')),
    clevertap: !!(window.clevertap || has('script[src*="clevertap"]')),
    salesforce_mc: !!(window._etmc || has('script[src*="evergage"]')),
    adobe_target: !!(window._satellite || window.adobe?.target),
    gtm: !!window.google_tag_manager,
    ga: !!(window.gtag || window.ga || window.dataLayer),
    hotjar: !!window.hj, channel_io: !!window.ChannelIO, kakao_pixel: !!window.kakaoPixel, naver_wcs: !!window.wcs, amplitude: !!window.amplitude,
  };

  // ── CSP probe: can a script-inserted <style> (inside a shadow root) actually apply?
  const csp = { meta: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || null, style_blocked: false, violations: [] };
  const onViol = (e) => csp.violations.push(e.violatedDirective + ' ' + (e.blockedURI || ''));
  document.addEventListener('securitypolicyviolation', onViol);
  csp.adopted_ok = false; csp.trusted_types = !!window.trustedTypes && !TT;
  try {
    const probe = document.createElement('div'); const sr = probe.attachShadow({ mode: 'open' });
    setHTML(sr, '<style>.p{color:rgb(1,2,3)}</style><span class="p">x</span><span class="q">y</span>');
    document.body.appendChild(probe);
    csp.style_blocked = getComputedStyle(sr.querySelector('.p')).color !== 'rgb(1, 2, 3)';
    try { const sh = new CSSStyleSheet(); sh.replaceSync('.q{color:rgb(4,5,6)}'); sr.adoptedStyleSheets = [sh]; csp.adopted_ok = getComputedStyle(sr.querySelector('.q')).color === 'rgb(4, 5, 6)'; } catch { csp.adopted_ok = false; }
    probe.remove();
  } catch (e) { csp.style_blocked = true; csp.violations.push('probe error: ' + e.message); }
  csp.demo_shell = csp.adopted_ok ? 'ok' : (csp.style_blocked ? 'blocked' : 'inline-only');

  // ── brand colors: frequent saturated colors on buttons / links / header
  const toHex = (rgb) => { const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/); if (!m || (m[4] !== undefined && Number(m[4]) < 0.5)) return null; const [r, g, b] = [m[1], m[2], m[3]].map(Number); if ((r === 0 && g === 0 && b === 238) || (r === 85 && g === 26 && b === 139)) return null; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx - mn < 40 || mx > 245 && mn > 225 || mx < 40) return null; return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join(''); };
  const colorCount = {}, darkCount = {};
  const bump = (hex, w) => { if (hex) colorCount[hex] = (colorCount[hex] || 0) + w; };
  const toDark = (rgb) => { const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/); if (!m) return null; const [r, g, b] = [m[1], m[2], m[3]].map(Number); return Math.max(r, g, b) < 70 ? '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('') : null; };
  [...document.querySelectorAll('button, a, [class*="btn"], [class*="button"], header, header *, nav a, [role="banner"] *')].slice(0, 2000).forEach((el) => {
    if (!visible(el)) return; const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
    const w = Math.min(4, 1 + r.width * r.height / 20000);
    bump(toHex(cs.backgroundColor), w * 2); bump(toHex(cs.color), w); bump(toHex(cs.borderColor), w / 2);
    if (/BUTTON|A/.test(el.tagName) || /btn|button/i.test(el.className)) { const d = toDark(cs.backgroundColor); if (d) darkCount[d] = (darkCount[d] || 0) + w; }
  });
  document.querySelectorAll('header svg *, [role="banner"] svg *, #header svg *, .header svg *, [class*="logo"] svg *').forEach((el) => { try { bump(toHex(getComputedStyle(el).fill), 3); } catch { /* ignore */ } });
  let brand_colors = Object.entries(colorCount).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c]) => c);
  const monochrome = brand_colors.length === 0;
  if (monochrome) brand_colors = Object.entries(darkCount).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([c]) => c);
  const cssVars = {};
  const near = (a, b) => { const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); if (!/^#[0-9a-f]{6}$/i.test(a) || !/^#[0-9a-f]{6}$/i.test(b)) return false; const [x, y] = [p(a), p(b)]; return Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]) < 90; };
  try { for (const ss of document.styleSheets) { let rules; try { rules = ss.cssRules; } catch { continue; } for (const r of rules) { if (r.selectorText === ':root' || r.selectorText === 'html') { for (const p of r.style) { if (p.startsWith('--') && /primary|brand|main|accent|point/i.test(p) && /#|rgb/.test(r.style.getPropertyValue(p))) cssVars[p] = r.style.getPropertyValue(p).trim(); } } } } } catch { /* ignore */ }
  const varColor = Object.values(cssVars).find((v) => brand_colors.some((c) => near(v.trim(), c)));
  const brand_color_suggested = varColor ? varColor.trim() : (brand_colors[0] || null);
  const fonts = { body: getComputedStyle(document.body).fontFamily, heading: document.querySelector('h1,h2') ? getComputedStyle(document.querySelector('h1,h2')).fontFamily : null };

  // ── products: JSON-LD first, then DOM cards
  const products = [];
  const seen = new Set();
  const addProduct = (p) => { const u = p.url ? (abs(p.url) || '').split('#')[0] || null : null; const k = u || p.name; if (!p.name || seen.has(k)) return; seen.add(k); products.push({ name: p.name.slice(0, 80), price: p.price ?? null, currency: p.currency || null, url: u, img: p.img ? abs(p.img) : null, source: p.source }); };
  const ldNodes = [];
  document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => { try { const j = JSON.parse(s.textContent); (Array.isArray(j) ? j : [j]).forEach((x) => { ldNodes.push(x); if (x['@graph']) ldNodes.push(...x['@graph']); }); } catch { /* bad json-ld */ } });
  const ldProduct = (x) => { const t = String(x['@type'] || ''); if (!/Product/.test(t)) return; const off = Array.isArray(x.offers) ? x.offers[0] : x.offers; addProduct({ name: x.name, price: off ? parsePrice(off.price ?? off.lowPrice) : null, currency: off?.priceCurrency, url: x.url || off?.url, img: Array.isArray(x.image) ? x.image[0] : (x.image?.url || x.image), source: 'json-ld' }); };
  ldNodes.forEach((x) => { ldProduct(x); if (x.itemListElement) x.itemListElement.forEach((it) => ldProduct(it.item || it)); });
  const ogType = document.querySelector('meta[property="og:type"]')?.content || null;
  if (/product/i.test(ogType || '')) addProduct({ name: document.querySelector('meta[property="og:title"]')?.content, price: parsePrice(document.querySelector('meta[property="product:price:amount"]')?.content), currency: document.querySelector('meta[property="product:price:currency"]')?.content, url: location.href, img: document.querySelector('meta[property="og:image"]')?.content, source: 'og' });
  const cardSel = [];
  if (products.length < 8) {
    for (const a of document.querySelectorAll('a[href]')) {
      if (products.length >= 16) break;
      const card = a.closest('li, article, [class*="product"], [class*="item"], [class*="card"], [class*="goods"]') || a;
      const img = card.querySelector('img'); const t = txt(card);
      if (!img || !PRICE.test(t) || t.length > 400 || !sameHost(a.href) || /demandware\.store|QuickView|Wishlist|AddProduct|\/cart\/add|javascript:/i.test(a.href)) continue;
      if (/\/(feature|news|special|spl|campaign|event|story|stories|blog|about|help|faq|livestation|contents)\b/i.test(new URL(a.href).pathname)) continue;
      const nameEl = card.querySelector('h1,h2,h3,h4,[class*="name"],[class*="title"]');
      const name = txt(nameEl) || img.alt || '';
      if (!name || name.length > 70 || /\b(image of|wearing|photo|banner)\b/i.test(name)) continue;
      const pm = t.match(PRICE);
      addProduct({ name, price: parsePrice(pm[0]), currency: currencyOf(pm[0]), url: a.href, img: img.currentSrc || img.src, source: 'dom-card' });
      if (cardSel.length < 3) cardSel.push(sel(card)[1]);
    }
  }
  // merge duplicates: same url -> keep the entry with a price and the shorter (non-title) name
  for (let i = products.length - 1; i >= 0; i--) {
    const a = products[i]; if (!a.url) continue;
    const j = products.findIndex((b, k) => k < i && b.url === a.url);
    if (j >= 0) { const b = products[j]; if (b.price == null && a.price != null) b.price = a.price, b.currency = a.currency; if (a.name.length < b.name.length && !/\|/.test(a.name)) b.name = a.name; if (!b.img) b.img = a.img; products.splice(i, 1); }
  }
  const currency = products.find((p) => p.currency)?.currency || (PRICE.test(txt(document.body).slice(0, 20000)) ? currencyOf(txt(document.body).match(PRICE)[0]) : null);

  // ── navigation links (header/nav/footer, same host)
  const nav = []; const navSeen = new Set();
  let navScope = document.querySelectorAll('header a[href], nav a[href], [role="navigation"] a[href], footer a[href], #header a[href], .header a[href], #gnb a[href], .gnb a[href], #lnb a[href], [id*="nav" i] a[href], [class*="nav" i] a[href], [id*="menu" i] a[href], [class*="menu" i] a[href], #footer a[href], .footer a[href]');
  if (navScope.length < 5) navScope = document.querySelectorAll('a[href]');
  for (const a of navScope) { const u = abs(a.href); const t = txt(a).slice(0, 40); if (!u || !t || !sameHost(u) || /^(javascript|mailto|tel):/.test(a.getAttribute('href') || '') || navSeen.has(u) || /^(skip|back)\b/i.test(t) || /demandware\.store|QuickView|Wishlist|OAuth|logout/i.test(u)) continue; navSeen.add(u); nav.push({ text: t, url: u.split('#')[0] }); if (nav.length >= 60) break; }
  const allLinks = [...document.querySelectorAll('a[href]')].map((a) => abs(a.href)).filter((u) => u && sameHost(u));

  // ── selector candidates for scenes / readers
  const inHeader = (e) => !!e.closest('header, [role="banner"], #header, .header, nav, footer');
  const btnLike = [...document.querySelectorAll('button, a, input[type="submit"], [role="button"]')].filter(visible);
  const atcRe = /^(장바구니(에)?\s?(담기)?|카트에?\s?담기|담기|add to (cart|bag|basket)|カートに(入れる|追加)|かごに(入れる|追加)|buy now|바로\s?구매|구매하기)$/i;
  const atc = first(btnLike, (b) => { const t = txt(b).replace(/\s+/g, ' '); return t.length <= 24 && (atcRe.test(t) || /add-to-cart|addtocart|btn-cart|cart-btn|buy-now/i.test(b.className + ' ' + (b.id || '') + ' ' + (b.getAttribute('data-action') || ''))); });
  const priceCands = [...document.querySelectorAll('[class*="price" i], [itemprop="price"], [data-price]')].filter((e) => visible(e) && PRICE.test(txt(e)) && txt(e).length < 40);
  const ldPrice = products.find((x) => x.source === 'json-ld' && x.price != null)?.price;
  const priceEl = (ldPrice != null && priceCands.find((e) => parsePrice(txt(e).match(PRICE)[0]) === ldPrice))   // the element showing the product's own price
    || priceCands.sort((a, b) => parseFloat(getComputedStyle(b).fontSize) - parseFloat(getComputedStyle(a).fontSize) || txt(a).length - txt(b).length)[0] || null;
  const h1 = first([...document.querySelectorAll('h1')].filter(visible), (e) => !inHeader(e) && txt(e).length > 1 && txt(e).length < 120 && !/[{}]/.test(txt(e)));
  const cartCount = first([...document.querySelectorAll('[class*="cart" i] [class*="count" i], [class*="cart" i] [class*="qty" i], [class*="cart" i] [class*="badge" i], [class*="minicart" i] span, [class*="cart-num" i], [class*="cartCount"]')].filter(visible), (e) => /^\d{1,3}$/.test(txt(e)));
  const cartTotal = first([...document.querySelectorAll('[class*="total" i], [class*="subtotal" i], [class*="grand" i]')].filter(visible), (e) => PRICE.test(txt(e)) && txt(e).length < 60);
  const search = document.querySelector('input[type="search"], input[name*="search" i], input[placeholder*="검색"], input[placeholder*="search" i]');
  const header = document.querySelector('header, [role="banner"], #header, .header');
  let hero = null, heroSize = 0;
  for (const e of [...document.querySelectorAll('h1, h2, h3, p, strong, span, div')].slice(0, 4000)) {
    if (e.children.length > 2 || inHeader(e)) continue;
    const t = txt(e); if (t.length < 4 || t.length > 120 || /[{}]/.test(t) || PRICE.test(t)) continue;
    const r = e.getBoundingClientRect(); if (r.top > 900 || r.width === 0 || r.height === 0) continue;
    const fs = parseFloat(getComputedStyle(e).fontSize); if (fs >= 26 && fs > heroSize) { hero = e; heroSize = fs; }
  }
  const volatile = (arr) => arr.some((x) => /[_-][A-Za-z0-9]{5,}$|__[A-Za-z0-9]{4,}|[a-f0-9]{6,}/.test(x));
  const selectors = {
    product_name: sel(h1), price: sel(priceEl), add_to_cart: sel(atc), cart_count: sel(cartCount), cart_total: sel(cartTotal),
    search: sel(search), header: sel(header), hero_heading: sel(hero), product_card: cardSel,
  };
  const volatile_selectors = Object.entries(selectors).filter(([, v]) => v.length && volatile(v)).map(([k]) => k);
  const samples = { product_name: txt(h1).slice(0, 60) || null, price: txt(priceEl).slice(0, 40) || null, add_to_cart: txt(atc).slice(0, 40) || null, cart_count: txt(cartCount) || null, cart_total: txt(cartTotal).slice(0, 40) || null, hero_heading: txt(hero).slice(0, 80) || null };

  products.forEach((x) => { if (x.source === 'json-ld' && atc) { if (!x.url) x.url = location.href.split('#')[0]; if (x.price == null && priceEl) { x.price = parsePrice(txt(priceEl)); x.currency = x.currency || currencyOf(txt(priceEl)); } } });
  if (h1 && priceEl && atc && !products.some((x) => x.source === 'json-ld' || x.source === 'og')) {
    const big = first([...document.querySelectorAll('main img, [class*="product"] img, [class*="gallery"] img, img')].filter(visible), (im) => im.getBoundingClientRect().width >= 200);
    addProduct({ name: txt(h1), price: parsePrice(txt(priceEl)), currency: currencyOf(txt(priceEl)), url: location.href, img: document.querySelector('meta[property="og:image"]')?.content || big?.currentSrc || big?.src, source: 'pdp-dom' });
  }

  // ── page type
  const path = location.pathname;
  const page_type = /cart|basket|bag\b|장바구니|checkout/i.test(path) ? 'cart'
    : (ldNodes.some((x) => /Product/.test(String(x['@type'] || '')) ) || (atc && h1)) ? 'pdp'
    : (path === '/' || /^(\/[a-z]{2}(-[a-z]{2})?){0,2}\/?(index|main|home)?(\.\w+)?\/?$/i.test(path)) ? 'home'
    : (products.filter((p) => p.source === 'dom-card').length >= 6 || document.querySelectorAll('[class*="product-tile" i], [class*="product-card" i], [class*="productTile" i], [class*="productCard" i], li[class*="product" i]').length >= 6) ? 'plp' : 'other';

  const meta = (n) => document.querySelector(`meta[property="${n}"], meta[name="${n}"]`)?.content?.trim() || '';
  const brandToken = location.hostname.replace(/^www\./, '').split('.')[0].toLowerCase();
  const segs = document.title.split(/[|｜\-–—:·]/).map((x) => x.trim()).filter(Boolean);
  const site_name = meta('og:site_name') || meta('application-name') || segs.find((x) => x.toLowerCase().includes(brandToken)) || segs.filter((x) => x.length <= 25).sort((a, b) => a.length - b.length)[0] || location.hostname.replace(/^www\./, '');
  const corpus = [document.title, meta('description'), meta('keywords'), ...nav.map((n) => n.text), ...[...document.querySelectorAll('h1,h2,h3,button,[role="menuitem"]')].slice(0, 300).map(txt), txt(document.body).slice(0, 4000)].join(' ').toLowerCase();
  const INDUSTRY = [
    ['Fashion & Apparel', /의류|패션|레깅스|아우터|드레스|스커트|셔츠|후디|신발|스니커즈|fashion|apparel|clothing|shoes|sneaker|dress|jacket|ファッション|シューズ|スニーカー|원피스|니트|가디건|팬츠|골프웨어|브랜드/g],
    ['Beauty & Cosmetics', /뷰티|화장품|스킨케어|메이크업|립|세럼|beauty|cosmetic|skincare|makeup|コスメ/g],
    ['Electronics', /가전|노트북|스마트폰|tv|냉장고|세탁기|electronics|laptop|smartphone|家電/g],
    ['Grocery & Food Delivery', /식품|신선|마트|장보기|배달|grocery|delivery|food|restaurant|フード/g],
    ['Marketplace / General Retail', /베스트|카테고리|입점|셀러|marketplace|best seller|category|deal/g],
    ['Travel & Hospitality', /항공|호텔|여행|예약|투어|flight|hotel|travel|booking|airline|旅行|ホテル/g],
    ['Banking & Insurance', /대출|예금|적금|보험|송금|신용카드|계좌개설|loan|insurance|banking|mortgage|credit card|savings|投資|保険|銀行|ローン/g],
    ['Telecom', /요금제|유심|esim|데이터|로밍|인터넷|iptv|mobile plan|telecom|roaming/g],
    ['Automotive & Mobility', /자동차|차량|시승|딜러|모델|전기차|바이크|automotive|dealer|test drive|vehicle|バイク|クルマ/g],
    ['Media & Subscriptions', /기사|뉴스|구독|영상|시리즈|에피소드|article|news|subscribe|episode|streaming/g],
    ['Education', /강의|수업|코스|학습|수강|course|lesson|learn|class|tutor/g],
    ['Healthcare', /병원|진료|건강검진|의료|clinic|doctor|patient|health|hospital/g],
    ['Nonprofit & Donations', /후원|기부|캠페인|나눔|donate|donation|charity|ngo|volunteer/g],
    ['Gaming, Entertainment & Ticketing', /게임|티켓|공연|콘서트|경기|game|ticket|concert|match|betting/g],
  ];
  const scored = INDUSTRY.map(([name, re]) => [name, (corpus.match(re) || []).length]).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1]);
  const industry_guess = scored.length ? scored[0][0] : null;
  const industry_candidates = scored.slice(0, 3).map(([n, c]) => `${n} (${c})`);
  const pageProfile = {
    url: location.href.split('#')[0], path, page_type, title: document.title.slice(0, 120), captured_at: new Date().toISOString(),
    login_gate: /login|signin|member\/login|로그인/i.test(path) || (/cart/i.test(path) && !!document.querySelector('form[action*="login" i]')),
    products, nav, link_count: new Set(allLinks).size, selectors, volatile_selectors, samples, csp,
    site_name, industry_guess, industry_candidates, brand_colors, brand_color_suggested, tags: Object.keys(tags).filter((k) => tags[k]), lang: document.documentElement.lang || null,
    iframes: [...document.querySelectorAll('iframe')].filter(visible).map((f) => (f.src || '').slice(0, 120)).slice(0, 5), body_nodes: document.body.querySelectorAll('*').length,
  };
  const siteProfile = {
    scan: VER, site_name, industry_guess, industry_candidates, host: location.hostname, hosts: [location.hostname.replace(/^www\./, '')], entry_url: location.origin + '/',
    lang: document.documentElement.lang || null, currency, render: spa ? 'spa' : 'ssr', monochrome, frameworks: Object.keys(frameworks).filter((k) => frameworks[k]),
    tags: Object.keys(tags).filter((k) => tags[k]), brand_colors, brand_color_suggested, css_vars: cssVars, fonts,
    viewport: { w: innerWidth, h: innerHeight }, ua: navigator.userAgent,
  };

  // ── accumulate per tab session
  let pages = [];
  try { pages = JSON.parse(sessionStorage.getItem(STORE) || '[]'); } catch { pages = []; }
  pages = pages.filter((p) => p.url !== pageProfile.url); pages.push(pageProfile);
  let storageOk = true;
  try { sessionStorage.setItem(STORE, JSON.stringify(pages)); } catch { storageOk = false; }
  const best = () => { const home = pages.find((p) => p.page_type === 'home'); const order = home ? [home, ...pages.filter((p) => p !== home)] : pages.slice(); const pick = (k) => { for (const p of order) { const v = p[k]; if (v && (!Array.isArray(v) || v.length)) return v; } return siteProfile[k]; }; return { site_name: pick('site_name'), industry_guess: pick('industry_guess'), industry_candidates: pick('industry_candidates'), brand_colors: pick('brand_colors'), brand_color_suggested: pick('brand_color_suggested'), lang: pick('lang'), tags: [...new Set(pages.flatMap((p) => p.tags || []))] }; };
  const merged = () => ({ ...siteProfile, ...best(), pages, allowed_urls: [...new Set(pages.flatMap((p) => [p.url, ...p.nav.map((n) => n.url), ...p.products.map((x) => x.url).filter(Boolean)]))].filter((u) => !/demandware\.store|QuickView|Wishlist|OAuth/i.test(u)).slice(0, 300) });
  document.removeEventListener('securitypolicyviolation', onViol);

  // ── panel
  const host = document.createElement('div'); host.id = 'demokit-site-scan';
  host.style.cssText = 'all:initial!important;position:fixed!important;right:16px!important;bottom:16px!important;z-index:2147483647!important';
  const root = host.attachShadow({ mode: 'open' });
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sw = (c) => `<i class="sw" data-style="background:${c}"></i>`;
  const PANEL_CSS = `
  .p{font:13px/1.5 -apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#1a1f27;background:#fff;border:1px solid #ddd;border-radius:14px;box-shadow:0 14px 50px #0004;width:360px;max-width:calc(100vw - 32px);overflow:hidden}
  .h{background:#1a1f27;color:#fff;padding:10px 14px;font-size:12px;letter-spacing:1px;display:flex;justify-content:space-between;align-items:center}.h button{background:none;border:0;color:#aaa;font-size:18px;cursor:pointer}
  .b{padding:12px 14px}table{width:100%;border-collapse:collapse;font-size:12px}td{padding:3px 0;vertical-align:top}td:first-child{color:#777;width:92px}
  .row{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}button.a{background:#d0021b;color:#fff;border:0;border-radius:8px;padding:9px 12px;font:700 13px/1 inherit;cursor:pointer}button.g{background:#eef0f3;color:#222;border:0;border-radius:8px;padding:9px 12px;font:13px/1 inherit;cursor:pointer}
  textarea{width:100%;height:90px;font:11px/1.3 ui-monospace,monospace;margin-top:8px;border:1px solid #ccc;border-radius:6px}[hidden]{display:none!important}.s{font-size:11px;color:#666;margin-top:6px}.warn{color:#b3261e}
  .sw{display:inline-block;width:14px;height:14px;border-radius:3px;vertical-align:middle;margin-right:3px;border:1px solid #0002}`;
  const B = best();
  const PANEL = `<div class="p"><div class="h"><span>DEMO KIT · ${L === 'en' ? 'SITE SCAN' : '사이트 스캔'} ${VER}</span><button data-a="x" aria-label="close">×</button></div><div class="b">
  <table>
  <tr><td>site</td><td>${esc(B.site_name)}${B.industry_guess ? ' · ' + esc(B.industry_guess) : ''}</td></tr>
  <tr><td>page</td><td><b>${esc(page_type)}</b> · ${esc(siteProfile.render)} ${siteProfile.frameworks.length ? '(' + esc(siteProfile.frameworks.join(', ')) + ')' : ''}</td></tr>
  <tr><td>products</td><td>${products.length} ${products[0] ? '· ' + esc(products[0].name.slice(0, 30)) : ''}</td></tr>
  <tr><td>nav links</td><td>${nav.length}</td></tr>
  <tr><td>selectors</td><td>${['product_name', 'price', 'add_to_cart', 'cart_count', 'cart_total'].filter((k) => selectors[k].length).join(', ') || '—'}</td></tr>
  <tr><td>colors</td><td>${(B.brand_colors || []).map(sw).join('')} ${esc((B.brand_colors || []).join(' '))}${B.brand_color_suggested ? (L === 'en' ? ' · suggested ' : ' · 제안 ') + esc(B.brand_color_suggested) : ''}</td></tr>
  <tr><td>tags</td><td>${esc((B.tags || []).join(', ')) || '—'}</td></tr>
  <tr><td>csp</td><td class="${csp.demo_shell === 'blocked' ? 'warn' : ''}">${csp.demo_shell === 'ok' ? 'ok' : csp.demo_shell === 'inline-only' ? 'ok (inline only)' : (L === 'en' ? '⚠ styles blocked — use the local rehearsal for the demo' : '⚠ 스타일 차단 — 데모는 로컬 리허설로')}${csp.trusted_types ? ' · ⚠ Trusted Types' : ''}${csp.meta ? ' · meta' : ''}</td></tr>
  ${pageProfile.iframes.length && pageProfile.body_nodes < 400 ? '<tr><td class="warn">iframe</td><td class="warn">' + (L === 'en' ? '⚠ content seems to live in an iframe — open the frame URL directly and run there' : '⚠ 콘텐츠가 iframe 안에 있는 듯 — 프레임 URL을 직접 열어 실행하세요') + '</td></tr>' : ''}
  ${(page_type === 'pdp' || page_type === 'plp') && !products.length ? '<tr><td class="warn">products</td><td class="warn">' + (L === 'en' ? '⚠ 0 products — scroll to the bottom, then click again' : '⚠ 상품이 0건 — 페이지 끝까지 스크롤한 뒤 다시 클릭') + '</td></tr>' : ''}
  ${volatile_selectors.length ? `<tr><td>note</td><td>${L === 'en' ? `hashed-class selectors (${volatile_selectors.join(', ')}) — may change after a deploy, re-check on the meeting day` : `해시 클래스 셀렉터(${volatile_selectors.join(', ')}) — 배포 후 바뀔 수 있음, 미팅 당일 재확인`}</td></tr>` : ''}
  ${storageOk ? '' : '<tr><td class="warn">session</td><td class="warn">' + (L === 'en' ? '⚠ session storage unavailable — copy "this page only" on each page and paste all of them' : '⚠ 세션 저장 불가 — 페이지마다 "이 페이지만" 복사해 모두 붙여넣으세요') + '</td></tr>'}
  ${allLinks.length < 20 ? '<tr><td class="warn">links</td><td class="warn">' + (L === 'en' ? '⚠ few links (SPA?) — run on product and cart pages too so URLs accumulate' : '⚠ 링크가 적은 페이지(SPA?) — 상품·장바구니 페이지에서도 실행해 URL을 누적하세요') + '</td></tr>' : ''}
  ${monochrome ? '<tr><td>note</td><td>' + (L === 'en' ? 'no saturated brand color — suggesting the dark button color' : '채도 있는 브랜드색 없음 — 버튼의 어두운 색을 brand로 제안') + '</td></tr>' : ''}
  <tr><td>collected</td><td>${pages.length} page(s): ${esc(pages.map((p) => p.page_type).join(' → '))}</td></tr>
  </table>
  <div class="row"><button class="a" data-a="copy">${L === 'en' ? 'Copy JSON' : 'JSON 복사'} (${pages.length}p)</button><button class="g" data-a="one">${L === 'en' ? 'This page only' : '이 페이지만'}</button><button class="g" data-a="clear">${L === 'en' ? 'Reset session' : '세션 초기화'}</button></div>
  <div class="s">${L === 'en' ? 'Click the bookmark again on Home → Product page → Cart, then copy at the end. Paste the JSON into step 1 of the Kit Builder.' : '홈 → 상품 상세 → 장바구니 순으로 각 페이지에서 북마크를 다시 클릭한 뒤 마지막에 복사하세요. 복사한 JSON을 킷 빌더 1단계에 붙여넣습니다.'}</div>
  <textarea hidden readonly></textarea></div></div>`;
  try { const sh = new CSSStyleSheet(); sh.replaceSync(PANEL_CSS); root.adoptedStyleSheets = [sh]; setHTML(root, PANEL); }
  catch { setHTML(root, `<style>${PANEL_CSS}</style>` + PANEL); }
  root.querySelectorAll('[data-style]').forEach((el) => { el.style.cssText += ';' + el.dataset.style; });
  const ta = root.querySelector('textarea'); const status = root.querySelector('.s');
  async function copy(obj) {
    const j = JSON.stringify(obj, null, 1);
    ta.value = j;
    try { await navigator.clipboard.writeText(j); status.textContent = L === 'en' ? `Copied (${(j.length / 1024).toFixed(0)} KB). Paste into step 1 of the Kit Builder.` : `복사했습니다 (${(j.length / 1024).toFixed(0)} KB). Gem에 붙여넣으세요.`; return; } catch { /* insecure context or denied */ }
    ta.hidden = false; ta.focus(); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; }
    status.textContent = ok ? (L === 'en' ? `Copied (${(j.length / 1024).toFixed(0)} KB).` : `복사했습니다 (${(j.length / 1024).toFixed(0)} KB). Gem에 붙여넣으세요.`) : (L === 'en' ? 'Select the JSON and press ⌘C / Ctrl+C.' : '선택된 JSON을 ⌘C / Ctrl+C로 복사하세요.');
  }
  function destroy() { host.remove(); delete window[KEY]; }
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.a === 'copy') copy(merged());
    else if (b.dataset.a === 'one') copy({ ...siteProfile, pages: [pageProfile] });
    else if (b.dataset.a === 'clear') { try { sessionStorage.removeItem(STORE); } catch { /* ignore */ } pages = [pageProfile]; status.textContent = L === 'en' ? 'Session cleared. Only this page remains.' : '세션을 비웠습니다. 현재 페이지만 남습니다.'; }
    else destroy();
  });
  document.body.appendChild(host);
  window[KEY] = { destroy, page: pageProfile, site: siteProfile, merged };
})();
