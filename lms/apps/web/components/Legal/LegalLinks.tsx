'use client'
import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { OPERATOR } from '@/lib/legal/operator'

/** Footer row with the legal documents and the operator's name. */
export default function LegalLinks({ className = '' }: { className?: string }) {
  const { t, i18n } = useTranslation()
  const lang = String(i18n.resolvedLanguage || i18n.language || '').toLowerCase().startsWith('ru') ? 'ru' : 'en'
  const links: Array<[string, string]> = [
    ['/privacy', t('legal.privacy_link')],
    ['/terms', t('legal.terms_link')],
    ['/consent', t('legal.consent_link_short')],
    ['/offer', t('legal.offer_link')],
    ['/contacts', t('legal.contacts_link')],
  ]
  return (
    <div className={`flex flex-col items-center gap-1 text-xs text-gray-400 ${className}`}>
      <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1" aria-label="Legal">
        {links.map(([href, label]) => (
          <Link key={href} href={href} className="hover:text-gray-600 underline-offset-2 hover:underline">{label}</Link>
        ))}
      </nav>
      <span>© {new Date().getFullYear()} {OPERATOR.name[lang]}</span>
    </div>
  )
}
