from PIL import Image, ImageDraw
import os, glob
files=sorted(glob.glob(r'D:\CyberSprint\web\public\images\*.jpg'))
cols=6; tw=220; th=150
rows=(len(files)+cols-1)//cols
sheet=Image.new('RGB',(cols*tw, rows*(th+24)),'white')
d=ImageDraw.Draw(sheet)
for i,f in enumerate(files):
    im=Image.open(f).convert('RGB'); im.thumbnail((tw,th))
    x=(i%cols)*tw; y=(i//cols)*(th+24)
    sheet.paste(im,(x,y))
    d.text((x+4,y+th+4), os.path.basename(f), fill='black')
sheet.save(r'D:\CyberSprint\design\contact_sheet.jpg', quality=85)
print(len(files), sheet.size)
