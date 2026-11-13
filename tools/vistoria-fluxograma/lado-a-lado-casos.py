"""Monta a imagem lado a lado de um caso: antigo, arrumado a mao (quando ha) e novo, prints do quadro de 2151 x 1370 do
programa de verdade, cada um com o numero do card do PO medido na tela.

Uso: python lado-a-lado-casos.py SAIDA.png IMAGEM1.png "texto 1" IMAGEM2.png "texto 2" [IMAGEM3.png "texto 3"]
"""

import sys

from PIL import Image, ImageDraw, ImageFont


def principal():
    saida = sys.argv[1]
    pares = list(zip(sys.argv[2::2], sys.argv[3::2]))
    imagens = [Image.open(p).convert("RGB") for p, _ in pares]
    altura = 760
    pequenas = [im.resize((int(im.width * altura / im.height), altura)) for im in imagens]
    margem = 70
    largura = sum(im.width for im in pequenas) + (len(pequenas) + 1) * 12
    quadro = Image.new("RGB", (largura, altura + margem), (18, 18, 20))
    desenho = ImageDraw.Draw(quadro)
    try:
        fonte = ImageFont.truetype("arial.ttf", 22)
    except OSError:
        fonte = ImageFont.load_default()
    x = 12
    for im, (_, titulo) in zip(pequenas, pares):
        quadro.paste(im, (x, margem))
        desenho.text((x + 6, 18), titulo, fill=(235, 235, 240), font=fonte)
        x += im.width + 12
    quadro.save(saida)


principal()
