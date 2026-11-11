import { defineFixture } from '../../../component-fixtures/component-fixture'
import { PcDeskProjectPicker } from './PcDeskProjectPicker'

export const open = defineFixture({
  width: 420,
  setup: () => {
    window.api.repos.listPcDeskHomeFolders = () =>
      Promise.resolve({
        rootPath: 'C:\\Users\\User\\Desktop\\Projetos',
        entries: ['orca', 'astra', 'piapp', 'social-hub'].map((name) => ({
          name,
          path: `C:\\Users\\User\\Desktop\\Projetos\\${name}`,
          gitKind: 'repo' as const,
          modifiedAt: 0
        }))
      })
  },
  render: () => (
    <div style={{ height: 520, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <PcDeskProjectPicker
        side="top"
        align="center"
        trigger={<button type="button">Novo chat ou projeto</button>}
      />
    </div>
  ),
  interact: (frame) => {
    frame.querySelector<HTMLButtonElement>('button')?.click()
  }
})
