#!/usr/bin/env python3
"""Build standalone browser tools using only the Python standard library."""
import json
import re
from pathlib import Path
ROOT = Path(__file__).resolve().parent
DIST = ROOT / 'dist'
def embed(value):
    return json.dumps(value, ensure_ascii=False).replace('<', '\\u003c')
def build():
    DIST.mkdir(exist_ok=True)
    shell = re.sub(r'^/\*.*?\*/', '', (ROOT/'shell/shell.js').read_text(), count=1, flags=re.S)
    scan = (ROOT/'scan/scan.js').read_text().replace('__LANG__', 'en')
    assert '</script' not in shell.lower() and '</script' not in scan.lower()
    builder = (ROOT/'builder_template.html').read_text().replace('__SHELL__', shell)
    scanner = (ROOT/'scan_template.html').read_text().replace('__SCAN__', scan)
    spec = json.loads((ROOT/'examples/northstar.spec.json').read_text())
    evidence = json.loads((ROOT/'examples/northstar.scan.json').read_text())
    kit = builder.replace('<script id="embedded-spec" type="application/json">__SPEC__</script>', '<script id="embedded-spec" type="application/json">'+embed(spec)+'</script>')
    kit = kit.replace('<script id="embedded-scan" type="application/json">null</script>', '<script id="embedded-scan" type="application/json">'+embed(evidence)+'</script>')
    playground = (ROOT/'examples/storefront.html').read_text().replace('__DEMO__',shell.replace('__SPEC__',embed(spec),1)).replace('__SCAN__',scan)
    for name, content in [('KIT_BUILDER.html',builder),('SITE_SCAN_KIT.html',scanner),('NORTHSTAR_DEMO_KIT.html',kit),('PLAYGROUND.html',playground)]:
        (DIST/name).write_text(content)
        print('Built',name)
if __name__ == '__main__': build()
