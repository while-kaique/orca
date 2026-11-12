// `hierarquia vez -- <comando>`: um comando pesado por vez na máquina inteira (item D da o-021).
import { spawn } from 'node:child_process'
import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { decidirVez } from './regras.mjs'
import { criarSeNaoExiste, lerJson, processoVivo } from './trava.mjs'

const INTERVALO_MS = 500

function pastaDaVez() {
  const pasta = process.env.HIERARQUIA_VEZ ?? join(homedir(), '.hierarquia-vez')
  mkdirSync(join(pasta, 'fila'), { recursive: true })
  return pasta
}

function hora() {
  return new Date().toISOString()
}

function lerFila(pasta) {
  return readdirSync(join(pasta, 'fila'))
    .map((nome) => ({ nome, ...lerJson(join(pasta, 'fila', nome)) }))
    .filter((item) => item.pid)
}

/** Espera a vez (por ordem de chegada), roda o comando e solta. Devolve o código de saída do comando. */
export async function rodarNaVez(comando) {
  const pasta = pastaDaVez()
  const dono = join(pasta, 'dono.json')
  const chegada = Date.now()
  const bilhete = join(pasta, 'fila', `${chegada}-${process.pid}.json`)
  criarSeNaoExiste(bilhete, { pid: process.pid, chegada, comando })
  const sairDaFila = () => rmSync(bilhete, { force: true })
  process.on('exit', sairDaFila)
  let avisou = false
  for (;;) {
    const atual = lerJson(dono)
    const decisao = decidirVez({ dono: atual, fila: lerFila(pasta), vivo: processoVivo })
    for (const morto of decisao.mortosNaFila) {
      rmSync(join(pasta, 'fila', morto.nome), { force: true })
    }
    if (decisao.soltarDono) {
      rmSync(dono, { force: true })
      console.log(`[vez] ${hora()} soltou a vez do processo ${atual.pid}, que morreu`)
    }
    if (decisao.proximo?.pid === process.pid) {
      const dados = { pid: process.pid, comando, desde: hora() }
      if (criarSeNaoExiste(dono, dados)) {
        break
      }
    } else if (!avisou && atual) {
      avisou = true
      console.log(
        `[vez] ${hora()} esperando: a vez esta com o processo ${atual.pid} (${atual.comando})`
      )
    }
    await new Promise((pronto) => setTimeout(pronto, INTERVALO_MS))
  }
  sairDaFila()
  const soltar = () => {
    if (lerJson(dono)?.pid === process.pid) {
      rmSync(dono, { force: true })
    }
  }
  process.on('exit', soltar)
  const esperou = Math.round((Date.now() - chegada) / 1000)
  console.log(`[vez] ${hora()} comecou (esperou ${esperou} s): ${comando}`)
  const codigo = await new Promise((pronto) => {
    const filho = spawn(comando, { shell: true, stdio: 'inherit', windowsHide: true })
    filho.on('exit', (code) => pronto(code ?? 1))
    filho.on('error', () => pronto(1))
  })
  soltar()
  console.log(`[vez] ${hora()} terminou com codigo ${codigo}: ${comando}`)
  return codigo
}
