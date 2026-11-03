'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import { LEGAL_DOCS, fill, type DocKey } from '@/lib/legal/content'
import { LEGAL_VERSION } from '@/lib/legal/version'
import { isOperatorComplete, missingOperatorFields, type Lang } from '@/lib/legal/operator'

/** A line like "Privacy Policy — /privacy" becomes a link; everything else is plain text. */
function Line({ text }: { text: string }) {
  const [label, path] = text.split(' — ')
  if (path && path.startsWith('/')) {
    return (
      <>
        <Link href={path} className="text-black underline underline-offset-2 hover:text-black/70">{label}</Link>
      </>
    )
  }
  return <>{text}</>
}

export default function LegalDocument({ doc }: { doc: DocKey }) {
  const { t, i18n } = useTranslation()
  const uiLang: Lang = String(i18n.resolvedLanguage || i18n.language || '').toLowerCase().startsWith('ru') ? 'ru' : 'en'
  const [chosen, setChosen] = useState<Lang | null>(null)
  const lang = chosen ?? uiLang
  const content = LEGAL_DOCS[doc][lang]
  const incomplete = !isOperatorComplete()

  return (
    <GeneralWrapperStyled>
      <article className="max-w-3xl mx-auto py-8 text-[15px] leading-relaxed text-gray-800">
        {incomplete && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span>{t('legal.draft_banner', { fields: missingOperatorFields().join(', ') })}</span>
          </div>
        )}

        <div className="flex items-start justify-between gap-4 mb-2">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900" dir="auto">{content.title}</h1>
          <div className="flex shrink-0 rounded-lg nice-shadow overflow-hidden text-sm" role="group" aria-label="Language">
            {(['ru', 'en'] as Lang[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setChosen(l)}
                aria-pressed={lang === l}
                className={`px-3 py-1.5 font-semibold ${lang === l ? 'bg-black text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-8">{t('legal.version_label', { version: LEGAL_VERSION })}</p>

        {content.sections.map((s, i) => (
          <section key={i} className="mb-6">
            {s.h && <h2 className="text-lg font-semibold text-gray-900 mb-2">{s.h}</h2>}
            {s.p?.map((para, j) => (
              <p key={j} className="mb-2"><Line text={fill(para, lang)} /></p>
            ))}
            {s.ul && (
              <ul className="list-disc ps-6 space-y-1">
                {s.ul.map((item, j) => <li key={j}>{fill(item, lang)}</li>)}
              </ul>
            )}
          </section>
        ))}
      </article>
    </GeneralWrapperStyled>
  )
}
