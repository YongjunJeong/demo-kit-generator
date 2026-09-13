/*
 * Demo Kit demo kit — generic overlay shell.
 * Runs inside the presenter's own browser tab. No backend. Images and navigation may make network requests.
 * Reset restores recorded DOM edits, not application state.
 * The builder replaces __SPEC__ with the scene spec JSON before encoding.
 * Presets: banner popup sticky_bar inline_edit reco_card social_proof tier_progress
 *          countdown free_shipping_bar coupon exit_intent lead_form survey spin_to_win custom
 */
(() => {
  'use strict';
  const SPEC = __SPEC__;
  const VER = 'shell 0.4';
  const KEY = '__demokitDemoKit';

  const site = SPEC.site || {};
  const cust = SPEC.customer || {};
  const hosts = site.hosts || [];
  const here = location.hostname;
  const local = location.protocol === 'file:' || here === 'localhost' || here === '127.0.0.1';
  const onSite = hosts.some((h) => here === h || here.endsWith('.' + h));
  if (!local && !onSite) {
    alert((SPEC.ui_lang === 'en' ? 'Run this bookmark on: ' : '이 북마크는 여기서 실행하세요: ') + (site.entry_url || hosts[0] || ''));
    return;
  }
  if (!document.body) return;
  window[KEY]?.destroy();

  // Trusted Types (sites with require-trusted-types-for 'script'): route every innerHTML through a policy
  let TT = null;
  try { if (window.trustedTypes?.createPolicy) TT = window.trustedTypes.createPolicy('demokit-demo-kit', { createHTML: (x) => x }); } catch { TT = null; }
  const setHTML = (el, html) => { el.innerHTML = TT ? TT.createHTML(html) : html; };
  // CSP style-src may block inline style attributes even inside a shadow root; data-style is applied through CSSOM instead
  const applyStyles = (scope) => scope.querySelectorAll('[data-style]').forEach((el) => { el.style.cssText += ';' + el.dataset.style; });

  const T = SPEC.ui_lang === 'en' ? {
    demo: 'DEMO', reset: 'Reset', exit: 'Exit ×', diag: 'Copy diagnostics', later: 'Maybe later', add: '+ Add', added: 'Added ✓', copy: 'Copy', copied: 'Copied ✓',
    submit: 'Submit', thanks: 'Thank you!', spin: 'Spin', view: 'View', armed: 'Armed — move the mouse out of the top of the window',
    wrongPage: (p) => `This scene is for the "${p}" page. Navigate there and click the bookmark again.`,
    ok: 'OK', fail: 'FAIL', noTarget: 'target element not found', reset_done: 'Reset — page restored',
    foot: 'CONCEPT DEMO · fictional visitor conditions · no form submission; images and links may load',
  } : {
    demo: 'DEMO', reset: '초기화', exit: '종료 ×', diag: '진단 복사', later: '지금은 둘러볼게요', add: '+ 담기', added: '담김 ✓', copy: '복사', copied: '복사됨 ✓',
    submit: '보내기', thanks: '감사합니다!', spin: '돌리기', view: '보기', armed: '대기 중 — 마우스를 창 위쪽 밖으로 이동하면 표시됩니다',
    wrongPage: (p) => `이 장면은 "${p}" 페이지용입니다. 그 페이지로 이동한 뒤 북마크를 다시 클릭하세요.`,
    ok: 'OK', fail: 'FAIL', noTarget: '대상 요소를 찾지 못함', reset_done: '초기화 — 페이지 원상 복구',
    foot: 'CONCEPT DEMO · no form submission; images and links may load',
  };

  // ── page detection (site.pages: [{id, match}] regex on path+search)
  function detectPage() {
    if (document.body.dataset.demoPage) return document.body.dataset.demoPage;
    const target = location.pathname + location.search;
    for (const p of site.pages || []) {
      try { if (new RegExp(p.match).test(target)) return p.id; } catch { /* bad regex in spec */ }
    }
    return 'other';
  }
  let page = detectPage();

  // ── helpers
  const SAFE_TAGS = new Set('BR B STRONG EM I SPAN P DIV SMALL H1 H2 H3 UL OL LI SECTION TABLE THEAD TBODY TR TD TH'.split(' '));
  function clean(html) {
    if (html == null) return '';
    const tpl = document.createElement('template');
    setHTML(tpl, String(html));
    tpl.content.querySelectorAll('*').forEach(el => {
      if (!SAFE_TAGS.has(el.tagName)) { el.remove(); return; }
      for (const a of [...el.attributes]) el.removeAttribute(a.name);
    });
    return tpl.innerHTML;
  }
  const text = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cur = site.currency || 'KRW';
  const money = (n) => {
    if (typeof n !== 'number') return text(n);
    try { return new Intl.NumberFormat(cust.lang || 'ko', { style: 'currency', currency: cur, maximumFractionDigits: cur === 'KRW' || cur === 'JPY' ? 0 : 2 }).format(n); }
    catch { return n.toLocaleString(); }
  };
  const fmt = (n) => Number(n).toLocaleString(cust.lang || 'ko');
  function pick(selectors) {
    for (const sel of selectors || []) { try { const el = document.querySelector(sel); if (el) return el; } catch { /* bad selector */ } }
    return null;
  }

  // ── context variables: read from the page (site.readers) with spec.vars fallbacks; used as {{name}} in copy
  const vars = Object.assign({}, SPEC.vars || {});
  for (const [k, sels] of Object.entries(site.readers || {})) {
    const el = pick(sels);
    if (!el) continue;
    const raw = el.textContent.trim().split('\n')[0].trim().slice(0, 60);
    if (/total|price|amount/.test(k)) { const m = raw.replace(/,/g, '').match(/\d+(\.\d+)?/); if (m) vars[k] = Number(m[0]); }
    else vars[k] = raw;
  }
  const fill = (s) => String(s ?? '').replace(/\{\{(\w+)\}\}/g, (m, k) => vars[k] === undefined ? m : (typeof vars[k] === 'number' && /total|price|amount/.test(k) ? money(vars[k]) : vars[k]));
  const num = (k, fallback) => typeof vars[k] === 'number' ? vars[k] : (Number(fallback) || 0);
  const h = (s) => clean(fill(s));

  // ── theme
  const brand = cust.brand_color || '#111111';
  const ink = cust.ink_color || '#1d2430';
  const accent = cust.accent_color || brand;
  const radius = { sharp: '4px', soft: '12px', round: '20px' }[cust.radius] || '16px';
  const font = cust.font || "-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic','Hiragino Sans','Noto Sans JP',sans-serif";
  const previous = document.activeElement;
  const host = document.createElement('div');
  host.id = 'demokit-demo-kit';
  host.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:none!important';
  const root = host.attachShadow({ mode: 'open' });
  const CSS = `
  :host{all:initial;color-scheme:light}*{box-sizing:border-box}[hidden]{display:none!important}
  .bar,.scene,.toast,.stick{pointer-events:auto;font:15px/1.6 ${font};color:${ink}}
  button,a,input{font:inherit}button{cursor:pointer}button:focus-visible,a:focus-visible,input:focus-visible{outline:3px solid #3478f6;outline-offset:3px}
  .bar{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap;width:max-content;max-width:calc(100vw - 24px);padding:11px 14px;background:#1a1f27;color:#fff;border-radius:14px;box-shadow:0 10px 35px #0005}
  .brand{font-size:11px;letter-spacing:1px;margin-right:6px;opacity:.85}
  .bar button{background:#2c3340;color:#fff;border:1px solid #4a5364;border-radius:8px;padding:8px 12px;font-size:13px}
  .bar button[aria-pressed=true]{background:${brand};border-color:${brand}}.bar button.off{opacity:.45}.bar button.util{background:transparent;border-color:#3a4252;color:#cfd5df}
  .backdrop{position:fixed;inset:0;background:#10131a75;pointer-events:auto}
  .scene{position:fixed;right:24px;bottom:105px;width:400px;max-width:calc(100vw - 32px);max-height:calc(100dvh - 130px);overflow:auto;background:#fff;border:1px solid #e9e9e9;border-radius:${radius};box-shadow:0 18px 60px #0004;transform:translateY(20px);opacity:0;transition:transform .4s cubic-bezier(.2,.8,.2,1),opacity .4s}
  .scene.in{transform:none;opacity:1}
  .scene.pos-bl{right:auto;left:24px}.scene.pos-tr{bottom:auto;top:76px;right:20px;transform:translateY(-20px)}.scene.pos-tr.in{transform:none}
  .scene.pos-tc{bottom:auto;top:76px;right:auto;left:50%;transform:translate(-50%,-20px)}.scene.pos-tc.in{transform:translate(-50%,0)}
  .scene.wide{left:50%;right:auto;transform:translate(-50%,20px);width:1000px;border-top:5px solid ${brand}}.scene.wide.in{transform:translate(-50%,0)}
  .wide .body{display:grid;grid-template-columns:1.5fr 1fr;gap:30px;padding:30px 36px}.wide .head{border:0;padding-bottom:0}
  .scene.sheet{left:16px;right:16px;bottom:100px;width:auto;max-width:none}.sheet .row{display:flex;gap:10px}.sheet .row .item{flex:1;margin:0}
  .scene.popup{left:50%;top:45%;right:auto;bottom:auto;transform:translate(-50%,-46%);width:520px;text-align:center;border:0}.scene.popup.in{transform:translate(-50%,-50%)}
  .popup .body{padding:22px 38px}.popup .head{border:0}.popup .cta{border-radius:30px}
  .scene.dark{background:#1f2a2a;color:#fff;border:0}.dark .head{border-color:#ffffff22}.dark .head b,.dark .close,.dark .tag{color:#efce99}.dark p,.dark .later,.dark .note,.dark .sub{color:#dbe5e1}
  .dark .card{background:transparent;border:0;border-top:1px solid #ffffff33;padding:16px 0;margin:20px 0 8px}.dark .card b{color:#efce99}.dark .card span{color:#cfdcd7}.dark .cta{background:#f3d3a1;color:#1f2a2a}.dark .foot{background:#172020;color:#c6d8d2}
  .head{padding:13px 22px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:11px;letter-spacing:1px}.head b{color:${brand}}
  .head.hd-brand{background:linear-gradient(90deg,${brand},${accent});color:#fff;border:0;font-size:13px;letter-spacing:.3px}.hd-brand b,.hd-brand .close{color:#fff}.head .ico{font-size:16px}
  .close{border:0;background:none;font-size:24px;color:#666;line-height:1;margin-left:auto}
  .body{padding:22px 24px}.tag{color:${brand};font-size:11px;font-weight:800;letter-spacing:1.4px}
  h1{font-size:24px;line-height:1.35;letter-spacing:-.8px;margin:10px 0 8px}h1:focus{outline:none}.wide h1,.popup h1{font-size:30px}
  p{font-size:14px;color:#5f6670;margin:6px 0 14px}.sub{font-size:12px;color:#777;margin:4px 0 10px}
  .card{background:#f6f4f1;border-radius:12px;padding:18px;margin:16px 0;border-left:4px solid ${brand}}.card b{display:block;font-size:19px;letter-spacing:-.5px}.card span{display:block;font-size:13px;color:#6f6a64;margin-top:5px}.card small{display:block;font-size:11px;color:#8a8580;letter-spacing:1px}
  .rows{margin:14px 0;border-top:1px solid #e5e8eb;text-align:left}.row{display:flex;justify-content:space-between;gap:16px;border-bottom:1px solid #e5e8eb;padding:9px 0;font-size:13px}.row span{color:#727986}.row b{text-align:right}
  .flow{display:grid;gap:8px;margin:16px 0;text-align:left}.node{border:1px solid #dfe4e9;border-radius:10px;padding:10px 14px}.node small{color:${brand};font-size:10px;letter-spacing:1px;display:block}.node b{display:block}.arrow{text-align:center;color:#8a8f98;font-size:12px}.ok-line{background:${brand}12;border:1px solid ${brand}44;border-radius:10px;padding:10px 12px;font-size:13px;margin-top:10px}
  .cta{display:block;background:${brand};color:#fff;text-align:center;text-decoration:none;border-radius:10px;padding:13px;font-weight:700;border:0;width:100%;cursor:pointer}
  .later{display:block;width:100%;border:0;background:none;color:#666;padding:10px;font-size:13px}
  .foot{background:#f5f5f5;padding:10px 22px;font-size:10px;color:#757575}.note{font-size:10px;color:#8a8a8a;margin-top:12px}
  .symbol{width:56px;height:56px;border-radius:50%;background:${brand}18;color:${brand};display:grid;place-items:center;font-size:30px;margin:0 auto 14px}
  .items{margin:12px 0}.item{display:flex;gap:12px;align-items:center;padding:10px;border:1px solid #eee;border-radius:12px;margin-bottom:8px;text-align:left}
  .item img{width:64px;height:64px;object-fit:cover;border-radius:8px;background:#f2f2f2;flex:none}.item .n{font-size:13px;font-weight:600;line-height:1.3}.item .t{font-size:11px;color:${brand};margin-top:2px}.item .p{font-size:13px;margin-top:2px}
  .item a,.item button.add{margin-left:auto;background:${ink};color:#fff;text-decoration:none;border:0;border-radius:99px;padding:8px 12px;font-size:12px;white-space:nowrap;cursor:pointer}.item button.add.ok{background:#1f9d55}
  .stats{display:flex;gap:10px;margin:12px 0}.stat{flex:1;background:${brand}10;border:1px solid ${brand}33;border-radius:10px;padding:10px 12px}.stat em{font-style:normal;font-size:26px;font-weight:800;color:${brand};line-height:1;display:block}.stat span{font-size:11px;color:#666}
  .pill{display:inline-block;background:${brand};color:#fff;font-size:11.5px;font-weight:700;border-radius:99px;padding:4px 12px;margin:4px 0}
  .stick{position:fixed;top:0;left:0;right:0;display:flex;gap:12px;align-items:center;justify-content:center;padding:10px 44px 10px 18px;background:linear-gradient(90deg,${brand},${accent});color:#fff;font-size:14px;box-shadow:0 4px 18px #0003}
  .stick.bottom{top:auto;bottom:0}.stick .ico{font-size:18px}.stick a,.stick button.go{color:#fff;background:#ffffff22;border:1px solid #ffffff66;border-radius:99px;padding:5px 14px;text-decoration:none;font-size:13px;cursor:pointer}.stick .close{color:#fff;position:absolute;right:12px;top:6px}
  .stick .prog{width:160px;height:8px;background:#ffffff44;border-radius:99px;overflow:hidden}.stick .prog i{display:block;height:100%;background:#fff;width:0;transition:width 1.2s cubic-bezier(.2,.8,.2,1)}
  .bar2{height:12px;background:#eee;border-radius:99px;overflow:hidden;margin:8px 0 6px;position:relative}.bar2 i{display:block;height:100%;background:linear-gradient(90deg,${brand},${accent});width:0;transition:width 1.4s cubic-bezier(.2,.8,.2,1)}
  .bar2 .proj{position:absolute;top:0;height:100%;width:0;transition:width 1.4s cubic-bezier(.2,.8,.2,1);background:repeating-linear-gradient(45deg,${accent}88,${accent}88 6px,${accent}44 6px,${accent}44 12px);border-left:2px solid #fff}
  .nums{display:flex;justify-content:space-between;font-size:11px;color:#888}.gain{font-size:13px;margin:10px 0 4px}.up{display:none;background:${brand}14;border:1px solid ${brand}44;border-radius:10px;padding:10px 12px;font-size:13px;margin-top:8px}
  .clock{display:flex;gap:8px;justify-content:center;margin:12px 0}.clock b{background:${ink};color:#fff;border-radius:8px;padding:8px 10px;font-size:22px;min-width:52px;text-align:center;font-variant-numeric:tabular-nums}.clock b small{display:block;font-size:9px;font-weight:400;opacity:.7;letter-spacing:1px}
  .code{display:flex;gap:8px;align-items:center;justify-content:center;margin:12px 0}.code span{border:2px dashed ${brand};color:${brand};font-weight:800;letter-spacing:2px;padding:10px 16px;border-radius:8px;font-size:18px}.code button{background:${ink};color:#fff;border:0;border-radius:8px;padding:10px 14px}
  .field{display:flex;gap:8px;margin:12px 0}.field input{flex:1;border:1px solid #ccc;border-radius:8px;padding:11px 12px;font-size:14px}.field button{background:${brand};color:#fff;border:0;border-radius:8px;padding:0 16px;font-weight:700}
  .opts{display:grid;gap:8px;margin:12px 0}.opts button{border:1px solid #ddd;background:#fff;border-radius:10px;padding:11px;text-align:left;font-size:14px}.opts button:hover{border-color:${brand}}.opts button.on{background:${brand};color:#fff;border-color:${brand}}
  .wheel{width:220px;height:220px;border-radius:50%;margin:12px auto;position:relative;border:6px solid ${ink};transition:transform 3.2s cubic-bezier(.15,.85,.2,1)}
  .wheel span{position:absolute;transform:translate(-50%,-50%);font-size:11px;font-weight:700;color:#fff;white-space:nowrap;text-shadow:0 1px 2px #0006}
  .pin{width:0;height:0;border-left:10px solid transparent;border-right:10px solid transparent;border-top:22px solid ${brand};margin:0 auto -14px;position:relative;z-index:1}
  .toast{position:fixed;left:50%;bottom:80px;transform:translateX(-50%);background:#111;color:#fff;font-size:12px;padding:8px 14px;border-radius:99px;opacity:0;transition:opacity .25s;white-space:nowrap;max-width:calc(100vw - 40px);overflow:hidden;text-overflow:ellipsis}
  .toast.in{opacity:.95}.toast.bad{background:#b3261e}
  @media(max-width:600px){.bar{bottom:8px;width:calc(100vw - 16px);padding:8px;gap:5px}.brand{width:100%;text-align:center}.bar button{font-size:11px;padding:7px}
    .scene,.scene.wide,.scene.popup,.scene.sheet{right:16px;left:16px;width:auto;top:auto;bottom:115px;transform:none;max-height:calc(100dvh - 135px)}.wide .body{display:block;padding:20px}.body{padding:18px}h1{font-size:22px}.sheet .row{display:block}}
  `;
  const MARKUP = `<div class="backdrop" hidden></div><nav class="bar" aria-label="demo panel"></nav><section class="scene" role="region" hidden></section><div class="stick" hidden></div><div class="toast" role="status"></div>`;
  let styleMode = 'adopted';
  try { const sheet = new CSSStyleSheet(); sheet.replaceSync(CSS); root.adoptedStyleSheets = [sheet]; setHTML(root, MARKUP); }
  catch { styleMode = 'inline'; setHTML(root, `<style>${CSS}</style>` + MARKUP); }

  const $ = (s) => root.querySelector(s);
  const bar = $('.bar'), scene = $('.scene'), stick = $('.stick'), backdrop = $('.backdrop'), toastEl = $('.toast');
  const scenes = SPEC.scenes || [];
  const status = {};
  const state = { added: [] };
  let selected = -1, toastTimer, ticker = null, exitHandler = null, bodyPad = null;
  function toast(msg, bad) {
    toastEl.textContent = msg; toastEl.classList.toggle('bad', !!bad); toastEl.classList.add('in');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('in'), bad ? 4000 : 1800);
  }

  // ── page edits (saved for restore)
  const edits = [];
  function save(el) {
    if (edits.some(e => e.el === el)) return;
    const nodes = [];
    const walk = node => { nodes.push({node, children: [...node.childNodes], value: node.nodeValue}); [...node.childNodes].forEach(walk); };
    walk(el);
    edits.push({el, nodes, cls: el.getAttribute('class'), style: el.getAttribute('style')});
  }
  function restoreEdits() {
    while (edits.length) {
      const e = edits.pop();
      if (!e.el.isConnected) continue;
      // Restore the same nodes, including listeners; does not roll back application state.
      for (const saved of [...e.nodes].reverse()) {
        if (saved.node.nodeType !== Node.ELEMENT_NODE) saved.node.nodeValue = saved.value;
        else saved.node.replaceChildren(...saved.children);
      }
      for (const [name,value] of [['class',e.cls],['style',e.style]]) {
        if (value == null) e.el.removeAttribute(name); else e.el.setAttribute(name,value);
      }
    }
    if (bodyPad != null) { document.body.style.paddingTop = bodyPad; bodyPad = null; }
  }
  function setText(el, value) {
    // Replace the visible text but keep child elements (icons, loaders) that the site's own scripts may depend on
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = []; let n;
    while ((n = walker.nextNode())) { if (n.nodeValue.trim()) nodes.push(n); }
    if (!nodes.length) { el.textContent = value; return; }
    nodes.sort((a, b) => b.nodeValue.trim().length - a.nodeValue.trim().length);
    nodes[0].nodeValue = value;
    nodes.slice(1).forEach((x) => { x.nodeValue = ''; });
  }
  function applyTarget(t) {
    const el = pick(t.selectors); if (!el) return false;
    save(el);
    if (t.html != null) setHTML(el, clean(fill(t.html)));
    else if (t.text != null) setText(el, fill(t.text));
    if (t.style) el.style.cssText += ';' + t.style;
    if (t.badge) { const b = document.createElement('span'); b.textContent = fill(t.badge); b.style.cssText = `display:inline-block;margin-left:8px;padding:2px 9px;border-radius:99px;background:${brand};color:#fff;font-size:11px;font-weight:700;vertical-align:middle;${t.badge_style || ''}`; el.appendChild(b); }
    if (t.highlight !== false && (t.style || t.html != null || t.text != null)) el.style.outline = `2px dashed ${brand}88`;
    return true;
  }
  function bumpNumber(selectors, delta, asMoney) {
    const el = pick(selectors); if (!el) return;
    save(el);
    const v = parseFloat(el.textContent.replace(/[^\d.]/g, '')) || 0;
    el.textContent = asMoney ? money(v + delta) : String(v + delta);
  }

  // ── building blocks
  const foot = () => `<footer class="foot">${text(SPEC.meeting?.disclaimer || T.foot)}</footer>`;
  const head = (d) => `<div class="head ${d.head_style === 'brand' ? 'hd-brand' : ''}">${d.icon && d.head_style === 'brand' ? `<span class="ico">${text(d.icon)}</span>` : ''}<b>${h(d.header || cust.name || '')}</b><button class="close" data-action="hide" aria-label="close">×</button></div>`;
  const intro = (d) => `${d.icon && d.head_style !== 'brand' ? `<div class="symbol" aria-hidden="true">${text(d.icon)}</div>` : ''}${d.copy?.eyebrow ? `<span class="tag">${h(d.copy.eyebrow)}</span>` : ''}${d.copy?.title ? `<h1 tabindex="-1">${h(d.copy.title)}</h1>` : ''}${d.copy?.body ? `<p>${h(d.copy.body)}</p>` : ''}`;
  const cardBlock = (d) => (d.card ? `<div class="card">${d.card.eyebrow ? `<small>${h(d.card.eyebrow)}</small>` : ''}<b>${h(d.card.title)}</b><span>${h(d.card.detail)}</span></div>` : '') + (d.rows?.length ? `<div class="rows">${d.rows.map(([k, v]) => `<div class="row"><span>${h(k)}</span><b>${h(v)}</b></div>`).join('')}</div>` : '');
  const ctaBlock = (d) => `${d.cta_scene && d.copy?.cta ? `<button class="cta" data-goto="${text(d.cta_scene)}">${h(d.copy.cta)} →</button>` : d.cta_url && d.copy?.cta ? `<a class="cta" href="${text(d.cta_url)}">${h(d.copy.cta)} →</a>` : ''}${d.copy?.later !== '' ? `<button class="later" data-action="hide">${text(d.copy?.later || T.later)}</button>` : ''}${d.note ? `<div class="note">${h(d.note)}</div>` : ''}`;
  const items = (d, addable) => `<div class="items ${d.layout === 'sheet' ? 'row' : ''}">${(d.products || []).map((p, i) => `<div class="item" data-i="${i}"><img src="${text(p.img || '')}" alt=""><div><div class="n">${h(p.name)}</div>${p.tag ? `<div class="t">${h(p.tag)}</div>` : ''}<div class="p">${money(p.price)}</div></div>${addable ? `<button class="add">${text(d.copy?.item_cta || T.add)}</button>` : (p.url ? `<a href="${text(p.url)}">${text(d.copy?.item_cta || T.view)}</a>` : '')}</div>`).join('')}</div>`;
  const stats = (d) => `<div class="stats">${(d.stats || []).map((s) => `<div class="stat"><em>${text(s.value)}</em><span>${h(s.label)}</span></div>`).join('')}</div>${d.stock_line ? `<span class="pill">${h(d.stock_line)}</span>` : ''}`;
  const cls = (d, extra) => [extra || '', d.layout === 'wide' ? 'wide' : '', d.layout === 'sheet' ? 'sheet' : '', d.theme === 'dark' ? 'dark' : '', d.position ? 'pos-' + d.position : ''].join(' ');
  const wrap = (d, inner, extra) => ({ className: cls(d, extra), html: head(d) + `<div class="body">${inner}</div>` + foot() });
  const orderTotal = (d) => num(d.total_var || 'cart_total', d.order_total) + state.added.reduce((s, p) => s + (Number(p.price) || 0), 0);
  function sticky(d, inner, bottom) {
    stick.className = 'stick ' + (bottom || d.position === 'bottom' ? 'bottom' : '');
    setHTML(stick, `${d.icon ? `<span class="ico">${text(d.icon)}</span>` : ''}${inner}<button class="close" data-action="hide" aria-label="close">×</button>`);
    applyStyles(stick); stick.hidden = false;
    if (d.push_body && !bottom && d.position !== 'bottom') { if (bodyPad == null) bodyPad = document.body.style.paddingTop; document.body.style.paddingTop = '44px'; }
  }
  function clock(d) {
    const end = Date.now() + (Number(d.ends_in_minutes) || 30) * 60000;
    const tick = () => {
      const left = Math.max(0, end - Date.now());
      const hh = Math.floor(left / 3600000), mm = Math.floor(left / 60000) % 60, ss = Math.floor(left / 1000) % 60;
      root.querySelectorAll('[data-clock]').forEach((el) => { setHTML(el, `<b>${String(hh).padStart(2, '0')}<small>HRS</small></b><b>${String(mm).padStart(2, '0')}<small>MIN</small></b><b>${String(ss).padStart(2, '0')}<small>SEC</small></b>`); });
      root.querySelectorAll('[data-clock-inline]').forEach((el) => { el.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`; });
    };
    clearInterval(ticker); tick(); ticker = setInterval(tick, 1000);
  }
  const grow = (rootEl) => setTimeout(() => rootEl.querySelectorAll('[data-w]').forEach((el) => { el.style.width = el.dataset.w + '%'; }), 120);
  const thanks = (d) => { setHTML(scene.querySelector('.body'), `<div class="symbol">✓</div><h1>${h(d.copy?.thanks || T.thanks)}</h1>${d.copy?.thanks_body ? `<p>${h(d.copy.thanks_body)}</p>` : ''}<div class="note">${T.foot}</div>`); };
  const modal = (d) => { if (d.layout === 'popup') { backdrop.hidden = false; return 'popup'; } return ''; };

  // ── presets
  const R = {
    banner(d) {
      const body = d.layout === 'wide' ? `<div>${intro(d)}</div><div>${cardBlock(d)}${items(d)}${ctaBlock(d)}</div>` : intro(d) + cardBlock(d) + items(d) + ctaBlock(d);
      return wrap(d, body);
    },
    popup(d) { backdrop.hidden = false; return wrap(d, intro(d) + cardBlock(d) + items(d) + ctaBlock(d), 'popup'); },
    sticky_bar(d) {
      sticky(d, `<span>${h(d.copy?.title)}</span>${d.cta_url && d.copy?.cta ? `<a href="${text(d.cta_url)}">${h(d.copy.cta)}</a>` : ''}`);
      return { silent: true };
    },
    inline_edit(d) {
      const found = (d.targets || []).filter(applyTarget).length;
      if (!found) return { silent: true, ok: false, reason: T.noTarget + ' ' + JSON.stringify((d.targets || []).map((t) => t.selectors)) };
      if (d.copy?.title) return wrap(Object.assign({ position: 'tr' }, d), intro(d) + ctaBlock(d));
      return { silent: true };
    },
    reco_card(d) {
      const r = wrap(d, intro(d) + items(d, d.addable) + ctaBlock(d));
      r.ok = (d.products || []).length > 0; r.reason = 'products[] empty';
      r.after = () => scene.querySelectorAll('button.add').forEach((b) => b.addEventListener('click', () => {
        const p = d.products[Number(b.closest('.item').dataset.i)];
        state.added.push(p); b.textContent = T.added; b.classList.add('ok'); b.disabled = true;
        if (d.bump?.qty_selectors) bumpNumber(d.bump.qty_selectors, 1, false);
        if (d.bump?.total_selectors) bumpNumber(d.bump.total_selectors, Number(p.price) || 0, true);
        toast(`${T.added} ${p.name}`);
      }));
      return r;
    },
    social_proof(d) {
      const r = wrap(Object.assign({ head_style: 'brand' }, d), intro(d) + stats(d) + ctaBlock(d));
      r.ok = (d.stats || []).length > 0; r.reason = 'stats[] empty'; return r;
    },
    tier_progress(d) {
      const t = d.tier || {};
      const total = orderTotal(d);
      const gain = Math.round(total * (Number(t.rate) || 0));
      const ytd = Number(t.ytd) || 0, nextAt = Number(t.next_at) || 1;
      const before = Math.min(100, Math.round(ytd / nextAt * 100)), after = Math.min(100, Math.round((ytd + gain) / nextAt * 100));
      const up = ytd + gain >= nextAt;
      Object.assign(vars, { tier_now: t.now, tier_next: t.next, tier_gain: fmt(gain), tier_ytd: fmt(ytd), tier_next_at: fmt(nextAt), order_total: money(total), tier_rate: Math.round((t.rate || 0) * 100) + '%' });
      const inner = intro(d) +
        `<div class="bar2"><i data-w="${before}"></i><span class="proj" data-style="left:${before}%" data-w="${Math.max(0, after - before)}"></span></div>
        <div class="nums"><span>${text(t.now)}</span><span>${text(t.next)} · ${fmt(nextAt)}${text(t.unit || 'pt')}</span></div>
        <div class="gain">${h(d.copy?.gain_line || '')}</div>
        <div class="up" ${up ? 'data-style="display:block"' : ''}>${h(d.copy?.up_line || '')}</div>` + ctaBlock(d);
      const r = wrap(Object.assign({ head_style: 'brand', position: 'tr' }, d), inner);
      r.after = () => grow(scene);
      return r;
    },
    countdown(d) {
      if (d.as === 'sticky') {
        sticky(d, `<span>${h(d.copy?.title)}</span><b data-clock-inline data-style="font-variant-numeric:tabular-nums"></b>${d.cta_url && d.copy?.cta ? `<a href="${text(d.cta_url)}">${h(d.copy.cta)}</a>` : ''}`);
        clock(d); return { silent: true };
      }
      const r = wrap(d, intro(d) + `<div class="clock" data-clock></div>` + cardBlock(d) + ctaBlock(d), modal(d));
      r.after = () => clock(d); return r;
    },
    free_shipping_bar(d) {
      const th = Number(d.threshold) || 1, now = orderTotal(d), left = Math.max(0, th - now), pct = Math.min(100, Math.round(now / th * 100));
      Object.assign(vars, { remaining: money(left), threshold: money(th), current_total: money(now) });
      const line = left > 0 ? h(d.copy?.title) : h(d.copy?.done_line || d.copy?.title);
      if (d.as !== 'card') {
        sticky(d, `<span>${line}</span><span class="prog"><i data-w="${pct}"></i></span>${d.cta_url && d.copy?.cta ? `<a href="${text(d.cta_url)}">${h(d.copy.cta)}</a>` : ''}`);
        grow(stick); return { silent: true };
      }
      const r = wrap(d, `${d.copy?.eyebrow ? `<span class="tag">${h(d.copy.eyebrow)}</span>` : ''}<h1 tabindex="-1">${line}</h1><div class="bar2"><i data-w="${pct}"></i></div><div class="nums"><span>${money(now)}</span><span>${money(th)}</span></div>` + ctaBlock(d));
      r.after = () => grow(scene); return r;
    },
    coupon(d) {
      const r = wrap(d, intro(d) + `<div class="code"><span>${text(d.code || 'WELCOME10')}</span><button class="cp">${T.copy}</button></div>` + cardBlock(d) + ctaBlock(d), modal(d));
      r.after = () => { const b = scene.querySelector('.cp'); b.addEventListener('click', () => { navigator.clipboard?.writeText(d.code || '').catch(() => {}); b.textContent = T.copied; }); };
      return r;
    },
    exit_intent(d) {
      const open = () => { backdrop.hidden = false; scene.className = 'scene ' + cls(d, 'popup'); setHTML(scene, head(d) + `<div class="body">${intro(d)}${cardBlock(d)}${ctaBlock(d)}</div>` + foot()); applyStyles(scene); scene.hidden = false; requestAnimationFrame(() => scene.classList.add('in')); };
      if (d.trigger === 'immediate' || exitHandler) { if (exitHandler) { document.removeEventListener('mouseleave', exitHandler); exitHandler = null; } open(); return { silent: true }; }
      exitHandler = (e) => { if (e.clientY <= 0) { document.removeEventListener('mouseleave', exitHandler); exitHandler = null; open(); } };
      document.addEventListener('mouseleave', exitHandler);
      return { silent: true, msg: T.armed };
    },
    lead_form(d) {
      const r = wrap(d, intro(d) + `<div class="field"><input type="${text(d.field_type || 'email')}" placeholder="${text(d.placeholder || 'you@example.com')}" aria-label="input"><button class="go">${text(d.copy?.cta || T.submit)}</button></div>${d.consent ? `<div class="sub">${h(d.consent)}</div>` : ''}${d.note ? `<div class="note">${h(d.note)}</div>` : ''}`, modal(d));
      r.after = () => scene.querySelector('.go').addEventListener('click', () => thanks(d));
      return r;
    },
    survey(d) {
      const r = wrap(d, intro(d) + `<div class="opts">${(d.options || []).map((o) => `<button>${h(o)}</button>`).join('')}</div>${d.note ? `<div class="note">${h(d.note)}</div>` : ''}`, modal(d));
      r.ok = (d.options || []).length > 0; r.reason = 'options[] empty';
      r.after = () => scene.querySelectorAll('.opts button').forEach((b) => b.addEventListener('click', () => { b.classList.add('on'); setTimeout(() => thanks(d), 500); }));
      return r;
    },
    spin_to_win(d) {
      const segs = d.segments || ['5%', '10%', 'FREE SHIP', '15%', 'GIFT', '20%'];
      const n = segs.length, step = 360 / n;
      const grad = segs.map((s, i) => `${i % 2 ? accent : brand} ${i * step}deg ${(i + 1) * step}deg`).join(',');
      const labels = segs.map((s, i) => { const a = (i * step + step / 2) * Math.PI / 180; return `<span data-style="left:${(50 + 33 * Math.sin(a)).toFixed(1)}%;top:${(50 - 33 * Math.cos(a)).toFixed(1)}%">${text(s)}</span>`; }).join('');
      const r = wrap(d, intro(d) + `<div class="pin"></div><div class="wheel" data-style="background:conic-gradient(${grad})">${labels}</div><button class="cta go">${text(d.copy?.cta || T.spin)}</button>${d.note ? `<div class="note">${h(d.note)}</div>` : ''}`, 'popup');
      backdrop.hidden = false;
      r.after = () => { const w = scene.querySelector('.wheel'), b = scene.querySelector('.go'); b.addEventListener('click', () => {
        const win = Math.min(n - 1, Number(d.win_index) || 0); b.disabled = true;
        w.style.transform = `rotate(${360 * 5 - (win * step + step / 2)}deg)`;
        setTimeout(() => { setHTML(scene.querySelector('.body'), `<div class="symbol">🎉</div><h1>${h(d.copy?.win_title || segs[win])}</h1>${d.code ? `<div class="code"><span>${text(d.code)}</span></div>` : ''}${d.copy?.win_body ? `<p>${h(d.copy.win_body)}</p>` : ''}${ctaBlock(d)}`); }, 3400);
      }); };
      return r;
    },
    custom(d) { const r = wrap(d, `<div data-style="grid-column:1/-1">${clean(fill(d.customHtml))}</div>`, modal(d)); r.ok = !!d.customHtml; r.reason = 'customHtml empty'; return r; },
  };

  function hide() {
    scene.hidden = true; scene.classList.remove('in'); backdrop.hidden = true; stick.hidden = true;
    clearInterval(ticker); ticker = null;
    if (bodyPad != null) { document.body.style.paddingTop = bodyPad; bodyPad = null; }
    if (selected >= 0) $(`[data-scene="${selected}"]`)?.focus();
  }
  function reset() {
    hide(); restoreEdits(); state.added = []; selected = -1;
    if (exitHandler) { document.removeEventListener('mouseleave', exitHandler); exitHandler = null; }
    root.querySelectorAll('[data-scene]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
    toast(T.reset_done);
  }
  function show(i) {
    const d = scenes[i]; if (!d) return;
    if (d.page && d.page !== 'any' && d.page !== page) { toast(T.wrongPage(d.page), true); return; }
    hide(); if (!d.keep_edits) restoreEdits(); selected = i;
    root.querySelectorAll('[data-scene]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.scene) === i)));
    const r = R[d.pattern] || R.banner;
    let out;
    try { out = r(d); } catch (e) { status[d.id] = 'FAIL: ' + e.message; toast(`${d.label}: ${T.fail} ${e.message}`, true); return; }
    if (!out.silent) {
      scene.className = 'scene ' + (out.className || '');
      setHTML(scene, out.html); applyStyles(scene); scene.hidden = false; scene.scrollTop = 0;
      scene.querySelectorAll('img').forEach((im) => im.addEventListener('error', () => { im.style.visibility = 'hidden'; }));
      requestAnimationFrame(() => scene.classList.add('in'));
      scene.querySelector('h1')?.focus({ preventScroll: true });
    }
    if (out.after) out.after();
    const ok = out.ok !== false;
    status[d.id] = ok ? 'OK' : 'FAIL: ' + out.reason;
    toast(out.msg || `${d.label}: ${ok ? T.ok : T.fail + ' · ' + out.reason}`, !ok);
  }
  function report() {
    return { shell: VER, url: location.href, page, style_mode: styleMode, trusted_types: !!TT, vars, ua: navigator.userAgent, scenes: scenes.map((s) => ({ id: s.id, page: s.page, pattern: s.pattern, status: status[s.id] || 'not run' })) };
  }
  async function copyDiag() {
    const j = JSON.stringify(report(), null, 2);
    try { await navigator.clipboard.writeText(j); toast(T.diag + ' ✓'); } catch { console.log(j); toast('console'); }
  }
  function buildBar() {
    setHTML(bar, `<span class="brand">${text((cust.name || '').toUpperCase())} × DEMO KIT · ${T.demo}</span>` +
      scenes.map((s, i) => s.hidden ? '' : `<button data-scene="${i}" aria-pressed="false" class="${s.page && s.page !== 'any' && s.page !== page ? 'off' : ''}" title="${text(s.page || 'any')} · ${text(s.pattern)}">${text(s.label)}</button>`).join('') +
      `<button class="util" data-action="reset">${T.reset}</button><button class="util" data-action="diag">${T.diag}</button><button class="util" data-action="destroy">${T.exit}</button>`);
  }
  function onKey(e) {
    if (e.key === 'Escape') { hide(); return; }
    if (e.composedPath().some((el) => el.tagName && /INPUT|TEXTAREA|SELECT/.test(el.tagName))) return;
    const n = Number(e.key);
    if (n >= 1 && n <= 9 && scenes[n - 1]) show(n - 1);
  }
  function destroy() {
    hide(); restoreEdits(); document.removeEventListener('keydown', onKey); observer.disconnect();
    if (exitHandler) document.removeEventListener('mouseleave', exitHandler);
    history.pushState = origPush; history.replaceState = origReplace;
    window.removeEventListener('popstate', onRoute); window.removeEventListener('hashchange', onRoute);
    host.remove(); delete window[KEY];
    if (previous?.isConnected) previous.focus({ preventScroll: true });
  }

  // ── SPA support: keep host mounted, re-detect page on route change
  const observer = new MutationObserver(() => { if (!host.isConnected && document.body) document.body.appendChild(host); });
  const origPush = history.pushState, origReplace = history.replaceState;
  function onRoute() { setTimeout(() => { const p = detectPage(); if (p !== page) { page = p; hide(); restoreEdits(); buildBar(); toast('page: ' + page); } }, 400); }
  history.pushState = function () { origPush.apply(this, arguments); onRoute(); };
  history.replaceState = function () { origReplace.apply(this, arguments); onRoute(); };
  window.addEventListener('popstate', onRoute); window.addEventListener('hashchange', onRoute);

  root.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.scene !== undefined) show(Number(b.dataset.scene));
    else if (b.dataset.goto) { const i = scenes.findIndex((x) => x.id === b.dataset.goto); if (i >= 0) show(i); }
    else if (b.dataset.action === 'hide') hide();
    else if (b.dataset.action === 'reset') reset();
    else if (b.dataset.action === 'diag') copyDiag();
    else if (b.dataset.action === 'destroy') destroy();
  });
  backdrop.addEventListener('click', hide);
  document.addEventListener('keydown', onKey);
  buildBar();
  document.body.appendChild(host);
  observer.observe(document.documentElement, { childList: true });
  window[KEY] = { destroy, show, reset, report, spec: SPEC, state };
  toast(`${VER} · ${cust.name || ''} · page: ${page}${styleMode === 'inline' ? ' · inline css' : ''}`);
})();
