// Monta a branch uma vez e reaproveita a montagem enquanto o codigo nao mudar (regra B).
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { lerJson } from '../../skills/hierarquia/trava.mjs'
import { RAIZ } from './raiz-e-mundo-de-teste.mjs'
import {
  ARQUIVO_DA_TRAVA,
  mensagemDeUso,
  OrcaDeTesteOcupado,
  travaViva
} from './trava-do-orca-de-teste.mjs'

const ARQUIVO_DA_MONTAGEM = path.join(RAIZ, 'out', '.montagem-orca-de-teste.json')

/** Foto do codigo que entra na montagem: commit e um hash do que a montagem le (arvores do commit + diff + arquivos novos). */
export function estadoDoCodigo(raiz = RAIZ) {
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: raiz,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true
    })
  const caminhos = ['src', 'config', 'package.json', 'pnpm-lock.yaml']
  try {
    const arvores = caminhos.map((caminho) => git('rev-parse', `HEAD:${caminho}`).trim()).join(',')
    const novos = git('ls-files', '--others', '--exclude-standard', '--', ...caminhos)
      .split(/\r?\n/u)
      .filter(Boolean)
    const hash = createHash('sha1')
      .update(arvores)
      .update(git('diff', 'HEAD', '--', ...caminhos))
    for (const novo of novos) {
      hash.update(novo).update(readFileSync(path.join(raiz, novo)))
    }
    return { commit: git('rev-parse', 'HEAD').trim(), codigo: hash.digest('hex') }
  } catch {
    return null
  }
}

/** Decide se monta de novo. `anterior` e o registro da ultima montagem, `atual` a foto do codigo agora. */
export function decidirMontagem({ anterior, atual, temOut }) {
  if (!temOut) {
    return { montar: true, motivo: 'montagem necessaria (out/ nao existe)' }
  }
  if (!atual) {
    return { montar: true, motivo: 'montagem necessaria (nao consegui ler o git)' }
  }
  if (!anterior?.codigo) {
    return { montar: true, motivo: 'montagem necessaria (sem registro da ultima montagem)' }
  }
  if (anterior.codigo !== atual.codigo) {
    return { montar: true, motivo: 'montagem necessaria (codigo mudou)' }
  }
  return {
    montar: false,
    motivo: `montagem reaproveitada (commit ${anterior.commit.slice(0, 10)})`
  }
}

/**
 * Monta a branch atual em RAIZ/out (um comando pesado por vez na maquina, pela vez do comando hierarquia).
 * Pula a montagem se o codigo nao mudou desde a ultima. MONTAGEM_SO_DECIDIR=1 so diz a decisao.
 */
export function montarBranch(pastaDoLog, registro = console.log) {
  const travaDaPasta = lerJson(ARQUIVO_DA_TRAVA)
  if (
    travaViva(travaDaPasta) &&
    travaDaPasta.raiz === RAIZ &&
    travaDaPasta.pidNode !== process.pid
  ) {
    throw new OrcaDeTesteOcupado(
      `${mensagemDeUso(travaDaPasta)}: ele usa o out/ desta pasta; feche com "node tools/vistoria-fluxograma/orca-de-teste.mjs fechar" antes de montar de novo.`
    )
  }
  const atual = estadoDoCodigo()
  const decisao = decidirMontagem({
    anterior: lerJson(ARQUIVO_DA_MONTAGEM),
    atual,
    temOut: existsSync(path.join(RAIZ, 'out', 'main'))
  })
  registro(decisao.motivo)
  if (!decisao.montar || process.env.MONTAGEM_SO_DECIDIR === '1') {
    return decisao
  }
  const env = { ...process.env, VITE_EXPOSE_STORE: 'true' }
  for (const nome of Object.keys(env)) {
    if (/^(ORCA_|CLAUDE|AI_AGENT)/u.test(nome)) {
      delete env[nome]
    }
  }
  const comVez = spawnSync('hierarquia', ['--ajuda'], { shell: true, stdio: 'ignore' }).status === 0
  // Cada passo pesado entra na fila da maquina sozinho (um `&&` fora da vez deixaria o segundo passo furar a fila).
  let saida = ''
  let status = 0
  for (const passo of [
    'node config/scripts/build-workspace-packages.mjs',
    'node config/scripts/run-electron-vite-build.mjs'
  ]) {
    const resultado = spawnSync(comVez ? `hierarquia vez -- ${passo}` : passo, {
      cwd: RAIZ,
      env,
      shell: true,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024
    })
    saida += `${resultado.stdout}
${resultado.stderr}
`
    status = resultado.status ?? 1
    if (status !== 0) {
      break
    }
  }
  const log = path.join(pastaDoLog, 'montagem.log')
  writeFileSync(log, saida)
  if (status !== 0) {
    throw new Error(`A montagem falhou (veja ${log}).`)
  }
  if (atual) {
    writeFileSync(
      ARQUIVO_DA_MONTAGEM,
      JSON.stringify({ ...atual, montadoEm: new Date().toISOString() })
    )
  }
  return decisao
}
