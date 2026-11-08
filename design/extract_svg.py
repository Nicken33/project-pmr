import re, base64
s=open(r'D:\CyberSprint\TDS.svg',encoding='utf-8',errors='ignore').read()
for i,m in enumerate(re.finditer(r'<image id="(image\d+_0_1)" width="(\d+)" height="(\d+)"[^>]*xlink:href="data:image/(png|jpeg);base64,([A-Za-z0-9+/=]+)"', s)):
    name,w,h,ext,b=m.groups()
    data=base64.b64decode(b)
    out=rf'D:\CyberSprint\design\{name}.{ext}'
    open(out,'wb').write(data)
    print(name,w,h,len(data),out)
