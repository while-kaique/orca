"""Mede um print do fluxograma (so o quadro): margem vazia de cada lado, em pixels de tela, e a largura do card do PO.

Uso: python medir-prints-encaixe.py PRINT.png [--poPx NUMERO] [--legenda ALTURA]
O fundo do quadro tem pontinhos; so conta como "desenho" o que forma mancha (varias celulas vizinhas diferentes do fundo).
A legenda e os botoes de baixo ficam de fora da medida do topo e da base.
"""

import json
import sys

import numpy as np
from PIL import Image


def medir(caminho, legenda=48):
    img = np.asarray(Image.open(caminho).convert("RGB")).astype(int)
    altura, largura, _ = img.shape
    fundo = np.median(img.reshape(-1, 3), axis=0)
    diferente = np.abs(img - fundo).sum(axis=2) > 36
    # Tira a legenda (embaixo a esquerda) e os botoes (embaixo a direita): so a faixa inferior da tela.
    diferente[altura - legenda :, :] = False
    # O botao redondo do canto (abaixo do painel) tambem nao e desenho.
    diferente[altura - 120 :, largura - 90 :] = False
    # Mancha: celula de 6x6 com ao menos 40% de pixels diferentes (pontinhos do fundo ficam abaixo disso).
    celula = 6
    h, w = altura // celula, largura // celula
    grade = diferente[: h * celula, : w * celula].reshape(h, celula, w, celula).mean(axis=(1, 3)) > 0.4
    # Linhas finas (setas) tambem contam como desenho, mas so se ligarem varias celulas: limpa celulas isoladas.
    vizinhas = (
        grade[1:-1, 1:-1].astype(int)
        + grade[:-2, 1:-1]
        + grade[2:, 1:-1]
        + grade[1:-1, :-2]
        + grade[1:-1, 2:]
    )
    limpa = np.zeros_like(grade)
    limpa[1:-1, 1:-1] = grade[1:-1, 1:-1] & (vizinhas >= 3)
    linhas = np.where(limpa.any(axis=1))[0]
    colunas = np.where(limpa.any(axis=0))[0]
    esquerda = int(colunas[0] * celula)
    direita = int(largura - (colunas[-1] + 1) * celula)
    topo = int(linhas[0] * celula)
    base = int(altura - legenda - (linhas[-1] + 1) * celula)
    return {"largura": largura, "altura": altura, "esquerda": esquerda, "direita": direita, "topo": topo, "baseAcimaDaLegenda": base}


if __name__ == "__main__":
    legenda = int(sys.argv[sys.argv.index("--legenda") + 1]) if "--legenda" in sys.argv else 48
    print(json.dumps(medir(sys.argv[1], legenda)))
