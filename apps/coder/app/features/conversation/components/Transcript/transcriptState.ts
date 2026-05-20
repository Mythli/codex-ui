import { useEffect, useState } from 'react'
import type { CodexActivitySummaryEntry, CodexWorkEntry } from '@taylordb/codex'

export function visibleWorkEntries(
  entry: CodexWorkEntry,
  hiddenActivityId: string | undefined
): CodexWorkEntry[] {
  if (!hiddenActivityId) {
    return [entry]
  }
  if (entry.id === hiddenActivityId) {
    return []
  }
  if (entry.type !== 'activitySummary') {
    return [entry]
  }
  const items = entry.items.filter((item) => item.id !== hiddenActivityId)
  if (items.length === 0) {
    return []
  }
  return [
    {
      ...entry,
      itemIds: entry.itemIds.filter((id) => id !== hiddenActivityId),
      items,
    },
  ]
}

export function shouldFlattenActivitySummary(entry: CodexActivitySummaryEntry): boolean {
  return entry.items.length === 1 && entry.items[0]?.type === 'command'
}

export function isActiveStatus(status: string | undefined) {
  return status === 'inProgress' || status === 'running'
}

export function useElapsedMs({
  durationMs,
  nowMs: fixedNowMs,
  startedAtMs,
  state,
}: {
  durationMs?: number
  nowMs?: number
  startedAtMs?: number
  state: 'working' | 'done' | 'error'
}) {
  const [now, setNow] = useState(() => fixedNowMs ?? Date.now())

  useEffect(() => {
    if (fixedNowMs !== undefined) {
      setNow(fixedNowMs)
      return
    }
    if (state !== 'working') {
      return
    }
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [fixedNowMs, state])

  if (state === 'working' && startedAtMs) {
    return Math.max(durationMs ?? 0, now - startedAtMs)
  }
  return durationMs
}
