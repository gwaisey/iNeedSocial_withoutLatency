import { describe, expect, it, vi } from "vitest"
import {
  reportRuntimeIssue,
  RUNTIME_MONITORING_EVENT_NAME,
} from "./runtime-monitoring"

describe("runtime monitoring", () => {
  it("logs and dispatches a normalized runtime monitoring event", () => {
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const capturedEvents: Event[] = []

    window.addEventListener(RUNTIME_MONITORING_EVENT_NAME, (event) => {
      capturedEvents.push(event)
    }, { once: true })

    const detail = reportRuntimeIssue({
      error: new Error("video blocked"),
      level: "warn",
      message: "Unexpected video autoplay failure.",
      metadata: {
        src: "/video.mp4",
      },
      scope: "video-playback",
    })

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[monitoring:video-playback] Unexpected video autoplay failure.",
      detail
    )
    expect(capturedEvents).toHaveLength(1)

    const event = capturedEvents[0]
    expect(event).toBeInstanceOf(CustomEvent)
    expect((event as CustomEvent<typeof detail>).detail).toMatchObject({
      error: {
        message: "video blocked",
        name: "Error",
      },
      level: "warn",
      message: "Unexpected video autoplay failure.",
      metadata: {
        src: "/video.mp4",
      },
      scope: "video-playback",
    })
  })
})
