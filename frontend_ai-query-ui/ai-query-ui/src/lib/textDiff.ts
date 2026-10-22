export type DiffLineKind = 'equal' | 'add' | 'remove'

export type DiffLine = {
  kind: DiffLineKind
  text: string
  /** 1-based line number in previous text (equal/remove) */
  oldLine?: number
  /** 1-based line number in current text (equal/add) */
  newLine?: number
}

export type DiffSegmentKind = 'equal' | 'add' | 'remove'

export type DiffSegment = {
  kind: DiffSegmentKind
  text: string
}

/**
 * Normalize BOM + CRLF/CR so line endings never make every line look changed.
 * Splits on `\n` and preserves a trailing empty line from split semantics.
 */
function splitLines(text: string): string[] {
  if (text === '') return []
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  return normalized.split('\n')
}

/** Classic LCS DP over string arrays (lines or single-char strings). */
function lcsDiff(a: string[], b: string[]): DiffLine[] {
  const n = a.length
  const m = b.length
  if (!n && !m) return []

  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    Array(m + 1).fill(0),
  )

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const out: DiffLine[] = []
  let i = 0
  let j = 0
  let oldLine = 1
  let newLine = 1

  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({
        kind: 'equal',
        text: a[i],
        oldLine: oldLine++,
        newLine: newLine++,
      })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ kind: 'remove', text: a[i], oldLine: oldLine++ })
      i++
    } else {
      out.push({ kind: 'add', text: b[j], newLine: newLine++ })
      j++
    }
  }
  while (i < n) {
    out.push({ kind: 'remove', text: a[i], oldLine: oldLine++ })
    i++
  }
  while (j < m) {
    out.push({ kind: 'add', text: b[j], newLine: newLine++ })
    j++
  }

  return out
}

/**
 * Line-level LCS diff — knowledge-doc UX (no extra deps).
 * Sanity: appending text on one line should yield one remove + one add
 * (paired as modify by toSideBySide), not a whole-file replace — provided
 * line endings are normalized (see splitLines).
 */
export function diffLines(previous: string, current: string): DiffLine[] {
  return lcsDiff(splitLines(previous), splitLines(current))
}

const CHAR_DIFF_MAX = 4000

function mergeSegments(segs: DiffSegment[]): DiffSegment[] {
  const out: DiffSegment[] = []
  for (const s of segs) {
    if (!s.text) continue
    const last = out[out.length - 1]
    if (last && last.kind === s.kind) last.text += s.text
    else out.push({ ...s })
  }
  return out
}

/**
 * Character-level LCS for a paired modified line.
 * Falls back to whole-string replace when lines are very long.
 */
export function diffChars(previous: string, current: string): DiffSegment[] {
  if (previous === current) {
    return previous ? [{ kind: 'equal', text: previous }] : []
  }
  if (
    previous.length * current.length > CHAR_DIFF_MAX * CHAR_DIFF_MAX ||
    previous.length > CHAR_DIFF_MAX ||
    current.length > CHAR_DIFF_MAX
  ) {
    return mergeSegments([
      { kind: 'remove', text: previous },
      { kind: 'add', text: current },
    ])
  }

  const raw = lcsDiff([...previous], [...current])
  return mergeSegments(
    raw.map((d) => ({
      kind: d.kind,
      text: d.text,
    })),
  )
}

function segmentsForSide(
  segments: DiffSegment[],
  side: 'left' | 'right',
): DiffSegment[] {
  return segments.filter((s) =>
    side === 'left' ? s.kind !== 'add' : s.kind !== 'remove',
  )
}

/** Side-by-side rows: pair removes with following adds when possible. */
export type SideBySideRow = {
  left?: {
    text: string
    line: number
    removed: boolean
    /** Char-level spans when this row is a modify (paired remove+add). */
    segments?: DiffSegment[]
  }
  right?: {
    text: string
    line: number
    added: boolean
    segments?: DiffSegment[]
  }
}

export function toSideBySide(lines: DiffLine[]): SideBySideRow[] {
  const rows: SideBySideRow[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.kind === 'equal') {
      rows.push({
        left: {
          text: line.text,
          line: line.oldLine!,
          removed: false,
        },
        right: {
          text: line.text,
          line: line.newLine!,
          added: false,
        },
      })
      i++
      continue
    }

    const removes: DiffLine[] = []
    const adds: DiffLine[] = []
    while (i < lines.length && lines[i].kind === 'remove') {
      removes.push(lines[i])
      i++
    }
    while (i < lines.length && lines[i].kind === 'add') {
      adds.push(lines[i])
      i++
    }

    const max = Math.max(removes.length, adds.length)
    for (let k = 0; k < max; k++) {
      const rem = removes[k]
      const add = adds[k]
      if (rem && add) {
        const charDiff = diffChars(rem.text, add.text)
        rows.push({
          left: {
            text: rem.text,
            line: rem.oldLine!,
            removed: true,
            segments: segmentsForSide(charDiff, 'left'),
          },
          right: {
            text: add.text,
            line: add.newLine!,
            added: true,
            segments: segmentsForSide(charDiff, 'right'),
          },
        })
      } else {
        rows.push({
          left: rem
            ? { text: rem.text, line: rem.oldLine!, removed: true }
            : undefined,
          right: add
            ? { text: add.text, line: add.newLine!, added: true }
            : undefined,
        })
      }
    }
  }
  return rows
}
