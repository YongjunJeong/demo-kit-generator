'use strict';
document.querySelector('#run').onclick = async function () {
  this.disabled = true;
  const out = document.querySelector('#results'); out.textContent = '';
  let count = 0;
  const check = (ok,msg) => { if (!ok) throw Error(msg); out.textContent += 'PASS · '+msg+'\n'; count++; };
  const frame = async url => { const f=document.createElement('iframe'); const ready=new Promise((resolve,reject)=>{f.onload=resolve; f.onerror=reject}); f.src=url; document.querySelector('#frames').append(f); await ready; return f; };
  document.querySelector('#frames').replaceChildren();
  try {
    sessionStorage.removeItem('__kit_recon');
    const spec = await (await fetch('../examples/northstar.spec.json')).json();
    const scan = await (await fetch('../examples/northstar.scan.json')).json();
    const b = await frame('../dist/KIT_BUILDER.html'); const d=b.contentDocument;
    const build = value => {d.querySelector('#spec').value=JSON.stringify(value);d.querySelector('#build').click();return d.querySelector('#msgs').textContent;};
    check(build(spec).includes('Original scan required'), 'Missing original scan blocks generation');
    d.querySelector('#recon').value=JSON.stringify(scan); d.querySelector('#read-recon').click();
    check(!build(spec).includes('✕')&&!d.querySelector('#kit').hidden, 'Synthetic example builds from source evidence');
    const wrong=structuredClone(spec);wrong.scenes[0].cta_url='https://unseen.example/';
    check(build(wrong).includes('✕'), 'Unscanned URL rejected');
    const selector=structuredClone(spec);selector.scenes[1].targets[0].selectors=['#invented'];
    check(build(selector).includes('✕'), 'Invented selector rejected');
    const html=structuredClone(spec);html.scenes[0].copy.body='<img src="https://unseen.example/pixel">';
    check(build(html).includes('✕'), 'Resource-bearing rich HTML rejected');
    const css=structuredClone(spec);css.scenes[1].targets[0].style='background:url(https://unseen.example/pixel)';
    check(build(css).includes('✕'), 'CSS resource loading rejected');
    check(!build(spec).includes('✕'), 'Valid example rebuilds after errors');
    check(d.querySelector('#bm').href.startsWith('javascript:'), 'Bookmarklet generated');
    const f=await frame('../dist/PLAYGROUND.html');const w=f.contentWindow;const p=f.contentDocument;
    const original=p.querySelector('#original-title'); const heading=p.querySelector('#hero-title');
    p.querySelector('#launch').click();
    check(!!w.__demokitDemoKit, 'Demo mounts on local storefront');
    w.__demokitDemoKit.show(1);
    check(heading.textContent.includes('Make room'), 'Inline personalization changes heading');
    w.__demokitDemoKit.reset();
    check(p.querySelector('#original-title')===original && heading.textContent==='Good days start outside.', 'Reset preserves original node identity and text');
    original.click();check(p.querySelector('#click-count').textContent.endsWith('1'), 'Original child listener survives reset');
    w.__demokitDemoKit.show(0);check(w.__demokitDemoKit.report().scenes[0].status==='OK', 'Return-visitor scene renders');
    w.__demokitDemoKit.show(2);check(w.__demokitDemoKit.report().scenes[2].status==='OK', 'Owner scene renders');
    p.querySelector('#launch').click();check(p.querySelectorAll('#demokit-demo-kit').length===1, 'Relaunch maintains one host');
    w.__demokitDemoKit.destroy();check(!p.querySelector('#demokit-demo-kit')&&!w.__demokitDemoKit, 'Exit removes host and handle');
    p.querySelector('#scan').click();
    check(!!w.__demokitSiteScan, 'Scanner mounts on the fictional store');
    check(w.__demokitSiteScan.merged().pages.length > 0, 'Scanner produces page evidence');
    w.__demokitSiteScan.destroy();
    check(!p.querySelector('#demokit-site-scan'), 'Scanner panel cleanup');
    out.textContent += '\n'+count+' checks passed.';
  } catch(e) {out.textContent+='FAIL · '+e.message+'\n';}
  finally {this.disabled=false;}
};
