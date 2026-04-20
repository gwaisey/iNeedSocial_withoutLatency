export const RUNTIME_MONITORING_EVENT_NAME = "ineedsocial:monitoring"

export type MonitoringLevel = "warn" | "error"

export type MonitoringScope =
  | "app-error-boundary"
  | "feed-service"
  | "supabase-save"
  | "video-playback"

export type MonitoringErrorDetail = {
  readonly message: string
  readonly name?: string
  readonly stack?: string
}

export type RuntimeMonitoringEvent = {
  readonly error?: MonitoringErrorDetail
  readonly level: MonitoringLevel
  readonly message: string
  readonly metadata?: Record<string, unknown>
  readonly scope: MonitoringScope
  readonly timestamp: string
}

type ReportRuntimeIssueInput = Omit<RuntimeMonitoringEvent, "error" | "timestamp"> & {
  readonly error?: unknown
}

declare global {
  interface WindowEventMap {
    "ineedsocial:monitoring": CustomEvent<RuntimeMonitoringEvent>
  }
}

function normalizeError(error: unknown): MonitoringErrorDetail | undefined {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    }
  }

  if (typeof error === "string") {
    return { message: error }
  }

  if (typeof error === "number" || typeof error === "boolean" || typeof error === "bigint") {
    return { message: String(error) }
  }

  if (typeof error === "object" && error !== null) {
    try {
      return { message: JSON.stringify(error) }
    } catch {
      return { message: String(error) }
    }
  }

  return undefined
}

export function reportRuntimeIssue(input: ReportRuntimeIssueInput): RuntimeMonitoringEvent {
  const detail: RuntimeMonitoringEvent = {
    error: normalizeError(input.error),
    level: input.level,
    message: input.message,
    metadata: input.metadata,
    scope: input.scope,
    timestamp: new Date().toISOString(),
  }

  const consoleMethod = detail.level === "error" ? console.error : console.warn
  consoleMethod(`[monitoring:${detail.scope}] ${detail.message}`, detail)

  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new CustomEvent(RUNTIME_MONITORING_EVENT_NAME, { detail }))
  }

  return detail
}
