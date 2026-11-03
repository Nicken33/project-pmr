s=open(r'D:\CyberSprint\Talentro_Filters интерактив.html',encoding='utf-8',errors='ignore').read()
for key in ['class="cards"','class="card ','class="recphoto"']:
    i=s.find(key)
    print('\n---',key,i,'---')
    print(s[i:i+2500])
