'use client'
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'

const KEY = 'lh_cookie_notice_seen'

/** One-line notice: only necessary cookies and our own analytics are used. Dismissed once, remembered in this browser. */
export default function CookieNotice() {
  const { t } = useTranslation()
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) !== '1') setShow(true)
    } catch {
      setShow(true)
    }
  }, [])

  if (!show) return null

  const close = () => {
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      // storage blocked: the notice returns on the next visit
    }
    setShow(false)
  }

  return (
    <div
      role="region"
      aria-label="Cookies"
      className="fixed inset-x-0 bottom-0 z-[60] flex justify-center px-3 pb-3 pointer-events-none"
    >
      <div className="pointer-events-auto flex flex-wrap items-center gap-3 max-w-2xl rounded-xl bg-white p-3 ps-4 text-[13px] text-gray-700 nice-shadow border border-gray-100">
        <span className="flex-1 min-w-[220px]">
          {t('legal.cookie_text')}{' '}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-black">{t('legal.privacy_link')}</Link>
        </span>
        <button
          type="button"
          onClick={close}
          className="rounded-lg bg-black px-4 py-1.5 text-sm font-semibold text-white hover:bg-black/85"
        >
          {t('legal.cookie_ok')}
        </button>
      </div>
    </div>
  )
}
