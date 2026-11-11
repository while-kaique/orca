import { DEFAULT_REPO_BADGE_COLOR, REPO_COLORS } from '../../../../shared/repo-badge-color'

const AUTO_COLORS = REPO_COLORS.filter((color) => color !== DEFAULT_REPO_BADGE_COLOR)

/** The sidebar badge color, or an automatic one per project while that is still the default gray. */
export function projectColor(repoId: string, badgeColor: string | undefined): string {
  if (badgeColor && badgeColor.toLowerCase() !== DEFAULT_REPO_BADGE_COLOR) {
    return badgeColor
  }
  let h = 0
  for (let i = 0; i < repoId.length; i++) {
    h = (h * 31 + repoId.charCodeAt(i)) | 0
  }
  return AUTO_COLORS[Math.abs(h) % AUTO_COLORS.length]
}

export function projectInitials(name: string): string {
  const words = name.split(/[\s_-]+/u).filter(Boolean)
  const letters = words.length > 1 ? `${words[0][0]}${words[1][0]}` : name.slice(0, 2)
  return letters.toUpperCase()
}
