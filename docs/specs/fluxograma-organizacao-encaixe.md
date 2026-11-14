# Fluxograma: organização por encaixe e vistoria que reprova defeito visual (ordem o-034)

Spec curta do planejador. Base: `feat/pc-como-mesa` em `6e43f71910`. Prints do Kaique em
`.hierarquia/provas/pedido-organizacao-encaixe/` e `.hierarquia/provas/pedido-reorganizar-ideal/`.
Não abre decisão de produto: tudo abaixo vem da ordem o-034, do complemento de 13/11 e da decisão do Kaique
de 12/11 ("deixa tudo parado pra eu apertar o botão mesmo").

## 1. Causas lidas no código (13/11)

| Defeito no print                                                     | Causa                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reorganizar com meia tela vazia                                      | `layoutCanvas` trata cada projeto como caixa retangular, corta em grade de linhas iguais e prefere a grade "mais quadrada" até perder 15% de zoom; vão fixo de uma coluna vazia (444) entre projetos.                                                                                          |
| Chat novo nasce longe do projeto                                     | A posição arrastada é guardada como distância (`dx, dy`) do lugar automático de **cada card**. O lugar automático de todos é refeito a cada chat que nasce ou fecha; o card novo não tem distância guardada e cai no lugar automático, enquanto o projeto que ele arrastou continua deslocado. |
| Executores do PO anterior ligados ao projeto, linha contornando o PO | `applyCanvasHierarchy` só liga o chat ao criador (`pai`) se o criador está aberto. O PO anterior fechou: os executores viram raiz, ficam na fileira 2 sob o projeto, e a linha projeto→executor desvia (`laneDetour`) em volta do card do PO novo.                                             |
| Seta manual com ponta solta                                          | `cordPath` usa o **espaço** do card (340 x 230), não o que é desenhado: no hexágono do executor (150 x 160) a ponta fica no vazio ao lado.                                                                                                                                                     |
| Nome cortado no hexágono ("Organizador de Fluxogram")                | O texto do hexágono não quebra nem reduz para caber na largura útil do hexágono.                                                                                                                                                                                                               |

## 2. A regra nova do lugar (encaixe)

1. **Forma real de cada projeto:** o contorno é o que é desenhado: por fileira, uma caixa por grupo de cards vizinhos de mesma
   altura, com os selos deles (o selo de um card não desce a fileira inteira), e, por família (um pai e os chats dele), as linhas como são desenhadas: o toco fino no centro do pai até a
   barra, a barra e as descidas até os chats (a barra fica no meio do caminho saindo do projeto e 40 unidades abaixo
   saindo de um chat); livres + selos em cima, cabeçalho. Não é mais a caixa retangular do projeto inteiro (o-042;
   a primeira versão reservava a faixa inteira do pai aos filhos e a vistoria mediu 92 em vez de 52).
2. **Encaixe:** os projetos são postos um a um no quadro; cada um cai na posição em que não encosta em nada já
   posto e que deixa o card maior na tela. Assim um projeto pode entrar por baixo ou ao lado de outro, dentro
   da caixa retangular dele (o social-hub sob o Astra no print a mão).
   2a. **Margem entre projetos (complemento do Kaique de 13/11 e resposta p-009 do PO):** a distância entre projetos
   vizinhos é **52 unidades** (o mesmo vão entre dois cards de uma fileira), **igual em todo lugar**: nenhum
   projeto fica a mais de 52 do vizinho mais próximo e nada de um projeto (card, linha, selo, texto) chega a
   menos de 52 de outro. No fim da busca, cada projeto que ficou longe desliza até ficar a 52 de um vizinho, sem
   diminuir o card (pode deixar no máximo um card a mais de vazio: a margem igual vem primeiro). A vistoria mede
   e reprova vão fora de 52 ± 4 (tipo j).
3. **Busca:** testa toda ordem de projetos até 6 projetos; acima disso, busca em feixe a partir das ordens
   "mais alto primeiro" e "mais largo primeiro". Ganha a arrumação com o maior card na tela (zoom em que tudo
   cabe no quadro, no máximo 1:1); empate (menos de 0,5%): cabeçalhos da mesma faixa na mesma altura, depois a
   menor área, depois a ordem da barra lateral. Tempo: 8 projetos e 40 chats em menos de 200 ms.
4. **Grade:** dentro de cada projeto, todo card começa num múltiplo de 196 unidades (meia coluna; coluna =
   340 + 52) contado do chat mais à esquerda dele. Entre projetos vale a margem de 52, não a grade (p-009: a
   grade única entre projetos era critério do PO; a margem pequena é pedido do Kaique). Cabeçalhos de projetos na mesma faixa ficam na mesma altura. PO centrado sob
   o cabeçalho do projeto dele (já é a regra da árvore).
5. **Zoom final:** depois do Reorganizar o zoom ajusta ao que é **desenhado** (contorno real, selos e chips
   incluídos), descontando a barra de legenda e os botões de baixo, com folga de 32 px de tela em cada lado; o
   desenho fica centrado, então as margens dos lados ficam parecidas.
6. **Dentro do projeto nada muda de sentido:** livres em cima, PO embaixo, planejadores embaixo do PO,
   executores embaixo de quem os criou.

## 3. Estado guardado e estabilidade

- **Âncora por projeto:** o Reorganizar grava a posição de cada cabeçalho de projeto (âncora). Entre um
  Reorganizar e outro, o lugar de cada chat é calculado a partir da âncora do projeto dele (árvore do projeto),
  mais o arraste próprio do chat. Arrastar um projeto move a âncora.
- **Chat nasce ou fecha:** só a árvore daquele projeto é refeita em volta da âncora. Se a forma nova passar a
  encostar em outro projeto, o outro desce (ou vai para a direita) o mínimo, na grade. A ordem dos projetos
  nunca muda sem o botão. O chat novo nasce no lugar dele na árvore, colado em quem o criou (ou acima do
  projeto, se for livre), nunca do outro lado da tela.
- **Troca de versão:** na primeira abertura da versão nova, sem âncora guardada, as âncoras e os arrastes são
  convertidos do lugar **antigo** (função antiga mantida só para isso) mais as distâncias guardadas: tudo fica
  exatamente onde estava (diferença 0 nas coordenadas). A arrumação nova só entra no clique do Reorganizar.
- **Livre que vira hierarquia:** a regra de zona que já existe continua: chat que trocou de zona volta para o
  lugar automático dele na árvore.

## 4. Hierarquia, linhas, setas e textos

- **Executores do PO anterior:** chat cujo `pai` no registro é um PO que não está aberto passa a ficar
  pendurado no PO ativo aberto do mesmo projeto; enquanto o PO novo está nascendo ("Abrindo o PO"), no chat que
  está nascendo. Linha reta do PO até eles.
- **Criador fechado em geral (complemento de 13/11, o-042):** chat da hierarquia cujo criador fechou fica embaixo
  do **ancestral vivo mais próximo** pela cadeia `pai` do registro (ex.: executor da o-036 cujo planejador fechou
  fica sob o PO). PO fechado na cadeia = o PO que está no lugar dele. Executor e planejador nunca ficam ligados
  direto ao projeto, nem com a cadeia quebrada; vale depois de reiniciar o Orca e para ordem com baixa (a
  ligação vem só do registro, não da ordem). Sem nenhum chat vivo acima (PO fechado e o próximo ainda sem abrir),
  ficam embaixo do projeto sem linha.
- **Chat lançado pela hierarquia:** já nasce embaixo de quem o criou; a fase "Livre longe" some (o registro
  `chat_lancado` existe antes de o papel aparecer na tela: o fluxograma relê o registro quando surge uma aba
  nova, em vez de esperar a próxima leitura de 3 s, e um chat cujo criador é da hierarquia não é desenhado como
  livre).
- **Linhas:** nenhuma linha passa por dentro nem contorna um card; com o lugar novo o caminho reto fica livre.
  O desvio continua só como último recurso para card arrastado pelo usuário.
- **Seta manual:** as pontas usam o contorno desenhado (hexágono, card fino); a seta acompanha qualquer
  movimento porque é recalculada das posições desenhadas; com um dos dois cards fechado ela não aparece; seta
  guardada de antes abre grudada.
- **Textos:** nenhum texto cortado ou fora da borda, em qualquer tipo de card e no menor zoom do Reorganizar;
  nome do executor quebra em até 2 linhas dentro do hexágono e reduz se precisar. Selo (anexo, agentes) sempre
  colado no card dono.

## 5. A vistoria (trava permanente)

Comando único: `node tools/vistoria-fluxograma/vistoria.mjs`. Monta a branch, abre o Orca de teste escondido com
cópia do estado real, tira o print **como está** e **depois do Reorganizar**, mede e termina com saída 1 e a
lista do que achou, ou saída 0 com "zero achado". Mede, no programa de verdade (posições lidas da tela):

1. linha que passa por dentro de card ou que corre colada em volta de um card que não é ponta dela;
2. ponta de linha ou de seta que não termina encostada num card;
3. texto cortado (reticências ou elemento maior que a caixa) ou fora da borda do card;
4. card sobre card;
5. selo a mais de 16 unidades do card dono;
6. card fora da grade de 196 (só depois do Reorganizar);
7. chat a mais de **3 colunas** (borda a borda, coluna = 392 unidades) do dono dele (criador, ou o projeto para
   PO e livre);
8. números do Reorganizar: largura do card do PO em px, margem vazia de cada lado em px, maior buraco entre
   projetos;
9. (tipo i, o-042) executor ou planejador ligado direto ao projeto;
10. (tipo j, o-042) margem entre projetos vizinhos fora de 52 ± 4 (encosta, passa por cima ou fica longe); o tipo 6
    (grade) passa a valer por projeto.

Obrigatória antes de qualquer entrega que toque o fluxograma (escrito no `AGENTS.md` e no `ONDE-PARAMOS.md`).

## 6. Divisão do trabalho

2 executores, porque são duas partes independentes (o lugar dos cards; o desenho e a vistoria) e o conjunto
é grande demais para um só no tempo pedido.

- **Executor A (lugar):** regra de encaixe, zoom final, âncoras, conversão do estado antigo, estabilidade,
  chat nascendo perto do dono, tempo, testes com os casos a mão do Kaique.
- **Executor B (desenho e vistoria):** comando de vistoria, executores do PO anterior, chat lançado sem fase
  "Livre", linhas, setas, textos e selos.
