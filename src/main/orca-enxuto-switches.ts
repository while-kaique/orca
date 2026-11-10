/**
 * Orca enxuto: background services this fork does not start. Flip a switch to `true` to bring a
 * service back exactly as upstream runs it. REMOVIDOS.md (repo root) lists each one and why.
 */
export const ORCA_ENXUTO_SWITCHES = {
  /** Orca Cloud connector (desktop link to an Orca account in the cloud). */
  connectorCloud: false,
  /** Orca Relay: pairs the mobile app with this desktop. */
  mobileRelay: false,
  /** Push gateway: sends notifications to the paired phone. */
  mobilePush: false,
  /** Android/iOS emulator bridge for workspaces. */
  emulator: false,
  /** "Give us a star on GitHub" prompt timer. */
  starNag: false,
  /** Periodic WSL usage report for telemetry. */
  wslUsageReporter: false,
  /** `glab` (GitLab CLI) install/auth probe in preflight. GitHub (`gh`) stays. */
  gitLabCliProbe: false,
  /** Codex history backfill + session migration scans (Codex agent is off). */
  codexBackgroundScans: false
} as const
