const WORKSPACE_NAME_INPUT_SELECTOR = '[data-workspace-name-input="true"]'
const WORKSPACE_SOURCE_PILL_SELECTOR = '[data-workspace-source-pill="true"]'
const PROJECT_COMBOBOX_TRIGGER_SELECTOR = '[data-project-combobox-root="true"][role="combobox"]'
const LEGACY_REPO_COMBOBOX_TRIGGER_SELECTOR = '[data-repo-combobox-root="true"][role="combobox"]'

export function getWorkspaceComposerInitialFocusTarget(
  root: ParentNode,
  options: { preferProjectSearch?: boolean } = {}
): HTMLElement | null {
  // Why: PC-desk mode opens the composer to pick a project first; the name is optional.
  if (options.preferProjectSearch) {
    const projectSearch =
      root.querySelector<HTMLElement>(PROJECT_COMBOBOX_TRIGGER_SELECTOR) ??
      root.querySelector<HTMLElement>(LEGACY_REPO_COMBOBOX_TRIGGER_SELECTOR)
    if (projectSearch) {
      return projectSearch
    }
  }
  // Focus name/source for immediate typing/Enter when project is already picked; linked sources use pills, with combobox fallback where name input is absent.
  return (
    root.querySelector<HTMLElement>(WORKSPACE_NAME_INPUT_SELECTOR) ??
    root.querySelector<HTMLElement>(WORKSPACE_SOURCE_PILL_SELECTOR) ??
    root.querySelector<HTMLElement>(PROJECT_COMBOBOX_TRIGGER_SELECTOR) ??
    root.querySelector<HTMLElement>(LEGACY_REPO_COMBOBOX_TRIGGER_SELECTOR)
  )
}
