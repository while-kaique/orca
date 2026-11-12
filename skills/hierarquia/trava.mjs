// Trava de arquivo com dono: se o processo dono morre, a trava se solta sozinha. Usado pelo comando `hierarquia`.
import { closeSync, openSync, readFileSync, rmSync, writeSync } from 'node:fs'

export function processoVivo(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (erro) {
    // EPERM: existe, mas é de outro usuário.
    return erro.code === 'EPERM'
  }
}

export function lerJson(caminho) {
  try {
    return JSON.parse(readFileSync(caminho, 'utf8'))
  } catch {
    return null
  }
}

/** Cria o arquivo só se ele não existe: é o que torna a trava de um dono só. */
export function criarSeNaoExiste(caminho, dados) {
  try {
    const fd = openSync(caminho, 'wx')
    writeSync(fd, JSON.stringify(dados))
    closeSync(fd)
    return true
  } catch (erro) {
    if (erro.code === 'EEXIST') {
      return false
    }
    throw erro
  }
}

const espera = new Int32Array(new SharedArrayBuffer(4))

/** Pega a trava (esperando quem a tem) e devolve a função que solta. Trava de processo morto é tomada. */
export function pegarTrava(caminho, prazoMs = 60000) {
  const limite = Date.now() + prazoMs
  while (!criarSeNaoExiste(caminho, { pid: process.pid, desde: new Date().toISOString() })) {
    const dono = lerJson(caminho)
    if (dono && !processoVivo(dono.pid)) {
      rmSync(caminho, { force: true })
      continue
    }
    if (Date.now() > limite) {
      throw new Error(`A trava ${caminho} continua com o processo ${dono?.pid}.`)
    }
    Atomics.wait(espera, 0, 0, 150)
  }
  return () => {
    if (lerJson(caminho)?.pid === process.pid) {
      rmSync(caminho, { force: true })
    }
  }
}
