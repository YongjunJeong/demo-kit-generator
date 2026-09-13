"""Local-only source/package checks. Does not run a browser or contact a model."""
import ast
import json
import subprocess
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
for p in ROOT.rglob('*.py'):
    ast.parse(p.read_text(), filename=str(p))
for p in ROOT.rglob('*.json'):
    json.loads(p.read_text())
for p in [ROOT/'shell/shell.js', ROOT/'scan/scan.js', ROOT/'tests/checks.js']:
    subprocess.run(['node', '--check', str(p)], check=True)
for p in ROOT.rglob('*'):
    if not p.is_file() or p.suffix not in {'.md','.html','.js','.py','.json'}: continue
    text = p.read_text()
    for token in ['usecaselibrary.insiderone.com','/Users/','/home/oai/','UNIQLO','SKECHERS','Kobue','SLACK_POST']:
        if p.name != 'check_release.py': assert token not in text, (p, token)
assert not (ROOT/'kb').exists()
print('PASS: source syntax, JSON parsing and public-file checks')
