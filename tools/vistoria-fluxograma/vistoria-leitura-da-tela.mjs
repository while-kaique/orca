// Le da tela do fluxograma (programa de verdade) o que a vistoria mede: onde esta cada card, o contorno
// desenhado, cada texto, cada selo e o caminho de cada linha e seta. Tudo em unidades do fluxograma
// (a mesma medida das caixas e das 196 da grade), nao em pixels.

/** Roda dentro da pagina. Devolve fatos puros (sem funcoes) para vistoria-regras.mjs analisar. */
export async function lerTela(page) {
  return page.evaluate(() => {
    const board = document.querySelector('.cc-board')
    const world = board.querySelector('.cc-world')
    const boardRect = board.getBoundingClientRect()
    const matriz = new DOMMatrixReadOnly(getComputedStyle(world).transform)
    const escala = matriz.a
    const paraMundo = (cx, cy) => [
      (cx - boardRect.left - matriz.e) / escala,
      (cy - boardRect.top - matriz.f) / escala
    ]
    const caixaDe = (rect) => {
      const [x, y] = paraMundo(rect.left, rect.top)
      return { x, y, w: rect.width / escala, h: rect.height / escala }
    }
    const visivel = (el) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
    }
    const unirRetangulos = (el) => {
      const faixa = document.createRange()
      faixa.selectNodeContents(el)
      const partes = [...faixa.getClientRects()].filter((r) => r.width > 0 && r.height > 0)
      if (partes.length === 0) {
        return el.getBoundingClientRect()
      }
      const esquerda = Math.min(...partes.map((r) => r.left))
      const topo = Math.min(...partes.map((r) => r.top))
      return new DOMRect(
        esquerda,
        topo,
        Math.max(...partes.map((r) => r.right)) - esquerda,
        Math.max(...partes.map((r) => r.bottom)) - topo
      )
    }

    const projetos = []
    const cards = []
    const textos = []
    const selos = []

    const SELETORES_TEXTO_CARD = [
      '.cc-chat-head b',
      '.cc-chat-head .cc-role',
      '.cc-model',
      '.cc-status',
      '.cc-context-label',
      '.cc-gate',
      '.cc-crest-body b',
      '.cc-crest-body .cc-role',
      '.cc-launch b',
      '.cc-launch small',
      '.cc-launch-steps li'
    ]
    // Etiquetas com borda e fundo (papel, modelo, estado, contador): o que vale e a caixa inteira, nao so as letras.
    const ETIQUETAS = '.cc-role, .cc-model, .cc-status, .cc-pill, .cc-chip, .cc-context-label'
    const lerTextos = (dono, rotuloDoDono, raiz, seletores) => {
      const vistos = new Set()
      for (const el of raiz.querySelectorAll(seletores.join(','))) {
        if (vistos.has(el) || !visivel(el)) {
          continue
        }
        vistos.add(el)
        const texto = el.textContent.trim()
        if (!texto) {
          continue
        }
        const estilo = getComputedStyle(el)
        const cortaComReticencias =
          estilo.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1
        const cortaPorAltura =
          estilo.overflow !== 'visible' && el.scrollHeight > el.clientHeight + 1
        textos.push({
          dono,
          rotuloDoDono,
          campo: el.className || el.tagName.toLowerCase(),
          texto: texto.slice(0, 60),
          caixaDoTexto: caixaDe(
            el.matches(ETIQUETAS) ? el.getBoundingClientRect() : unirRetangulos(el)
          ),
          cortaComReticencias,
          cortaPorAltura
        })
      }
    }

    const blocos = [...world.children].filter((bloco) => bloco.querySelector('.cc-project'))
    blocos.forEach((bloco, indice) => {
      const projeto = bloco.querySelector('.cc-project')
      const nome = projeto.querySelector('.cc-project-name span')?.textContent?.trim() ?? '?'
      const caixaProjeto = caixaDe(projeto.getBoundingClientRect())
      projetos.push({ indice, nome, caixa: caixaProjeto })
      const dono = `projeto "${nome}"`
      const chaveDoProjeto = `projeto:${indice}`
      cards.push({
        chave: chaveDoProjeto,
        rotulo: dono,
        tipo: 'projeto',
        projeto: nome,
        papel: null,
        forma: 'card',
        caixa: caixaProjeto,
        contorno: null
      })
      lerTextos(chaveDoProjeto, dono, projeto, ['.cc-project-name span', '.cc-pill'])
      for (const el of bloco.querySelectorAll('[data-chat-key]')) {
        const caixa = caixaDe(el.getBoundingClientRect())
        const papel =
          el.querySelector('.cc-role')?.dataset.role ?? (el.dataset.launch ? 'abrindo-po' : null)
        const forma = el.classList.contains('cc-shape-crest')
          ? 'crest'
          : el.classList.contains('cc-shape-slim')
            ? 'slim'
            : 'card'
        let contorno = null
        const poligono = el.querySelector('.cc-crest-outline polygon')
        if (poligono && forma === 'crest') {
          const matrizPoligono = poligono.getScreenCTM()
          contorno = [...poligono.points].map((ponto) => {
            const cliente = new DOMPoint(ponto.x, ponto.y).matrixTransform(matrizPoligono)
            return paraMundo(cliente.x, cliente.y)
          })
        }
        const titulo = (
          el.querySelector('.cc-crest-body b') ?? el.querySelector('.cc-chat-head b')
        )?.textContent
          ?.trim()
          .slice(0, 40)
        const rotulo = `${papel ?? 'chat'} "${titulo ?? el.dataset.chatKey.slice(0, 8)}" (${nome})`
        cards.push({
          chave: el.dataset.chatKey,
          rotulo,
          tipo: 'chat',
          projeto: nome,
          papel,
          mascara: el.dataset.launch ?? null,
          forma,
          caixa,
          contorno
        })
        lerTextos(el.dataset.chatKey, rotulo, el, SELETORES_TEXTO_CARD)
        const selo = el.parentElement?.querySelector('.cc-chips')
        if (selo && visivel(selo)) {
          const caixaDoSelo = caixaDe(selo.getBoundingClientRect())
          selos.push({ dono: el.dataset.chatKey, rotuloDoDono: rotulo, caixa: caixaDoSelo })
          for (const chip of selo.querySelectorAll('.cc-chip')) {
            const texto = chip.textContent.trim()
            textos.push({
              dono: el.dataset.chatKey,
              rotuloDoDono: `selo de ${rotulo}`,
              selo: caixaDoSelo,
              campo: 'cc-chip',
              texto,
              caixaDoTexto: caixaDe(chip.getBoundingClientRect()),
              cortaComReticencias: chip.scrollWidth > chip.clientWidth + 1,
              cortaPorAltura: false
            })
          }
        }
      }
    })

    // Caminho de cada linha e seta, amostrado de 6 em 6 unidades.
    const amostrar = (caminho) => {
      const total = caminho.getTotalLength()
      const ctm = caminho.getScreenCTM()
      const pontos = []
      const passo = 6
      for (let l = 0; l <= total + 0.001; l += passo) {
        const p = caminho.getPointAtLength(Math.min(l, total))
        const c = new DOMPoint(p.x, p.y).matrixTransform(ctm)
        pontos.push(paraMundo(c.x, c.y))
      }
      const fim = caminho.getPointAtLength(total)
      const cfim = new DOMPoint(fim.x, fim.y).matrixTransform(ctm)
      pontos.push(paraMundo(cfim.x, cfim.y))
      return { pontos, comprimento: total }
    }
    const linhas = []
    for (const caminho of board.querySelectorAll('.cc-lines path.cc-line-tree')) {
      linhas.push({
        tipo: caminho.classList.contains('cc-line-created') ? 'criada' : 'projeto',
        ...amostrar(caminho)
      })
    }
    for (const caminho of board.querySelectorAll('.cc-lines path.cc-cord')) {
      linhas.push({ tipo: 'seta', ...amostrar(caminho) })
    }

    let setasGuardadas = []
    try {
      setasGuardadas = JSON.parse(window.localStorage.getItem('orca-fork.canvas-cords') ?? '[]')
    } catch {
      setasGuardadas = []
    }

    // Numeros em pixels de tela, para o Reorganizar.
    const pxDe = (rect) => ({
      esquerda: rect.left - boardRect.left,
      direita: boardRect.right - rect.right,
      topo: rect.top - boardRect.top,
      base: boardRect.bottom - rect.bottom
    })
    const desenhados = [
      ...board.querySelectorAll('.cc-project, [data-chat-key], .cc-chips')
    ].filter(visivel)
    const retangulosPorProjeto = blocos.map((bloco) =>
      [...bloco.querySelectorAll('.cc-project, [data-chat-key], .cc-chips')]
        .filter(visivel)
        .map((el) => el.getBoundingClientRect())
    )
    const uniao = (rects) => {
      const esquerda = Math.min(...rects.map((r) => r.left))
      const topo = Math.min(...rects.map((r) => r.top))
      return {
        left: esquerda,
        top: topo,
        right: Math.max(...rects.map((r) => r.right)),
        bottom: Math.max(...rects.map((r) => r.bottom))
      }
    }
    const tudo =
      desenhados.length > 0 ? uniao(desenhados.map((el) => el.getBoundingClientRect())) : null
    const caixasDosProjetos = retangulosPorProjeto.filter((r) => r.length > 0).map(uniao)
    let maiorBuraco = 0
    caixasDosProjetos.forEach((a, i) => {
      let maisPerto = Infinity
      caixasDosProjetos.forEach((b, j) => {
        if (i === j) {
          return
        }
        const dx = Math.max(0, a.left - b.right, b.left - a.right)
        const dy = Math.max(0, a.top - b.bottom, b.top - a.bottom)
        maisPerto = Math.min(maisPerto, Math.max(dx, dy))
      })
      if (Number.isFinite(maisPerto)) {
        maiorBuraco = Math.max(maiorBuraco, maisPerto)
      }
    })
    const largurasDoPo = [...board.querySelectorAll('[data-chat-key]')]
      .filter(
        (el) =>
          el.querySelector('.cc-role')?.dataset.role === 'po' || el.dataset.launch !== undefined
      )
      .map((el) => Math.round(el.getBoundingClientRect().width))

    return {
      escala,
      tela: { w: Math.round(boardRect.width), h: Math.round(boardRect.height) },
      projetos,
      cards,
      textos,
      selos,
      linhas,
      setasGuardadas,
      numeros: {
        larguraDoPoEmPx: largurasDoPo,
        margensEmPx: tudo
          ? Object.fromEntries(
              Object.entries(pxDe(tudo)).map(([lado, valor]) => [lado, Math.round(valor)])
            )
          : null,
        maiorBuracoEntreProjetosEmPx: Math.round(maiorBuraco)
      }
    }
  })
}
