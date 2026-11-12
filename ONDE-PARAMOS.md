# Onde paramos — fork do Orca "PC como mesa"

## 12/11/2026 (tarde, ordem o-021) — comando `hierarquia`: PO dorme, aviso por pedido, fila, vez, chat morto

**Como ler:** **VISTO NO ORCA REAL** = rodado no Orca em uso com chats de teste de verdade, com a saída
guardada. **SÓ DECLARADO** = escrito, sem ter sido visto funcionando. Provas em
`.hierarquia/provas/o-021/` (pasta principal, fora do git). Spec: `docs/specs/hierarquia-fluxo-sem-vigia.md`.
Branch: `kaiquebreno-ggp/planejador-o-021-hierarquia` (não enviada; quem junta é o PO).

**Regras de fluxo que o PO já escreveu nos papéis hoje** (commits `cfaa99b890`, `101ce4fef5`, `f52ea0b03f`):

- O PO lança e **dorme**; só acorda com o pacote de um pedido, uma pergunta ou o Kaique.
- O **planejador é dono da área até o fim**: cria executores, junta, prova no produto real e entrega um
  pacote só. A prova é sempre do **produto de verdade**, nunca de cenário montado.
- **Vários pedidos em fila** (`.hierarquia/FILA.md`, uma linha por pedido); cada pedido fecha sozinho.
- "Faz isso" dito ao PO é ordem para **planejar e organizar chats**, não para ele codar. Coisa pontual vai
  para um chat livre.
- Teto: **2 planejadores e 2 executores trabalhando por projeto** (antes eram 4 executores por criador).

**O que mudou para quem usa** (todos os comandos com `hierarquia`):

- **Aviso por pedido.** `ordem --pedido NOME [--na-frente]`. Um processo de fundo por chat criador (o
  "vigia") segura a caixa de correio dele e escreve **uma** linha no chat quando todas as ordens daquele
  pedido terminam: `PEDIDO FECHADO: NOME. Entregaram: ... Pararam: ...`. **VISTO NO ORCA REAL:** no pedido
  TESTE-X, a 1ª entrega (14:35:07) não escreveu nada; a 2ª fechou o pedido com uma linha (14:40:40), com o
  TESTE-Y ainda trabalhando; depois TESTE-Y, M1, M2 e V, cada um com a sua linha (`tela-do-criador.txt`,
  `registro-dos-testes.txt`). **Falha parcial:** com o Orca lento (30 a 56 s por chamada), o aviso do próprio
  Orca "You have N orchestration messages" ainda escapou algumas vezes; o conteúdo foi para o vigia.
- **Fila com prioridade e teto 2+2.** Ordem acima do teto espera e sai sozinha; `--na-frente` pega a próxima
  vaga. **VISTO NO ORCA REAL:** X2 (`--na-frente`) saiu 1,6 s depois da entrega do X1, antes do Y (`estado-1.txt`).
- **Chat morto e baixa.** Ordem cujo chat fechou, caiu ou ficou 20 min sem nada na tela vira "parou"
  sozinha e fecha o pedido; `baixa --ordem ID --motivo "..."` para quem criou. **VISTO NO ORCA REAL:** aba
  da o-026 fechada às 15:10:42, parada sozinha às 15:11:30; baixa da o-027 (`B-*.txt`).
- **Lançamento sem mão.** Número da ordem sob trava (dois lançamentos juntos nunca repetem); ordem parada
  na caixa é enviada mesmo com o Orca lento; o vigia tenta de novo. **VISTO NO ORCA REAL:** dois
  lançamentos juntos (o-001/o-002 e o-026/o-027) nasceram registrados. A o-026 e a o-027 ficaram
  digitadas sem enviar; o vigia enviou as duas sozinho (o-027: `chat_iniciou` com `porVigiaDoCriador`
  às 15:11:01; o-026 começou às 15:06:49, pelo `ok.txt`, mas o registro dela ficou "não começou" porque a
  leitura da tela levou mais que a espera). Ninguém mandou tecla (`registro-dos-testes.txt`).
- **Vez para comando pesado.** `vez -- <comando>`: um por vez na máquina inteira. **VISTO:** dois juntos
  rodaram em fila; matar o dono soltou a vez em 0,49 s (`D-vez.txt`). `pnpm tc` e o print rodaram por ela.
- **Responder pergunta.** `perguntar` escreve a pergunta no chat de quem criou; `responder --pergunta p-NNN
  --texto "..."` escreve a resposta no chat que perguntou. **VISTO NO ORCA REAL:** p-003 (`E-tela-*.txt`).
- **Ver e fechar o que criou.** `estado` mostra cada chat ligado, dormindo ou fechado (lê a sessão que o
  Orca grava, sem mudar o Orca); `fechar --ordem ID | --pedido NOME | --terminados`. **VISTO:** o-018 do PO
  aparece "dormindo"; `fechar --terminados` fechou o X2 ligado e recusou fechar chat do PO
  (`adendo5-*.txt`). **SÓ DECLARADO:** fechar aba **dormindo** (não deu para produzir uma sem reabrir o
  Orca). Para os cartões dormindo do PO, depois de juntar: `hierarquia fechar --terminados`, rodado no chat
  do PO.
- **Nenhum chat da hierarquia como "Livre".** O fluxograma lia só o primeiro registro do projeto; agora
  junta todos. Abas lançadas ganham o título da ordem. **VISTO** no print do estado real com o código novo
  (`adendo4-fluxograma-real-com-teste.dark.png`). `criar-po` num 2º registro só com `--teste`.
- **Nenhuma janela de cmd.** **VISTO:** vigia rodando 2 min, zero janelas novas (`janelas-vigia-2min.txt`).

**Efeito dos meus testes em chats que não eram meus:** antes do conserto, três lançamentos meus fecharam
(liberaram) chats terminados do PO das ordens o-002, o-003 e o-004 (dispatches `ctx_5072e6967059`,
`ctx_525bb4c38e76`, `ctx_ff69be79d8ca`; `chat_encerrado` "deu lugar a outro chat" às 14:33, 14:35 e 14:38).
Hoje só fecha chat do mesmo criador.

## 12/11/2026 (rodada do PO 105fc07b) — etiquetas, desenho, "aguardando equipe", máscara e comando `hierarquia`

> **Atenção 1:** para as mudanças aparecerem no Orca em uso basta **reabrir pelo atalho "Orca (meu)"**: ele
> remonta sozinho (visto em 12/11: montagem às 10:39–10:41, depois do último commit).
>
> **Atenção 2:** a **troca de modelo com `/model` ao vivo continua sem teste.**

**Como ler:** **VISTO** = print ou teste que alguém conferiu. **DECLARADO** = escrito pelo executor, sem
prova rodada ou sem conferência do PO. Fontes, locais e fora do git: `.hierarquia/PRODUTO.md` (pedidos 5 a
18, com as palavras do Kaique), `.hierarquia/DECISOES.md`, `.hierarquia/relatorio-rodada-12-11.md`
(horários e erros) e `.hierarquia/provas/<ordem>/`.

- **Git:** `feat/pc-como-mesa` em `fdd3eff304` já tem tudo da rodada: o-009, o-010, o-011 (a spec), o-012,
  o-013, o-014, o-016 (junção `fdd3eff304`), o-017 (duas entregas) e os papéis. **Enviado ao GitHub em
  12/11 junto com este commit, pelo PO, com autorização do Kaique registrada no `DECISOES.md`.**
- **Conferência final do PO** com tudo junto (rodada em `fdd3eff304` e repetida em `8ea575dbed`, com as
  saídas dos comandos guardadas em `.hierarquia/provas/final/saida-*.txt`): `pnpm tc` sem erros, `oxlint`
  sem achados, 16 testes de `canvas-chats` e 25 testes de `skills/hierarquia` passando. **VISTO:** 6 prints
  em `.hierarquia/provas/final/`.

**1. Etiquetas de papel, de modelo e "Livre" (o-009; `370c71c522`, `abfe298aa4`; junção `10e475060a`)**

- **Para quem usa:** papel em azul (forte no PO, médio no planejador, fraco no executor). Etiqueta de
  modelo separada, em todo chat. Chat sem papel mostra "Livre". No hexágono, o papel fica no topo e o
  modelo embaixo do título.
- **Arquivos:** `CanvasChatHierarchyBadges.tsx`, `CanvasExecutorCrest.tsx`, `canvas-chats.css` e
  `canvas-chat-transcript-model.ts` (em `src/shared/`). O modelo é lido da conversa gravada do chat
  (`canvas-context-tokens-handler.ts`), porque o status do Claude não traz o modelo.
- **VISTO:** print do fluxograma com chats reais, conferido pelo PO: PO "Fable 5.2", planejador "Opus 5.5",
  executores "Sonnet 5.5", chat sem papel "Livre". A função que lê o modelo foi rodada em 2 conversas
  reais e em 5 cenários de troca.
- **DECLARADO / sem prova:** **troca de modelo com `/model` ao vivo não foi testada** (a tela relê a
  conversa a cada ~20 s; só provado com conversas gravadas). O fluxograma só tem tema escuro.
- **Histórico:** a o-009 foi reprovada 1 vez (o modelo não aparecia em nenhum chat real; o print "claro"
  era igual ao escuro). A segunda entrega fechou isso.

**2. Desenho do fluxograma (o-012 `6d672c330c`, junção `aa79b91440`; conserto da aba na o-016)**

- **Para quem usa:** card do planejador em três linhas (papel, título, contexto/modelo/estado). Hexágono do
  executor sem o quadrado em volta. Fileira vazia não ocupa espaço: executor direto sob o PO fica mais
  perto. A aba de preparação "Configuração" não vira mais card, nem sozinha na pasta.
- **Arquivos:** `CanvasChatsNodes.tsx`, `canvas-chats-layout.ts`, `canvas-chats-data.ts`,
  `canvas-chats.css`, `canvas-chats-fixture-chats.ts` (dados de exemplo, separados por limite de 300 linhas).
- **VISTO:** print conferido pelo PO (06:05): três linhas cabem no card; hexágono sem quadrado; executor
  direto a 80 px do PO contra 108 px abaixo de um planejador. 11 testes de layout passam.
- **VISTO (aba "Configuração"):** a sobra de 3 abas foi consertada na o-016 (`8705020dee`, `f17b2660c4`). O PO
  viu o print dos chats reais (`.hierarquia/provas/o-016/prints/` e `.hierarquia/provas/final/`): projeto
  `orca` sem nenhum card "Configuração" (no print da o-016 caiu de 12 para 5 chats).
- **Fontes divergem:** o resumo da o-012 declara a mesma distância do executor nos dois casos (não
  medida). Vale a medida do PO em print.
- **Limite conhecido:** a aba é reconhecida pelo nome no idioma atual do Orca. Se o idioma mudar depois de a
  aba nascer, a antiga reaparece. Não testado.

**3. Estado "aguardando equipe" (o-013 `d7fe9acbd3`; entrou pela junção da o-016, `dac54abfa0`)**

- **Para quem usa:** PO ou planejador parado, com um chat criado por ele trabalhando, mostra
  "aguardando equipe" em roxo. Some quando o último chat de baixo para.
- **Arquivos:** `canvas-chat-team-wait.ts` (novo), `CanvasChatsNodes.tsx`, `CanvasChatsPage.tsx`,
  `canvas-chats.css`, `canvas-chats-layout.ts`.
- **VISTO:** com chats reais. No print real da o-016 o card do PO aparece "aguardando equipe" em roxo, e a
  legenda tem a entrada nova. Em cenário de exemplo, o planejador também (`equipePlanejador`).
- **Sem prova:** o planejador em roxo com chat real (só cenário). A o-013 nunca rodou `entregar`; levou
  baixa manual depois da queda.

**4. Máscara de carregamento do PO (spec o-011 `1938b7f415`; código o-014 `cb2b1e39bb`; correções da o-016)**

- **Para quem usa:** chat aberto no modo Hierárquico nasce coberto por uma máscara azul com três etapas
  ("Iniciando...", "Carregando funções...", "Esperando um pedido"), que some no primeiro pedido. Se o chat
  não sobe, para numa tela de problema em vermelho. Chat Livre não muda. Só o PO por enquanto.
- **Arquivos:** spec em `docs/specs/carregamento-chat-hierarquico.md` (no git, adicionada com `git add -f`,
  porque `docs/**` está no `.gitignore`). Código: `CanvasChatLaunchMask.tsx`, `canvas-chat-launch-mask.ts`,
  `canvas-chat-launch-fixture-scenario.ts`, `launch-pc-desk-chat.ts`.
- **A primeira versão dava alarme falso:** em 3 de 3 aberturas reais de PO, a tela mostrava "Deu problema ao
  abrir o PO" aos ~25 s, com o PO subindo certo. **Causa:** o Claude avisa "terminou" aos ~18 s, ocioso,
  antes de tratar o pedido; a spec tomava isso por "primeiro turno terminou" e dava 6,5 s para o registro,
  que só acontece entre 33 s e 47 s. O erro foi da spec e da aprovação dela: o sinal foi escolhido lendo o
  código, sem medir uma abertura real. Detalhes: `.hierarquia/provas/o-016/resumo.md`,
  `.hierarquia/provas/o-016-v2/resumo.md` e seções 3, 4 e 5 da spec.
- **Correção (`e8b7053654`, `e16a557441`; junção `fdd3eff304`):** "terminou" só vale depois de o chat ter
  trabalhado com o prompt de lançamento (um "trabalhando" de 0,4 s no boot do Claude é ignorado). Falha
  nova: etapa 2 por 120 s sem receber o pedido. Cores fixas do card nos dois temas.
- **VISTO:** num Orca de teste oculto, com Claude real: 4 aberturas sem alarme falso; etapas 1, 2 e 3 ao
  vivo (etapa 3 entre 33,7 s e 44,4 s); a máscara some no primeiro pedido; o segundo PO do mesmo projeto,
  recusado pelo `criar-po`, cai na tela de problema aos 37,8 s.
- **Sem prova no fluxo real:** as falhas "terminal fechou", "agente parou com erro" e "nunca começou". A
  falha "pedido de início não chegou" só em cenário. **Não visto no Orca em uso** (não foi reaberto).

**5. Comando `hierarquia`: registro do chat novo e ordem não enviada (o-010, o-017)**

- **o-010 (`599d1c45b5`; junção `0e18e054ea`):** tentou registrar o chat novo na hora em que a aba nasce.
  **No Orca real não funcionou** (registro 4 min 12 s depois): o `task-list` real traz só `id`, `status` e
  `title`, não o texto do pedido que a o-010 procurava. Provado só com Orca de mentira.
- **o-017, primeira entrega (`dfac4226d1`; junção `5b1d1d6054`):** achava o chat pelo título da tarefa e
  exigia o terminal do worker. **No real não funcionou:** o-018 registrou 68 s depois da aba; o-019, 2 min
  54 s depois da ordem. **Causa:** enquanto o chat nasce, o Orca lista o worker como "starting", sem
  terminal e sem pasta.
- **o-017, segunda entrega (`9064af4492`; junção `6cd7229bb8`):** acha a tarefa pelo título e o terminal
  pelo único agente novo na lista de terminais, com 1 chamada ao Orca por rodada. **MEDIDA pelo PO num
  lançamento real (ordem o-020):** ordem 06:53:41, aba 06:54:22, **registro 06:54:46 (24 s depois da
  aba)**, resposta do Orca 06:55:22 (36 s depois do registro), `chat_iniciou` gravado. O critério antigo
  de "até 10 s" não foi cumprido: cada chamada ao `orca-dev` leva segundos neste PC.
- **Também no comando (o-017):** vigia a ordem digitada e não enviada (envia Enter uma única vez, grava
  `chat_iniciou` ou `chat_nao_iniciou`), e `hierarquia estado` não diz "trabalhando" sem início
  confirmado. Arquivos: `orca-lancador.mjs`, `inicio-do-turno.mjs` (novo), `regras.mjs`,
  `pedido-da-ordem.mjs`, `estado-na-tela.mjs`, `hierarquia.mjs`.
- **VISTO:** testes de `skills/hierarquia` passam (25). As respostas reais do Orca usadas estão em
  `.hierarquia/provas/o-010-real/` e `.hierarquia/provas/o-017-real/`.
- **Sem prova no real:** o envio automático da ordem parada (os lançamentos medidos chegaram todos
  `ready`) e dois lançamentos ao mesmo tempo. Com a máquina livre o lançamento levou 1,5 a 2,7 min; com 4
  a 5 chats pesados, 4 a 8 min e a ordem ficou sem enviar.

**6. Regras novas dos papéis (`913a15bc89`, `skills/hierarquia/papeis/po.md` e `planejador.md`)**

- O PO decide a divisão em chats e avisa antes de lançar; o teto de chats existe para limitar memória e
  não é preocupação do PO (regra do Kaique, 12/11).
- Frentes no mesmo arquivo podem rodar em paralelo; a junção é feita pelo git, uma branch aprovada por vez.
- **VISTO:** o texto está commitado. **Sem prova de uso.** A junção pelo git funcionou no código do
  produto e falhou duas vezes no mesmo arquivo de cenários de exemplo (ver "Aberto").

**Aberto**

- **Frontend para terminais (pedido 8):** só viabilidade, nada construído. Fonte, tamanho e cores já são
  opções do terminal (custo zero). Quebra de linha "de chat" exige tela própria: produto novo, spec própria.
- **Máscara em planejador e executor:** possibilidade, não compromisso. A spec deve dizer se os mesmos
  sinais servem.
- **Limites da máquina com vários chats pesados:** memória baixa (2 a 3 GB livres) derrubou prints. De 01:54
  a 06:02 ninguém trabalhou (causa da queda não confirmada, com 1,6 a 2,0 GB livres). Não há controle de
  recurso pesado entre chats; a trava de prints (`.hierarquia/trava-prints`) foi regra do PO e ficou presa 4 h.
- **Planejador sem o passo "spec aprovada, continue":** o PO só aprova (fecha a ordem) ou reprova. Por isso o
  executor da máscara ficou ligado ao PO e não ao planejador.
- **PO sem comando para responder a pergunta de executor** (`hierarquia perguntar`): a resposta foi dentro do
  motivo da reprovação, que conta como reprovação no registro mesmo com a entrega quase certa.
- **Comando sem baixa para ordem cujo chat morreu:** `parou_sem_entregar` foi escrito à mão no registro
  para o-013, o-014 e o-015.
- **Arquivo de cenários de exemplo (`canvas-chats-fixture-scenario.ts`):** toda frente visual o edita e
  deu conflito na junção de o-012 e de o-013. Precisa de dono, ou um arquivo por frente.
- **Também pendente:** reconstruir e reabrir o Orca em uso (OK do Kaique); testar `/model` ao vivo; testar
  no real o envio automático da ordem parada, dois lançamentos ao mesmo tempo e as falhas da máscara sem prova.

## 11/11/2026 (noite) — PO só vale enquanto a aba dele está aberta

- **Regra:** fechar a aba do chat (pelo "x" ou pela barra lateral) encerra o chat na hierarquia. Se era o
  PO, o projeto fica sem PO (`hierarquia estado` mostra `PO: (nenhum)`) e o próximo chat roda `criar-po`.
- **Como:** `canvas-hierarchy-closed-tab-watch.ts` (ligado em `AppWorkspaceShell.tsx`) vê a aba sumir e
  chama `repos:closeCanvasHierarchyChat`; o processo principal roda `hierarquia encerrar --chat ID_DA_ABA`,
  que grava `chat_encerrado`. `regras.mjs` zera `estado.po` quando o chat encerrado é o PO.
- **À mão:** `hierarquia encerrar --chat ID_DA_ABA --projeto PASTA` (recusa se rodado por chat da hierarquia).
- **Feito à mão nesta data:** o PO `1c56db15…` do projeto orca, cuja aba já estava fechada, foi encerrado.
- **Não provado ao vivo:** o aviso da tela ao fechar a aba só entra depois de reconstruir e reabrir o Orca;
  testado até aqui: regra (21 testes), comando `encerrar`, tipos e lint.
- `foraDoGit` saiu de `hierarquia.mjs` para `pasta-fora-do-git.mjs` (o arquivo passava de 600 linhas).

## 12/11/2026 — PO só abre chat com plano aprovado + consertos do comando `hierarquia`

- **Regra nova do PO** (`skills/hierarquia/papeis/po.md`, "Antes de abrir qualquer chat"): registrar o
  pedido, tirar as dúvidas de escopo, apresentar o plano (frentes e quantos chats) e esperar o OK do
  Kaique. Só então lança, um chat por vez. A frase que abre o chat do PO (`launch-pc-desk-chat.ts`) diz o mesmo.
- **Comando `hierarquia` com o Orca atual:** a resposta do Orca mudou de formato (`runId`, `terminal`,
  `workspace`; a aba vem de `terminal show`). `orca-lancador.mjs` e `hierarquia.mjs` foram adaptados.
- **Cópia de trabalho do chat novo** nasce da branch em que o projeto está (`--base-branch`); antes nascia
  do Orca oficial, sem o fluxograma. **Ainda não testado com um lançamento de verdade.**
- **Atalho para o Git Bash:** `%APPDATA%\orca-fork\cli\bin\hierarquia` (sem extensão), ao lado do `.cmd`.
  Sem ele o chat novo dava "hierarquia: command not found".
- **Nome do planejador:** o Haiku dá um nome de até 4 palavras (executor continua com até 2), mostrado no
  card (`canvas-chat-executor-name.ts`, IPC `repos:nameCanvasExecutor` com `role`).
- **Aberto:** chats lançados pelo PO apareceram ao lado dele no fluxograma, não embaixo (causa não
  confirmada; ver `.hierarquia/PRODUTO.md`). Pedidos pendentes (máscara de carregamento, cor da etiqueta
  de papel, etiqueta de modelo) estão no `PRODUTO.md`, sem começar.

## 11/11/2026 (noite) — Ver o fluxograma sem reiniciar + formatos por papel

**Vistoria (usar SEMPRE antes de dizer "pronto" em mudança de tela):**

1. `python tools/vistoria-fluxograma/capturar.py` copia o estado real do Orca em uso (projetos, abas,
   estados, hierarquia, contexto) para `.cache/vistoria-fluxograma/estado.json` (fora do git).
2. `pnpm fixtures:shot canvas-chats/CanvasChatsPage:real --scale 2` desenha o fluxograma com esses dados e
   grava `.cache/fixtures/canvas-chats__CanvasChatsPage--real.dark.png`. Abrir a imagem e olhar.
3. Página solta (preview de opções): `node tools/vistoria-fluxograma/print-html.mjs entrada.html saida.png`.

Limites da vistoria: a partida fria leva 1 a 2 min neste PC; os estados saem quase todos "parado"
(falta copiar o que a tela considera visto/não visto); sem manchete do Haiku; não testa hover nem clique.
O comando termina com erro por um recurso 404 da página, mas a imagem sai.

**Fluxograma, estado atual:**

- Cabeçalho do card em duas linhas (nome inteiro em cima; contexto, modelo e estado embaixo).
- Barra de contexto 0 a 1M tokens lida do histórico da conversa (`canvas-chat-context-tokens.ts`).
- Fileiras por papel: PO, planejadores, executores; cada fileira tem a altura do que é desenhado nela.
  Planejadores vêm antes dos executores diretos; a linha sai do centro de baixo do criador.
- Formatos (`canvas-chat-shape.ts`): planejador = card fino com uma frase; executor = hexágono
  (`CanvasExecutorCrest.tsx`) com título de 1 ou 2 palavras dado pelo Haiku
  (`canvas-chat-executor-name.ts`, IPC `repos:nameCanvasExecutor`) e a barra de contexto. Executor não
  abre no hover, só no clique.
- Cor do projeto só no card do projeto.
- **Anexos em fichas** (`CanvasChatAttachments.tsx`): embaixo de cada chat, uma fileira fina com uma ficha
  por tipo e a quantidade (agentes, artefatos, localhosts, imagens). Clicar na ficha abre a galeria do
  tipo; clicar na miniatura abre grande. As pilhas de cards embaixo do chat saíram.
- **Imagens** (novo): o fluxograma acha os caminhos de arquivo de imagem que o chat imprime
  (`imagePathsIn` em `canvas-chat-artifacts.ts`, guarda as 24 últimas por chat) e o processo principal
  devolve miniatura ou imagem grande (`repos:readCanvasImage`, `canvas-image-handler.ts`). Não acha caminho
  que o terminal quebrou em duas linhas, nem caminho relativo.
- Cenários de print sem chats reais: `canvas-chats/CanvasChatsPage:exemplo` (PO, 2 planejadores, 4
  executores, todos os anexos), `:exemploGaleria` (galeria de imagens aberta) e `:exemploEstados` (todas as
  cores de borda). Dados em `canvas-chats-fixture-scenario.ts`.

**Limpeza das pastas (11/11 à noite):** as cópias de trabalho `orca-canvas`, `orca-voz`, `orca-enxuto` e
`orca-atualiza` foram removidas (as branches continuam no repositório); os protótipos vieram para
`orca\prototipos-canvas` (fora do git); o cadastro duplicado do projeto `orca` saiu com o comando novo
`orca-dev repo rm --repo id:<id>` (só tira o cadastro). Tudo agora é feito na pasta `orca`.
Para apagar uma cópia de trabalho neste PC: `git worktree remove` e depois `cmd /c rmdir /s /q` no que
sobrar (não segue os atalhos do pnpm).

**Causa do chat sem aba:** o Orca só lista a pasta principal do projeto `orca`; `orca-canvas`, `orca-voz`,
`orca-enxuto` e `orca-atualiza` são cópias criadas por fora e não aparecem. Por isso `.hierarquia` veio
para a pasta `orca`, o comando `hierarquia` aponta para `orca\skills\hierarquia`, e o trabalho passou
a ser feito direto na pasta `orca` (branch `feat/pc-como-mesa`).

## 11/11/2026 — Hierarquia de chats (PO > Planejador > Executor) + ajustes do fluxograma

**O que é:** um chat PO (Fable) por projeto recebe o pedido do Kaique, manda ordens a planejadores
(Opus) e executores (Sonnet), confere as entregas e só ele faz push/deploy. Branch
`feat/hierarquia-de-chats` (worktree `Desktop\Projetos\orca-canvas`), juntada por avanço simples na
pasta `orca` (`feat/pc-como-mesa`).

| Peça              | Onde                                                   | Como funciona                                                                                                                                              |
| ----------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Comando           | `skills/hierarquia/hierarquia.mjs` (+ `regras.mjs`)    | `criar-po`, `ordem`, `entregar`, `conferir`, `perguntar`, `pedir-ok`, `ok`, `devolver`, `estado`. No PATH por `%APPDATA%\orca-fork\cli\bin\hierarquia.cmd` |
| Papéis            | `skills/hierarquia/papeis/{po,planejador,executor}.md` | o chat lê o seu ao nascer; cada um com a sua parte das regras (push só do PO, menor número de executores, território)                                      |
| Estado do projeto | `<projeto>/.hierarquia/` (fora do git)                 | `registro.jsonl` (verdade), `estado.json` (foto para o fluxograma), `ordens/`, `provas/`, `PRODUTO.md`, `DECISOES.md`, `config.json`                       |
| Regras impostas   | `regras.mjs`                                           | modelo por papel, ordem sem os 5 campos é recusada, entrega sem prova é recusada, teto 2 planejadores / 4 executores, só o Kaique dá OK                    |
| Fluxograma        | `canvas-chats/canvas-chat-hierarchy.ts` e cards        | chat criado fica embaixo do criador com linha e selo do modelo; papel e estado da entrega no card; caixa "Esperando você" com OK e Devolver                |

**Feito em 11/11 (tudo commitado; ver `git log`):**

- Chat identificado pela aba (sobrevive ao reinício do Orca).
- Desenho: todos os chats na mesma grade de colunas; card do projeto começa no x do primeiro chat.
- X no card do projeto (fecha todos os chats, com confirmação) e botão "Novo chat ou projeto" com a
  busca da barra (`PcDeskProjectPicker`, extraído de `PcDeskNewProjectButton`).
- Estado falso corrigido na regra do Orca (`claude-reported-state.ts`,
  `claude-finished-shell-notification.ts`): pedido de permissão em modo automático não vira "precisa de
  você"; comando de fundo já terminado dá baixa mesmo se o turno foi interrompido.
- Botão "Novo chat ou projeto" (e o "+" da barra): projeto com `.hierarquia` e sem PO ativo abre o chat já como PO no Fable (`--model fable` + pedido para rodar `hierarquia criar-po`), em `launch-pc-desk-chat.ts`. `hierarquia estado` agora regrava o `estado.json`.
- "Novo chat ou projeto" (e o "+" da barra) tem a escolha **Hierárquico (PO)** ou **Livre**, lembrada no navegador. Hierárquico abre o Fable como PO, que roda `hierarquia criar-po` e espera o briefing; Livre é o chat solto de antes. `criar-po` põe `.hierarquia/` em `.git/info/exclude` do projeto. Papel do PO ganhou "Primeira conversa" e "SDD por padrão" (specs em `docs/specs/`). Os outros "+" (cabeçalho, card do projeto) abrem Livre.
- Projetos empilhados por coluna: cada projeto fica logo abaixo do que está acima nas mesmas colunas, com o mesmo vão usado entre colunas (`ROW_GAP` em `canvas-chats-layout.ts`); antes a fileira inteira esperava o projeto mais alto.
- Hexágono do executor desenhado a 75% (`EXECUTOR_CREST_SCALE`), centrado no mesmo espaço; o layout reserva o tamanho cheio (`chatFootprintHeight`), então nada ao redor se mexe.
- Chat dormindo: abrir o card acorda só ele e mostra "Restaurando o chat…"
  (`CanvasChatTerminal.tsx`, `use-canvas-chat-terminal-wake.ts`); terminal fecha no tamanho da caixa
  (`preview-grid-claim.ts`); card aberto pede 300 linhas de histórico (o popout segue com 24).
- Servidor de tipos dos chats desligado em `.claude/settings.json` (custava 4 a 5 GB por chat).
- Barra de status do Claude removida de `~/.claude/settings.json` (cópia em
  `settings.json.bak-statusline-11-11`).
- Mestre de Banners virou PO do Astra Designer (lá o executor nasce com aba e ligado ao PO).

**Pegadinhas (todas vistas em 11/11):**

- **Chat lançado no projeto do Orca nasce sem aba** (terminal "órfão"): roda, mas não aparece na barra
  nem no fluxograma. No Astra Designer aparece. Diferenças: aqui `config.json` tem
  `pastaDosChats: "projeto"` (executor na própria pasta) e o PO morava em outro projeto. Causa não provada.
  Pista forte: `orca-dev terminal create --worktree path:.../orca-canvas` devolveu `surface: background` com
  o aviso "Terminal reveal timed out", e `terminal focus` respondeu ok sem a aba aparecer. Chat sem aba
  não volta depois de reiniciar o Orca.
- **Reiniciar o Orca mata os executores em andamento**, e a ordem fica presa como "trabalhando" (a
  `o-002` ficou assim). Avisar o Kaique antes de ele reiniciar.
- **Pergunta de executor não chega como aviso ao PO.** Só aparece em
  `orca-dev orchestration inbox`. A `o-004` ficou 40 min parada por isso. Olhar a caixa de tempos em tempos.
- **Ordem repetida confunde o executor:** relançar com o mesmo arquivo fez a `o-004` perguntar se era
  duplicata. Ao relançar, dizer na ordem que a anterior morreu.
- **`hierarquia ok` recusa rodar de dentro de um chat da hierarquia.** Quando o Kaique dá o OK por
  escrito no chat do PO, registrar com `env -u ORCA_TAB_ID -u ORCA_TERMINAL_HANDLE`.
- **Arquivo de ordem é JSON:** barra invertida de caminho do Windows quebra; usar `/`.
- **Memória:** cada Claude custa ~300 MB, e o app de teste oculto ~1,8 GB. Com pouca memória o Windows
  mata `pnpm tc`; usar `pnpm tc:web` e uma coisa pesada por vez.
- **No modo normal o card segue "precisa de você" depois do clique em permitir:** desde 05/11 o fork só
  recebe os avisos de ferramenta para pergunta e plano (`claude-managed-hook-events.ts`), por velocidade.
- **Executores dividem a pasta `orca-canvas`:** commit sempre com arquivos nomeados; uma ordem por vez
  em `canvas-chats/`.

**Não feito / próximos passos:**

0. **Push NÃO feito em 11/11.** `ORCA_CODE_QUALITY_BASE=origin/feat/pc-como-mesa pnpm check:changed` falhou em
   9 portões (qualidade do código alterado: 5 achados; catálogo de tradução; teste `regras.test.mjs` sem
   executor; manifesto de skills; e 4 catracas). Limpar isso antes de enviar; é o pedido combinado para o
   teste do ciclo completo. O projeto ficou **sem PO ativo**: o próximo chat aberto em `orca-canvas` roda
   `hierarquia criar-po` (ver `.hierarquia/DECISOES.md`).

1. Teste do ciclo completo com planejador Opus (nunca rodou). Pedido combinado: registro de diagnóstico
   do fluxograma, para depurar sem print.
2. Contador de contexto (0 a 1M de tokens) em cada card; o número vem do histórico da conversa.
3. Descobrir por que o chat nasce sem aba neste projeto.
4. Lentidão ao abrir, medida em 11/11 13:38: 276 s remontando o app (montar no commit resolve), 18 s
   varrendo 22 pastas de skills, todos os chats acordando juntos, antivírus 1 s por processo.
5. "Em segundo plano" falso do Ideias Ads: caminho corrigido, causa daquele chat não provada. Para
   fechar, gravar o `background_tasks` do próximo `Stop`.
6. A "letra gigante" do card aberto não reproduziu em teste.

**Atualizado:** 11/11/2026.

## 09/11/2026 — Fluxograma de chats (canvas) — NO AR

Botão novo no canto superior esquerdo (ícone de fluxo, ao lado do da barra lateral) troca a tela
principal por um **fluxograma dos mesmos chats** da barra: projeto > chats > agentes (+ servidores e
artifacts). É só outra tela dos mesmos dados; trocar de volta não perde nada. Reabre no fluxograma se
foi fechado nele (`activeView = 'canvas'`, salvo como as outras views).

**Onde está o código:** `src/renderer/src/components/canvas-chats/` (branch `feat/canvas-chats`,
worktree `Desktop\Projetos\orca-canvas`, juntada em `feat/pc-como-mesa`). Protótipo aprovado e spec
visual: `Desktop\Projetos\orca\prototipos-canvas` (V1, README.md).

| Peça                 | Arquivo                                                                                               | Como funciona                                                                                                                                                                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| View + botão         | `TitlebarLeftControls.tsx`, `ui-slice-view-actions.ts`, `AppWorkspaceShell.tsx`                       | `openCanvasPage/closeCanvasPage/toggleCanvasPage`; `'canvas'` em todas as listas de views                                                                                                                                                        |
| Dados                | `canvas-chats-data.ts`                                                                                | mesma lista da barra: `repos` > abas de `tabsByWorktree`; estado do card = mesma regra da bolinha da barra (`useWorktreeActivityStatus`)                                                                                                         |
| Layout               | `canvas-chats-layout.ts`                                                                              | projeto em cima, chats lado a lado, agentes/extras empilhados; blocos em fileiras que caibam na tela                                                                                                                                             |
| Cards                | `CanvasChatsNodes.tsx`                                                                                | card fechado = último pedido + manchete do Haiku; aberto = terminal ao vivo (`AgentTerminalPreview`)                                                                                                                                             |
| Manchete             | `canvas-chats-summary.ts` + `repos:summarizeCanvasReply` (main)                                       | Haiku escreve 1 manchete curta por conclusão, só com o chat verde (terminou, não visto)                                                                                                                                                          |
| Arrastar             | `canvas-chats-offsets.ts`                                                                             | projeto leva o bloco, chat leva os agentes; posições salvas; **Reorganizar** zera e centraliza                                                                                                                                                   |
| Cordas               | `canvas-chats-cords.ts`, `use-canvas-cord-layer.tsx`                                                  | puxa de qualquer borda; azul + gruda num chat válido; ✕ no meio corta. **Ainda só desenho: troca de contexto pela corda não existe**                                                                                                             |
| Fechar chat          | ✕ flutuante + confirmação                                                                             | usa `closePcDeskChat` (mesmo ✕ da barra)                                                                                                                                                                                                         |
| Cor                  | `projectColor` em `canvas-chats-data.ts`                                                              | cor do selo do projeto (`badgeColor`); cinza padrão vira cor automática; paleta no hover chama `updateRepo`                                                                                                                                      |
| Servidores/artifacts | `CanvasChatExtras.tsx`, `canvas-chat-artifacts.ts`                                                    | servidor = pty que imprimiu a URL (`advertisedByPtyId`, novo no main) **ou** porta citada na conversa; artifacts = links claude.ai/artifact do terminal; clique abre webview **fora** da área com zoom; ✕ do servidor confirma e mata o processo |
| Voz                  | `use-canvas-voice-prompt.ts`, `CanvasVoiceBar.tsx`, `canvas-voice-preference.ts`                      | **Ctrl+E no fluxograma** liga/desliga o modo escuta (começa desligado); abrir chat já ouve; 3 s de silêncio ou **Enter** envia; Ctrl+E/digitar deixa escrito; clicar fora envia                                                                  |
| Colar imagem         | `preview-terminal-paste.ts`                                                                           | Ctrl+V com imagem salva arquivo temporário e cola o caminho (igual ao terminal)                                                                                                                                                                  |
| Espiar (hover)       | `use-canvas-chat-peek.ts`, `canvas-chat-peek-screen.ts`, `canvas-chat-terminal-tail.ts`               | mouse parado 220 ms no card fechado mostra as últimas 7 linhas ao vivo, com as cores e a fonte do terminal; leituras em fila (2 por vez)                                                                                                         |
| Fotos das páginas    | `canvas-chat-previews.ts` + `repos:captureCanvasPagePreview` (main, `canvas-page-preview-handler.ts`) | janela oculta abre o localhost/artifact e tira foto (1 por vez, só localhost e claude.ai/artifact); refaz quando o chat termina um turno ou a foto passa de 10 min; guarda 40                                                                    |
| Processos de fundo   | `canvas-chat-child-work.ts`                                                                           | shells/monitores que o chat deixou rodando viram pílulas roxas; estado "em segundo plano" (roxo)                                                                                                                                                 |
| Restaurar chat       | `lib/chat-restore-progress.ts`, `SessionRestoredBanner.tsx`                                           | abrir um chat dormindo acorda só ele (`tabIds` no wake) e mostra "Restaurando o chat…" até a caixa de digitar do Claude aparecer                                                                                                                 |
| Links no chat aberto | `canvas-chat-terminal-links.ts` (prop `linkHandlers` no `AgentTerminalPreview`)                       | clique simples em link abre no navegador padrão do sistema                                                                                                                                                                                       |

**Teclas no card aberto:** Esc vai para o chat (interrompe o agente, como sempre); só **clicar fora** fecha o card.

**Pegadinhas:**

- **Nunca ler campo cru do status; sempre a função da barra lateral.** O oficial trocou `entry.subagents` por `entry.children` em 30/09/2026 (PR #22614) e o fluxograma, que lia o campo velho, parou de mostrar agentes de fundo. Hoje usa `buildRunningAgentChildRowModels` (o mesmo da barra) e `useWorktreeActivityStatus`. Depois de atualizar do oficial, rodar `grep -rn "entry\.\|entry?\." src/renderer/src/components/canvas-chats` e conferir cada campo cru que sobrou.

- O chat da voz (outra sessão) também comita em `canvas-chats/` — sempre `git merge feat/pc-como-mesa` antes de juntar.
- Chat sem terminal após reabrir o Orca: abrir o card faz o mesmo que clicar na barra (ativa o chat) e remonta a tela.
- Webview não desenha dentro de elemento com CSS transform: a telinha fica fora de `.cc-world`.
- Testar visual: `pnpm dev-stable-name` com `ORCA_DEV_USER_DATA_PATH` próprio imprime porta CDP; perfil vazio não tem chats.
- Nada disso tem teste automatizado; conferido só com `pnpm tc` + oxlint e pelo Kaique na tela.
- Login do claude.ai no mini navegador: o Kaique entrou por e-mail dentro do próprio Orca (fica no perfil `orca-browser`). Importar cookies do Chrome não funcionou.
- Depois de mudar o layout, posições arrastadas antigas desalinham a grade: clicar **Reorganizar**.
- `dashboard-preview-link-composition.test.tsx` tem 2 testes que já falhavam antes do fork mexer (conferido em 10/11).

**Estado em 10/11/2026:** tudo commitado em `feat/canvas-chats` e `feat/pc-como-mesa` (ponta `2d5aa86600`). Nada enviado ao GitHub desde o PR #1. As mudanças de 10/11 (espiar, fotos, processos de fundo, restaurar, links) passaram em tipos/estilo mas não foram conferidas na tela por mim.

**Próximos passos:** troca de contexto real pelas cordas; comparar lado a lado com o protótipo e igualar o visual; imagens ligadas aos chats (o layout já cresce com o que fica pendurado).

**Atualizado:** 10/11/2026.

## Estado

- Fork `while-kaique/orca`, branch `feat/pc-como-mesa`, clonado em `Desktop\Projetos\orca`.
- Plano completo: `PLANO-PC-COMO-MESA.md` (fases 0 a 3).
- **Fase 0 (montar o app): feita.** Abrir com dois cliques em `dev-orca.bat`
  (perfil separado em `%APPDATA%\orca-fork`, não mexe no Orca instalado).
- **Fase 1 (barra lateral nova): escrita e commitada** (`19d2e023`), checagem de tipos e lint limpos.
  App aberto em 23/09 para teste; o Kaique ainda não testou.
- Aviso "opencode / SQLite database does not exist" no log é inofensivo (opencode não instalado).

## O que a fase 1 mudou

1. Clicar no nome do projeto abre a pasta dele (a setinha continua abrindo/fechando o grupo).
2. Todos os projetos aparecem sempre; worktree só aparece enquanto tiver chat aberto nela.
3. Em projeto com git, o **+** virou **⑂ N**: lista "Pasta do projeto", worktrees ativas e "Criar worktree nova…".

## Próximo passo (24/09)

1. Abrir `dev-orca.bat` e testar os 3 itens acima.
2. O Kaique tem **ajustes** para passar — ouvir e aplicar antes de seguir.
3. Depois: fase 2 (cada lado da tela dividida escolhe pasta/worktree, ~1 a 2 dias).

## 24/09 — barra lateral em 3 versões (aguardando escolha)

- Pedido: abrir em `Projetos`, restaurar o que ficou aberto, caixa de busca + clique nas pastas, botão de worktree por pasta.
- Protótipo clicável A/B/C: https://claude.ai/artifact/S1XgbSgDU4g14XFjK68WDU
  (A = seletor no topo · B = lista com busca fixa · C = paleta no meio da tela + cartões).
- Restaurar sessão: o Orca já salva abas e histórico (`src/main/ipc/session.ts`); o fork só precisa mostrar isso na barra.
- **Escolhida: A.** Implementada em 24/09 (commit "feat(sidebar): seletor de projetos no topo").
  - Caixa no topo da barra: mostra a pasta/worktree atual; clique abre busca + lista de `Desktop\Projetos`
    (Abertos agora / Mexidos por último / Todas). Pasta nova vira projeto no 1º clique, sem diálogo.
  - Botão ⑂ (ou seta →) lista as worktrees: pasta do projeto, com chat aberto, outras, criar nova.
  - A barra embaixo mostra só o que tem chat aberto (inclui o que volta aberto ao reabrir o Orca).
  - Código: `src/renderer/src/components/sidebar/pc-desk-switcher/` + IPC `repos:listPcDeskHomeFolders`.
  - Sem atalho de teclado ainda: Ctrl+P já é "abrir arquivo" no Orca.
- Próximo: Kaique testa (fechar e abrir `dev-orca.bat`, porque mudou o processo principal) e passa ajustes; depois fase 2.

## 24/09 (tarde) — 3 pedidos novos, commitados (912f6f6c, 4650c20e)

1. **Botão "+" fixo** no pé da lista de chats: busca instantânea em `Projetos`; nome que não existe vira
   "Criar projeto" (pasta com git, reusa `repos:create`) e já abre. `pc-desk-switcher/PcDeskNewProjectButton.tsx`.
2. **Bolinha verde**: cheia = terminou e você não viu; só contorno = já viu, esperando você.
   Regra de "visto" = a mesma das linhas em negrito (`acknowledgedAgentsByPaneKey`). Cor nova `--agent-done`.
3. **Sessão sobrevive a desligar o PC**: causa achada — o Orca só salvava o registro de retomada de chat
   _trabalhando_; chat parado voltava como terminal vazio. Agora salva também o parado, 2 s após cada
   mudança, e grava em disco quando o Windows avisa que vai desligar (`main/window/os-session-end-flush.ts`).

- Falta: Kaique testar reiniciando o PC com 2-3 chats parados abertos.

## 25/09 — 2 ajustes (d2056b21)

1. "+" agora fica logo abaixo do último projeto (a lista encolhe até o conteúdo no modo mesa); borda tracejada grossa, fundo mais claro, clareia no hover.
2. "New workspace" abre com o foco na busca de projeto (não no nome opcional) — só no modo mesa.

- Falta: Kaique ver na tela.

## 25/09 — nome da sessão

- Feito (0bb4e05e): nome automático cortado em 3 palavras / 23 caracteres, sem "de/do/para…" (`src/shared/session-title-cap.ts`). Nome renomeado à mão não corta.
- **Feito: nome inteligente** (modo mesa). Aba abre com o nome do projeto; na 1ª mensagem o Haiku já dá o nome do tema;
  depois, a cada 10 min com ≥3 mensagens novas, ele responde MANTER ou nome novo (troca no máximo 1x a cada 20 min).
  Só o chat mais antigo da aba conta. Renomear à mão vence sempre.
  - Agendador: `src/renderer/src/lib/pc-desk-session-namer.ts` (ligado em `main.tsx`).
  - Chamada: `src/main/ipc/repos/pc-desk-session-title-handlers.ts` → `claude -p --model haiku` SEM hooks, MCP,
    ferramentas nem sessão salva (senão cada renomeação viraria linha no Diário de Bordo).
  - Nome fica em `generatedTitle` (já persistido) e vence o título do Claude no modo mesa.
  - Falta: Kaique testar (fechar e abrir `dev-orca.bat`, mudou o processo principal).

## 25/09 — chat parado sumia ao reiniciar (corrigido, falta testar)

- Caso: 2 chats no Creative Studio; após reinício forçado só 1 voltou com a conversa. O outro não tinha registro
  de retomada, e na reabertura chat PARADO só voltava com registro (chat trabalhando já usava o último status).
- Correção: na reabertura, sem registro, usa o último status do painel que o processo principal salva em disco
  (`last-status.json`). Só vale na reabertura; chat encerrado de propósito continua fechado.
  `pty-connection/sleeping-record-access.ts` (`getColdRestoreRecordForPane`).
- Conversa perdida desse dia: `claude --resume d74a6471-0d66-4d92-b4be-328a4a3b6497` no Creative Studio.
- Lição: reiniciar o Orca por WMI abre sem o PATH do usuário (claude "não encontrado"); reiniciar via explorer.exe.

## 25/09 10:30 — testado no app

- Nome inteligente: chat novo no diario-local abriu como "diario-local" e 10 s após a 1ª mensagem virou "Contar arquivos MD".
- Reinício: os 7 chats abertos voltaram com o Claude rodando e a conversa anterior na tela (Creative Studio x2, radar, jarvis, diario x2, este).
- Pegadinha de teste: no CDP, caminho com `\` virou pasta inexistente; usar barras normais. Dev CLI: `pnpm run build:cli` e usar `orca-dev.cmd`.

## 25/09 — nome da aba vira o nome da sessão entre chats

- Antes: chats se viam como `creative-studio-c5`, `whelk-b5` (nome derivado da pasta pelo Claude Code).
- Agora: hook `~/.claude/hooks/orca-nome-da-aba.js` (SessionStart + UserPromptSubmit, fora do repo) lê
  o nome da aba em `profiles/*/orca-data.json` pelo `ORCA_TAB_ID` e devolve `sessionTitle`. Nome manual vence;
  nome provisório (= nome do projeto) é ignorado. Sem mudança no código do app.
- Atraso: o nome novo entra na mensagem SEGUINTE do chat (hook só roda quando você manda mensagem ou reabre).
- Backup do settings: `~/.claude/settings.json.bak-nome-aba`.

## 25/09 18h — app "trava, pisca e volta" sem ninguém mexer (investigando)

- Causa vista no log: o **serviço de terminais (daemon) morre calado** e o app sobe outro; todos os chats remontam.
  Em 25/09: 12:54, 14:16, 16:07, 17:59 (horário de Brasília). Nenhuma linha de erro, nenhum crash no Windows.
- Monitoramento novo (vale depois de fechar e abrir `dev-orca.bat`), tudo em `%APPDATA%\orca-fork\logs`:
  1. `daemon.log` → `heartbeat` a cada 30 s (memória, atraso do laço) + `process-exit`. Batimento parando sem `process-exit` = morte nativa ou kill externo; atraso alto antes = travou.
  2. `daemon-watch.log` → `daemon-respawn`: motivo, pid antigo e se ainda estava vivo.
  3. `main-console.log` → saída do processo principal (antes ia pro nada). Sessão anterior em `main-console.anterior.log`.
- Código: `src/main/daemon/pc-desk-daemon-watch.ts` (dentro do daemon) e `pc-desk-daemon-respawn-log.ts` (no app).
- Próximo: na próxima queda, cruzar os 3 arquivos pelo horário.
- **Atalho "Orca (meu)" agora abre no modo montado** (`abrir-orca-fork.vbs` → `abrir-orca-montado.bat`): monta em ~10 s
  e roda sem recarregar quando o código muda. Se montar/abrir falhar, cai sozinho no `dev-orca.bat`.
  Para editar o Orca com recarga automática, abrir `dev-orca.bat` direto. Ainda não testado ao vivo (o app estava aberto).

## 28/09 — botão "+ Adicionar Chat" + grupo desfeito

- Botão **+ Adicionar Chat** logo abaixo do seletor de projeto (modo mesa): abre uma aba nova com o agente padrão
  (Claude) no projeto/worktree ativo — processo novo, então a conversa tem memória própria.
  `pc-desk-switcher/PcDeskAddChatButton.tsx`. Falta: Kaique ver na tela.
- Grupo "Projetos group" (criado sem querer) desfeito pela RPC `projectGroup.delete` — só desagrupa, a pasta
  Projetos e os chats ficaram. Backup: `%APPDATA%\orca-fork\profiles\local-default\orca-data.json.antes-desfazer-grupo`.

## 28/09 (tarde) — cada chat vira uma linha própria na barra

- Pedido: "+" → "Projetos" → Enter não fazia nada; "Adicionar Chat" só abria aba no mesmo espaço; "social hub" não abria.
- Causas: (1) a barra mostrava 1 linha por pasta, e escolher a pasta já aberta só a reativava;
  (2) a busca não tratava espaço como `-`/`_`, então "social hub" só oferecia "Criar projeto".
- Agora (modo mesa):
  1. Cada chat (aba de terminal) é uma linha debaixo do projeto, com nome, bolinha e X próprios; clicar abre aquele chat.
     `pc-desk-switcher/pc-desk-chat-rows.ts` (divide as linhas) + `PcDeskChatCardScope.tsx` (contexto do chat no card).
  2. "+" lá embaixo: escolher uma pasta abre um **chat novo** nela (nova linha), mesmo se ela já estiver aberta.
     "Criar projeto" também já abre com um chat. `launch-pc-desk-chat.ts` (usado também pelo "Adicionar Chat").
  3. Busca: espaço casa com `-`, `_` e `.` ("social hub" → social-hub-gogroup; também acha socialhub-profiles).
- Limite: as abas no topo continuam mostrando todos os chats da mesma pasta.
- Testes da barra: 186 falhas já existiam antes desta mudança (mesmo número com `git stash`).
- Falta: Kaique fechar e abrir o "Orca (meu)" (remonta sozinho) e testar.

## 29/09 — "+" no cabeçalho do projeto

- Pedido: "+" no card da pasta (ex.: Projetos), antes da setinha, que abre um chat novo.
- Feito: `pc-desk-switcher/PcDeskHeaderNewChatButton.tsx` (em `SectionHeader.tsx`, só no modo mesa). Aparece ao
  passar o mouse no cabeçalho, como os outros botões; o chat nasce como linha nova debaixo do projeto.
- Mesmo caminho do "+" de baixo: `openPcDeskChatInRepo` em `launch-pc-desk-chat.ts`.
- Falta: Kaique reabrir o "Orca (meu)" (remonta sozinho) e testar.

## 30/09 — "+" → social-hub-gogroup dava "Não deu para abrir o projeto" (corrigido)

- Causa: o projeto foi registrado com `C:\…` e o git devolve a pasta como `C:/…`; o seletor montava o id com `\`
  e a busca exata não achava a pasta principal.
- Afetava os 8 projetos com git adicionados pela CLI em 23/09 (social-strategy, hit-stories, cx-hub, goatlas…).
- Correção definitiva: `resolveRepoMainWorktreeId` em `src/shared/worktree/id.ts` (com teste) acha o id real carregado,
  comparando sem ligar pro tipo de barra. Usado em TODO lugar do app que abria a pasta principal pelo id montado:
  "+", "+" do cabeçalho, "Criar projeto", "Pasta do projeto" (seletor e menu do cabeçalho) e sincronizar fork.
- Falta: Kaique reabrir o "Orca (meu)" e testar "+" → socialhub → Enter.

## 06/10 — serviço de terminais caiu 2x de manhã (08:45 e 09:56)

- Mesmo padrão de 25/09: batimento normal (memória ~165 MB, sem travar) e some, sem `process-exit`,
  sem evento de erro no Windows e sem despejo de crash. Cara de processo morto de fora (encerramento forçado).
- Descartado: o chat do radar-de-trends rodou `Stop-Process` na porta 8765 às 09:50 (5 min antes, outro processo).
- Os 7 chats voltaram com a conversa (`claude --resume`), mas o que estava trabalhando para e espera mensagem.
- Ideia em aberto: na volta, mandar "continue" sozinho só para quem estava trabalhando na hora da queda
  (`pty-connection/cold-restore-resume-startup.ts` + último status em `last-status.json`).

## 06/10 10:17 — caixa-preta ligada (descobre QUEM mata o serviço)

- Vigia `tools/caixa-preta/caixa-preta.py`, tarefa agendada **"Orca caixa-preta"** (administrador, liga ao entrar no Windows,
  reinicia sozinha). Escuta o rastreamento do próprio Windows (ETW): quem chamou TerminateProcess + código de saída.
- Quando o serviço (ou o app) morre, grava em `%APPDATA%\orca-fork\logs\caixa-preta\`:
  `QUEDA-<data>-daemon-<pid>.txt` (culpado e pais até o claude.exe com a pasta, processos nascidos 90 s antes,
  comandos dos agentes Claude em volta) + uma linha em `caixa-preta.log`. Mortes de claude.exe vão em `mortes.log`.
- Testado: processo falso morto por `taskkill` → relatório apontou taskkill → bash → claude.exe em `Projetos`.
- Suspeita a confirmar: o próprio Claude Code roda `taskkill` para matar comandos em segundo plano; um PID velho
  reaproveitado pelo serviço explicaria a morte "sem dono". Na próxima queda: abrir o QUEDA mais novo.
- Reinstalar/atualizar: `powershell -File tools\caixa-preta\instalar.ps1` (pede o "Sim" do Windows).

## 06/10 noite — causa parcial: o serviço ABORTA sozinho (código 134)

- Caixa-preta pegou 4 quedas (11:04, 14:43, 17:30 + manhã): ninguém matou; saída 134 = falha fatal interna do Node
  (aborto). Sempre com ~60-70 min de vida. A mensagem do erro ia para o stderr, que o app fecha depois da partida.
- Correção de diagnóstico (falta reabrir o "Orca (meu)" para valer):
  `pc-desk-daemon-stderr-log.ts` grava o stderr do serviço em `logs/daemon-stderr.log`; o serviço gera relatório
  do Node (`report.*.json`, pilhas nativa e JS) em `logs/` em erro fatal; heartbeat ganhou `handles`.
- Vigia: filtro no próprio ETW + só lê detalhes de electron/claude/python → ~23% de 1 núcleo (~1,5% do PC), 58 MB.
  O PC cria ~25 processos/s (bash, curl, cmd, clink de hooks/barra de status dos chats).

## 08/10 — causa achada: o serviço de terminais ESTOURA A MEMÓRIA

- `logs/daemon-stderr.log`: "FATAL ERROR ... JavaScript heap out of memory" nas quedas de 07/10 19:25 e 08/10 11:02
  (código 134 e 0xC0000374 = mesma coisa). Heap vai de ~20 MB a ~4 GB em menos de 30 s, não é vazamento lento.
- Gatilho provável: um "checkpoint" (foto do terminal p/ restaurar depois) trava >30 s (`takePendingOutput timed out`
  no main-console.log) e enche a memória. Código do serviço é do Orca original (fork não mexeu).
- Upstream (1482 commits à frente) não tem correção clara; o mais perto é 07c237939 (serializador do checkpoint).
- Depois da queda das 11:02 o serviço só voltou 11:25 (23 min sem terminais).
- Próximo: gravar foto da memória perto do limite (heap snapshot) p/ ver qual sessão/objeto enche.
- **Feito (08/10 tarde):** daemon agora (a) grava `Heap-*.heapsnapshot` em `%APPDATA%\orca-fork\` ao chegar perto do limite
  de memória e (b) escreve `logs/daemon-snapshot-atual.txt` antes de cada foto de terminal ("FOTOGRAFANDO sessao=..." —
  se o daemon morrer, o arquivo aponta o culpado) + `logs/daemon-snapshot-lento.log` p/ fotos >2 s ou >100 MB.
  Código: `pc-desk-snapshot-breadcrumb.ts`. Só vale para o daemon que nascer depois de remontar o app.
  Na próxima queda: ler `daemon-snapshot-atual.txt` e abrir o .heapsnapshot no Chrome DevTools (aba Memory).

## 15/10 16:57 — nova queda do serviço (falta de memória de novo)

- Saída 0xE0000008 = código de falta de memória do Chromium. Último sinal de vida 16:53:35 (heap 22 MB, normal);
  foto de memória começou 16:54:11 e saiu com 0 byte (não havia memória para gravá-la). Morreu 16:57:10.
- NÃO foi durante foto de terminal: no `daemon-snapshot-historico.log` a última foto (16:30) tem INICIO+FIM.
- Suspeito: terminal do gohelp-chatbot (sessão 868a868e…@@70df6a48). Às 16:50–16:51 o Claude dele disparou
  16 subagentes em paralelo; eles terminaram entre 16:52:27 e 16:54:40, janela exata do travamento.
  Todos os timeouts de `takePendingOutput` no main-console são dessa sessão.
- Furos da instrumentação: foto de heap sai vazia; `daemon-snapshot-atual.txt` é sobrescrito pelo daemon novo.
- Próximo: reproduzir (1 terminal, Claude dispara ~16 subagentes) vigiando o heap do daemon; trocar a foto de heap
  por limite de bytes por sessão no ingest do terminal.
- **Teste 15/10 17:35–17:43:** Claude novo com 16 subagentes em segundo plano, terminando um a um ("Waiting for N background
  agents"). Serviço ficou entre 240 e 257 MB, sem queda. Os 16 subagentes sozinhos NÃO reproduzem. Falta o ingrediente
  da sessão real (horas de histórico, saídas grandes de ferramenta). Vigia: scratchpad da sessão e79db112 (vigia.ps1).
- **Pulso (15/10 18:00):** `src/main/daemon/pc-desk-pulse.ts`. Uma thread separada grava a cada 1 s
  `logs/daemon-pulso-atual.txt` e, no histórico `logs/daemon-pulso.log`, a memória, a última operação que começou
  (pedido + sessão, ou dados de terminal) e os bytes por terminal no último segundo. Continua escrevendo com o laço principal
  travado (testado: 80 MB → 1,6 GB anotados com "parado=Ns"). Só vale para o serviço que nascer depois de remontar o app.
  **Na próxima queda: ler o fim de `daemon-pulso.log`**; a linha com "parado" crescendo diz a operação e a sessão culpadas.

## 16/10 13:23 — queda pega pelo pulso

- Serviço parou às 13:21:10 logo após `req inspectProcess` do terminal motor-conteudo-cms@@a3d8114f e ficou travado
  158 s (terminais congelados) com a memória indo de 254 MB a 11,8 GB; morreu 13:23:49 (0xE0000008).
- 11,8 GB passa do limite de 4 GB do JS: parte é memória nativa. Último segundo antes: 4,7 KB nesse terminal.
- `inspectProcess` no Windows: `getStrictProcessTableSnapshotWithAge` roda `ps` (falha rápido no Windows) —
  o laço exato ainda não está provado.
- **Commit 07c8b527b:** parado 5 s → o pulso pausa a thread principal pelo inspector e grava a pilha em
  `logs/daemon-pulso-pilha.log` (testado). Parado 20 s com ≥3 GB → encerra o serviço (o app sobe outro).
  **Na próxima queda: ler `daemon-pulso-pilha.log`** e abrir `out/main/<arquivo>` na linha:coluna indicada.

## 05/11 — atualizado para o oficial v1.4.249 (branch `atualiza-oficial-1.4.249`)

- Pasta separada: `Desktop\Projetos\orca-atualiza` (worktree). `feat/pc-como-mesa` e a pasta `orca` intactas.
- Commits: `45f8d314fa` (merge, 55 conflitos), `2a57dc1b9c` (achados da revisão), `8206199afa` (testes do stderr).
- O que mudou de lugar no fork: X de cada chat agora é parte do molde do card
  (`workspace-card/template/default-workspace-card.json` → `PcDeskClose`); filtro do modo mesa em
  `worktree-list/listing/pc-desk-visible-rows.ts`; linha por chat em `pc-desk-sidebar-rows.ts`;
  bootstrap do PowerShell em `src/main/pty/shell-startup/powershell-osc133-bootstrap-file.ts`.
- Saiu do fork (o oficial faz igual): correção do laço de PIDs, captura de chat parado ao fechar e o
  registro sintético do último status (o oficial cria o registro real a partir do status).
- Limitação conhecida: desligar o Windows — o salvamento virou assíncrono no oficial; começa em
  query-session-end, mas não há garantia de terminar antes do Windows encerrar o app.
- Neste PC falham também no oficial puro: 20 arquivos de teste do daemon/WSL (/bin/sh, getuid, WSL)
  e o teste CLM do PowerShell (antivírus bloqueia o script do teste).
- **INTEGRADO 05/11 19:39:** pasta `orca` (`feat/pc-como-mesa`) avançou para `9c155026c2` por fast-forward,
  `pnpm install` + build feitos; os 2 atalhos "Orca (meu)" voltaram para `orca\abrir-orca-fork.vbs`.
  Registro: `%APPDATA%\orca-fork\logs\integracao-1.4.249.log`. Aviso "[Crash Report]" ao abrir = registro
  antigo de 24/09 (v1.4.209) em `crash-reports.json`, nada novo.
- 05/11 tarde: juntados os 3 commits da sessão "Lentidão Bitdefender" (hooks só AskUserQuestion|ExitPlanMode,
  preset Agent sleep 2 h) — commit `815ea9b3c1`; integração na pasta `orca` vira fast-forward.
