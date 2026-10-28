/* eslint-disable @next/next/no-img-element */
import React from 'react'

/** SIRIUS mark: black in the light theme, white in the dark theme (or a fixed tone). */
export default function Logo({
  size = 24,
  tone = 'auto',
  className = '',
  style,
}: {
  size?: number
  tone?: 'auto' | 'black' | 'white'
  className?: string
  style?: React.CSSProperties
}) {
  const common = { alt: 'SIRIUS', width: size, height: size, style: { width: size, height: size, ...style } }
  if (tone === 'black') return <img src="/logo-black.png" className={className} {...common} />
  if (tone === 'white') return <img src="/logo-white.png" className={className} {...common} />
  return (
    <>
      <img src="/logo-black.png" className={`dark:hidden ${className}`} {...common} />
      <img src="/logo-white.png" className={`hidden dark:block ${className}`} {...common} />
    </>
  )
}
