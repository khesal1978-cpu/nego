from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1]
original = Image.open(root / 'public/assets/sixgun-logo.png').convert('RGBA')
size = min(original.size)
left, top = (original.width - size) // 2, (original.height - size) // 2
original = original.crop((left, top, left + size, top + size))
mask = Image.new('L', (size, size))
ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=round(size * .22), fill=255)
original.putalpha(mask)
icons = root / 'public/icons'
for name, pixels in [('favicon-16', 16), ('favicon-32', 32), ('apple-touch-icon', 180), ('icon-192', 192), ('icon-512', 512)]:
    original.resize((pixels, pixels), Image.Resampling.LANCZOS).save(icons / f'{name}.png')
original.resize((256, 256), Image.Resampling.LANCZOS).save(root / 'public/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
