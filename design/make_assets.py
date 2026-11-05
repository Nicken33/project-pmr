import re, shutil, os
src = r'D:\CyberSprint\design\set6\Talentro_precise_vector 1.svg'
s = open(src, encoding='utf-8').read()
# remove background rect
s = re.sub(r'<rect width="1536" height="512" fill="#F5F5F5"/>', '', s, count=1)
# change viewbox to crop
logo = s.replace('viewBox="0 0 1536 512"', 'viewBox="95 18 1340 465"')
open(r'D:\CyberSprint\web\public\brand\logo.svg','w',encoding='utf-8').write(logo) if os.path.isdir(r'D:\CyberSprint\web\public\brand') else None
os.makedirs(r'D:\CyberSprint\web\public\brand', exist_ok=True)
open(r'D:\CyberSprint\web\public\brand\logo.svg','w',encoding='utf-8').write(logo)
# mark only: remove wordmark group
mark = re.sub(r'<g id="talentro-wordmark">.*?</g>\n', '', logo, flags=re.S)
mark = mark.replace('viewBox="95 18 1340 465"','viewBox="110 25 480 470"')
open(r'D:\CyberSprint\web\public\brand\mark.svg','w',encoding='utf-8').write(mark)
# copy assets
shutil.copy(r'D:\CyberSprint\design\image3_0_1.png', r'D:\CyberSprint\web\public\brand\hero-illustration.png')
shutil.copy(r'D:\CyberSprint\design\image2_0_1.png', r'D:\CyberSprint\web\public\brand\flowing.png')
shutil.copy(r'D:\CyberSprint\design\image0_0_1.png', r'D:\CyberSprint\web\public\images\palette.png')
print('done')
