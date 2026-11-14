// Prova da trava do Orca de teste SEM abrir o Orca: no lugar do Electron sobe um node que dorme (modo simulado).
// `node tools/vistoria-fluxograma/prova-orca-de-teste.mjs tudo PASTA_DA_PROVA` roda os casos e escreve um arquivo por caso.
// `pedido NOME SEGURA_S [ESPERAR_MIN]` e o que cada "chat" roda: pede o Orca de teste, segura SEGURA_S segundos e fecha.
import { execFileSync, spawn } from 'node:child_process'
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import {
  abrirOrcaDeTeste,
  ARQUIVO_DA_TRAVA,
  conectarOrcaDeTeste,
  contarProcessosDeTeste,
  decidirMontagem,
  estadoDoCodigo
} from './orca-de-teste.mjs'

const hora = () => new Date().toLocaleTimeString('pt-BR', { hour12: false })
const dormir = (ms) => new Promise((pronto) => setTimeout(pronto, ms))
const [comando, ...resto] = process.argv.slice(2)

if (comando === 'pedido') {
  const [nome, seguraS, esperarMin] = resto
  const dizer = (texto) => console.log(`[${hora()}] ${nome}: ${texto}`)
  try {
    dizer('pedindo o Orca de teste')
    const orca = await abrirOrcaDeTeste({
      registro: dizer,
      esperarMin: esperarMin === undefined ? undefined : Number(esperarMin),
      prepararMundo: () => dizer('mundo de teste preparado (so com a trava na mao)')
    })
    dizer(`USANDO o Orca de teste por ${seguraS} s`)
    await dormir(Number(seguraS) * 1000)
    const sobras = await orca.fechar()
    dizer(`FECHOU; sobraram ${sobras.length} processos do mundo; trava solta`)
    process.exit(0)
  } catch (erro) {
    dizer(`RECUSADO/ERRO (saida ${erro.codigoDeSaida ?? 2}): ${erro.message}`)
    process.exit(erro.codigoDeSaida ?? 2)
  }
}

if (comando === 'conectar') {
  const orca = await conectarOrcaDeTeste({
    reusar: true,
    registro: (texto) => console.log(`[${hora()}] ${texto}`)
  })
  console.log(`[${hora()}] ${orca ? `conectou (reusado=${orca.reusado})` : 'sem Orca aberto'}`)
  await orca?.fechar()
  process.exit(0)
}

if (comando !== 'tudo') {
  console.log('node tools/vistoria-fluxograma/prova-orca-de-teste.mjs tudo PASTA_DA_PROVA')
  process.exit(2)
}

const pasta = path.resolve(resto[0] ?? '.provas/o-046')
mkdirSync(pasta, { recursive: true })
const mundoDaProva = path.join(
  process.env.TEMP ?? '/tmp',
  'vistoria-fluxograma-prova-o046',
  'mundo'
)
const ambiente = {
  ...process.env,
  ORCA_DE_TESTE_SIMULADO: '1',
  ORCA_DE_TESTE_AVISO_S: '3',
  VISTORIA_MUNDO: mundoDaProva
}
const script = import.meta.filename
const cli = path.join(import.meta.dirname, 'orca-de-teste.mjs')

function contagem() {
  const processos = contarProcessosDeTeste()
  const orcas = processos.filter((p) => !p.filhoSimulado)
  return { processos, orcas }
}

/** Escreve a contagem de tempos em tempos no arquivo do caso e guarda o maior numero de Orcas vivos. */
function amostrador(arquivo) {
  let parar = false
  let maximo = 0
  const laco = (async () => {
    while (!parar) {
      const { processos, orcas } = contagem()
      maximo = Math.max(maximo, orcas.length)
      appendFileSync(
        arquivo,
        `[${hora()}] CONTAGEM processos de teste=${processos.length} orcas simulados vivos=${orcas.length} PIDs=${processos.map((p) => p.pid).join(',') || '-'}\n`
      )
      await dormir(1200)
    }
  })()
  return async () => {
    parar = true
    await laco
    return maximo
  }
}

function lancar(arquivo, nome, seguraS, esperarMin, extraEnv = {}) {
  const filho = spawn(
    process.execPath,
    [
      script,
      'pedido',
      nome,
      String(seguraS),
      ...(esperarMin === undefined ? [] : [String(esperarMin)])
    ],
    {
      env: { ...ambiente, ORCA_DE_TESTE_DONO: `${nome} (chat simulado)`, ...extraEnv },
      windowsHide: true
    }
  )
  const escrever = (dados) => appendFileSync(arquivo, dados)
  filho.stdout.on('data', escrever)
  filho.stderr.on('data', escrever)
  const saida = new Promise((pronto) => filho.on('exit', (codigo) => pronto(codigo)))
  const aberto = new Promise((pronto) => {
    filho.stdout.on('data', (dados) => String(dados).includes('USANDO') && pronto(true))
    filho.on('exit', () => pronto(false))
  })
  return { filho, saida, aberto }
}

const rodarCli = (...args) => {
  try {
    return execFileSync(process.execPath, [cli, ...args], {
      env: ambiente,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    })
  } catch (erro) {
    return `${erro.stdout ?? ''}${erro.stderr ?? ''}(saida ${erro.status})\n`
  }
}
const anotar = (arquivo, texto) => appendFileSync(arquivo, `[${hora()}] ${texto}\n`)
const matar = (pid) => {
  try {
    execFileSync('taskkill', ['/F', '/PID', String(pid)], { stdio: 'ignore', windowsHide: true })
  } catch {
    // Ja morreu.
  }
}

const arq = (nome) => {
  const caminho = path.join(pasta, nome)
  writeFileSync(caminho, '')
  return caminho
}

// ---- caso 1: o segundo ESPERA e entra quando o primeiro fecha
{
  const arquivo = arq('1-espera.txt')
  anotar(arquivo, 'CASO 1: dois pedidos ao mesmo tempo; o segundo espera (esperarMin 2)')
  const antes = contagem()
  anotar(
    arquivo,
    `ANTES: processos de teste=${antes.processos.length}, orcas=${antes.orcas.length}`
  )
  const parar = amostrador(arquivo)
  const a = lancar(arquivo, 'Chat A', 12, 2)
  await a.aberto
  const b = lancar(arquivo, 'Chat B', 4, 2)
  const codigos = await Promise.all([a.saida, b.saida])
  const maximo = await parar()
  await dormir(2500)
  const depois = contagem()
  anotar(
    arquivo,
    `DEPOIS: processos de teste=${depois.processos.length}, orcas=${depois.orcas.length}`
  )
  anotar(
    arquivo,
    `RESULTADO: saidas A=${codigos[0]} B=${codigos[1]}; maximo de Orcas vivos ao mesmo tempo=${maximo}`
  )
}

// ---- caso 2: com esperarMin 0 o segundo e RECUSADO na hora, com a mensagem de quem usa
{
  const arquivo = arq('2-recusa.txt')
  anotar(arquivo, 'CASO 2: o segundo pede com esperarMin 0 e e recusado (saida 3)')
  const antes = contagem()
  anotar(
    arquivo,
    `ANTES: processos de teste=${antes.processos.length}, orcas=${antes.orcas.length}`
  )
  const parar = amostrador(arquivo)
  const a = lancar(arquivo, 'Chat A', 8, 2)
  await a.aberto
  const b = lancar(arquivo, 'Chat B', 4, 0)
  const codigoB = await b.saida
  const codigoA = await a.saida
  const maximo = await parar()
  await dormir(2500)
  const depois = contagem()
  anotar(
    arquivo,
    `DEPOIS: processos de teste=${depois.processos.length}, orcas=${depois.orcas.length}`
  )
  anotar(
    arquivo,
    `RESULTADO: saida do B=${codigoB} (esperado 3), saida do A=${codigoA}; maximo de Orcas vivos=${maximo}`
  )
}

// ---- caso 3: trava de dono morto e tomada
{
  const arquivo = arq('3-dono-morto.txt')
  anotar(
    arquivo,
    'CASO 3: mato o node dono e o Electron simulado (so os meus, pelo PID); sobra um processo filho do mundo'
  )
  const a = lancar(arquivo, 'Chat A', 120, 2)
  await a.aberto
  const trava = JSON.parse(readFileSync(ARQUIVO_DA_TRAVA, 'utf8'))
  anotar(
    arquivo,
    `trava antes: dono="${trava.dono}" PID node=${trava.pidNode} PID electron=${trava.pidElectron} porta=${trava.porta}`
  )
  anotar(
    arquivo,
    `matando o node dono (PID ${trava.pidNode}) e o Electron simulado (PID ${trava.pidElectron}), sem /T`
  )
  matar(trava.pidNode)
  matar(trava.pidElectron)
  await a.saida
  await dormir(1500)
  const sobra = contagem()
  anotar(
    arquivo,
    `sobrou: processos de teste=${sobra.processos.length} PIDs=${sobra.processos.map((p) => p.pid).join(',')}`
  )
  anotar(arquivo, '--- estado (dono morto):')
  appendFileSync(arquivo, rodarCli('estado'))
  const c = lancar(arquivo, 'Chat C', 3, 2)
  const codigoC = await c.saida
  await dormir(2500)
  const depois = contagem()
  anotar(arquivo, `DEPOIS: processos de teste=${depois.processos.length}; saida do C=${codigoC}`)
}

// ---- caso 4: processo de teste vivo SEM trava impede abrir (nunca dois vivos)
{
  const arquivo = arq('4-processo-sem-trava.txt')
  anotar(
    arquivo,
    'CASO 4: um processo de teste vivo sem trava (largado de uma rodada antiga); o pedido recusa dizendo o PID'
  )
  const fantasma = spawn(
    process.execPath,
    [
      path.join(import.meta.dirname, 'orca-de-teste-simulado.mjs'),
      '9',
      path.join(process.env.TEMP ?? '/tmp', 'vistoria-fluxograma-prova-o046-fantasma', 'perfil'),
      'filho'
    ],
    { stdio: 'ignore', windowsHide: true }
  )
  await dormir(1500)
  anotar(arquivo, `fantasma criado por mim: PID ${fantasma.pid}`)
  const b = lancar(arquivo, 'Chat B', 3, 0)
  const codigo = await b.saida
  anotar(arquivo, `RESULTADO: saida do pedido=${codigo} (esperado 3)`)
  matar(fantasma.pid)
  await dormir(1500)
  const depois = contagem()
  anotar(
    arquivo,
    `DEPOIS (matei so o PID ${fantasma.pid}): processos de teste=${depois.processos.length}`
  )
}

// ---- caso 5: abrir e deixar aberto, estado com e sem Orca vivo, conectar, fechar
{
  const arquivo = arq('5-estado-e-reuso.txt')
  anotar(
    arquivo,
    'CASO 5: orca-de-teste.mjs estado / abrir / estado / conectar / fechar / estado (simulado)'
  )
  anotar(arquivo, '$ node tools/vistoria-fluxograma/orca-de-teste.mjs estado   (SEM Orca de teste)')
  appendFileSync(arquivo, rodarCli('estado'))
  anotar(arquivo, '$ node tools/vistoria-fluxograma/orca-de-teste.mjs abrir')
  appendFileSync(arquivo, rodarCli('abrir'))
  anotar(
    arquivo,
    '$ node tools/vistoria-fluxograma/orca-de-teste.mjs estado   (COM Orca de teste vivo)'
  )
  appendFileSync(arquivo, rodarCli('estado'))
  anotar(arquivo, '$ conectarOrcaDeTeste({ reusar: true }) por outro processo')
  appendFileSync(
    arquivo,
    execFileSync(process.execPath, [script, 'conectar'], { env: ambiente, encoding: 'utf8' })
  )
  anotar(arquivo, '$ pedido de outro chat com esperarMin 0 enquanto esse Orca esta aberto')
  const b = lancar(arquivo, 'Chat B', 2, 0)
  await b.saida
  anotar(arquivo, '$ node tools/vistoria-fluxograma/orca-de-teste.mjs fechar')
  appendFileSync(arquivo, rodarCli('fechar'))
  anotar(arquivo, '$ node tools/vistoria-fluxograma/orca-de-teste.mjs estado   (depois de fechar)')
  appendFileSync(arquivo, rodarCli('estado'))
}

// ---- caso 6: decisao de montagem com dois estados de git escritos a mao
{
  const arquivo = arq('6-montagem.txt')
  const montadoAntes = { commit: 'aaaaaaaaaaaaaaaa1111', codigo: 'hash-do-codigo-1' }
  const casos = [
    [
      'nada mudou desde a ultima montagem',
      {
        anterior: montadoAntes,
        atual: { commit: 'bbbbbbbbbbbbbbbb2222', codigo: 'hash-do-codigo-1' },
        temOut: true
      }
    ],
    [
      'src/ ou config/ mudou',
      {
        anterior: montadoAntes,
        atual: { commit: 'cccccccccccccccc3333', codigo: 'hash-do-codigo-2' },
        temOut: true
      }
    ],
    ['sem registro da ultima montagem', { anterior: null, atual: montadoAntes, temOut: true }],
    ['out/ nao existe', { anterior: montadoAntes, atual: montadoAntes, temOut: false }]
  ]
  for (const [rotulo, entrada] of casos) {
    anotar(
      arquivo,
      `${rotulo}: ${JSON.stringify(entrada)} -> ${JSON.stringify(decidirMontagem(entrada))}`
    )
  }
  const agora = estadoDoCodigo()
  anotar(
    arquivo,
    `foto real do codigo desta pasta (lida duas vezes, tem de ser igual): ${JSON.stringify(agora)} == ${JSON.stringify(estadoDoCodigo())}`
  )
  anotar(
    arquivo,
    '$ MONTAGEM_SO_DECIDIR=1 node tools/vistoria-fluxograma/orca-de-teste.mjs montar   (decide, nao monta)'
  )
  appendFileSync(
    arquivo,
    execFileSync(process.execPath, [cli, 'montar'], {
      env: { ...ambiente, MONTAGEM_SO_DECIDIR: '1' },
      encoding: 'utf8'
    })
  )
}

const fim = contagem()
const resumo = path.join(pasta, '0-resumo-final.txt')
writeFileSync(
  resumo,
  `[${hora()}] FIM DA PROVA: processos de teste vivos=${fim.processos.length}; trava existe=${(() => {
    try {
      readFileSync(ARQUIVO_DA_TRAVA)
      return 'sim'
    } catch {
      return 'nao'
    }
  })()}\n`
)
console.log(readFileSync(resumo, 'utf8'))
process.exit(fim.processos.length === 0 ? 0 : 1)
