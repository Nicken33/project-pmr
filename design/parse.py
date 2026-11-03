import re, base64, os
p = r'D:\CyberSprint\Talentro_Filters интерактив.html'
s = open(p, encoding='utf-8', errors='ignore').read()
print('data uris', len(re.findall(r'data:image/[^;"\')]+', s)))
for i,m in enumerate(re.finditer(r'data:image/(png|jpeg|webp|svg\+xml);base64,([A-Za-z0-9+/=]+)', s)):
    data = base64.b64decode(m.group(2))
    ext = m.group(1).replace('svg+xml','svg')
    out = rf'D:\CyberSprint\design\embedded_{i}.{ext}'
    open(out,'wb').write(data)
    print(i, ext, len(data), out)
print('img srcs:')
for m in re.finditer(r'<img[^>]+src="([^"]+)"', s):
    print(m.group(1)[:120])
print('urls:')
for m in re.finditer(r'url\((["\']?)([^)"\']+)\1\)', s):
    u=m.group(2)
    if not u.startswith('data:'): print(u[:120])
