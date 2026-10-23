from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
image = Image.new('RGBA', (512, 512), '#ff5a17')
draw = ImageDraw.Draw(image)
# The simple I. mark matches the existing website; it is an original program icon.
draw.rounded_rectangle((32,32,480,480), radius=96, fill='#ff5a17')
font = ImageFont.truetype('C:/Windows/Fonts/arialbi.ttf', 330)
draw.text((124,56), 'I', font=font, fill='#fffaf2')
draw.ellipse((324,353,374,403),fill='#222b25')
icons = ROOT/'desktop/icons'; icons.mkdir(parents=True,exist_ok=True)
image.save(icons/'app.ico',sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
image.resize((32,32)).save(icons/'tray.png')
for size in [192,512]: image.resize((size,size)).save(ROOT/f'dist/assets/app-icon-{size}.png')
android = ROOT/'android/res/mipmap-nodpi'; android.mkdir(parents=True,exist_ok=True)
image.resize((192,192)).save(android/'app_icon.png')
