// Fork "PC como mesa": impressão digital do código que entra na montagem, para o
// abrir-orca-montado.bat pular a montagem (~10 s) quando nada mudou desde a última.
// Uso: node pc-desk-build-key.mjs <arquivo-da-chave>  → sai 0 se a montagem atual vale, 1 se não.
//      node pc-desk-build-key.mjs <arquivo-da-chave> --save  → grava a chave do código atual.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '../..')
const PATHS = [
  'src',
  'config',
  'resources',
  'electron.vite.config.ts',
  'package.json',
  'pnpm-lock.yaml'
]

function git(args) {
  return execFileSync('git', ['-C', repoRoot, ...args], { maxBuffer: 256 * 1024 * 1024 })
}

function currentKey() {
  const hash = createHash('sha256')
  hash.update(git(['rev-parse', 'HEAD']))
  // Why: edições não commitadas também mudam o app montado.
  hash.update(git(['diff', 'HEAD', '--', ...PATHS]))
  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z', '--', ...PATHS])
    .toString()
    .split('\0')
    .filter(Boolean)
  for (const file of untracked) {
    hash.update(file)
    hash.update(readFileSync(path.join(repoRoot, file)))
  }
  return hash.digest('hex')
}

const [keyFile, mode] = process.argv.slice(2)
try {
  const key = currentKey()
  if (mode === '--save') {
    writeFileSync(keyFile, key)
    process.exit(0)
  }
  const builtOk = existsSync(path.join(repoRoot, 'out/main/index.js')) && existsSync(keyFile)
  process.exit(builtOk && readFileSync(keyFile, 'utf8').trim() === key ? 0 : 1)
} catch {
  // Na dúvida, monta.
  process.exit(1)
}
