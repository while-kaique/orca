// A pasta `.hierarquia/` fica fora do git do projeto. Usado pelo comando `hierarquia`.
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/** `.hierarquia/` é do PO, não do produto: fica fora do git do projeto, sem mexer no .gitignore dele. */
export function foraDoGit(projeto) {
  let pasta = projeto
  while (!existsSync(join(pasta, '.git'))) {
    const acima = dirname(pasta)
    if (acima === pasta) {
      return
    }
    pasta = acima
  }
  try {
    const exclude = join(pasta, '.git', 'info', 'exclude')
    const atual = existsSync(exclude) ? readFileSync(exclude, 'utf8') : ''
    if (!/^\/?\.hierarquia\/?\s*$/m.test(atual)) {
      const quebra = atual && !atual.endsWith('\n') ? '\n' : ''
      appendFileSync(exclude, `${quebra}.hierarquia/\n`, 'utf8')
    }
  } catch {
    // `.git` é arquivo (cópia de trabalho) ou sem permissão: o PO avisa se aparecer no git status.
  }
}
