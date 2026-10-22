import type { VersionKnowledgeRecord } from '../types/software'

export type MockStudiedFile = {
  path: string
  name: string
  studyDurationMs: number
  tokens: number
  /** آیا این فایل منبع اصلی ساخت کوئری بوده */
  isQuerySource: boolean
}

export type MockAiQueryTestResult = {
  query: string
  studiedFiles: MockStudiedFile[]
  /** مسیر فایل‌هایی که منبع مستندات کوئری بوده‌اند */
  querySourcePaths: string[]
  timings: {
    totalStudyMs: number
    searchMs: number
    queryBuildMs: number
  }
  tokens: {
    study: number
    queryBuild: number
    total: number
  }
  confidence: {
    /** قواعد کوئری‌نویسی — همیشه ۱۰۰ */
    syntaxRulesPercent: 100
    /** احتمال انتخاب درست جدول/فیلد از نظر خود AI */
    schemaChoicePercent: number
    /** احتمال درستی روش محاسبه از نظر خود AI */
    calculationMethodPercent: number
  }
}

const FALLBACK_PATHS = [
  'docs/schema/tables.md',
  'docs/schema/relations.md',
  'docs/queries/sales.md',
  'docs/business/rules.md',
  'docs/indexes/overview.md',
] as const

const QUERY_TEMPLATES = [
  (ctx: string) =>
    `SELECT TOP 100\n  o.OrderId,\n  o.OrderDate,\n  c.CustomerName,\n  SUM(oi.Quantity * oi.UnitPrice) AS TotalAmount\nFROM dbo.Orders o\nINNER JOIN dbo.Customers c ON c.CustomerId = o.CustomerId\nINNER JOIN dbo.OrderItems oi ON oi.OrderId = o.OrderId\nWHERE o.OrderDate >= DATEADD(MONTH, -3, GETDATE())\n  /* درخواست: ${ctx} */\nGROUP BY o.OrderId, o.OrderDate, c.CustomerName\nORDER BY TotalAmount DESC;`,
  (ctx: string) =>
    `SELECT\n  p.ProductCode,\n  p.ProductName,\n  SUM(s.Quantity) AS QtySold,\n  SUM(s.Quantity * s.UnitPrice) AS Revenue\nFROM dbo.Sales s\nINNER JOIN dbo.Products p ON p.ProductId = s.ProductId\nWHERE s.SaleDate BETWEEN @FromDate AND @ToDate\n  /* درخواست: ${ctx} */\nGROUP BY p.ProductCode, p.ProductName\nHAVING SUM(s.Quantity) > 0\nORDER BY Revenue DESC;`,
  (ctx: string) =>
    `SELECT\n  e.EmployeeId,\n  e.FullName,\n  d.DepartmentName,\n  COUNT(t.TaskId) AS OpenTasks\nFROM dbo.Employees e\nLEFT JOIN dbo.Departments d ON d.DepartmentId = e.DepartmentId\nLEFT JOIN dbo.Tasks t ON t.AssigneeId = e.EmployeeId AND t.Status = N'Open'\nWHERE e.IsActive = 1\n  /* درخواست: ${ctx} */\nGROUP BY e.EmployeeId, e.FullName, d.DepartmentName\nORDER BY OpenTasks DESC;`,
  (ctx: string) =>
    `WITH Monthly AS (\n  SELECT\n    YEAR(i.InvoiceDate) AS Y,\n    MONTH(i.InvoiceDate) AS M,\n    SUM(i.NetAmount) AS NetTotal\n  FROM dbo.Invoices i\n  WHERE i.Status <> N'Cancelled'\n    /* درخواست: ${ctx} */\n  GROUP BY YEAR(i.InvoiceDate), MONTH(i.InvoiceDate)\n)\nSELECT Y, M, NetTotal,\n  LAG(NetTotal) OVER (ORDER BY Y, M) AS PrevMonth\nFROM Monthly\nORDER BY Y, M;`,
  (ctx: string) =>
    `SELECT\n  w.WarehouseCode,\n  i.ItemCode,\n  i.ItemName,\n  SUM(st.OnHandQty) AS OnHand,\n  SUM(st.ReservedQty) AS Reserved\nFROM dbo.Stock st\nINNER JOIN dbo.Warehouses w ON w.WarehouseId = st.WarehouseId\nINNER JOIN dbo.Items i ON i.ItemId = st.ItemId\nWHERE st.OnHandQty > 0\n  /* درخواست: ${ctx} */\nGROUP BY w.WarehouseCode, i.ItemCode, i.ItemName\nORDER BY OnHand DESC;`,
]

function hashSeed(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function pick<T>(arr: readonly T[], seed: number, offset = 0): T {
  const idx = (seed + offset) % arr.length
  return arr[idx]!
}

function stableInt(seed: number, min: number, max: number, salt: number): number {
  const span = max - min + 1
  return min + ((seed + salt * 9973) % span)
}

function collectCandidatePaths(knowledge: VersionKnowledgeRecord): string[] {
  const paths: string[] = []
  for (const docs of knowledge.databaseDocs) {
    for (const f of docs.files) {
      if (!f.active) continue
      if (f.encoding === 'text') paths.push(f.path)
    }
  }
  if (!paths.length) {
    for (const docs of knowledge.databaseDocs) {
      for (const f of docs.files) {
        if (f.active) paths.push(f.path)
      }
    }
  }
  return paths.length ? paths : [...FALLBACK_PATHS]
}

function hasUsableKnowledge(knowledge: VersionKnowledgeRecord): boolean {
  const hasText =
    knowledge.description.trim().length > 0 ||
    knowledge.analysis.trim().length > 0
  const hasFiles = knowledge.databaseDocs.some((d) =>
    d.files.some((f) => f.active),
  )
  return hasText || hasFiles
}

export type MockAiQueryTestInput = {
  prompt: string
  softwareId: string
  versionId: string
  knowledge: VersionKnowledgeRecord
}

export type MockAiQueryTestOutcome =
  | { ok: true; result: MockAiQueryTestResult }
  | { ok: false; message: string }

/**
 * شبیه‌سازی پاسخ مدل AI روی دانش نسخه — خروجی پایدار برای همان ورودی.
 */
export function mockAiQueryTest(
  input: MockAiQueryTestInput,
): MockAiQueryTestOutcome {
  const prompt = input.prompt.trim()
  if (!prompt) {
    return { ok: false, message: 'لطفاً درخواست خود را بنویسید.' }
  }
  if (!hasUsableKnowledge(input.knowledge)) {
    return {
      ok: false,
      message:
        'برای این نسخه دانش/مستند فعالی ثبت نشده است. ابتدا در مدیریت دانش نسخه مستندات را تکمیل کنید.',
    }
  }

  const seed = hashSeed(
    `${input.prompt}|${input.softwareId}|${input.versionId}`,
  )
  const paths = collectCandidatePaths(input.knowledge)
  const studyCount = Math.min(
    paths.length,
    stableInt(seed, 2, Math.min(5, paths.length), 1),
  )

  const studiedPaths: string[] = []
  for (let i = 0; i < studyCount; i++) {
    const p = paths[(seed + i * 17) % paths.length]!
    if (!studiedPaths.includes(p)) studiedPaths.push(p)
  }
  while (studiedPaths.length < studyCount && studiedPaths.length < paths.length) {
    for (const p of paths) {
      if (!studiedPaths.includes(p)) {
        studiedPaths.push(p)
        break
      }
    }
  }

  const sourceCount = Math.min(
    studiedPaths.length,
    stableInt(seed, 1, Math.min(2, studiedPaths.length), 3),
  )
  const querySourcePaths = studiedPaths.slice(0, sourceCount)

  const studiedFiles: MockStudiedFile[] = studiedPaths.map((path, i) => {
    const name = path.split('/').pop() || path
    const pathSeed = hashSeed(path + String(seed))
    return {
      path,
      name,
      studyDurationMs: stableInt(pathSeed, 80, 420, i + 1),
      tokens: stableInt(pathSeed, 120, 980, i + 11),
      isQuerySource: querySourcePaths.includes(path),
    }
  })

  const totalStudyMs = studiedFiles.reduce((s, f) => s + f.studyDurationMs, 0)
  const searchMs = stableInt(seed, 40, 180, 21)
  const queryBuildMs = stableInt(seed, 90, 350, 34)
  const studyTokens = studiedFiles.reduce((s, f) => s + f.tokens, 0)
  const queryBuildTokens = stableInt(seed, 200, 650, 55)

  const promptSnippet =
    prompt.length > 60 ? `${prompt.slice(0, 57)}…` : prompt
  const template = pick(QUERY_TEMPLATES, seed)
  const query = template(promptSnippet)

  return {
    ok: true,
    result: {
      query,
      studiedFiles,
      querySourcePaths,
      timings: {
        totalStudyMs,
        searchMs,
        queryBuildMs,
      },
      tokens: {
        study: studyTokens,
        queryBuild: queryBuildTokens,
        total: studyTokens + queryBuildTokens,
      },
      confidence: {
        syntaxRulesPercent: 100,
        schemaChoicePercent: stableInt(seed, 62, 94, 71),
        calculationMethodPercent: stableInt(seed, 58, 92, 83),
      },
    },
  }
}
