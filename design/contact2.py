from PIL import Image, ImageDraw
import os, glob
files=[f for f in sorted(glob.glob(r'D:\CyberSprint\web\public\images\*.jpg')) if os.path.basename(f) in ['dance2.jpg','english2.jpg','pottery2.jpg','ballet.jpg','drawing.jpg','teen.jpg','kids.jpg','volley.jpg']]
cols=4; tw=240; th=170
rows=(len(files)+cols-1)//cols
sheet=Image.new('RGB',(cols*tw, rows*(th+24)),'white'); d=ImageDraw.Draw(sheet)
for i,f in enumerate(files):
    im=Image.open(f).convert('RGB'); im.thumbnail((tw,th)); x=(i%cols)*tw; y=(i//cols)*(th+24); sheet.paste(im,(x,y)); d.text((x+4,y+th+4),os.path.basename(f),fill='black')
sheet.save(r'D:\CyberSprint\design\contact2.jpg', quality=85)
