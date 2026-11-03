'use client'
import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'

interface Props {
  terms: boolean
  data: boolean
  onChange: (field: 'accept_terms' | 'accept_data', value: boolean) => void
  /** Shown under the boxes when the form was submitted without ticking both. */
  error?: string
  disabled?: boolean
}

const linkClass = 'text-black underline underline-offset-2 hover:text-black/70'

/** The two required sign-up checkboxes: Terms + Privacy Policy, and consent to personal-data processing. */
export default function LegalConsentBoxes({ terms, data, onChange, error, disabled }: Props) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-2 mt-2 text-[13px] text-black/60 leading-snug">
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={terms}
          disabled={disabled}
          onChange={(e) => onChange('accept_terms', e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-black"
        />
        <span>
          {t('legal.accept_terms_pre')}{' '}
          <Link href="/terms" target="_blank" className={linkClass}>{t('legal.terms_link')}</Link>{' '}
          {t('legal.and')}{' '}
          <Link href="/privacy" target="_blank" className={linkClass}>{t('legal.privacy_link')}</Link>
        </span>
      </label>
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={data}
          disabled={disabled}
          onChange={(e) => onChange('accept_data', e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-black"
        />
        <span>
          {t('legal.consent_pre')}{' '}
          <Link href="/consent" target="_blank" className={linkClass}>{t('legal.consent_link')}</Link>
        </span>
      </label>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
