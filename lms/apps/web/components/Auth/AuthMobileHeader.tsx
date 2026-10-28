'use client'
import React from 'react'
import { getOrgAuthBackgroundMediaDirectory } from '@services/media/media'

interface AuthMobileHeaderProps {
  org: any
}

export default function AuthMobileHeader({ org }: AuthMobileHeaderProps) {
  const authBranding = org?.config?.config?.customization?.auth_branding || org?.config?.config?.general?.auth_branding || {}
  const {
    background_type = 'gradient',
    background_image = '',
    unsplash_photographer_name = '',
    unsplash_photographer_url = '',
    unsplash_photo_url = '',
  } = authBranding
  const UNSPLASH_UTM = '?utm_source=SIRIUS&utm_medium=referral'
  const withUtm = (url: string) => (url ? `${url}${UNSPLASH_UTM}` : '')

  // Same background as the desktop panel: the planet unless the org chose its own image.
  const image =
    background_type === 'custom' && background_image
      ? getOrgAuthBackgroundMediaDirectory(org?.org_uuid, background_image)
      : background_type === 'unsplash' && background_image
        ? background_image
        : '/auth-planet.jpg'

  return (
    <div
      className="relative h-28 rounded-b-2xl overflow-hidden"
      style={{ backgroundImage: `url(${image})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      {/* Unsplash attribution (required by Unsplash API guidelines) */}
      {background_type === 'unsplash' && background_image && unsplash_photographer_name && (
        <span className="absolute bottom-2 start-4 end-4 z-10 text-[10px] leading-tight text-white/70 truncate">
          Photo by{' '}
          <a
            href={withUtm(unsplash_photographer_url) || withUtm(unsplash_photo_url)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {unsplash_photographer_name}
          </a>
          {' '}on{' '}
          <a
            href={`https://unsplash.com/${UNSPLASH_UTM}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Unsplash
          </a>
        </span>
      )}
    </div>
  )
}
