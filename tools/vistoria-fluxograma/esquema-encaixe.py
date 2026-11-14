"""Desenha o esquema (contornos + maior buraco) que depurar-encaixe.mjs grava. Apoio para olhar o arranjo, nao e prova.
Uso: python esquema-encaixe.py esquema.json saida.png
Azul = contorno de cada projeto; verde = maior buraco com as folgas 104/80; vermelho tracejado = maior vazio sem folga."""
import json
import sys

from PIL import Image, ImageDraw

dados = json.load(open(sys.argv[1], encoding="utf-8"))
ESC = 0.22
paineis = []
for nome in ("novo", "mao"):
    d = dados[nome]
    caixa = d["caixa"]
    img = Image.new("RGB", (int(caixa["w"] * ESC) + 20, int(caixa["h"] * ESC) + 20), (17, 17, 17))
    desenho = ImageDraw.Draw(img)

    def r(c, **kw):
        x0 = 10 + (c["x"] - caixa["x"]) * ESC
        y0 = 10 + (c["y"] - caixa["y"]) * ESC
        desenho.rectangle([x0, y0, x0 + c["w"] * ESC, y0 + c["h"] * ESC], **kw)

    for c in d["contornos"]:
        r(c, fill=(60, 90, 130), outline=(150, 200, 255))
    r(d["semFolgas"], outline=(255, 90, 90), width=2)
    r(d["comFolgas"], outline=(90, 255, 90), width=3)
    desenho.text((14, 14), nome, fill=(255, 255, 255))
    paineis.append(img)
largura = max(p.width for p in paineis)
total = Image.new("RGB", (largura, sum(p.height for p in paineis) + 10), (0, 0, 0))
y = 0
for p in paineis:
    total.paste(p, (0, y))
    y += p.height + 10
total.save(sys.argv[2])
