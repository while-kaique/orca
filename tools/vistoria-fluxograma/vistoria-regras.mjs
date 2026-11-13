// As medidas da vistoria do fluxograma, sobre os fatos lidos da tela (vistoria-leitura-da-tela.mjs).
// Tudo em unidades do fluxograma. Cada achado diz o tipo (a a g), o card e a coordenada.

export const COLUNA = 392
export const MEIA_COLUNA = 196
export const LIMITES = {
  pontaAteOContorno: 4,
  linhaColadaMenosDe: 24,
  linhaColadaPorPeloMenos: 40,
  seloAteOCard: 16,
  colunasAteODono: 3,
  folgaDoTexto: 0.75,
  volta: 12
}

const arredondar = (n) => Math.round(n)
const coordenada = ([x, y]) => `(${arredondar(x)}, ${arredondar(y)})`

const cantos = (c) => [
  [c.x, c.y],
  [c.x + c.w, c.y],
  [c.x + c.w, c.y + c.h],
  [c.x, c.y + c.h]
]
const contornoDe = (card) => card.contorno ?? cantos(card.caixa)

function distanciaAoSegmento([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax
  const dy = by - ay
  const comprimento = dx * dx + dy * dy
  const t =
    comprimento === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / comprimento))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

export function distanciaAoContorno(ponto, card) {
  const poligono = contornoDe(card)
  let melhor = Infinity
  for (let i = 0; i < poligono.length; i++) {
    melhor = Math.min(
      melhor,
      distanciaAoSegmento(ponto, poligono[i], poligono[(i + 1) % poligono.length])
    )
  }
  return melhor
}

function dentroDoPoligono([px, py], poligono) {
  let dentro = false
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const [xi, yi] = poligono[i]
    const [xj, yj] = poligono[j]
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      dentro = !dentro
    }
  }
  return dentro
}

/** Dentro do card, a pelo menos `folga` unidades do contorno. */
const dentroDoCard = (ponto, card, folga) =>
  dentroDoPoligono(ponto, contornoDe(card)) && distanciaAoContorno(ponto, card) >= folga

function distanciaACaixa([px, py], c) {
  const dx = Math.max(c.x - px, 0, px - (c.x + c.w))
  const dy = Math.max(c.y - py, 0, py - (c.y + c.h))
  return Math.hypot(dx, dy)
}

const distanciaEntreCaixas = (a, b) =>
  Math.hypot(
    Math.max(0, a.x - (b.x + b.w), b.x - (a.x + a.w)),
    Math.max(0, a.y - (b.y + b.h), b.y - (a.y + a.h))
  )

/** O espaco que o card ocupa na fileira: o hexagono ocupa 340 de largura mesmo desenhado menor. */
function lugarDoCard(card) {
  if (card.forma === 'crest') {
    return { ...card.caixa, x: card.caixa.x + card.caixa.w / 2 - 170, w: 340 }
  }
  return card.caixa
}

function cardMaisPerto(ponto, cards) {
  let melhor = null
  for (const card of cards) {
    const distancia = distanciaAoContorno(ponto, card)
    if (!melhor || distancia < melhor.distancia) {
      melhor = { card, distancia }
    }
  }
  return melhor
}

/** Para cada seta guardada, qual par de cards ela deve ligar; a seta desenhada escolhe o par que mais combina. */
function pontasDaSeta(linha, cardsPorChave, guardadas) {
  const inicio = linha.pontos[0]
  const fim = linha.pontos.at(-1)
  let melhor = null
  for (const guardada of guardadas) {
    const a = cardsPorChave.get(guardada.a)
    const b = cardsPorChave.get(guardada.b)
    if (!a || !b) {
      continue
    }
    for (const [de, para] of [
      [a, b],
      [b, a]
    ]) {
      const custo = distanciaAoContorno(inicio, de) + distanciaAoContorno(fim, para)
      if (!melhor || custo < melhor.custo) {
        melhor = { custo, de, para }
      }
    }
  }
  return melhor ? { de: melhor.de, para: melhor.para } : null
}

export function analisar(fatos, { depoisDoReorganizar }) {
  const achados = []
  const achar = (tipo, regra, card, ponto, detalhe) =>
    achados.push({
      tipo,
      regra,
      card,
      coordenada: ponto ? coordenada(ponto) : '-',
      detalhe
    })
  const cards = fatos.cards
  const cardsPorChave = new Map(cards.map((card) => [card.chave, card]))

  // Fim de cada linha: o card cujo contorno desenhado esta mais perto de cada ponta.
  const ligacoes = fatos.linhas.map((linha) => {
    if (linha.tipo === 'seta') {
      const par = pontasDaSeta(linha, cardsPorChave, fatos.setasGuardadas)
      if (par) {
        return { linha, de: par.de, para: par.para }
      }
    }
    return {
      linha,
      de: cardMaisPerto(linha.pontos[0], cards)?.card ?? null,
      para: cardMaisPerto(linha.pontos.at(-1), cards)?.card ?? null
    }
  })

  for (const { linha, de, para } of ligacoes) {
    const nome = linha.tipo === 'seta' ? 'seta' : 'linha'
    // b) as duas pontas encostadas (ate 4 unidades) no contorno desenhado.
    for (const [ponta, card, rotuloPonta] of [
      [linha.pontos[0], de, 'saida'],
      [linha.pontos.at(-1), para, 'chegada']
    ]) {
      if (!card) {
        achar('b', 'ponta solta', `${nome} (${rotuloPonta})`, ponta, 'nenhum card por perto')
        continue
      }
      const distancia = distanciaAoContorno(ponta, card)
      if (distancia > LIMITES.pontaAteOContorno) {
        achar(
          'b',
          'ponta solta',
          card.rotulo,
          ponta,
          `${nome} de ${rotuloPonta}: termina a ${distancia.toFixed(1)} unidades do contorno desenhado`
        )
      }
    }
  }

  for (const { linha, de, para } of ligacoes) {
    if (linha.tipo === 'seta') {
      continue
    }
    const pontas = new Set([de?.chave, para?.chave])
    const titulo = `linha ${de?.rotulo ?? '?'} -> ${para?.rotulo ?? '?'}`
    // a) por dentro de card.
    const jaDentro = new Set()
    for (const ponto of linha.pontos.slice(1, -1)) {
      for (const card of cards) {
        if (!jaDentro.has(card.chave) && dentroDoCard(ponto, card, 3)) {
          jaDentro.add(card.chave)
          achar('a', 'linha por dentro de card', card.rotulo, ponto, titulo)
        }
      }
    }
    // a) colada em volta de um card que nao e ponta dela.
    for (const card of cards) {
      if (pontas.has(card.chave)) {
        continue
      }
      let corrida = 0
      let inicioDaCorrida = null
      let achou = false
      const fecharCorrida = () => {
        if (!achou && corrida >= LIMITES.linhaColadaPorPeloMenos && inicioDaCorrida) {
          achou = true
          achar(
            'a',
            'linha colada em volta de card',
            card.rotulo,
            inicioDaCorrida,
            `${titulo}: ${arredondar(corrida)} unidades a menos de ${LIMITES.linhaColadaMenosDe}`
          )
        }
        corrida = 0
        inicioDaCorrida = null
      }
      linha.pontos.forEach((ponto, i) => {
        if (distanciaACaixa(ponto, card.caixa) < LIMITES.linhaColadaMenosDe) {
          inicioDaCorrida ??= ponto
          corrida +=
            i === 0
              ? 0
              : Math.hypot(ponto[0] - linha.pontos[i - 1][0], ponto[1] - linha.pontos[i - 1][1])
        } else {
          fecharCorrida()
        }
      })
      fecharCorrida()
    }
    // a) contornando: a linha sai para fora do espaco entre as duas pontas e volta.
    const xs = linha.pontos.map((p) => p[0])
    const ys = linha.pontos.map((p) => p[1])
    const [x0, y0] = linha.pontos[0]
    const [x1, y1] = linha.pontos.at(-1)
    const sobraX = Math.max(Math.min(x0, x1) - Math.min(...xs), Math.max(...xs) - Math.max(x0, x1))
    const sobraY = Math.max(Math.min(y0, y1) - Math.min(...ys), Math.max(...ys) - Math.max(y0, y1))
    if (sobraX > LIMITES.volta || sobraY > LIMITES.volta) {
      const faixa = {
        x: Math.min(...xs),
        y: Math.min(...ys),
        w: Math.max(...xs) - Math.min(...xs),
        h: Math.max(...ys) - Math.min(...ys)
      }
      const contornados = cards.filter(
        (card) => !pontas.has(card.chave) && distanciaEntreCaixas(card.caixa, faixa) === 0
      )
      achar(
        'a',
        'linha contornando card',
        contornados.map((c) => c.rotulo).join(' + ') || 'sem card no caminho',
        linha.pontos[Math.floor(linha.pontos.length / 2)],
        `${titulo}: sai ${arredondar(Math.max(sobraX, sobraY))} unidades para fora do caminho reto`
      )
    }
  }

  // c) texto cortado ou fora da borda do card.
  for (const texto of fatos.textos) {
    const dono = cardsPorChave.get(texto.dono)
    const rotulo = dono?.rotulo ?? texto.rotuloDoDono ?? texto.dono
    const lugar = texto.caixaDoTexto
    const centro = [lugar.x + lugar.w / 2, lugar.y + lugar.h / 2]
    if (texto.cortaComReticencias || texto.cortaPorAltura) {
      achar('c', 'texto cortado', rotulo, centro, `"${texto.texto}" (${texto.campo}) esta cortado`)
      continue
    }
    const alvo = texto.selo ? { caixa: texto.selo, contorno: null } : dono
    if (!alvo) {
      continue
    }
    const folga = LIMITES.folgaDoTexto
    const dentroDaBorda = cantos(lugar).every(
      ([x, y]) =>
        dentroDoPoligono([x, y], contornoDe(alvo)) || distanciaAoContorno([x, y], alvo) <= folga
    )
    if (!dentroDaBorda) {
      achar(
        'c',
        'texto fora da borda',
        rotulo,
        centro,
        `"${texto.texto}" (${texto.campo}) passa da borda do card`
      )
    }
  }

  // d) card sobre card.
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const a = cards[i].caixa
      const b = cards[j].caixa
      const sobraX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
      const sobraY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
      if (sobraX > 1 && sobraY > 1) {
        achar(
          'd',
          'card sobre card',
          cards[i].rotulo,
          [Math.max(a.x, b.x) + sobraX / 2, Math.max(a.y, b.y) + sobraY / 2],
          `cobre ${cards[j].rotulo} em ${arredondar(sobraX)} x ${arredondar(sobraY)} unidades`
        )
      }
    }
  }

  // e) selo longe do card dono.
  for (const selo of fatos.selos) {
    const dono = cardsPorChave.get(selo.dono)
    if (!dono) {
      continue
    }
    const distancia = distanciaEntreCaixas(selo.caixa, dono.caixa)
    if (distancia > LIMITES.seloAteOCard) {
      achar(
        'e',
        'selo longe do dono',
        dono.rotulo,
        [selo.caixa.x + selo.caixa.w / 2, selo.caixa.y + selo.caixa.h / 2],
        `selo a ${distancia.toFixed(1)} unidades do card (limite ${LIMITES.seloAteOCard})`
      )
    }
  }

  // f) grade de 196 contada da mesma origem (so depois do Reorganizar).
  let origemDaGrade = null
  if (depoisDoReorganizar && cards.length > 0) {
    origemDaGrade = Math.min(...cards.map((card) => lugarDoCard(card).x))
    for (const card of cards) {
      const resto =
        (((lugarDoCard(card).x - origemDaGrade) % MEIA_COLUNA) + MEIA_COLUNA) % MEIA_COLUNA
      const desvio = Math.min(resto, MEIA_COLUNA - resto)
      if (desvio > 1.5) {
        achar(
          'f',
          'card fora da grade de 196',
          card.rotulo,
          [lugarDoCard(card).x, card.caixa.y],
          `a ${desvio.toFixed(1)} unidades da linha da grade (origem x=${arredondar(origemDaGrade)})`
        )
      }
    }
  }

  // g) chat a mais de 3 colunas do dono (borda a borda).
  for (const { linha, de, para } of ligacoes) {
    if (linha.tipo === 'seta' || !de || !para || para.tipo !== 'chat') {
      continue
    }
    const a = lugarDoCard(de)
    const b = lugarDoCard(para)
    const vao = Math.max(0, a.x - (b.x + b.w), b.x - (a.x + a.w))
    if (vao > LIMITES.colunasAteODono * COLUNA) {
      achar(
        'g',
        'chat longe do dono',
        para.rotulo,
        [b.x, b.y],
        `${(vao / COLUNA).toFixed(1)} colunas de ${de.rotulo} (limite ${LIMITES.colunasAteODono})`
      )
    }
  }

  return { achados, origemDaGrade }
}
