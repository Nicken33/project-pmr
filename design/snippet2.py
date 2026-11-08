s=open(r'D:\CyberSprint\Talentro_Filters интерактив.html',encoding='utf-8',errors='ignore').read()
for key in ['cards','recphoto','col-card','class=\\"']:
    print(key, [m for m in [s.find(key)] if m>=0][:5])
print(s[15000:18000])
