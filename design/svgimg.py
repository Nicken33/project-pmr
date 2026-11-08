import re
s=open(r'D:\CyberSprint\TDS.svg',encoding='utf-8',errors='ignore').read()
print('images', s.count('<image'))
for m in re.finditer(r'<pattern[^>]*id="pattern3[^"]*"[^>]*>(.*?)</pattern>', s, re.S):
    print(m.group(0)[:1000])
for m in re.finditer(r'<image[^>]+>', s):
    print(m.group(0)[:300])
