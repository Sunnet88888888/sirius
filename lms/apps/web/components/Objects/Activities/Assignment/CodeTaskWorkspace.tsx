'use client'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import dynamic from 'next/dynamic'
import {
  CheckCircle2,
  Download,
  EyeOff,
  Info,
  Loader2,
  Lock,
  Maximize2,
  Minimize2,
  Play,
  RotateCcw,
  ShieldCheck,
  Terminal,
  XCircle,
} from 'lucide-react'

const CodeMirror = dynamic(() => import('@uiw/react-codemirror'), {
  ssr: false,
  loading: () => <div className="h-full min-h-[160px] bg-neutral-900 animate-pulse" />,
})

// Structural copies of the types in TaskCodeObject, so this view stays a pure
// presentation component (no import cycle with the task component).
export type WorkspaceTestCase = {
  id: string
  label: string
  stdin: string
  expectedStdout: string
  hidden: boolean
}

export type WorkspaceTestResult = {
  id: string
  label: string
  passed: boolean
  actual_stdout: string | null
  expected_stdout: string | null
  stderr: string | null
  compile_output: string | null
  status: { id: number; description: string } | null
  time: string | null
  memory: number | null
}

type CodeTaskWorkspaceProps = {
  title: string
  hint?: string
  referenceFileHref?: string
  languageName: string

  testCases: WorkspaceTestCase[]
  showHiddenTestCount: boolean
  showDetailsOnFail: boolean

  code: string
  onCodeChange: (_value: string) => void
  onReset: () => void
  readOnly: boolean
  lockedMessage?: string
  antiPasteHint?: string
  mustPassHint?: string

  cmExtensions: any[]
  cmTheme: any

  allowRun: boolean
  isRunning: boolean
  onRun: () => void
  results: WorkspaceTestResult[]
  hasRun: boolean
}

// rtl-ok: CodeMirror is dir="ltr" regardless of UI language; code reads
// left-to-right by language spec and the editor computes its geometry
// physically. The gutter border stays physical to match.
const cmClassName = [
  'h-full',
  '[&_.cm-editor]:!h-full',
  '[&_.cm-editor]:!bg-[#1a1b26]',
  '[&_.cm-gutters]:!bg-[#1a1b26]',
  '[&_.cm-gutters]:!border-r-transparent',
  '[&_.cm-activeLineGutter]:!bg-[#24283b]',
  '[&_.cm-activeLine]:!bg-[#24283b]',
  '[&_.cm-editor]:!outline-none',
  '[&_.cm-focused]:!outline-none',
  '[&_.cm-scroller]:!overflow-auto',
  '[&_.cm-line]:!px-4',
].join(' ')

const cmStyles: React.CSSProperties = {
  fontSize: '14px',
  height: '100%',
  fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, monospace",
}

const SPLIT_KEY = 'sirius-code-split'
const CONSOLE_KEY = 'sirius-code-console'
const NARROW_BELOW = 760 // px of container width

function readNumber(key: string, fallback: number, min: number, max: number) {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    const n = Number(raw)
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
  } catch {
    return fallback
  }
}
function writeNumber(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    /* storage unavailable */
  }
}

// Pointer-driven drag helper: calls onMove with the pointer position while a
// drag that started on the handle is active.
function useDragHandle(onMove: (_e: PointerEvent) => void, onEnd: () => void) {
  const moveRef = useRef(onMove)
  const endRef = useRef(onEnd)
  moveRef.current = onMove
  endRef.current = onEnd
  const [dragging, setDragging] = useState(false)

  const start = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    setDragging(true)
    const move = (ev: PointerEvent) => moveRef.current(ev)
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setDragging(false)
      endRef.current()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }, [])

  return { dragging, start }
}

type MobileTab = 'description' | 'code' | 'results'

export default function CodeTaskWorkspace(props: CodeTaskWorkspaceProps) {
  const {
    title, hint, referenceFileHref, languageName, testCases, showHiddenTestCount,
    showDetailsOnFail, code, onCodeChange, onReset, readOnly, lockedMessage,
    antiPasteHint, mustPassHint, cmExtensions, cmTheme, allowRun, isRunning,
    onRun, results, hasRun,
  } = props
  const { t } = useTranslation()

  const [fullscreen, setFullscreen] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const rootRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const [narrow, setNarrow] = useState(false)
  const [tab, setTab] = useState<MobileTab>('description')

  // Pane sizes. leftPct: width of the description pane in %, consoleH: height
  // of the results pane in px. Both are remembered per browser.
  const [leftPct, setLeftPct] = useState(42)
  const [consoleH, setConsoleH] = useState(220)
  useEffect(() => {
    setLeftPct(readNumber(SPLIT_KEY, 42, 22, 70))
    setConsoleH(readNumber(CONSOLE_KEY, 220, 90, 600))
  }, [])

  // Layout follows the width of the workspace itself, not the window, so it
  // also adapts when the lesson page puts it in a narrow column.
  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? el.clientWidth
      setNarrow(w > 0 && w < NARROW_BELOW)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [fullscreen, mounted])

  // Jump to the results tab when a run starts on the narrow layout.
  useEffect(() => {
    if (narrow && isRunning) setTab('results')
  }, [narrow, isRunning])

  // Esc leaves full screen; the page behind must not scroll while it is open.
  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false)
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [fullscreen])

  const isRtl = () =>
    !!bodyRef.current && getComputedStyle(bodyRef.current).direction === 'rtl'

  const splitDrag = useDragHandle(
    (e) => {
      const el = bodyRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const frac = isRtl() ? (rect.right - e.clientX) / rect.width : (e.clientX - rect.left) / rect.width
      setLeftPct(Math.min(70, Math.max(22, frac * 100)))
    },
    () => writeNumber(SPLIT_KEY, leftPct)
  )
  const consoleDrag = useDragHandle(
    (e) => {
      const el = rightRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setConsoleH(Math.min(rect.height - 120, Math.max(90, rect.bottom - e.clientY)))
    },
    () => writeNumber(CONSOLE_KEY, consoleH)
  )

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && allowRun && !isRunning) {
      e.preventDefault()
      onRun()
    }
  }

  const visibleTests = testCases.filter((tc) => !tc.hidden)
  const hiddenCount = testCases.length - visibleTests.length

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50">
      <span className="px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-600 rounded-full">
        {languageName}
      </span>
      {hiddenCount > 0 && showHiddenTestCount && (
        <span className="px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700 rounded-full">
          {t('assignments.code.hidden_tests', { count: hiddenCount, defaultValue: hiddenCount === 1 ? '{{count}} hidden test' : '{{count}} hidden tests' })}
        </span>
      )}
      <div className="ms-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            if (readOnly) return
            if (window.confirm(t('assignments.code.reset_confirm', { defaultValue: 'Reset your code to the starter code?' }))) onReset()
          }}
          disabled={readOnly}
          title={t('assignments.code.reset', { defaultValue: 'Reset code' })}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-600 rounded-md hover:bg-gray-100 disabled:opacity-40"
        >
          <RotateCcw size={13} />
          <span className="hidden sm:inline">{t('assignments.code.reset', { defaultValue: 'Reset' })}</span>
        </button>
        {allowRun && (
          <button
            type="button"
            onClick={onRun}
            disabled={isRunning}
            title="Ctrl/⌘ + Enter"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
          >
            {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            <span>{isRunning ? t('assignments.code.running', { defaultValue: 'Running…' }) : t('assignments.code.run', { defaultValue: 'Run tests' })}</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => setFullscreen((v) => !v)}
          title={fullscreen ? t('assignments.code.exit_fullscreen', { defaultValue: 'Exit full screen (Esc)' }) : t('assignments.code.fullscreen', { defaultValue: 'Full screen' })}
          aria-label={fullscreen ? t('assignments.code.exit_fullscreen', { defaultValue: 'Exit full screen (Esc)' }) : t('assignments.code.fullscreen', { defaultValue: 'Full screen' })}
          className="flex items-center justify-center w-8 h-8 text-slate-600 rounded-md hover:bg-gray-100"
        >
          {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>
      </div>
    </div>
  )

  const descriptionPane = (
    <div className="h-full overflow-y-auto px-4 py-4 text-slate-800">
      <h3 className="text-base font-semibold leading-snug whitespace-pre-wrap break-words">{title}</h3>

      {hint && (
        <details className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
          <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
            <Info size={13} />
            {t('assignments.hint')}
          </summary>
          <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap break-words">{hint}</p>
        </details>
      )}

      {referenceFileHref && (
        <a
          href={referenceFileHref}
          target="_blank"
          rel="noreferrer"
          download
          className="mt-4 inline-flex items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-900"
        >
          <Download size={13} />
          {t('assignments.reference_document')}
        </a>
      )}

      {visibleTests.length > 0 && (
        <div className="mt-6">
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {t('assignments.code.examples', { defaultValue: 'Examples' })}
          </h4>
          <div className="mt-2 flex flex-col gap-3">
            {visibleTests.map((tc, i) => (
              <div key={tc.id} className="rounded-md border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-semibold text-slate-600">
                  {tc.label || `${t('assignments.code.example', { defaultValue: 'Example' })} ${i + 1}`}
                </p>
                <div dir="ltr" className="mt-2 grid gap-2 text-xs">
                  <div>
                    <p className="mb-1 text-[10px] font-bold uppercase text-slate-400">
                      {t('assignments.code.input', { defaultValue: 'Input' })}
                    </p>
                    <pre className="whitespace-pre-wrap break-all rounded bg-white px-2 py-1.5 font-mono text-slate-800 border border-gray-200">{tc.stdin === '' ? '(empty)' : tc.stdin}</pre>
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] font-bold uppercase text-slate-400">
                      {t('assignments.code.expected_output', { defaultValue: 'Expected output' })}
                    </p>
                    <pre className="whitespace-pre-wrap break-all rounded bg-white px-2 py-1.5 font-mono text-slate-800 border border-gray-200">{tc.expectedStdout}</pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {hiddenCount > 0 && showHiddenTestCount && (
        <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
          <EyeOff size={13} />
          {t('assignments.code.hidden_note', {
            count: hiddenCount,
            defaultValue: hiddenCount === 1 ? '{{count}} more hidden test is run when your work is graded.' : '{{count}} more hidden tests are run when your work is graded.',
          })}
        </p>
      )}
    </div>
  )

  const editorPane = (
    <div className="flex h-full min-h-0 flex-col">
      <div dir="ltr" className="min-h-0 flex-1 overflow-hidden">
        {cmTheme ? (
          <div className={cmClassName}>
            <CodeMirror
              value={code}
              onChange={(val) => {
                if (!readOnly) onCodeChange(val)
              }}
              extensions={cmExtensions}
              theme={cmTheme}
              style={cmStyles}
              height="100%"
              readOnly={readOnly}
              editable={!readOnly}
              basicSetup={{ lineNumbers: true, foldGutter: false }}
            />
          </div>
        ) : (
          <div className="h-full bg-neutral-900 animate-pulse" />
        )}
      </div>
      {(lockedMessage || antiPasteHint) && (
        <div className="flex flex-wrap gap-2 border-t border-gray-200 bg-gray-50 px-3 py-1.5">
          {lockedMessage && (
            <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <Lock size={11} />
              {lockedMessage}
            </span>
          )}
          {antiPasteHint && (
            <span className="flex items-center gap-1.5 text-[11px] text-amber-700">
              <span>🔒</span>
              {antiPasteHint}
            </span>
          )}
        </div>
      )}
    </div>
  )

  const resultsPane = (
    <ResultsPane
      results={results}
      testCases={testCases}
      hasRun={hasRun}
      isRunning={isRunning}
      showDetailsOnFail={showDetailsOnFail}
      showHiddenTestCount={showHiddenTestCount}
      mustPassHint={mustPassHint}
      allowRun={allowRun}
    />
  )

  const passedCount = results.filter((r) => r.passed).length
  const summary =
    hasRun && results.length > 0
      ? `${passedCount}/${results.length}`
      : null

  let content: React.ReactNode
  if (narrow) {
    const tabs: { id: MobileTab; label: string }[] = [
      { id: 'description', label: t('assignments.code.tab_description', { defaultValue: 'Description' }) },
      { id: 'code', label: t('assignments.code.tab_code', { defaultValue: 'Code' }) },
      { id: 'results', label: t('assignments.code.tab_results', { defaultValue: 'Results' }) + (summary ? ` ${summary}` : '') },
    ]
    content = (
      <>
        <div role="tablist" className="flex border-b border-gray-200 bg-white">
          {tabs.map((tb) => (
            <button
              key={tb.id}
              role="tab"
              type="button"
              aria-selected={tab === tb.id}
              onClick={() => setTab(tb.id)}
              className={`flex-1 px-3 py-2 text-xs font-semibold border-b-2 ${
                tab === tb.id ? 'border-emerald-600 text-slate-900' : 'border-transparent text-slate-500'
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1">
          {tab === 'description' && descriptionPane}
          {tab === 'code' && editorPane}
          {tab === 'results' && resultsPane}
        </div>
      </>
    )
  } else {
    content = (
      <div ref={bodyRef} className="flex min-h-0 flex-1">
        <div className="min-w-0 border-e border-gray-200" style={{ width: `${leftPct}%` }}>
          {descriptionPane}
        </div>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={t('assignments.code.resize', { defaultValue: 'Resize panels' })}
          onPointerDown={splitDrag.start}
          onDoubleClick={() => {
            setLeftPct(42)
            writeNumber(SPLIT_KEY, 42)
          }}
          className={`w-1.5 shrink-0 cursor-col-resize touch-none transition-colors hover:bg-emerald-400/60 ${
            splitDrag.dragging ? 'bg-emerald-500/70' : 'bg-transparent'
          }`}
        />
        <div ref={rightRef} className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">{editorPane}</div>
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label={t('assignments.code.resize', { defaultValue: 'Resize panels' })}
            onPointerDown={consoleDrag.start}
            onDoubleClick={() => {
              setConsoleH(220)
              writeNumber(CONSOLE_KEY, 220)
            }}
            className={`h-1.5 shrink-0 cursor-row-resize touch-none border-t border-gray-200 transition-colors hover:bg-emerald-400/60 ${
              consoleDrag.dragging ? 'bg-emerald-500/70' : 'bg-transparent'
            }`}
          />
          <div className="shrink-0 overflow-hidden" style={{ height: consoleH }}>
            {resultsPane}
          </div>
        </div>
      </div>
    )
  }

  const shell = (
    <div
      ref={rootRef}
      onKeyDown={onKeyDown}
      className={
        fullscreen
          ? 'fixed inset-0 z-[1000] flex flex-col bg-white'
          : 'flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white h-[min(78vh,820px)] min-h-[520px]'
      }
      style={fullscreen || !(splitDrag.dragging || consoleDrag.dragging) ? undefined : { userSelect: 'none' }}
    >
      {toolbar}
      {content}
    </div>
  )

  // Full screen is portalled to <body> so no ancestor (transform, overflow,
  // z-index) can clip it. The component state lives on, so the editor keeps
  // its content and cursor.
  if (fullscreen && mounted) {
    return (
      <>
        <div className="h-[min(78vh,820px)] min-h-[520px] rounded-lg border border-dashed border-gray-200" />
        {createPortal(shell, document.body)}
      </>
    )
  }
  return shell
}

function ResultsPane({
  results, testCases, hasRun, isRunning, showDetailsOnFail, showHiddenTestCount,
  mustPassHint, allowRun,
}: {
  results: WorkspaceTestResult[]
  testCases: WorkspaceTestCase[]
  hasRun: boolean
  isRunning: boolean
  showDetailsOnFail: boolean
  showHiddenTestCount: boolean
  mustPassHint?: string
  allowRun: boolean
}) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<string | null>(null)

  const masked = testCases.filter((tc) => tc.hidden && !results.some((r) => r.id === tc.id))
  const passedCount = results.filter((r) => r.passed).length
  const allPassed = results.length > 0 && passedCount === results.length

  // Selection falls back to the first failing test, else the first test, so it
  // is always valid after a re-run without needing an effect.
  const current =
    results.find((r) => r.id === selected) ?? results.find((r) => !r.passed) ?? results[0] ?? null
  const currentCase = current ? testCases.find((tc) => tc.id === current.id) : null

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50">
      <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-1.5">
        <Terminal size={13} className="text-slate-500" />
        <span className="text-xs font-semibold text-slate-700">
          {t('assignments.code.test_results', { defaultValue: 'Test results' })}
        </span>
        {isRunning && <Loader2 size={13} className="animate-spin text-slate-500" />}
        {hasRun && results.length > 0 && !isRunning && (
          <span
            className={`ms-auto px-2 py-0.5 text-[11px] font-bold rounded-full ${
              allPassed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
            }`}
          >
            {allPassed
              ? masked.length > 0
                ? t('assignments.code.visible_passed', { defaultValue: 'Visible tests passed' })
                : t('assignments.code.all_passed', { defaultValue: 'All passed' })
              : `${passedCount}/${results.length} ${t('assignments.code.passed', { defaultValue: 'passed' })}`}
          </span>
        )}
      </div>

      {mustPassHint && !allPassed && (
        <div className="flex items-center gap-1.5 border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-700">
          <ShieldCheck size={13} />
          <span>{mustPassHint}</span>
        </div>
      )}

      {results.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-4 text-center text-xs text-slate-500">
          {isRunning
            ? t('assignments.code.running', { defaultValue: 'Running…' })
            : allowRun
              ? t('assignments.code.run_hint', { defaultValue: 'Run your code to see the test results here (Ctrl/⌘ + Enter).' })
              : t('assignments.code.no_run_hint', { defaultValue: 'Your code is checked when your work is graded.' })}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <div className="flex w-36 shrink-0 flex-col gap-1 overflow-y-auto border-e border-gray-200 p-2">
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelected(r.id)}
                className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-start text-xs font-medium ${
                  current?.id === r.id ? 'bg-white shadow-sm ring-1 ring-gray-200' : 'hover:bg-white/70'
                }`}
              >
                {r.passed ? (
                  <CheckCircle2 size={13} className="flex-none text-emerald-600" />
                ) : (
                  <XCircle size={13} className="flex-none text-red-600" />
                )}
                <span className="truncate text-slate-700">{r.label}</span>
              </button>
            ))}
            {showHiddenTestCount &&
              masked.map((tc) => (
                <div key={tc.id} className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-slate-400" title={t('assignments.code.hidden_run_note', { defaultValue: 'Hidden test (run when your work is graded)' })}>
                  <EyeOff size={13} className="flex-none" />
                  <span className="truncate">{tc.label}</span>
                </div>
              ))}
          </div>

          <div dir="ltr" className="min-w-0 flex-1 overflow-y-auto p-3 text-xs">
            {current && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${current.passed ? 'text-emerald-700' : 'text-red-700'}`}>
                    {current.status?.description ?? (current.passed ? 'Accepted' : 'Failed')}
                  </span>
                  {current.time && <span className="text-[11px] text-slate-400">{current.time}s</span>}
                  {typeof current.memory === 'number' && (
                    <span className="text-[11px] text-slate-400">{Math.round(current.memory / 1024)} MB</span>
                  )}
                </div>
                {currentCase && <Block label={t('assignments.code.input', { defaultValue: 'Input' })} value={currentCase.stdin === '' ? '(empty)' : currentCase.stdin} />}
                {!current.passed && showDetailsOnFail && (
                  <>
                    {current.expected_stdout !== null && <Block label={t('assignments.code.expected_output', { defaultValue: 'Expected output' })} value={current.expected_stdout} />}
                    {current.actual_stdout !== null && <Block label={t('assignments.code.your_output', { defaultValue: 'Your output' })} value={current.actual_stdout} tone="bad" />}
                  </>
                )}
                {current.stderr && <Block label={t('assignments.code.error', { defaultValue: 'Error' })} value={current.stderr} tone="bad" />}
                {current.compile_output && <Block label={t('assignments.code.compile_output', { defaultValue: 'Compile output' })} value={current.compile_output} tone="bad" />}
                {current.passed && current.actual_stdout !== null && <Block label={t('assignments.code.your_output', { defaultValue: 'Your output' })} value={current.actual_stdout} />}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Block({ label, value, tone }: { label: string; value: string; tone?: 'bad' }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-bold uppercase text-slate-400">{label}</p>
      <pre
        className={`whitespace-pre-wrap break-all rounded border bg-white px-2 py-1.5 font-mono ${
          tone === 'bad' ? 'border-red-200 text-red-700' : 'border-gray-200 text-slate-800'
        }`}
      >
        {value === '' ? '(empty)' : value}
      </pre>
    </div>
  )
}
