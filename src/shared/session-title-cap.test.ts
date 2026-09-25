import { describe, expect, it } from 'vitest'
import { capSessionTitle } from './session-title-cap'

describe('capSessionTitle', () => {
  it('drops connector words and keeps three content words', () => {
    expect(capSessionTitle('Botão de adicionar projeto no fim da barra')).toBe(
      'Botão adicionar projeto'
    )
  })

  it('never exceeds 23 characters and cuts on a word boundary', () => {
    const capped = capSessionTitle('Reestruturação arquitetural completa')
    expect(capped.length).toBeLessThanOrEqual(23)
    expect(capped).toBe('Reestruturação')
  })

  it('strips a trailing ellipsis', () => {
    expect(capSessionTitle('Fix login…')).toBe('Fix login')
  })

  it('keeps short names untouched', () => {
    expect(capSessionTitle('orca')).toBe('orca')
  })
})
