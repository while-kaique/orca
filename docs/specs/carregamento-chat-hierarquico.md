# Spec: máscara de carregamento do chat hierárquico

Ordem o-011 · planejador · 11/11/2026 · branch `kaiquebreno-ggp/feat-planejador-hierarquia-chats`

Estado: **aguardando o OK do Kaique.** Nenhum código foi escrito. Depois do OK, um executor
implementa as tarefas da seção 8.

## 1. O que faz

Quando o Kaique abre um chat no modo **Hierárquico**, o card do fluxograma nasce já coberto
por uma máscara azul que diz em que ponto o PO está subindo:

1. `Iniciando...`
2. `Carregando funções...`
3. `Esperando um pedido`

As três etapas aparecem sempre listadas, uma embaixo da outra: a que já passou tem um ✓, a
atual fica em destaque e a que falta fica apagada. O card inteiro fica com o azul da etiqueta
do PO enquanto isso. Quando o primeiro pedido do Kaique chega ao chat, a máscara some e o card
vira um card normal.

Se o chat travar ao subir, a máscara para numa **tela de problema** em vermelho, que diz em que
etapa parou e por quê, e fica ali até o Kaique agir. Nada tenta de novo sozinho.

## 2. Como o fluxograma sabe que o chat é hierárquico

Hoje o fluxograma só descobre o papel de um chat quando ele aparece em
`.hierarquia/estado.json`, e o PO só entra lá quando ele mesmo roda `hierarquia criar-po`.
Até lá o card é um "Terminal 1 / parado / sem mensagens ainda" igual a qualquer outro.

**Decisão:** quem marca o chat é o próprio lançamento, no mesmo instante em que a aba nasce.

- `launchPcDeskChat` (`src/renderer/src/components/sidebar/pc-desk-switcher/launch-pc-desk-chat.ts`)
  já sabe que está lançando o PO (`PO_LAUNCH`, modo `'hierarquico'` com o agente Claude).
- O retorno de `launchAgentInNewTab` traz o id da aba nova (`surface.tabId`). Logo depois,
  na mesma chamada, o lançamento grava um **registro de lançamento** para essa aba:
  `{ tabId, desde (hora), textoDoLancamento (o prompt do PO_LAUNCH) }`.
- O registro mora num arquivo novo do fluxograma (`canvas-chats/canvas-chat-launch-mask.ts`),
  só na memória do Orca aberto. Não grava arquivo, não cria sinal novo no comando `hierarquia`
  e não mexe em `src/shared/canvas-hierarchy`.
- O card lê esse registro. Sem registro, o card é exatamente o de hoje.

**Por que na memória e não em `.hierarquia/`:** é o único jeito de o card saber no mesmo
instante (o `estado.json` só é relido a cada 3 s), e é o que garante o critério 6 de graça:
um Orca reiniciado não tem registro nenhum, então um PO pronto nunca volta a mostrar a máscara.
O custo está na seção 7 (um Orca reiniciado **no meio** do carregamento perde a máscara).

## 3. Sinal de cada etapa

Todos os sinais já existem. O estado do chat vem das funções da barra lateral
(`useWorktreeActivityStatus`, a mesma que pinta o card hoje via `useCanvasChatStatus`), nunca do
campo cru do status do agente. O papel vem do `estado.json` que o fluxograma já lê
(`chat.hierarchy`, montado em `canvas-chat-hierarchy.ts`).

| Etapa                      | Começa quando                                              | Termina quando                                                                                                  |
| -------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 1. `Iniciando...`          | a aba nasce com registro de lançamento                     | o estado da barra lateral sai de "parado" pela primeira vez (o Claude recebeu o prompt e começou a rodar)       |
| 2. `Carregando funções...` | fim da etapa 1                                             | o chat aparece no `estado.json` com papel **PO** **e** o primeiro turno terminou (estado da barra = "terminou") |
| 3. `Esperando um pedido`   | fim da etapa 2                                             | chega o primeiro pedido do Kaique                                                                               |
| fim da máscara             | o último prompt do chat deixa de ser o texto do lançamento | —                                                                                                               |

Confirmo a sugestão do PO, com dois ajustes:

- **Fim da etapa 2 pede as duas coisas** (registrado como PO e turno terminado). Só "registrado"
  mostraria "Esperando um pedido" com o PO ainda lendo o papel; só "turno terminado" esconderia
  um `criar-po` que falhou.
- **"Primeiro pedido chegou" = o prompt mudou**, não "voltou a trabalhar". O último prompt do
  chat (o mesmo que o card já mostra como `› ...`) é comparado com os primeiros 60 caracteres do
  texto do lançamento, sem diferença de espaços. Se o Kaique escrever antes da etapa 3, a máscara
  some na hora, em qualquer etapa: ele já está usando o chat.

As etapas não dependem de cronômetro. O único relógio é o prazo da falha da etapa 1 (seção 4),
que só decide "deu problema", nunca a passagem entre etapas.

**Pedido de permissão no meio do caminho** (estado "precisa de você"): não é falha. A etapa
atual continua e ganha uma linha embaixo, `Pedindo permissão: abra o chat para responder`.

## 4. Falhas: sinal e texto de cada uma

Qualquer falha troca a máscara pela tela de problema, para sempre, até o Kaique agir. Ela some
só quando ele manda um pedido ao chat (fim normal da máscara) ou fecha o chat. Abrir o card
mostra o terminal de verdade para investigar.

Título fixo: **`Deu problema ao abrir o PO`**. Embaixo, `Parou em: <nome da etapa>` e o motivo:

| Falha                          | Sinal                                                                                                                | Motivo na tela                                           |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Terminal morreu                | a aba tinha terminal e ficou sem nenhum (`ptyIdsByTabId` da aba vazio), com a aba ainda aberta                       | `O terminal do chat fechou.`                             |
| Agente parou com erro          | estado da barra = "falhou" ou "interrompido" durante as etapas 1 ou 2                                                | `O agente parou com erro antes de terminar de subir.`    |
| `criar-po` falhou ou não rodou | primeiro turno terminou e, depois de 2 leituras seguidas do `estado.json` (cerca de 6 s), o chat não aparece como PO | `O chat terminou de subir mas não se registrou como PO.` |
| Nunca começou                  | etapa 1 dura mais de **120 s**                                                                                       | `O agente não começou a rodar em 2 minutos.`             |

Última linha, sempre: `Abra o chat para ver o que aconteceu.`

O card com problema troca o azul pelo **vermelho que já existe para "precisa de você"**
(`--cc-wait`), com o mesmo anel. Sem cor nova.

**Por que 120 s na etapa 1:** nesta máquina abrir um processo leva cerca de 1 s por causa do
antivírus, e o Claude abre vários ao subir. A entrega mede o tempo real da etapa 1 no fluxo de
verdade; se passar de 40 s, o prazo é revisto com o PO antes de fechar.

**Por que 2 leituras na terceira falha:** o `estado.json` pode ser lido no meio de uma
gravação e vir vazio por um instante (`readSnapshot` devolve nada nesse caso). Uma leitura só
daria falso alarme.

## 5. Como fica na tela

- **Onde:** a máscara cobre o card inteiro (cabeçalho e corpo), de borda a borda, menos o "x"
  de fechar, que continua clicável. Assim o "Terminal 1 / parado / sem mensagens ainda" nunca
  aparece. O cabeçalho não é alterado: a máscara fica por cima dele.
- **Topo da máscara:** `Abrindo o PO` em letra pequena e forte.
- **Lista das etapas:** três linhas. Passada: ícone ✓ (lucide `Check`) e texto apagado. Atual:
  o girador do `ChatRestoreLoading` (etapas 1 e 2) ou um ponto azul fixo (etapa 3, que é
  espera, não trabalho) e texto em destaque. Futura: círculo vazio e texto apagado.
- **Visual de base:** o mesmo do `ChatRestoreLoading` ("Restaurando o chat…", em
  `terminal-pane/SessionRestoredBanner.tsx`): fundo opaco, centralizado, girador de 22 px,
  texto 14 px forte e 12 px apagado. Reaproveita a animação `chat-restore-spin`.
- **Cor do card:** borda e brilho em `var(--color-blue-600)`, o azul sólido da etiqueta do PO
  (commit 370c71c522). Enquanto a máscara está ativa, o anel amarelo de "trabalhando", a
  respiração verde de "terminou" e o tracejado de "visto" ficam desligados nesse card. O azul é
  outro tom do roxo de "em segundo plano" (`#8b8cf6`) e vem sempre com a lista de etapas, então
  não se confunde com nenhum estado (confere-se lado a lado com o cenário `exemploEstados`).
- **Card aberto (clicado):** mostra o terminal de verdade, sem máscara. Só a borda azul fica.
- **Espiada ao passar o mouse:** desligada enquanto a máscara está ativa, para o card não
  trocar a máscara pelo terminal.
- **Textos** passam por `translate('fork.canvas.launch...', ...)` como o resto do card. Os três
  textos usam três pontos normais (`...`), exatamente como o Kaique escreveu.
- **CSS** num bloco próprio no fim de `canvas-chats.css`, com o comentário
  `/* máscara de carregamento do chat hierárquico (o-011) */`. Só `var(--color-blue-600)`,
  `--cc-wait`, `--foreground`, `--muted-foreground` e `--background`.

## 6. Requisitos

1. A máscara está na tela no primeiro desenho do card: o registro é gravado na mesma chamada
   síncrona que cria a aba, antes de o React redesenhar.
2. Só chats lançados por `launchPcDeskChat` com `PO_LAUNCH` ganham registro. Modo Livre, agente
   que não é o Claude e chats que já existiam não ganham.
3. O registro é apagado quando a máscara termina normalmente ou quando a aba fecha. Com
   problema, ele fica até uma dessas duas coisas.
4. A etapa é calculada a cada desenho a partir dos fatos da seção 3. O registro guarda só o
   mínimo que os fatos não guardam: hora do lançamento, se a aba já teve terminal e quando o
   turno terminou sem papel.
5. Nenhuma leitura de arquivo nova, nenhum timer global: só um timer por card mascarado (para
   o prazo de 120 s e as 2 leituras), desligado quando a máscara some.
6. A mudança em `CanvasChatsNodes.tsx` fica em poucas linhas: ler o registro, um atributo
   `data-launch` na raiz do card, o `|| mascarado` na espiada e a linha que desenha a máscara.
   Nada de reformatar o resto.

## 7. Critérios de aceite (o que dá para ver ou medir)

| #   | Critério                                                                                    | Como se confere                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Card nasce mascarado, sem passar por "Terminal 1 / parado / sem mensagens ainda"            | fluxo real: print por CDP tirado logo depois do lançamento já mostra a máscara                                                              |
| A2  | Três etapas visíveis, com os textos exatos, e dá para ver qual é a atual                    | 3 prints de cenário, um por etapa                                                                                                           |
| A3  | Cada etapa muda por fato, não por tempo                                                     | fluxo real: prints das 3 etapas com hora, junto do estado da barra e do `estado.json` no mesmo momento                                      |
| A4  | Card azul nas três etapas, distinto das cores de estado; volta ao normal no primeiro pedido | prints de cenário ao lado de `exemploEstados`; fluxo real: print depois de mandar um pedido                                                 |
| A5  | Falha para numa tela de problema vermelha que diz a etapa e o motivo, sem tentar de novo    | print do cenário de falha; fluxo real: abrir um segundo PO no projeto de teste que já tem PO (o `criar-po` recusa) e ver a tela de problema |
| A6  | Livre e chats antigos iguais; reiniciar com PO pronto não mostra máscara                    | fluxo real: abrir um chat Livre (sem máscara); reiniciar o Orca de teste com o PO pronto (sem máscara)                                      |
| A7  | Tipos e lint limpos                                                                         | `pnpm tc:web` e `pnpm exec oxlint` nos arquivos tocados, saída anexada                                                                      |

**Fora do escopo**

- Planejador e executor (critério 7 da ordem): eles nascem por `hierarquia ordem`, pelo
  `orca-dev orchestration worker-start`, não por `launchPcDeskChat`, então o fluxograma não
  sabe deles no nascimento. Daria para usar o mesmo desenho se o comando `hierarquia` registrar
  o chat antes de ele subir (é o que outra ordem está fazendo), mas a etapa 2 não serve para
  eles: o primeiro turno de um executor já é o trabalho, não "carregar funções". Custo
  estimado: um sinal novo no comando (`papel_lido`) e uma regra a mais na máscara, cerca de
  meio dia. **Não entra.**
- Orca reiniciado ou janela recarregada **no meio** do carregamento: a máscara se perde e o
  card volta ao normal (o registro é só da memória).
- Contar o card com problema no contador "precisa de você" do projeto e da barra lateral.
- Agente que não é o Claude no modo Hierárquico (hoje já abre como chat simples).

## 8. Riscos e regressões

| Risco                                 | O que pode quebrar                                                            | Como a entrega confere                                                                                                                                                                    |
| ------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Conflito com as outras ordens no card | o cabeçalho, as etiquetas e o desenho do card mudam em outras branches        | a máscara fica por cima do cabeçalho sem mexer nele; `git diff` de `CanvasChatsNodes.tsx` com no máximo ~10 linhas novas e nenhuma linha alheia reformatada; CSS só num bloco novo no fim |
| Cor do estado vazando                 | o anel amarelo de "trabalhando" aparece por cima do azul na etapa 2           | print do cenário da etapa 2 com o chat em "trabalhando" por baixo: sem anel amarelo                                                                                                       |
| Card normal mudando                   | regra de CSS ou de estado afeta card sem registro                             | print de `exemploEstados` antes e depois da mudança, comparados lado a lado                                                                                                               |
| Falso alarme de falha                 | prazo curto na máquina lenta, ou `estado.json` lido no meio da gravação       | tempo real da etapa 1 medido e relatado; regra das 2 leituras                                                                                                                             |
| Máscara presa para sempre             | uma passagem que nunca acontece                                               | todo caminho termina em etapa seguinte, problema ou fim; o fluxo real passa pelas 3 etapas até o fim                                                                                      |
| Abertura do Orca mais lenta           | trabalho novo na subida                                                       | nada roda na subida: o registro só existe depois de um lançamento; A6 confere o reinício                                                                                                  |
| Teste mexendo no projeto real         | o Orca de teste lendo o `.hierarquia/` de verdade e encerrando o PO do Kaique | o fluxo real roda com perfil separado e num projeto de teste fora do git, nunca em `Desktop\Projetos\orca`; o Orca em uso pelo Kaique não é fechado nem reiniciado                        |
| Conflito na linha da espiada          | outra ordem pode mexer na mesma linha do `usePeek`                            | mudança de uma expressão só; conflito, se houver, o PO resolve ao juntar                                                                                                                  |

## 9. Plano de tarefas

**Um executor.** As partes dependem umas das outras (registro → etapa → máscara → cenários →
fluxo real) e cabem num território só; dividir só criaria espera entre executores.

Tarefa única, nesta ordem, cada passo com a prova dele:

1. `canvas-chats/canvas-chat-launch-mask.ts`: registro de lançamento (gravar, ler, apagar) e a
   função que devolve `{ etapa, problema }` a partir dos fatos da seção 3 e 4.
2. `launch-pc-desk-chat.ts`: gravar o registro logo depois do `launchAgentInNewTab` quando o
   lançamento é o `PO_LAUNCH` (o passo 1 apaga o registro quando a aba fecha).
3. `canvas-chats/CanvasChatLaunchMask.tsx` e o bloco de CSS; ligar no `ChatNode` com as poucas
   linhas do requisito 6.
4. Quatro cenários novos em `CanvasChatsPage.fixture.tsx` / `canvas-chats-fixture-scenario.ts`:
   `carregandoIniciando`, `carregandoFuncoes`, `carregandoEsperando`, `carregandoProblema`.
   Prova: `pnpm fixtures:shot canvas-chats/CanvasChatsPage:<cenário> --scale 2` de cada um,
   mais `exemploEstados` antes e depois, abertos e conferidos.
5. Fluxo real numa janela oculta (`ORCA_BACKGROUND_LAUNCH=1`, perfil separado, projeto de teste,
   prints por CDP): as 3 etapas mudando com hora, o fim no primeiro pedido, a falha do segundo PO,
   um chat Livre sem máscara e o reinício com PO pronto sem máscara.
6. `pnpm tc:web` e `pnpm exec oxlint` nos arquivos tocados; `pnpm exec oxfmt --check` neles.
   Sem teste novo (regra do AGENTS.md). Commit na branch do executor, sem push.

Tempo estimado do executor: cerca de 3 a 4 horas, a maior parte no fluxo real (cada abertura do
PO leva alguns minutos para subir).
