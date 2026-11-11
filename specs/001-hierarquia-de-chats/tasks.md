---
feature: 'hierarquia-de-chats'
id: '001'
spec: './spec.md'
plan: './plan.md'
updated: '2026-11-10'
---

# Tarefas: Hierarquia de chats

> Uma tarefa por linha, cada uma com a prova que fecha. Marcar `[x]` só com a prova na mão.
> As tarefas das Fases 2 a 4 são detalhadas depois do resultado da Fase 0, porque o plano B
> (seção 3 do plano) muda parte delas.

**Branch:** `feat/hierarquia-de-chats`, na pasta `Desktop\Projetos\orca-canvas`.
Nasceu de `feat/canvas-chats` com a versão enxuta (`feat/orca-enxuto`, commit `dd3b45481a`) juntada
em 10/11/2026 (commit `cb4d122c2b`). A branch antiga `feat/canvas-chats` ficou intacta.

## Fase 0 — Base e prova do motor

| #     | Tarefa                                                         | Prova                                                                                            | Estado                                                                                                                                                                                                     |
| ----- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-001 | Criar a branch em cima da versão enxuta                        | `git log` mostra o merge `cb4d122c2b`, sem conflito                                              | [x] 10/11/2026                                                                                                                                                                                             |
| T-002 | Checagem de tipos limpa na branch nova                         | Saída de `pnpm tc --compiler=native` com código 0                                                | [x] 10/11/2026: código 0. A 1ª tentativa caiu por lentidão da máquina (o teste de versão do `bun` estourou 2 s), não por erro de tipo                                                                      |
| T-003 | Conferir que a versão enxuta manteve orquestração e fluxograma | `REMOVIDOS.md`: orquestração não está na lista de desligados; "Fluxograma" está em "Não cortado" | [x] 10/11/2026                                                                                                                                                                                             |
| T-004 | Achar o comando do Orca que fala com o fork                    | `orca-dev.cmd status --json` responde `reachable: true`, versão do app 1.4.249                   | [x] 10/11/2026 (ver achado A-1)                                                                                                                                                                            |
| T-005 | Subir o limite de níveis de 1 para 2                           | Configurações → Orchestration → "Nested worker depth" = 2                                        | [ ] **depende do Kaique** (ver achado A-2)                                                                                                                                                                 |
| T-006 | Registrar as pastas dos chats de prova como confiáveis         | Os chats de prova chegam a trabalhar, sem parar na pergunta de confiança                         | [x] 10/11/2026 para pasta já usada (`orca-canvas`): os dois chats trabalharam. Pasta nova, criada na hora, ainda precisa do registro (fica para T-008)                                                     |
| T-007 | Prova de 1 nível: lançar 1 chat com modelo escolhido           | Saída do lançamento + status do chat com pai e modelo certos                                     | [x] 10/11/2026: execução `run_a4a55de06fcb`, tarefa `task_48cabdce296f`. O chat respondeu "claude-sonnet-5-5" e o Orca registrou nível 1 (`dispatch.depth = 1`). A 1ª tentativa falhou (achados A-5 e A-6) |
| T-008 | Prova de 2 níveis: um Opus que cria um Sonnet                  | Saída com os dois chats, pai e modelo certos                                                     | [ ] depende de T-005                                                                                                                                                                                       |
| T-009 | Conferir se "fable" é aceito como nome de modelo               | Chat lançado com Fable mostra o modelo no status                                                 | [x] 10/11/2026: tarefa `task_2a896750e9ab`, o chat respondeu "claude-fable-5-2"                                                                                                                            |
| T-010 | Conferir se a tela enxerga o pai nos dois níveis               | Print do painel de agentes com a árvore                                                          | [ ] depende de T-008                                                                                                                                                                                       |
| T-011 | Conferir se dá para distinguir mensagem digitada pelo Kaique   | Resultado anotado; se não der, vale o botão "vou mexer aqui" (risco P-3 do plano)                | [ ]                                                                                                                                                                                                        |
| T-012 | Decidir: plano normal ou plano B                               | Resultado de T-008 escrito aqui; se for plano B, OK do Kaique para o novo texto do FR-4          | [ ]                                                                                                                                                                                                        |

### Achados da Fase 0

- **A-1 (10/11/2026).** O `orca` que o terminal acha primeiro é o Orca oficial instalado, e ele
  **não alcança** o fork (`runtime: starting, reachable: false`). O comando certo é
  `%APPDATA%\orca-fork\cli\bin\orca-dev.cmd`, que alcança o fork (`appVersion 1.4.249`) e aceita a
  opção de modelo. Ele imprime "1.4.197" como versão própria; é só o rótulo do pacote do comando,
  o app que responde é o 1.4.249. Consequência para o plano: o comando `hierarquia` chama sempre o
  `orca-dev.cmd` do fork, nunca o `orca` solto. A etapa 0.3 do plano fica resolvida sem remontar nada.
- **A-2 (10/11/2026).** O limite de níveis só muda pela tela de Configurações do Orca (aba
  Orchestration). Não há comando para isso, e editar o arquivo de dados com o app aberto não vale
  porque o app regrava. Valor hoje: 1.
- **A-3 (10/11/2026).** A versão enxuta desligou todos os agentes menos o Claude. A hierarquia só
  usa Claude, então não afeta.
- **A-4 (10/11/2026).** Com a checagem de tipos rodando, a máquina ficou lenta a ponto de comandos
  simples passarem de 2 minutos. As provas que lançam chat (T-007 em diante) rodam só com a
  máquina livre, para não derrubar o serviço de terminais.

- **A-5 (10/11/2026).** Na 1ª tentativa de T-007 a ordem **não chegou** ao chat: com a máquina
  lenta, o Orca digitou a ordem antes de o Claude terminar de abrir e ela se perdeu (o lançamento
  voltou `outcome_unknown` / `turn_start_unobserved`, e a tela do chat ficou com a caixa vazia).
  Na 2ª tentativa, com 180 s de espera (`--timeout-ms 180000`), entrou de primeira. Consequência:
  o comando `hierarquia` lança sempre com espera longa e, se voltar "não observado", lê a tela do
  chat antes de decidir; nunca relança no escuro.
- **A-6 (10/11/2026).** Na mesma 1ª tentativa o Orca avisou "o chat parou sem entregar" mostrando
  uma conversa que **não era a do chat de prova**: era a do Diário de Bordo, que roda um Claude
  sem tela na pasta `Projetos` toda vez que um chat abre. Os dois estavam na mesma pasta e o Orca
  trocou as conversas. Consequência: chat da hierarquia nunca roda numa pasta em que outro Claude
  roda ao mesmo tempo. O plano já dá uma cópia separada a cada executor (FR-19); passa a valer
  também para planejador. O aviso "parou sem entregar" (FR-22) tem que conferir a tela do chat
  antes de acreditar na conversa.
- **A-7 (10/11/2026).** O status do chat de prova não trouxe pai nem modelo prontos
  (`projection.parent` e `projection.provider.model` vazios em 1 nível). O modelo aparece no
  pedido de lançamento e na tela do chat. Se continuar assim em 2 níveis, a tela tira papel,
  modelo e pai do registro do projeto, que o comando `hierarquia` escreve, e não do status.

## Fase 1 — Comando e papéis, sem tela

| #     | Tarefa                                                           | Prova                                                                                                                                 | Estado                                                                                                                                             |
| ----- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-101 | Escrever os três textos de papel                                 | Arquivos em `skills/hierarquia/papeis/` lidos e aprovados pelo Kaique                                                                 | [ ] escritos em 10/11/2026, **aguardando a leitura do Kaique**                                                                                     |
| T-102 | Modelo do `PRODUTO.md` e roteiro da entrevista do PO             | Arquivo em `skills/hierarquia/modelos/`                                                                                               | [ ]                                                                                                                                                |
| T-103 | Registro do projeto: formato de `registro.jsonl` e `estado.json` | Documento curto do formato + teste de leitura e escrita                                                                               | [ ] em parte: os tipos de linha do registro já existem em `skills/hierarquia/regras.mjs` (`montarEstado`); falta o documento e a gravação em disco |
| T-104 | Regras de quem cria quem, modelo por papel e teto                | Testes: PO cria planejador e executor; planejador cria só executor; executor é recusado; 3º planejador e 5º executor entram em espera | [x] 10/11/2026: `node --test skills/hierarquia/regras.test.mjs`, 17 de 17 passando                                                                 |
| T-105 | Regra da ordem com cinco campos                                  | Teste: ordem sem um campo é recusada dizendo qual falta                                                                               | [x] 10/11/2026: mesmo comando, 17 de 17                                                                                                            |
| T-106 | `hierarquia criar-po`                                            | Pasta `.hierarquia/` criada e aba do PO anotada, num projeto de teste descartável                                                     | [ ]                                                                                                                                                |
| T-107 | `hierarquia ordem` ligado ao lançador do Orca                    | Chat criado com papel, modelo e cópia separada da pasta; linha no registro                                                            | [ ] depende de T-012                                                                                                                               |
| T-108 | `hierarquia estado`                                              | Mostra frentes terminadas, paradas e em espera a partir do registro                                                                   | [ ]                                                                                                                                                |
| T-109 | Hook de abertura do PO                                           | PO recriado do zero responde a 5 perguntas que só estão nos arquivos                                                                  | [ ]                                                                                                                                                |
| T-110 | Pedido de mentira de ponta a ponta até o executor trabalhar      | Registro com PO, planejador e executor, pai e modelo certos                                                                           | [ ] depende de T-107                                                                                                                               |

## Fases 2 a 4

Detalhadas depois de T-012. O conteúdo de cada fase está na seção 3 do `plan.md`.
