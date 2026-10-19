# Verificación · TravelPal logo

Comandos ejecutados desde la raíz del repositorio con Bash. No se han abierto ni
inspeccionado visualmente las imágenes. Las dimensiones de lockup corresponden a
la altura solicitada, conservando su relación horizontal. El único protocolo
permitido es la declaración XML del namespace SVG; no carga recursos de red.
Las rutas de comandos son herramientas o entradas locales, no enlaces de assets.

## Rasterización de todos los SVG y variantes monocromas

```bash
set -e
cd docs/design/logo/proposals
mkdir -p renders/dark renders/mono-light renders/mono-dark
for svg in *.svg; do
  for size in 16 32 64 128; do
    rsvg-convert --stylesheet <(printf '%s' 'svg { color: #101828 !important; } #mark { color: #0759d3 !important; }') --height "$size" "$svg" --output "renders/${svg%.svg}-${size}.png"
    rsvg-convert --stylesheet <(printf '%s' 'svg { color: #edf3fb !important; } #mark { color: #8dbaff !important; }') --background-color '#101827' --height "$size" "$svg" --output "renders/dark/${svg%.svg}-${size}.png"
  done
done
for svg in *-mark.svg; do
  for size in 16 32 64 128; do
    rsvg-convert --stylesheet <(printf '%s' 'svg, #mark { color: #101828 !important; }') --background-color '#ffffff' --height "$size" "$svg" --output "renders/mono-light/${svg%.svg}-${size}.png"
    rsvg-convert --stylesheet <(printf '%s' 'svg, #mark { color: #edf3fb !important; }') --background-color '#101827' --height "$size" "$svg" --output "renders/mono-dark/${svg%.svg}-${size}.png"
  done
done
printf 'SVG rasterizados: %s\n' "$(find . -maxdepth 1 -name '*.svg' | wc -l)"
printf 'PNG generados: %s\n' "$(find renders -name '*.png' | wc -l)"
```

Salida literal:

```text
SVG rasterizados: 18
PNG generados: 192
```

Código de salida: `0`.

## XML

```bash
set -e
for svg in docs/design/logo/proposals/*.svg; do
  xmllint --noout "$svg"
done
printf 'XML válidos: 18/18\n'
```

Salida literal:

```text
XML válidos: 18/18
```

Código de salida: `0`.

## Dimensiones con identify

```bash
set -e
cd docs/design/logo/proposals
identify -format '%m %wx%h\n' renders/*.png renders/dark/*.png renders/mono-light/*.png renders/mono-dark/*.png | sort | uniq -c
```

Salida literal:

```text
     24 PNG 122x32
     24 PNG 128x128
     24 PNG 16x16
     24 PNG 244x64
     24 PNG 32x32
     24 PNG 488x128
     24 PNG 61x16
     24 PNG 64x64
```

Código de salida: `0`.

## Texto visible y recursos externos con grep

```bash
set -e
cd docs/design/logo/proposals
if grep -nE '<([[:alnum:]_-]+:)?text([[:space:]>])' -- *-mark.svg *-outlined.svg; then
  exit 1
fi
printf 'grep: 0 elementos text en marcas y lockups trazados\n'
printf 'Literales de protocolo presentes en SVG/HTML:\n'
grep -ohE 'https?://[^"[:space:]]+' -- *.svg index.html | sort | uniq -c
if sed 's@xmlns="http://www.w3.org/2000/svg"@@g' -- *.svg index.html | grep -nEi 'https?://|@font-face|@import|url[[:space:]]*\(|<image[[:space:]>]|<script[[:space:]>]|(href|src|xlink:href)[[:space:]]*=[[:space:]]*["\x27](/|file:|data:)|/(home|usr|tmp|var|etc)/'; then
  exit 1
fi
printf 'grep: 0 recursos remotos, rutas absolutas o fuentes externas (exceptuado xmlns SVG)\n'
```

Salida literal:

```text
grep: 0 elementos text en marcas y lockups trazados
Literales de protocolo presentes en SVG/HTML:
     18 http://www.w3.org/2000/svg
grep: 0 recursos remotos, rutas absolutas o fuentes externas (exceptuado xmlns SVG)
```

Código de salida: `0`.

## Colores con grep y lista cerrada de tokens

```bash
set -e
cd docs/design/logo/proposals
actual=$(grep -ohEi '#[[:xdigit:]]{3,8}\b' -- *.svg index.html | tr '[:upper:]' '[:lower:]' | sort -u)
printf '%s\n' "$actual"
invalid=$(printf '%s\n' "$actual" | grep -vxE '#(ffffff|f4f7fb|e7edf5|101828|526174|dce4ee|0759d3|064bb5|eaf2ff|101827|182338|22314a|edf3fb|b0bfd4|34455f|8dbaff|b3d1ff)' || true)
test -z "$invalid"
printf 'Colores fuera de tokens: 0\n'
```

Salida literal:

```text
#064bb5
#0759d3
#101827
#101828
#182338
#34455f
#526174
#8dbaff
#b0bfd4
#dce4ee
#eaf2ff
#edf3fb
#f4f7fb
#ffffff
Colores fuera de tokens: 0
```

Código de salida: `0`.

## Incidencia de margen detectada antes de la corrección

El primer Vínculo dejaba menos de un píxel de margen vertical a 16 px; el
antialias ocupaba las filas extremas. Se reconstruyeron sus curvas dentro del
margen, sin cambiar el tamaño de lienzo ni reducir el peso del trazo.

```bash
/usr/bin/python3 - <<'CHECK'
from PIL import Image
im = Image.open('docs/design/logo/proposals/renders/06-vinculo-mark-16.png')
bbox = im.getchannel('A').getbbox()
assert bbox[1] > 0 and bbox[3] < im.height, (im.size, bbox)
print('Vínculo: margen vertical libre a 16 px')
CHECK
```

Salida literal previa a la corrección:

```text
Traceback (most recent call last):
  File "<stdin>", line 4, in <module>
AssertionError: ((16, 16), (1, 0, 15, 16))
```

Código de salida previo: `1`. La comprobación se repite más abajo.

## Integridad, márgenes, geometría y hoja autocontenida

```bash
/usr/bin/python3 - <<'CHECK'
from pathlib import Path
from PIL import Image
from html.parser import HTMLParser
import xml.etree.ElementTree as ET
import re
p = Path('docs/design/logo/proposals')
svgs = sorted(p.glob('*.svg'))
assert len(svgs) == 18
for png in sorted((p/'renders').glob('*.png')):
    im = Image.open(png).convert('RGBA')
    bbox = im.getchannel('A').getbbox()
    assert bbox is not None, png
    assert 0 < bbox[0] < bbox[2] < im.width, (png, bbox)
    assert 0 < bbox[1] < bbox[3] < im.height, (png, bbox)
print('72 PNG transparentes: contenido no vacío y márgenes libres en cuatro lados')
assert len(list((p/'renders').rglob('*.png'))) == 192
for png in (p/'renders').rglob('*.png'):
    with Image.open(png) as im:
        im.verify()
print('192 PNG: decodificación íntegra con Pillow')
def local(e):
    return e.tag.split('}')[-1]
def geometry(e):
    return [(local(n), sorted(n.attrib.items())) for n in e if local(n) == 'path']
for svg in svgs:
    root = ET.parse(svg).getroot()
    mark = next(e for e in root if e.get('id') == 'mark')
    assert all(local(e) in ('g','path') for e in mark.iter()), svg
    assert mark.get('fill') == 'currentColor', svg
    if svg.stem.endswith('-mark'):
        assert root.get('viewBox') == '0 0 64 64'
        assert not any(local(e) in ('text','image','use','foreignObject','style') for e in root.iter())
        assert not re.search(r'#[0-9a-fA-F]{3,8}\b', svg.read_text())
    else:
        base = svg.stem.removesuffix('-outlined')
        original = next(e for e in ET.parse(p/f'{base}-mark.svg').getroot() if e.get('id') == 'mark')
        assert geometry(mark) == geometry(original), svg
        if svg.stem.endswith('-outlined'):
            assert not any(local(e) == 'text' for e in root.iter())
            assert len(next(e for e in root if e.get('id') == 'wordmark')) == 9
        else:
            text = next(e for e in root if local(e) == 'text')
            assert text.text == 'TravelPal'
            assert text.get('font-family') == 'Inter, system-ui, sans-serif'
            assert text.get('font-weight') == '600'
print('18 SVG: geometría coherente; 6 marcas con currentColor; 6 wordmarks editables y 6 en trazados')
page = (p/'index.html').read_text()
class CheckHTML(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids=[]; self.hrefs=[]; self.articles=0
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if 'id' in a: self.ids.append(a['id'])
        if 'href' in a: self.hrefs.append(a['href'])
        assert tag not in ('script','link','iframe','img'), tag
        assert 'src' not in a
        if tag == 'article': self.articles += 1
parser=CheckHTML(); parser.feed(page); parser.close()
assert len(parser.ids) == len(set(parser.ids))
assert parser.articles == 6
for href in parser.hrefs:
    if href.startswith('#'):
        assert href[1:] in parser.ids, href
    else:
        assert (p/href).is_file(), href
        assert not href.startswith('/') and ':' not in href, href
inline = re.findall(r'<svg\b.*?</svg>', page, flags=re.S)
assert len(inline) == 60,len(inline)
marks=sorted(p.glob('*-mark.svg'))
for i, svg in enumerate(marks):
    original = next(e for e in ET.parse(svg).getroot() if e.get('id') == 'mark')
    for j, source in enumerate(inline[i*10:(i+1)*10]):
        root=ET.fromstring(source)
        shape = next((e for e in root if e.get('class') == 'brand-mark'),root)
        assert geometry(shape) == geometry(original), (svg,j)
        if j < 4:
            size = str((16,32,64,128)[j])
            assert root.get('width') == root.get('height') == size
print('HTML: 6 conceptos, 60 SVG coherentes, escalas correctas, IDs únicos y enlaces locales existentes')
print('Vínculo: margen vertical libre a 16 px (comprobación repetida y superada)')
CHECK
```

Salida literal:

```text
72 PNG transparentes: contenido no vacío y márgenes libres en cuatro lados
192 PNG: decodificación íntegra con Pillow
18 SVG: geometría coherente; 6 marcas con currentColor; 6 wordmarks editables y 6 en trazados
HTML: 6 conceptos, 60 SVG coherentes, escalas correctas, IDs únicos y enlaces locales existentes
Vínculo: margen vertical libre a 16 px (comprobación repetida y superada)
```

Código de salida: `0`.

## Fuente usada para los trazados

```bash
/usr/bin/python3 - <<'CHECK'
import subprocess
import fontTools
from fontTools.ttLib import TTFont
font = TTFont(subprocess.check_output(['fc-match', '-f', '%{file}', 'Inter:style=SemiBold'], text=True))
assert font['OS/2'].usWeightClass == 600
print('fontTools', fontTools.__version__)
print('Fuente:', font['name'].getDebugName(1))
print('Peso OS/2:', font['OS/2'].usWeightClass)
CHECK
```

Salida literal:

```text
fontTools 4.67.0
Fuente: Inter SemiBold
Peso OS/2: 600
```

Código de salida: `0`.

## Límite de la prueba de navegador

```bash
node -e 'for (const name of ["@playwright/test", "playwright"]) { try { console.log(name, require.resolve(name)) } catch { console.log(name, "no disponible") } }'
```

Salida literal:

```text
@playwright/test no disponible
playwright no disponible
```

Código de salida: `0`.

## Ajuste de la comprobación de Git

La primera prueba esperaba código 0 de `git diff --no-index --check` al comparar
ficheros nuevos con un fichero vacío. Git devuelve 1 porque hay diferencias,
sin emitir errores de espacios. Se corrigió esa expectativa del verificador.

```bash
git diff --no-index --check -- /dev/null docs/design/logo/proposals/01-cuaderno-abierto-mark.svg
```

Salida literal:

```text
```

Código de salida: `1` (diferencias esperadas, sin diagnóstico de espacios).

## Alcance de Git y revisión de todos los ficheros de texto añadidos

```bash
/usr/bin/python3 - <<'CHECK'
from pathlib import Path
import subprocess
p=Path('docs/design/logo/proposals')
assert subprocess.run(['git','diff','--exit-code'],capture_output=True).returncode == 0
raw=subprocess.check_output(['git','status','--porcelain=v1','--untracked-files=all'],text=True)
entries=raw.splitlines()
assert entries and all(line.startswith('?? docs/design/logo/') for line in entries),raw
print('Cambios fuera de docs/design/logo/: 0')
print('Ficheros ya versionados modificados: 0')
texts=sorted([*p.glob('*.svg'),p/'index.html',p/'README.md',p/'VERIFICATION.md'])
for f in texts:
    diff=subprocess.run(['git','diff','--no-index','--','/dev/null',str(f)],capture_output=True,text=True)
    assert diff.returncode == 1 and diff.stdout.startswith('diff --git '),f
    whitespace=subprocess.run(['git','diff','--no-index','--check','--','/dev/null',str(f)],capture_output=True,text=True)
    assert whitespace.returncode in (0,1) and not whitespace.stdout and not whitespace.stderr,(f,whitespace.stdout,whitespace.stderr)
print('Diff completo comprobado para 21 ficheros de texto; sin errores de espacios')
print('Rama:',subprocess.check_output(['git','branch','--show-current'],text=True).strip())
CHECK
```

Salida literal:

```text
Cambios fuera de docs/design/logo/: 0
Ficheros ya versionados modificados: 0
Diff completo comprobado para 21 ficheros de texto; sin errores de espacios
Rama: design/logo-proposals
```

Código de salida: `0`.

## Límite de la entrega

Las comprobaciones técnicas anteriores pasan después de reconstruir Vínculo.
No se han ejecutado pruebas de app: no se ha cambiado código de la app.
No se ha realizado inspección visual ni prueba de navegador; la lectura del
HTML comprueba estructura y referencias, no layout renderizado. La aprobación
visual a tamaño real sigue pendiente. No se han instalado paquetes, generado
commits, hecho push ni creado PR.
