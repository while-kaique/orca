"""Tabela do criterio 6: onde cada card esta na versao antiga e na nova com o mesmo estado guardado (arrastes incluidos).

Uso: python tabela-antes-depois.py ANTIGO/fatos.json NOVO/fatos.json ETAPA SAIDA.txt
Cada coordenada e lida da tela e convertida em unidades do fluxograma (px / escala), contada a partir do cartao do 1o projeto.
"""

import json
import sys


def cartoes(fatos, etapa):
    e = fatos["etapas"][etapa]
    escala = e["escala"]
    q = e["quadro"]
    projetos = e["projetos"]
    base = projetos[0]["caixa"]
    out = {}
    for p in projetos:
        out["P:" + (p["nome"] or "?")] = (
            (p["caixa"]["x"] - base["x"]) / escala,
            (p["caixa"]["y"] - base["y"]) / escala,
        )
        for c in p["cards"]:
            out[c["chave"]] = ((c["caixa"]["x"] - base["x"]) / escala, (c["caixa"]["y"] - base["y"]) / escala, p["nome"], c["papel"])
    return out


def principal():
    antigo = json.load(open(sys.argv[1], encoding="utf-8"))
    novo = json.load(open(sys.argv[2], encoding="utf-8"))
    etapa = sys.argv[3]
    a = cartoes(antigo, etapa)
    n = cartoes(novo, etapa)
    linhas = ["card | antes (antigo): x,y | depois (novo): x,y | diferenca (unidades do fluxograma)"]
    maximo = 0.0
    for chave in a:
        if chave not in n:
            linhas.append(f"{chave} | so no antigo")
            continue
        ax, ay = a[chave][0], a[chave][1]
        nx, ny = n[chave][0], n[chave][1]
        dif = max(abs(ax - nx), abs(ay - ny))
        maximo = max(maximo, dif)
        nome = chave if chave.startswith("P:") else f"{a[chave][2]} / {a[chave][3]}"
        linhas.append(f"{nome:40s} | {ax:9.1f},{ay:9.1f} | {nx:9.1f},{ny:9.1f} | {dif:.3f}")
    for chave in n:
        if chave not in a:
            linhas.append(f"{chave} | so no novo")
    linhas.append(f"maior diferenca: {maximo:.3f} unidades em {len(a)} cards")
    open(sys.argv[4], "w", encoding="utf-8").write("\n".join(linhas))
    print(linhas[-1])


principal()
