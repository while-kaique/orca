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
  // Why: most opens already have a project selected; land on the name/source
  // field so users can type or press Enter immediately. The source pill
  // replaces the input when a linked item or branch is pre-filled. Keep
  // combobox fallbacks for surfaces that omit the smart name field.
  return (
    root.querySelector<HTMLElement>(WORKSPACE_NAME_INPUT_SELECTOR) ??
    root.querySelector<HTMLElement>(WORKSPACE_SOURCE_PILL_SELECTOR) ??
    root.querySelector<HTMLElement>(PROJECT_COMBOBOX_TRIGGER_SELECTOR) ??
    root.querySelector<HTMLElement>(LEGACY_REPO_COMBOBOX_TRIGGER_SELECTOR)
  )
}
