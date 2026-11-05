from PIL import Image, ImageDraw, ImageFilter
import os
mark=Image.open(r'D:\CyberSprint\design\set6\Talentro DS@2x.png').convert('RGBA')
# trim transparent
bbox=mark.getbbox(); mark=mark.crop(bbox)
def icon(size, padding=0.16, bg=True, rounded=False):
    canvas=Image.new('RGBA',(size,size),(0,0,0,0))
    if bg:
        # diagonal gradient purple
        grad=Image.new('RGB',(size,size))
        px=grad.load()
        for y in range(size):
            for x in range(size):
                t=(x+y)/(2*size)
                r=int(124*(1-t)+60*t); g=int(78*(1-t)+46*t); b=int(226*(1-t)+205*t)
                px[x,y]=(r,g,b)
        mask=Image.new('L',(size,size),0)
        d=ImageDraw.Draw(mask)
        if rounded: d.rounded_rectangle([0,0,size-1,size-1],radius=int(size*0.22),fill=255)
        else: d.rectangle([0,0,size,size],fill=255)
        canvas.paste(grad,(0,0),mask)
    target=int(size*(1-2*padding))
    m=mark.copy(); m.thumbnail((target,target), Image.LANCZOS)
    # white tint? keep original
    canvas.alpha_composite(m, ((size-m.width)//2,(size-m.height)//2))
    return canvas
os.makedirs(r'D:\CyberSprint\web\public\icons',exist_ok=True)
icon(192).save(r'D:\CyberSprint\web\public\icons\icon-192.png')
icon(512).save(r'D:\CyberSprint\web\public\icons\icon-512.png')
icon(512,padding=0.24).save(r'D:\CyberSprint\web\public\icons\icon-maskable-512.png')
icon(180).save(r'D:\CyberSprint\web\public\icons\apple-touch-icon.png')
icon(32, bg=False, padding=0).save(r'D:\CyberSprint\web\public\icons\favicon-32.png')
icon(16, bg=False, padding=0).save(r'D:\CyberSprint\web\public\icons\favicon-16.png')
print('icons done')
