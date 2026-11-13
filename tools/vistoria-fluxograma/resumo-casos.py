"""Junta as provas dos casos no programa de verdade: imagem lado a lado (antigo, a mao, novo) e a tabela de numeros.

Uso: python resumo-casos.py PASTA_DOS_CASOS
Espera PASTA/<caso>/antigo/{fatos.json,2-reorganizado-antigo.png,3-a-mao.png} e PASTA/<caso>/novo/{fatos.json,2-reorganizado-novo.png}.
"""

import json
import os
import subprocess
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
PASTA = sys.argv[1]
PO_PRINT = {"caso-4-projetos": 209, "caso-3-projetos-a": 278, "caso-3-projetos-b": 242}
linhas = ["| Caso | PO antigo (px) | PO a mao, reproduzido (px) | PO a mao, no print dele (px) | PO novo (px) | margens do novo esq/dir/topo/base (px) |", "| --- | --- | --- | --- | --- | --- |"]
for caso in sorted(PO_PRINT):
    antigo = json.load(open(f"{PASTA}/{caso}/antigo/fatos.json", encoding="utf-8"))["etapas"]
    novo = json.load(open(f"{PASTA}/{caso}/novo/fatos.json", encoding="utf-8"))["etapas"]
    po_antigo = antigo["2-reorganizado-antigo"]["poLarguraPx"]
    po_mao = antigo["3-a-mao"]["poLarguraPx"]
    po_novo = novo["2-reorganizado-novo"]["poLarguraPx"]
    m = novo["2-reorganizado-novo"]["margensPx"]
    linhas.append(
        f"| {caso} | {po_antigo} | {po_mao} | {PO_PRINT[caso]} | **{po_novo}** | {m['esquerda']} / {m['direita']} / {m['topo']} / {m['base']} |"
    )
    subprocess.run(
        [
            sys.executable,
            os.path.join(AQUI, "lado-a-lado-casos.py"),
            f"{PASTA}/{caso}/antigo/2-reorganizado-antigo.png",
            f"{PASTA}/{caso}/antigo/3-a-mao.png",
            f"{PASTA}/{caso}/novo/2-reorganizado-novo.png",
            f"{PASTA}/{caso}-lado-a-lado.png",
            f"ANTIGO (6e43f71910) depois do Reorganizar: card do PO {po_antigo} px",
            f"A MAO (posicoes do print do Kaique), zoom justo: card do PO {po_mao} px (no print dele {PO_PRINT[caso]} px)",
            f"NOVO depois do Reorganizar: card do PO {po_novo} px",
        ],
        check=True,
    )
open(f"{PASTA}/tabela-casos.md", "w", encoding="utf-8").write("\n".join(linhas))
print("\n".join(linhas))
