"""Monta a imagem lado a lado de um caso: antigo, arrumado a mao e novo, os tres prints do quadro de 2151 x 1370 do programa
de verdade, cada um com o numero do card do PO medido na tela.

Uso: python lado-a-lado-casos.py ANTIGO.png MAO.png NOVO.png SAIDA.png "texto antigo" "texto mao" "texto novo"
"""

import sys

from PIL import Image, ImageDraw, ImageFont


def principal():
    antigo, mao, novo, saida, t1, t2, t3 = sys.argv[1:8]
    imagens = [Image.open(p).convert("RGB") for p in (antigo, mao, novo)]
    altura = 760
    pequenas = [im.resize((int(im.width * altura / im.height), altura)) for im in imagens]
    margem = 70
    largura = sum(im.width for im in pequenas) + 4 * 12
    quadro = Image.new("RGB", (largura, altura + margem), (18, 18, 20))
    desenho = ImageDraw.Draw(quadro)
    try:
        fonte = ImageFont.truetype("arial.ttf", 22)
    except OSError:
        fonte = ImageFont.load_default()
    x = 12
    for im, titulo in zip(pequenas, (t1, t2, t3)):
        quadro.paste(im, (x, margem))
        desenho.text((x + 6, 18), titulo, fill=(235, 235, 240), font=fonte)
        x += im.width + 12
    quadro.save(saida)


principal()
