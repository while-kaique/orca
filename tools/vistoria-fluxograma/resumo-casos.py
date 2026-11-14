"""Junta as provas dos casos no programa de verdade: imagem lado a lado (antigo, a mao, novo) e a tabela de numeros.

Uso: python resumo-casos.py PASTA_DOS_CASOS
Espera PASTA/<caso>/antigo/{fatos.json,2-reorganizado-antigo.png[,3-a-mao.png]} e PASTA/<caso>/novo/{fatos.json,2-reorganizado-novo.png}.
O caso de 5 projetos nao tem arrumacao a mao (o print dele so mostra as margens grandes demais).
"""

import json
import os
import subprocess
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
PASTA = sys.argv[1]
PO_PRINT = {"caso-4-projetos": 209, "caso-3-projetos-a": 278, "caso-3-projetos-b": 242, "caso-5-projetos": None}
linhas = [
    "| Caso | PO antigo (px) | PO a mao, reproduzido / no print (px) | PO novo (px) | vao entre projetos do novo, menor-maior (px) | achados da vistoria no novo |",
    "| --- | --- | --- | --- | --- | --- |",
]
for caso in sorted(PO_PRINT):
    antigo = json.load(open(f"{PASTA}/{caso}/antigo/fatos.json", encoding="utf-8"))["etapas"]
    novo = json.load(open(f"{PASTA}/{caso}/novo/fatos.json", encoding="utf-8"))["etapas"]
    po_antigo = antigo["2-reorganizado-antigo"]["poLarguraPx"]
    mao = antigo.get("3-a-mao")
    po_mao = mao["poLarguraPx"] if mao else None
    etapa = novo["2-reorganizado-novo"]
    po_novo = etapa["poLarguraPx"]
    vaos = list((etapa.get("vaosPx") or {}).values())
    faixa = f"{min(vaos)} - {max(vaos)}" if vaos else "sem vizinho"
    achados = etapa.get("achados") or []
    tipos = sorted({a["tipo"] for a in achados})
    texto_mao = f"{po_mao} / {PO_PRINT[caso]}" if po_mao else "sem arrumacao a mao"
    linhas.append(
        f"| {caso} | {po_antigo} | {texto_mao} | **{po_novo}** | {faixa} | {len(achados)} {' '.join(tipos)} |"
    )
    versao = "6d247f8e78" if caso == "caso-5-projetos" else "6e43f71910"
    imagens = [f"{PASTA}/{caso}/antigo/2-reorganizado-antigo.png", f"ANTIGO ({versao}) depois do Reorganizar: card do PO {po_antigo} px"]
    if mao:
        imagens += [
            f"{PASTA}/{caso}/antigo/3-a-mao.png",
            f"A MAO (posicoes do print do Kaique), zoom justo: card do PO {po_mao} px (no print dele {PO_PRINT[caso]} px)",
        ]
    imagens += [f"{PASTA}/{caso}/novo/2-reorganizado-novo.png", f"NOVO depois do Reorganizar: card do PO {po_novo} px"]
    subprocess.run(
        [sys.executable, os.path.join(AQUI, "lado-a-lado-casos.py"), f"{PASTA}/{caso}-lado-a-lado.png", *imagens],
        check=True,
    )
open(f"{PASTA}/tabela-casos.md", "w", encoding="utf-8").write("\n".join(linhas))
print("\n".join(linhas))
