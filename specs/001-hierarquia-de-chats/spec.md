---
feature: 'hierarquia-de-chats'
id: '001'
status: draft # draft | clarified | planned | in-progress | done
created: '2026-11-10'
spec_version: 1
metodo: SDD # decidido pelo Kaique em 10/11/2026 (só SDD, sem TDD obrigatório)
---

# Spec: Hierarquia de chats no fluxograma (PO > Planejador > Executor)

> Esta spec diz **o quê** e **por quê**. O **como** (arquivos, comandos, código) vai no `plan.md`,
> que só é escrito depois de o Kaique aprovar este documento.
> O único trecho técnico é o Anexo A, que lista os fatos já conferidos para o plano partir deles.

**Dicionário**

| Nome               | O que é                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| **PO**             | O chat dono do produto. Um por projeto. Modelo Fable. Sabe o que o projeto tem que cumprir e o nível de qualidade. |
| **Planejador**     | Chat criado pelo PO para uma frente (ex.: tela inicial, cadastro, segurança). Modelo Opus. Decide o caminho.       |
| **Executor**       | Chat criado para fazer uma tarefa fechada. Modelo Sonnet. Recebe ordem pronta e entrega com prova.                 |
| **Ordem**          | O pedido escrito que desce de um nível para o outro, em formato fixo.                                              |
| **Portão**         | Ponto em que alguém confere uma entrega antes de ela subir.                                                        |
| **Fila do Kaique** | Lista única de tudo que está esperando uma resposta dele, em todos os projetos.                                    |
| **Juntar**         | Levar o trabalho pronto para a versão principal do projeto (merge) ou publicar.                                    |

---

## 1. Problema e por quê

Hoje o fluxograma mostra projetos, chats e agentes, mas todo chat é igual e nasce da mão do Kaique.
Isso tem três custos:

1. **Ninguém guarda a visão do produto.** Cada chat novo começa sem saber o que o projeto deve
   cumprir. Quem carrega isso é o Kaique, na cabeça, e repete a cada conversa.
2. **Ninguém confere antes dele.** O que um chat entrega chega direto no Kaique. Ele é o único
   revisor de tudo.
3. **O trabalho não se divide sozinho.** Para ter três coisas andando em paralelo, ele abre três
   chats e explica três vezes.

A reformulação faz o fluxograma deixar de ser só uma tela para olhar chats e passar a **ordenar a
forma de usar o Claude**: cada projeto tem um dono permanente, que divide o trabalho, cobra
qualidade e só chama o Kaique no que é decisão dele.

## 2. Objetivos e o que fica de fora

**Objetivos**

- **O-1** Cada projeto que adotar a hierarquia tem um PO que não perde o que sabe, mesmo se o PC
  desligar ou a conversa for compactada.
- **O-2** O PO cria planejadores e os planejadores criam executores, sem o Kaique abrir chat à mão.
- **O-3** Toda entrega passa por portões com dono claro antes de chegar ao Kaique.
- **O-4** Nada é juntado na versão principal sem o OK do Kaique.
- **O-5** O fluxograma mostra a hierarquia, o modelo de cada chat e em que portão cada entrega está.
- **O-6** O Kaique pode entrar em qualquer chat, e o PO fica sabendo do que ele mudou.
- **O-7** Funciona de verdade em **um projeto piloto** antes de valer para os outros.

**Fora do escopo desta entrega**

- Valer para todos os projetos de uma vez. Projeto sem PO continua igual a hoje.
- Rodar na nuvem ou com o PC desligado. Isso é o outro projeto ("supersistema"), não este.
- Juntar sozinho, sem o OK do Kaique.
- Usar outro agente que não o Claude (Codex e outros).
- Mudar a voz, o espiar, as fotos de página e as cordas manuais do fluxograma atual.
- TDD obrigatório. O método é SDD; teste automatizado entra onde o plano justificar.

## 3. Quem usa e em que situação

- **Kaique**, sozinho, no PC dele, com vários projetos abertos ao mesmo tempo no fork do Orca.
- Usa a assinatura do Claude, que tem limite de uso. Quanto esta hierarquia gasta desse limite
  **não está medido** (ver risco R-1).
- O PC pode desligar ou o serviço de terminais pode cair no meio do trabalho (já aconteceu várias
  vezes; histórico no `ONDE-PARAMOS.md`).

## 4. Histórias

- **US-1** Como Kaique, quero falar só com o PO de um projeto e ter o pedido dividido e executado,
  para não abrir nem explicar chat por chat.
- **US-2** Como Kaique, quero que o PO saiba sempre o que o projeto deve cumprir, para não repetir
  o contexto a cada conversa.
- **US-3** Como Kaique, quero ver só o que já foi conferido por dois níveis, para não ser o único
  revisor.
- **US-4** Como Kaique, quero que nada entre na versão principal sem o meu OK, para um erro não ir
  direto para o que está funcionando.
- **US-5** Como Kaique, quero ver no fluxograma quem manda em quem, que modelo cada chat usa e onde
  cada entrega está parada, para entender o projeto num olhar.
- **US-6** Como Kaique, quero uma fila única do que espera por mim, para não caçar pergunta em
  dez chats.
- **US-7** Como Kaique, quero poder entrar em qualquer chat e corrigir algo pequeno, sem o PO ficar
  com uma ideia errada do projeto.

## 5. Como funciona (o desenho proposto)

### 5.1 Os três papéis

| Papel      | Modelo | O que sabe                                                                   | O que decide                                                        | O que **não** faz                                                       |
| ---------- | ------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| PO         | Fable  | O produto inteiro: para quem é, o que tem que cumprir, o que não pode passar | O que fazer, em que ordem, e se a entrega serve ao produto          | Não escreve código. Não junta sem o Kaique.                             |
| Planejador | Opus   | A frente dele em detalhe, mais a ordem recebida                              | O caminho: pesquisa, plano, divisão em tarefas, critérios de aceite | Não muda o objetivo recebido. Não sai consertando o que não foi pedido. |
| Executor   | Sonnet | Só a tarefa dele                                                             | Nada de produto. Só como cumprir a ordem                            | Não replaneja. Na dúvida, pergunta para cima.                           |

### 5.2 Mudanças que proponho sobre a ideia do áudio

1. **O que o PO sabe mora em arquivo, não na conversa.** Uma conversa de semanas perde detalhe a
   cada compactação. O PO mantém um arquivo do produto (o que cumprir, nível de qualidade, o que
   não pode passar) e um registro das decisões. "Sempre ligado" passa a significar: o chat do PO
   volta sozinho quando o Orca abre e, se a conversa se perder, um PO novo lê os arquivos e
   continua de onde parou.
2. **Três portões antes do Kaique, mais o OK dele no fim.** Cada nível confere contra o que ele
   mesmo escreveu. É a resposta para a parte "quem valida o quê" (seção 5.3).
3. **Atalho para pedido pequeno.** Se o pedido cabe em uma tarefa só, o PO manda direto para um
   executor, sem planejador. Motivo: a análise de 09/09/2026 concluiu que cada nível a mais custa
   caro e rende pouco (_declarado_: `Desktop\Projetos\empresa-de-agentes\ESTADO.md`; três níveis
   deram +1,5 ponto a 1,79x do custo, sem significância). O nível do meio só entra quando há o que
   planejar.
4. **Limite de reprovações.** Reprovou duas vezes no mesmo portão, sobe um nível em vez de tentar
   de novo. Evita dois chats presos em vai e volta gastando limite.
5. **Fila do Kaique.** Toda pergunta sem resposta e todo pedido de OK caem numa lista única,
   visível no fluxograma.
6. **Cada executor no seu canto.** Dois executores nunca editam os mesmos arquivos ao mesmo tempo;
   cada um trabalha numa cópia separada do projeto e o planejador reúne.
7. **Teto de chats em paralelo**: cada planejador cria no máximo 4 executores ao mesmo tempo, para
   o limite da assinatura não acabar numa tarde.

### 5.3 Quem valida o quê

| Portão         | Quem confere       | Contra o quê                             | Olhando o quê                                                        | Se reprovar                        |
| -------------- | ------------------ | ---------------------------------------- | -------------------------------------------------------------------- | ---------------------------------- |
| **1. Prova**   | O próprio executor | Os critérios de aceite escritos na ordem | A prova pedida: teste rodando, print ou saída                        | Não entrega. Continua trabalhando. |
| **2. Plano**   | O planejador       | O plano que ele escreveu                 | O resultado funcionando e a prova. Código linha a linha só se quiser | Devolve ao executor com o motivo   |
| **3. Produto** | O PO               | O arquivo do produto                     | O produto rodando, como um usuário veria                             | Devolve ao planejador com o motivo |
| **4. Juntar**  | O Kaique           | A vontade dele                           | O que o PO aprovou, com resumo e prova                               | Devolve ao PO                      |

Regra que amarra tudo: **os critérios de aceite são escritos antes do trabalho começar**, por quem
dá a ordem. Quem executa nunca define o que é "pronto".

No atalho (pedido pequeno, sem planejador), o portão 2 não existe e o PO faz o 3.

### 5.4 O formato da ordem

Toda ordem que desce tem os mesmos cinco campos:

1. **Objetivo:** o resultado esperado, em uma frase.
2. **Por quê:** a razão, para quem recebe poder decidir bem os detalhes.
3. **Critérios de aceite:** como se prova que ficou pronto.
4. **Limites:** o que não pode ser tocado ou mudado.
5. **Território:** que parte do projeto é de quem recebe.

### 5.5 O caminho de um pedido

```
Kaique ──pedido──> PO ──ordem──> Planejador ──ordem──> Executor
                                                          │ portão 1 (prova)
                   PO <──entrega── Planejador <──entrega──┘
                    │ portão 3       portão 2
                    ▼
            Fila do Kaique ──OK──> juntar
```

Dúvida sobe pelo mesmo caminho: executor pergunta ao planejador, planejador ao PO, PO ao Kaique.
Cada um responde o que sabe e só repassa o que não sabe.

## 6. Cenários

- **SC-1 Pedido grande** (US-1, US-3, US-4)
  - **Dado** um projeto com PO, **quando** o Kaique pede "quero a tela inicial mais bonita",
  - **então** o PO registra o pedido, cria um planejador com uma ordem; o planejador pesquisa,
    escreve plano e critérios, cria executores; cada executor entrega com prova; o planejador
    confere; o PO confere o produto rodando; o item aparece na Fila do Kaique; só depois do OK
    dele o trabalho é juntado.
- **SC-2 Pedido pequeno** (US-1)
  - **Dado** um projeto com PO, **quando** o Kaique pede uma correção que cabe em uma tarefa,
  - **então** o PO manda a ordem direto a um executor e confere a entrega ele mesmo.
- **SC-3 Reprovação** (US-3)
  - **Dado** uma entrega no portão 2, **quando** o planejador reprova,
  - **então** ela volta ao executor com o motivo escrito; **e quando** reprova pela segunda vez,
  - **então** o caso sobe ao PO, que decide: refazer a ordem, trocar o executor ou perguntar ao Kaique.
- **SC-4 Kaique entra no meio** (US-7)
  - **Dado** um executor trabalhando, **quando** o Kaique escreve direto para ele,
  - **então** o executor obedece, o card fica marcado como "mexido pelo Kaique", e o que mudou
    é relatado ao nível de cima até chegar ao PO.
- **SC-5 PC desligou** (US-2)
  - **Dado** um PO com trabalho em andamento, **quando** o Orca reabre,
  - **então** o PO volta, lê os arquivos dele e mostra o estado de cada frente: o que terminou,
    o que parou no meio e o que espera o Kaique. Nada é dado como pronto sem prova.
- **SC-6 Teto atingido** (US-1)
  - **Dado** o projeto no teto de chats em paralelo, **quando** alguém tenta criar mais um,
  - **então** o pedido entra em espera e o fluxograma mostra que há trabalho na fila.
- **SC-7 Dúvida** (US-6)
  - **Dado** um executor com dúvida, **quando** ninguém acima sabe responder,
  - **então** a pergunta aparece na Fila do Kaique com o projeto, o chat de origem e o contexto;
    as outras frentes continuam trabalhando.
- **SC-8 Projeto sem PO**
  - **Dado** um projeto que não adotou a hierarquia, **quando** o Kaique abre o fluxograma,
  - **então** ele aparece exatamente como hoje.
- **SC-9 Chat que morre** (confiabilidade)
  - **Dado** um executor que parou sem entregar, **quando** quem o criou percebe,
  - **então** a tarefa volta para a fila daquele nível com o que já foi feito preservado, e o card
    mostra "parou sem entregar" em vez de sumir.

## 7. Requisitos funcionais

**Papéis e criação**

- **FR-1** O SISTEMA DEVE permitir marcar um projeto como "com hierarquia" e criar o PO dele.
- **FR-2** O SISTEMA DEVE permitir no máximo um PO por projeto.
- **FR-3** QUANDO o PO cria um chat, O SISTEMA DEVE criá-lo como planejador (Opus) ou, no atalho,
  como executor (Sonnet).
- **FR-4** QUANDO um planejador cria um chat, O SISTEMA DEVE criá-lo como executor (Sonnet).
- **FR-5** SE um executor tentar criar outro chat da hierarquia, ENTÃO O SISTEMA DEVE recusar.
- **FR-6** O SISTEMA DEVE registrar, para cada chat, o papel, o modelo e quem o criou.

**Memória do PO**

- **FR-7** O SISTEMA DEVE manter, por projeto, um arquivo do produto e um registro de decisões,
  ambos legíveis por gente.
- **FR-8** QUANDO o PO toma uma decisão ou aprende um requisito novo, O SISTEMA DEVE fazê-lo
  registrar no arquivo antes de continuar.
- **FR-9** QUANDO um PO inicia sem a conversa anterior, O SISTEMA DEVE fazê-lo ler os arquivos do
  projeto e o estado das frentes antes de responder.

**Ordens e portões**

- **FR-10** O SISTEMA DEVE exigir que toda ordem tenha os cinco campos da seção 5.4.
- **FR-11** SE uma entrega chegar sem a prova pedida nos critérios, ENTÃO O SISTEMA DEVE tratá-la
  como não entregue.
- **FR-12** QUANDO uma entrega é reprovada, O SISTEMA DEVE devolvê-la com o motivo por escrito.
- **FR-13** QUANDO a mesma entrega é reprovada duas vezes no mesmo portão, O SISTEMA DEVE subir o
  caso um nível.
- **FR-14** O SISTEMA NÃO DEVE juntar trabalho na versão principal nem publicar sem um OK do
  Kaique registrado para aquela entrega.
- **FR-14a** O SISTEMA NÃO DEVE gravar em sistema real de fora do projeto (no piloto: Spree,
  Factory e portais das licenciadoras) sem um OK do Kaique registrado para aquela gravação.
  Ler e simular é livre.
- **FR-14b** QUANDO o PO aprova uma entrega, O SISTEMA DEVE fazê-lo olhar o produto e propor o
  próximo pedido na Fila do Kaique, sem mandar executar.
- **FR-15** O SISTEMA DEVE guardar o histórico de cada entrega: quem conferiu, quando, resultado e motivo.

**Kaique**

- **FR-16** O SISTEMA DEVE manter uma Fila do Kaique única, com os pedidos de OK e as perguntas de
  todos os projetos, cada item com projeto, chat de origem e contexto.
- **FR-17** QUANDO o Kaique escreve direto num planejador ou executor, O SISTEMA DEVE marcar o
  chat e fazer a mudança ser relatada para cima até o PO.
- **FR-18** ENQUANTO um item espera o Kaique, O SISTEMA DEVE deixar as outras frentes trabalhando.

**Convivência e limites**

- **FR-19** O SISTEMA DEVE impedir que dois executores editem os mesmos arquivos ao mesmo tempo.
- **FR-20** O SISTEMA DEVE limitar cada planejador a 4 executores ao mesmo tempo e o projeto ao
  número de planejadores combinado (P-2), pondo em espera o que passar disso.
- **FR-20a** O SISTEMA DEVE tratar o PO como o caminho padrão: o Kaique fala com o PO, e o PO
  orquestra tudo. Falar direto com planejador ou executor é exceção permitida (FR-17).
- **FR-21** QUANDO uma entrega é aceita, O SISTEMA DEVE encerrar o executor que a fez. Planejador
  encerra quando a frente termina. PO não encerra.
- **FR-22** SE um chat da hierarquia parar sem entregar, ENTÃO O SISTEMA DEVE avisar quem o criou
  e preservar o que foi feito.

**Fluxograma**

- **FR-23** O SISTEMA DEVE desenhar, por projeto com hierarquia: projeto > PO > planejadores > executores.
- **FR-24** O SISTEMA DEVE mostrar em cada card o papel e o modelo (Fable, Opus, Sonnet).
- **FR-25** O SISTEMA DEVE mostrar em cada card o estado da entrega: trabalhando, em prova,
  conferindo plano, conferindo produto, esperando o Kaique, devolvido, parou sem entregar.
- **FR-26** O SISTEMA DEVE mostrar a Fila do Kaique dentro do fluxograma, e clicar num item DEVE
  levar ao chat de origem.
- **FR-27** O SISTEMA DEVE continuar mostrando projetos sem hierarquia como hoje.
- **FR-28** O SISTEMA DEVE manter as regras visuais já aprovadas: texto de tamanho fixo no zoom,
  nome nunca cortado, linhas finas, nada de layout em polígono ou constelação.

## 8. Requisitos não funcionais

- **Confiabilidade:** queda do serviço de terminais ou desligamento do PC não pode fazer uma
  entrega aparecer como pronta. O estado verdadeiro vem do registro, não da tela.
- **Custo:** o gasto do limite da assinatura por pedido tem que ser medido no piloto (R-1).
- **Desempenho:** o fluxograma com a hierarquia não pode ficar mais lento que hoje com a mesma
  quantidade de cards. A medida de comparação entra no plano.
- **Segurança:** esta entrega não cria nem guarda senha, chave ou segredo. Se o plano precisar de
  algum, tem que dizer onde fica, quem acessa e como é protegido.
- **Rastreio:** toda ordem, entrega, reprovação e OK fica registrada com data e autor.

## 9. Casos de borda

- O Kaique dá uma ordem a um executor que contradiz a ordem do planejador: vale a do Kaique, e a
  contradição sobe ao PO (SC-4).
- O PO e o Kaique discordam sobre qualidade: vale o Kaique, e o PO registra a decisão no arquivo
  do produto para não cobrar o contrário depois.
- Dois planejadores precisam do mesmo arquivo: o PO decide a ordem; não rodam juntos nele.
- O arquivo do produto está vazio (projeto novo): o PO começa entrevistando o Kaique antes de
  criar qualquer chat.
- Projeto sem controle de versão (pasta simples): "juntar" não existe como merge. Ver pergunta P-3.
- O limite da assinatura acaba no meio: os chats param; ao voltar, vale o cenário SC-5.

## 10. Como saber que deu certo (piloto)

- **CS-1** Três pedidos reais do Kaique completam o caminho inteiro (SC-1 ou SC-2) sem ele
  precisar abrir chat à mão nem intervir antes do portão 4.
- **CS-2** Zero trabalho juntado sem OK registrado, conferido no histórico (FR-15).
- **CS-3** Um PO recriado do zero responde certo a cinco perguntas sobre o produto que só estão
  nos arquivos.
- **CS-4** Em 100% dos chats do piloto, o fluxograma mostra o pai, o papel e o modelo corretos,
  conferido com print.
- **CS-5** Pelo menos uma reprovação real acontece no portão 2 ou 3 e aparece com motivo. Se nunca
  reprovar nada, os portões não estão conferindo.
- **CS-6** O gasto do limite da assinatura em cada um dos três pedidos fica anotado, comparado com
  o mesmo tipo de pedido feito num chat só.

## 11. Riscos

| #   | Risco                                                                      | O que fazer                                                                          | Responsável                            | Prazo                        |
| --- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------- | ---------------------------- |
| R-1 | Três níveis gastam o limite da assinatura rápido demais                    | Atalho (5.2 item 3), teto (FR-20) e medição CS-6                                     | Claude mede; Kaique decide se continua | Fim do piloto                |
| R-2 | O motor atual do Orca não aguenta dois níveis de chat criando chat         | Provar com um teste mínimo antes de escrever o resto do plano (Anexo A, itens 2 e 5) | Claude                                 | Antes de aprovar o `plan.md` |
| R-3 | Portão vira carimbo: todo mundo aprova tudo                                | CS-5 mais conferência contra texto escrito antes (5.3)                               | Claude monta; Kaique avalia no piloto  | Fim do piloto                |
| R-4 | O PO renascido não sabe o que o antigo sabia                               | FR-8 e teste CS-3                                                                    | Claude                                 | Antes de liberar o piloto    |
| R-5 | O serviço de terminais cai com muitos chats (já caiu por falta de memória) | Teto baixo no piloto; estado vem do registro (SC-5, SC-9)                            | Claude                                 | Durante o piloto             |

Os prazos estão amarrados a etapas, não a datas, porque o calendário do piloto ainda não foi
combinado com o Kaique.

## 12. Perguntas em aberto

- [x] **P-1** Qual projeto é o piloto? **Automação de Cadastros** (Kaique, 10/11/2026). Consequência:
      o projeto escreve em sistemas reais, então vale o FR-14a.
- [x] **P-2** Teto: **1 PO por projeto; cada planejador cria até 4 executores** (Kaique,
      10/11/2026, corrigindo a resposta anterior de 4 executores no total).
- [ ] **P-2a** Quantos planejadores ao mesmo tempo no piloto? _Sugestão: 2, o que dá até 11 chats
      (1 PO + 2 planejadores + 8 executores). O Kaique não fixou esse número._
- [ ] **P-2b** O atalho do pedido pequeno (PO manda direto a um executor, seção 5.2 item 3)
      continua valendo? O Kaique descreveu o PO criando planejadores, que criam executores.
      _Sugestão: manter o atalho, por custo._
- [x] **P-3** Ronda do PO: **só ao fim de cada entrega**; ele olha o produto e propõe o próximo
      pedido na Fila do Kaique. Nunca por relógio (Kaique, 10/11/2026).
- [ ] **P-4** Em projeto sem controle de versão, o que conta como "juntar"? _Sugestão: piloto só em
      projeto com git; decidir depois._
- [ ] **P-5** As cordas manuais do fluxograma (hoje só desenho) ganham função nesta entrega?
      _Sugestão: não; a hierarquia desenha as próprias linhas._

## 13. Fica para depois

- Valer para todos os projetos.
- PO conversando com PO de outro projeto.
- Rodar sem o PC ligado.
- Fila do Kaique no celular ou no Slack.

---

## Anexo A — Fatos conferidos (insumo para o plano)

Conferido em 10/11/2026, na worktree `orca-canvas`, commit `847a40b0fd`. Atenção: o comando `orca`
do terminal responde como versão **1.4.209** (o Orca instalado), não o fork (1.4.249). O plano tem
que repetir as conferências 1 e 3 com o comando do fork.

| #   | Fato                                                                                                                 | Tipo                                                                | Onde conferir                                                                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | O Orca lança um chat novo já com modelo escolhido                                                                    | Conferido na ajuda do comando                                       | `orca orchestration worker-start --help` (opções `--model`, `--effort`)                                                                      |
| 2   | Por padrão, um chat criado **não** pode criar outro: o limite de níveis é 1. PO > planejador > executor precisa de 2 | Conferido no código                                                 | `src/shared/nested-worker-depth.ts` (`NESTED_WORKER_MAX_DEPTH_DEFAULT = 1`); ajuste em Configurações → Orchestration → "Nested worker depth" |
| 3   | Já existe ponto de decisão que trava uma tarefa até alguém escolher                                                  | Conferido na ajuda do comando                                       | `orca orchestration gate-create --help`                                                                                                      |
| 4   | O "quem criou quem" já existe no status de cada chat e o painel de agentes já monta a árvore                         | Conferido no código                                                 | `src/renderer/src/components/dashboard/agent-row-lineage-model.ts`                                                                           |
| 5   | Dois níveis funcionando de ponta a ponta, e o nome "fable" aceito como modelo                                        | **Não testado**                                                     | Primeiro teste do plano (R-2)                                                                                                                |
| 6   | Chat criado em pasta nova morre na pergunta "confia nesta pasta?" se a pasta não for registrada antes                | _Declarado_ (aconteceu em 20/10/2026, anotado na memória do Claude) | Repetir no primeiro teste do plano                                                                                                           |
| 7   | O fluxograma atual não tem teste automatizado de tela                                                                | _Declarado_ no `ONDE-PARAMOS.md`                                    | `ONDE-PARAMOS.md`, seção de 09/11                                                                                                            |
