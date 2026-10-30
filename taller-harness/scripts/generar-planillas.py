"""Genera las fotos de planillas de los casos de prueba a partir de casos/casos.json.

Uso: python -I taller-harness/scripts/generar-planillas.py
Las planillas son ficticias: imitan una hoja de cuaderno escrita a mano y fotografiada.
"""
import json
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

RAIZ = Path(__file__).resolve().parent.parent
FUENTE_MANO = "C:/Windows/Fonts/Inkfree.ttf"
FUENTE_TITULO = "C:/Windows/Fonts/segoescb.ttf"
ANCHO, ALTO_FILA, MARGEN_SUP = 900, 78, 250


def hoja(n_filas):
    alto = MARGEN_SUP + ALTO_FILA * (n_filas + 1) + 80
    img = Image.new("RGB", (ANCHO, alto), (246, 242, 228))
    d = ImageDraw.Draw(img)
    # Renglones azules y margen rojo, como un cuaderno.
    for y in range(MARGEN_SUP - 10, alto - 40, ALTO_FILA):
        d.line([(30, y), (ANCHO - 30, y)], fill=(170, 190, 220), width=2)
    d.line([(110, 20), (110, alto - 20)], fill=(220, 140, 140), width=2)
    return img, d


def escribir_planilla(caso, destino):
    p = caso["planilla"]
    rnd = random.Random(caso["id"])
    img, d = hoja(len(p["filas"]))
    titulo = ImageFont.truetype(FUENTE_TITULO, 34)
    mano = ImageFont.truetype(FUENTE_MANO, 46)
    tinta = (25, 35, 95)
    d.text((140, 40), "Finca Santa Rita — Pesaje", font=titulo, fill=tinta)
    d.text((140, 100), f"Lote: {p['lote']}", font=mano, fill=tinta)
    d.text((140, 160), f"Fecha: {p['fecha']}", font=mano, fill=tinta)
    y = MARGEN_SUP - 5
    d.text((150, y), p.get("columna_id", "N°"), font=mano, fill=tinta)
    d.text((470, y), "Peso kg", font=mano, fill=tinta)
    cajas = []
    for i, (numero, peso) in enumerate(p["filas"], start=1):
        y = MARGEN_SUP + ALTO_FILA * i - 5 + rnd.randint(-4, 4)
        d.text((150 + rnd.randint(-6, 6), y), numero, font=mano, fill=tinta)
        d.text((480 + rnd.randint(-8, 8), y), peso, font=mano, fill=tinta)
        cajas.append((130, y - 8, 700, y + ALTO_FILA - 12))

    if p.get("estilo") == "borrosa":
        # Toda la foto un poco movida y una fila manchada (agua o barro sobre la tinta).
        caja = cajas[p["fila_borrosa"]]
        zona = img.crop(caja).filter(ImageFilter.GaussianBlur(6))
        mancha = Image.new("RGB", zona.size, (160, 140, 100))
        zona = Image.blend(zona, mancha, 0.3)
        img.paste(zona, caja[:2])
        img = img.filter(ImageFilter.GaussianBlur(1.6))

    # Efecto de foto: leve giro, sombra de un lado y fondo de mesa.
    img = img.rotate(rnd.uniform(-2.5, 2.5), expand=True, fillcolor=(92, 74, 58), resample=Image.BICUBIC)
    sombra = Image.linear_gradient("L").rotate(90).resize(img.size)
    img = Image.composite(img, Image.new("RGB", img.size, (60, 55, 50)), sombra.point(lambda v: 255 - v // 5))
    img.save(destino, quality=88)


def main():
    casos = json.loads((RAIZ / "casos" / "casos.json").read_text(encoding="utf-8"))["casos"]
    for caso in casos:
        carpeta = RAIZ / "casos" / caso["id"]
        carpeta.mkdir(parents=True, exist_ok=True)
        if caso["entrada"] == "imagen":
            escribir_planilla(caso, carpeta / "planilla.jpg")
        else:
            (carpeta / "mensaje.txt").write_text(caso["texto"] + "\n", encoding="utf-8")
        print("listo", caso["id"])


if __name__ == "__main__":
    main()
