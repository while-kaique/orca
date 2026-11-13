# Vistoria do fluxograma (trava de defeito visual)

**Obrigatória antes de qualquer entrega que toque o fluxograma.** Um comando só:

```
node tools/vistoria-fluxograma/vistoria.mjs
```

Termina com **saída 0 e `RESULTADO: zero achado`**, ou **saída 1 e a lista do que achou** (tipo, card, coordenada).
Saída 2 = a vistoria não conseguiu rodar (erro escrito na última linha).

**O que faz:** monta a branch (pela vez da máquina), abre o Orca de teste **escondido** com uma cópia do estado
real (`preparar-estado.py`), tira o print do fluxograma **como está** e **depois de clicar no Reorganizar**, lê da
tela a posição de cada card, o contorno desenhado (hexágono incluso), cada texto, selo, linha e seta, e mede:

| Tipo | O que reprova                                                                                                                                                                                    |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| a    | linha de árvore que passa por dentro de card, corre colada (menos de 24 unidades por 40 ou mais) em volta de card que não é ponta dela, ou contorna card (sai para fora do caminho reto e volta) |
| b    | ponta de linha ou de seta a mais de 4 unidades do contorno **desenhado** do card (hexágono, card fino)                                                                                           |
| c    | texto cortado (reticências ou maior que a caixa dele) ou com a caixa fora da borda do card                                                                                                       |
| d    | card sobre card                                                                                                                                                                                  |
| e    | selo (anexos) a mais de 16 unidades do card dono                                                                                                                                                 |
| f    | card fora da grade de 196 unidades (origem = card mais à esquerda; só depois do Reorganizar)                                                                                                     |
| g    | chat a mais de 3 colunas (392 cada, borda a borda) do dono: o criador, ou o projeto (PO e livre)                                                                                                 |
| i    | executor ou planejador ligado direto ao projeto (só pode estar ligado a um chat; criador fechado = fica sob o chat vivo mais próximo)                                                            |

Também imprime os números do Reorganizar: largura do card do PO em px de tela, margem vazia de cada lado em px e
o maior buraco entre projetos. Esses números não reprovam; servem para comparar antes e depois.

**Fora da conta (de propósito):** o texto de resumo do chat (último pedido, manchete) é resumido de propósito e
fica de fora do "texto cortado". Setas manuais só entram no tipo b: o caminho delas é livre e pode cruzar card.

| Opção                     | Para quê                                                                                                             |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `--sem-montar`            | usa o `out/` que já está montado (só se a branch não mudou desde a última montagem)                                  |
| `--app PASTA`             | abre o app montado em outra pasta (precisa de `package.json` e `out/`); serve para rodar a vistoria no código antigo |
| `--saida PASTA`           | onde guardar prints, `*-fatos.json`, `achados.json` e `relato.txt` (padrão `.cache/vistoria-fluxograma/vistoria/`)   |
| `--posicoes ARQUIVO.json` | cards arrastados (formato de `orca-fork.canvas-offsets`) para montar cenário de prova                                |
| `--cordas ARQUIVO.json`   | setas guardadas (chave `orca-fork.canvas-cords`: `[{"a":"<id>","b":"<id>"}]`)                                        |
| `--cenario ARQUIVO.mjs`   | módulo que monta um cenário de prova no app de teste (ver `cenarios-de-prova/`)                                      |
| `--zoom 0.35,1`           | mede de novo em cada zoom listado, depois do Reorganizar                                                             |
| `--manter`                | não apaga o mundo de teste no fim                                                                                    |

**Onde sai o resultado:** `<saida>/como-esta.png`, `reorganizado.png`, `zoom-*.png`, os `*-fatos.json` (o que foi
lido da tela), `achados.json` e `relato.txt`.

**Quanto demora:** de 3 a 4 minutos com montagem (a montagem é quase tudo e espera a vez da máquina) e cerca de
1 minuto com `--sem-montar`.

**Cenários de prova (`cenarios-de-prova/`):** montam defeitos de propósito para provar que a vistoria pega cada
tipo. Rodam só no Orca de teste (`--cenario ARQUIVO.mjs`):

| Arquivo                          | O que monta                                                                                   |
| -------------------------------- | --------------------------------------------------------------------------------------------- |
| `print-do-kaique.mjs`            | o print de 13/11: PO anterior fechado, PO novo, setas manuais, nome comprido, selo solto      |
| `seta-manual.mjs`                | seta entre dois cards (um hexágono) depois de Reorganizar, arrastar e chat novo; card fechado |
| `chat-lancado-nasce.mjs`         | chat lançado pela hierarquia nascendo: linha do tempo do papel e do lado dele                 |
| `c-texto-pior-caso.mjs`          | nomes e títulos compridos, modelo, aguardando equipe, 987k e selos em todo tipo de card       |
| `a-card-no-caminho-da-linha.mjs` | tipo a (e d e g de tabela): card arrastado para o meio de uma linha                           |
| `d-card-sobre-card.mjs`          | tipo d                                                                                        |
| `f-fora-da-grade.mjs`            | tipo f: card puxado depois do Reorganizar                                                     |
| `g-chat-longe-do-dono.mjs`       | tipo g                                                                                        |

Um cenário exporta `default async (page, { lerTela, medir, recarregar, dizer, mundo, saida })`; pode exportar também
`depoisDoReorganizar(page, ferramentas)` e `limpar()`. O cenário `c-texto-pior-caso` grava um transcrito de teste em
`~/.claude/projects/TESTE-vistoria-fluxograma/` (o Orca só lê transcritos dali) e o apaga no fim.

**Limites:** o Orca de teste roda escondido, e o Chromium freia os temporizadores de uma janela escondida: um tempo
medido em segundos aqui (por exemplo, quanto o fluxograma demora para ler o registro) não vale como tempo real do Orca
em uso. O que vale é a ordem dos fatos. O texto de resumo do chat fica fora do "texto cortado".

---

# Vistoria da junção do fluxograma (comando antigo, `vistoria-juncao.mjs`)

**O que faz:** monta a branch atual, abre um Orca de teste **escondido** com uma cópia do estado guardado do
Orca em uso, tira o print do fluxograma, confere se cada card está do lado certo (hierarquia embaixo do
projeto, livre em cima) e fecha tudo sem deixar processo nem janela.

**Comando (da raiz do projeto):**

```
node tools/vistoria-fluxograma/vistoria-juncao.mjs
```

| Opção                     | Para quê                                                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--sem-montar`            | pula a montagem e usa o que já está em `out/` (só use se a branch não mudou desde a última montagem feita por este comando)                                        |
| `--saida PASTA`           | onde guardar o resultado (padrão: `.cache/vistoria-fluxograma/juncao/`)                                                                                            |
| `--posicoes ARQUIVO.json` | troca as posições arrastadas guardadas por essas (formato de `orca-fork.canvas-offsets`, ex.: `{"<id do chat>":{"dx":0,"dy":-400}}`) para simular cards arrastados |
| `--manter`                | não apaga o mundo de teste no fim (para investigar)                                                                                                                |

**Onde sai o print:** `.cache/vistoria-fluxograma/juncao/fluxograma.png`, mais `fluxograma-fatos.json` (lugar
de cada card), `rodada.txt` (o relato da rodada com o tempo de cada passo) e `montagem.log`.

**Quanto demora:** cerca de 3 a 4 minutos com montagem (a montagem é quase tudo) e cerca de 1 minuto com
`--sem-montar`. Montagem roda pela vez do comando `hierarquia vez`, então espera se outro comando pesado estiver rodando.

**Como termina:** a última linha diz `RESULTADO: tudo no lugar, nada sobrou` (saída 0) ou `RESULTADO: ha o que
olhar` (saída 1), com a lista de cards no lado errado, processos que sobraram ou janelas visíveis.

**O que garante que nada do Orca em uso é tocado:**

- O Orca de teste usa um perfil próprio em `%TEMP%\vistoria-fluxograma\mundo\perfil` (apagado no fim) e porta
  de inspeção própria; o Orca em uso não é fechado, reiniciado nem reconstruído.
- `preparar-estado.py` só **lê** o estado do Orca em uso. Todo caminho sob `Desktop\Projetos` e
  `orca\workspaces` é trocado por uma pasta de teste (repositório git vazio mais a cópia do
  `.hierarquia/estado.json`), então o Orca de teste nunca enxerga a pasta de verdade e não consegue escrever nela.
- A janela abre oculta (`ORCA_BACKGROUND_LAUNCH=1`) e o print vem por CDP, sem tirar foco.
- Ao fechar, a ferramenta mata só os processos cuja linha de comando cita a pasta do mundo de teste e confere
  que não restou nenhum.

**Limites:** o estado copiado é o de agora (inclusive posições arrastadas); o Orca de teste não acorda os
terminais dos chats. Para ver o PO nascendo ou a máscara de carregamento no programa de verdade, use as funções
de `orca-de-teste.mjs` (`abrirOrcaDeTeste`, `abrirFluxograma`, `lerFluxograma`) num roteiro próprio.

## Provas do lugar dos cards (o-036)

| Comando                                                                                        | O que faz                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node tools/vistoria-fluxograma/prova-encaixe.mjs [--saida ARQ.json]`                          | Roda o calculo real do Reorganizar (sem abrir o Orca): largura do card do PO nos casos dos prints a mão e tempo com 8 projetos e 40 chats.                                                                                                                                                                              |
| `node tools/vistoria-fluxograma/prova-encaixe-real.mjs --rotulo novo --saida PASTA [--nascer]` | No Orca de teste escondido: números e prints do quadro de 2151 x 1370 antes e depois do Reorganizar. `--nascer` arrasta um projeto e cria chats (livre, PO, planejador, executor). `--arrastes` guarda arrastes antes de abrir. `--quadro LxA` troca o tamanho do quadro. `--raiz PASTA` roda um build de outra versão. |
| `python tools/vistoria-fluxograma/medir-prints-encaixe.py PRINT.png`                           | Mede a margem vazia de cada lado no print do quadro, em px de tela.                                                                                                                                                                                                                                                     |
| `python tools/vistoria-fluxograma/lado-a-lado-encaixe.py ANTIGO MAO NOVO SAIDA T1 T2 T3`       | Monta a imagem antigo / arrumado a mão / novo com um texto em cada.                                                                                                                                                                                                                                                     |

## Provas dos 3 casos a mao e do buraco (o-036, correcao 1)

| Comando                                                                                                                  | O que faz                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node tools/vistoria-fluxograma/prova-casos-real.mjs --caso ID --rotulo antigo\|novo --raiz BUILD --saida PASTA [--mao]` | No Orca de teste escondido monta a forma de chats de um dos 3 casos (`casos-encaixe.mjs`), clica Reorganizar e, com `--mao`, arruma como o Kaique (arrastando) e mede o card do PO. |
| `python tools/vistoria-fluxograma/resumo-casos.py PASTA_DOS_CASOS`                                                       | Junta antigo / a mao / novo lado a lado e a tabela de numeros.                                                                                                                      |
| `node tools/vistoria-fluxograma/buraco-dos-prints.mjs PASTA_DOS_CASOS`                                                   | Mede o maior buraco (em cards de 340 x 230) de cada arrumacao lida da tela.                                                                                                         |
| `python tools/vistoria-fluxograma/tabela-antes-depois.py ANTIGO.json NOVO.json ETAPA SAIDA.txt`                          | Tabela do estado guardado: onde cada card esta na versao antiga e na nova.                                                                                                          |
| `node tools/vistoria-fluxograma/depurar-encaixe.mjs [caso] [saida.json]` + `python .../esquema-encaixe.py`               | Desenha os contornos e o maior buraco de um caso (apoio, nao e prova).                                                                                                              |
