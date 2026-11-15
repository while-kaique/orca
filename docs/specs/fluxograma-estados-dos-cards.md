# Fluxograma: estados dos cards e fluxograma leve (ordem o-044)

Spec curta do planejador. Base: `feat/pc-como-mesa` em `a5e94fe7be`. Ordem inteira em
`.hierarquia/ordens/o-044.md`; parte 1 em `.hierarquia/ordem-estado-falta-seu-ok.json`. Não abre decisão de produto
nova: os pontos em que a ordem deixa escolha estão marcados como **decisão do planejador**, com o motivo.

## Parte 1: "precisa de você" de verdade

**Causa (lida no código, a confirmar rodando):** `chatStatus()` e `useCanvasChatStatus()`
(`canvas-chats/canvas-chats-data.ts`) só dão `waiting` com pedido de permissão ou agente bloqueado. Um chat que
terminou a vez perguntando em texto não tem sinal. E quando sobra um comando em segundo plano, o host junta o
turno encerrado do chat (`mainAgent.state === 'done'`) com o comando vivo e manda `state: 'working'`,
`workingMode: 'monitoring'` (`shared/agent-status/lifecycle/agent-lead-status-fold.ts`); `monitoring` vem antes de
tudo o que é "terminou", e o card diz "em segundo plano".

**Sinal escolhido (decisão do planejador):** o fim do texto da última resposta da vez
(`lastAssistantMessage` / `lastCompletedAssistantMessage`, o mesmo texto que o card já mostra), lido por
`replyAsksUser()` em `canvas-chats/canvas-chat-asks-user.ts`: nas 3 últimas linhas, uma pergunta (`?` fora de código
e link), um pedido de OK escrito ("falta seu OK", "esperando o seu ok"), um pedido para ele digitar uma palavra
("me diga \"abri\"") ou uma linha "Próxima ação:" com verbo para ele (responda, escolha, libere...). Não conta:
"nenhuma sua", "(do PO)", saudação de chat vazio, "quando X acontecer, me diga".
Por que esse: é o único sinal que existe para **todo** chat (Livre não tem registro da hierarquia), já chega ao
renderer sem leitura de arquivo, e a medida deu poucos erros (abaixo). Gravar um sinal novo pelo comando
`hierarquia` mexeria em `skills/hierarquia/**`, que tem outro dono.

**Medida** (`.hierarquia/provas/o-044/sinal-precisa-de-voce.md`): 120 fins de vez reais rotulados à mão, de 42
conversas de topo (PO e Livre). Conjunto separado, nunca usado para ajustar a primeira versão: 23 de 24 pedidos
achados, 0 alarme falso em 36. Os dois conjuntos juntos, versão final: perde 4 de 50 pedidos e grita à toa 2 vezes
em 70 fins sem pedido (as duas: "quando a geração voltar, me diga 'gera as fotos'", que espera outra coisa antes).

**Quem pode estar "precisa de você" pelo texto (decisão do planejador):** só chat de topo, PO ou Livre. Planejador e
executor perguntam ao criador pelo comando `hierarquia`; o texto final deles é para o PO, não para o Kaique.

**Regra do estado (ordem de prioridade):**

1. Permissão, agente bloqueado, ou turno do chat encerrado com pergunta (`replyAsksUser`) e sem nenhuma vez nova
   depois: `waiting` ("precisa de você", vermelho). Ganha de segundo plano, de terminou/visto e de aguardando equipe.
2. `working`.
3. Turno do chat ainda aberto só por comando de fundo: `monitoring` ("em segundo plano").
4. Aguardando equipe: um filho (a qualquer profundidade) está **trabalhando ou em segundo plano**
   (`canvas-chat-team-wait.ts` hoje só olha `working`; o pai do o-032 ficava "visto").
5. `unseen` / `seen` / `idle`.

Com `waiting` e comando de fundo ao mesmo tempo, o card mostra "precisa de você" na borda e no estado, e o comando de
fundo como detalhe (a linha do processo em segundo plano que o card já desenha, mais o ponto do estado).
A pergunta respondida apaga o estado: a vez nova (prompt do Kaique) troca o `stateStartedAt` e o texto.

**Cores (decisão do planejador, dentro do STYLEGUIDE):** "aguardando equipe" fica no roxo (`--color-purple-500`);
"em segundo plano" sai do índigo `#8b8cf6` para o ciano (`--color-cyan-400`), com borda tracejada, para não ler
"alguém está esperando". Nomes ficam ("em segundo plano", "aguardando equipe"). Legenda e bolinha da barra seguem.

**Barra lateral:** a bolinha da linha do chat usa a mesma regra (mesmo seletor).

## Parte 2: projeto apagado

Projeto **ativo** se algum chat dele está: trabalhando, precisa de você, terminou e não visto, em segundo plano,
aguardando equipe, ou nascendo (máscara). Senão (todos parados, vistos ou suspensos): **apagado**: cabeçalho cinza
(sem a cor do projeto), cards com o conteúdo esmaecido, ainda clicáveis e com contraste de texto de pelo menos 4,5:1.
Decisão do planejador: "em segundo plano" acende (algo do projeto está rodando). Entrada do projeto na barra lateral
segue a mesma regra se ela tiver cor.

## Parte 3: Suspender e Fechar definitivamente

- Botão **Suspender** no card: para o processo do chat (libera memória), o card fica no lugar com o estado
  "suspenso"; um clique acorda o chat com a conversa guardada. Base: o hibernar que já existe
  (`shutdownCompletedAgentPaneForHibernation`, evento `WAKE_HIBERNATED_AGENTS_WORKTREE_EVENT`, o chat dormindo que o
  card já acorda).
- O **X** do card abre três escolhas: Suspender, Fechar definitivamente, Cancelar. Fechar definitivamente para o
  processo e tira o card. Chat trabalhando: uma confirmação a mais que diz o que se perde.
- Antes de codar, mede-se no Orca de teste se a árvore de processos do chat morre no X de hoje. Se sobra processo,
  mata-se só a árvore daquele chat, nunca por nome. Se isso pedir `src/main`, o planejador pergunta ao PO.

## Parte 4: fluxograma leve

Suspeitos lidos no código (`canvas-chats.css`): a "respiração" do card terminou (`cc-breathe`, 4,5 s, infinita)
anima `border-color` e `box-shadow` com 30 px de desfoque, que repinta o card inteiro a cada quadro, no processo da
tela e no de vídeo; o anel do card trabalhando (`cc-lap`) anima uma propriedade CSS (`--cc-angle`), que também
repinta. Medida no Orca de teste com cópia do estado (11 cards ou mais): segundos de processador a cada 5 s, processo
da tela e de vídeo, como está, com cada suspeito desligado, e com o conserto. Conserto sem mudar o que se vê: o
brilho vira camada própria animada só em opacidade (a placa de vídeo compõe sem repintar). Se a meta pedir tirar algo
visível, pergunta ao PO.

## Parte 5: um Orca de teste só

`tools/vistoria-fluxograma/orca-de-teste.mjs` ganha uma trava única da máquina (arquivo com dono, pasta, PID e hora
em `%TEMP%`): `abrirOrcaDeTeste` recusa abrir um segundo enquanto o dono estiver vivo e diz quem é; trava de dono
morto é tomada. Montagem reaproveitada: guarda o commit montado e só monta de novo se o código mudou. Comando
`node tools/vistoria-fluxograma/orca-de-teste.mjs estado|abrir|fechar`. `hierarquia vez` continua sendo a fila dos
comandos pesados (não se cria outra).

## Divisão

2 executores Sonnet, porque Suspender/Fechar (parte 3) e a trava do Orca de teste (parte 5) são independentes do
resto e de mais ou menos 1 hora cada. O planejador faz as partes 1, 2 e 4 (dependem uma da outra e a 4 é medida),
junta e prova o conjunto.

## Resultado (14/11, rodada final)

- **Parte 3, o que a medida mostrou:** no Windows o comando que o agente deixa em segundo plano escapa do job do
  terminal; o X de hoje deixava 1 de 7 processos vivo. Conserto (OK do PO, p-012) em
  `src/main/pty/process-retirement/windows-detached-descendant-sweep.ts`: foto da árvore pelo PID raiz antes do job,
  depois mata por PID só o que continua sendo o mesmo processo (data de criação). Vale para todo
  `killWithDescendantSweep` no Windows: chat de agente e fechamento forçado de terminal comum (o fechamento normal de
  terminal comum não passa por ali).
- **Acordar:** o registro de sono do Suspender é o mesmo do hibernar do Orca (`state: 'done'`, sem "só ao abrir a
  aba"); o clique retoma a mesma sessão (`claude --resume <id>`).
- **Parte 4 (decisão do PO, p-013):** respiração a 10 quadros/s (mesma curva), anel girando por transform a 24
  quadros/s; medido num Chrome sem janela porque a janela escondida do Orca de teste não pinta.
- **Parte 5:** `orca-de-teste.mjs abrir` segura o Orca vivo até o `fechar`; desconectar não fecha o Orca reusado.
