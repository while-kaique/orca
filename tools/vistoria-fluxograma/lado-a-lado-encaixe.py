"""Monta a imagem lado a lado do criterio 1: antigo, arrumado a mao pelo Kaique (print dele) e novo, cada um com o numero.

Uso: python lado-a-lado-encaixe.py ANTIGO.png MAO.png NOVO.png SAIDA.png "PO antigo" "PO mao" "PO novo"
O print a mao e o da tela inteira do Kaique (2559 px): recorta so o quadro do fluxograma.
"""

import sys

from PIL import Image, ImageDraw, ImageFont


def principal():
    antigo, mao, novo, saida, texto_antigo, texto_mao, texto_novo = sys.argv[1:8]
    imagens = [Image.open(antigo).convert("RGB"), Image.open(mao).convert("RGB"), Image.open(novo).convert("RGB")]
    # Recorte do quadro no print inteiro do Kaique (a barra lateral e a barra do topo ficam de fora).
    inteira = imagens[1]
    imagens[1] = inteira.crop((413, 56, inteira.width, min(inteira.height - 90, 56 + 1370)))
    altura = 760
    pequenas = [im.resize((int(im.width * altura / im.height), altura)) for im in imagens]
    titulos = [texto_antigo, texto_mao, texto_novo]
    margem = 70
    largura = sum(im.width for im in pequenas) + 4 * 12
    quadro = Image.new("RGB", (largura, altura + margem), (18, 18, 20))
    desenho = ImageDraw.Draw(quadro)
    try:
        fonte = ImageFont.truetype("arial.ttf", 22)
    except OSError:
        fonte = ImageFont.load_default()
    x = 12
    for im, titulo in zip(pequenas, titulos):
        quadro.paste(im, (x, margem))
        desenho.text((x + 6, 18), titulo, fill=(235, 235, 240), font=fonte)
        x += im.width + 12
    quadro.save(saida)


principal()
