#!/bin/bash
# Provas da o-042 no programa de verdade: uma rodada por vez (um Orca de teste por vez), cada uma pela vez da maquina.
# Uso: bash tools/vistoria-fluxograma/prova-o-042.sh PASTA_DE_PROVA PASTA_DO_APP_ANTIGO [rodada ...]
# Sem rodadas, roda todas. O app novo e o out/ desta pasta (montado antes por `montar`).
set -u
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
PROVA="$1"
ANTIGO="$2"
shift 2
V="$RAIZ/tools/vistoria-fluxograma"
C="$V/cenarios-de-prova"
mkdir -p "$PROVA/casos"
cd "$RAIZ" || exit 2

vistoria() {
  local nome="$1"
  shift
  echo "== $nome: $*"
  hierarquia vez -- node "$V/vistoria.mjs" --saida "$PROVA/$nome" "$@" >"$PROVA/$nome-saida.txt" 2>&1
  echo "EXIT $?" >>"$PROVA/$nome-saida.txt"
  tail -2 "$PROVA/$nome-saida.txt"
}

rodada() {
  case "$1" in
    tipos)
      hierarquia vez -- pnpm tc:web >"$PROVA/saida-tc.txt" 2>&1
      echo "tipos: EXIT $?"
      ;;
    testes)
      hierarquia vez -- node config/scripts/run-vitest.mjs run --config config/vitest.config.ts src/renderer/src/components/canvas-chats --maxWorkers=2 >"$PROVA/saida-testes.txt" 2>&1
      echo "testes: EXIT $?"
      ;;
    montar)
      for v in $(env | grep -oE '^(ORCA_|CLAUDE|AI_AGENT)[A-Za-z0-9_]*'); do unset "$v"; done
      VITE_EXPOSE_STORE=true hierarquia vez -- node config/scripts/build-workspace-packages.mjs >"$PROVA/montagem.log" 2>&1 &&
        VITE_EXPOSE_STORE=true hierarquia vez -- node config/scripts/run-electron-vite-build.mjs >>"$PROVA/montagem.log" 2>&1
      echo "montar: EXIT $?"
      ;;
    novo-real) vistoria novo-real --sem-montar ;;
    antigo-real) vistoria antigo-real --app "$ANTIGO" ;;
    antigo-print) vistoria antigo-print --app "$ANTIGO" --cenario "$C/print-do-kaique.mjs" ;;
    novo-print) vistoria novo-print --sem-montar --cenario "$C/print-do-kaique.mjs" ;;
    antigo-texto) vistoria antigo-texto --app "$ANTIGO" --cenario "$C/c-texto-pior-caso.mjs" --zoom 0.35,1 ;;
    novo-texto) vistoria novo-texto --sem-montar --cenario "$C/c-texto-pior-caso.mjs" --zoom 0.35,1 ;;
    novo-seta) vistoria novo-seta --sem-montar --cenario "$C/seta-manual.mjs" ;;
    novo-lancado) vistoria novo-lancado --sem-montar --cenario "$C/chat-lancado-nasce.mjs" ;;
    caso-a) vistoria caso-a --sem-montar --cenario "$C/a-card-no-caminho-da-linha.mjs" ;;
    caso-d) vistoria caso-d --sem-montar --cenario "$C/d-card-sobre-card.mjs" ;;
    caso-e) vistoria caso-e --sem-montar --cenario "$C/e-selo-longe.mjs" ;;
    caso-f) vistoria caso-f --sem-montar --cenario "$C/f-fora-da-grade.mjs" ;;
    caso-g) vistoria caso-g --sem-montar --cenario "$C/g-chat-longe-do-dono.mjs" ;;
    po-nascendo)
      hierarquia vez -- node "$V/roteiro-po-nascendo.mjs" "$PROVA/po-nascendo" --projeto orca >"$PROVA/po-nascendo-saida.txt" 2>&1
      echo "po-nascendo: EXIT $?"
      ;;
    casos)
      for caso in caso-4-projetos caso-3-projetos-a caso-3-projetos-b caso-5-projetos; do
        hierarquia vez -- node "$V/prova-casos-real.mjs" --caso "$caso" --rotulo novo --saida "$PROVA/casos/$caso/novo" >"$PROVA/casos/log-$caso-novo.txt" 2>&1
        echo "casos $caso: EXIT $?"
      done
      ;;
    antigo-arrastes)
      hierarquia vez -- node "$V/prova-encaixe-real.mjs" --rotulo antigo --arrastes --raiz "$ANTIGO" --saida "$PROVA/antigo-arrastes" >"$PROVA/antigo-arrastes-saida.txt" 2>&1
      echo "antigo-arrastes: EXIT $?"
      ;;
    novo-arrastes)
      hierarquia vez -- node "$V/prova-encaixe-real.mjs" --rotulo novo --arrastes --semente "$PROVA/antigo-arrastes/fatos.json" --saida "$PROVA/novo-arrastes" >"$PROVA/novo-arrastes-saida.txt" 2>&1
      echo "novo-arrastes: EXIT $?"
      ;;
    nascer)
      hierarquia vez -- node "$V/prova-encaixe-real.mjs" --rotulo novo --nascer --saida "$PROVA/nascimentos" >"$PROVA/nascimentos-saida.txt" 2>&1
      echo "nascer: EXIT $?"
      ;;
    caso5-antigo)
      hierarquia vez -- node "$V/prova-casos-real.mjs" --caso caso-5-projetos --rotulo antigo --raiz "$ANTIGO" --saida "$PROVA/casos/caso-5-projetos/antigo" >"$PROVA/casos/log-caso-5-projetos-antigo.txt" 2>&1
      echo "caso5-antigo: EXIT $?"
      ;;
    *) echo "rodada desconhecida: $1" ;;
  esac
}

if [ $# -eq 0 ]; then
  set -- montar novo-real antigo-real antigo-print novo-print novo-texto novo-seta novo-lancado caso-a caso-d caso-e caso-f caso-g casos po-nascendo
fi
for r in "$@"; do
  rodada "$r"
done
echo "processos de teste vivos no fim (Orca de teste e vistoria; o shell desta rodada nao conta):"
powershell.exe -NoProfile -Command "(Get-CimInstance Win32_Process | Where-Object { \$_.CommandLine -match 'vistoria-fluxograma-snipefish|vistoria\.mjs|prova-casos-real|roteiro-po-nascendo' -and \$_.Name -notin @('powershell.exe','bash.exe') } | Measure-Object).Count"
