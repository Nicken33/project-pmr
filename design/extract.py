from pypdf import PdfReader
r = PdfReader(r'D:\CyberSprint\Техническое задание проекта Talentro_v2.pdf')
out = []
for i, p in enumerate(r.pages):
    out.append(f'===PAGE {i+1}===\n' + (p.extract_text() or ''))
open(r'D:\CyberSprint\design\tz_text.txt','w',encoding='utf-8').write('\n'.join(out))
print('pages', len(r.pages))
