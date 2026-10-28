'use client'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Check, FileWarning, ImageIcon, Trash2, UploadCloud } from 'lucide-react'
import { Button } from '@components/ui/button'
import { Label } from '@components/ui/label'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUser, updateUserBanner, deleteUserBanner } from '@services/users/users'
import { getUserBannerMediaDirectory } from '@services/media/media'
import { getErrorMessage } from '@services/utils/ts/errorMessage'

const MAX_BYTES = 5 * 1024 * 1024

export default function BannerUploader() {
  const { t } = useTranslation()
  const session = useLHSession() as any
  const userId = session?.data?.user?.id
  const accessToken = session?.data?.tokens?.access_token
  const [user, setUser] = React.useState<any>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const [success, setSuccess] = React.useState('')

  React.useEffect(() => {
    if (!userId || !accessToken) return
    getUser(userId, accessToken).then(setUser).catch(() => {})
  }, [userId, accessToken])

  const bannerUrl = user?.banner_image ? getUserBannerMediaDirectory(user.user_uuid, user.banner_image) : ''

  async function apply(action: () => Promise<any>, message: string) {
    setBusy(true)
    setError('')
    setSuccess('')
    const res = await action()
    if (res.success === false || (res.status && res.status >= 400)) {
      setError(getErrorMessage(res.data?.detail, res.HTTPmessage || t('user.settings.general.update_failed')))
    } else {
      setUser(await getUser(userId, accessToken))
      setSuccess(message)
    }
    setBusy(false)
  }

  function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > MAX_BYTES) {
      setError(t('user.settings.general.banner_too_large'))
      return
    }
    apply(() => updateUserBanner(userId, file, accessToken), t('user.settings.general.banner_updated'))
  }

  return (
    <div className="bg-gray-50/50 p-6 rounded-lg nice-shadow">
      <Label className="font-bold">{t('user.settings.general.banner_title')}</Label>
      <p className="text-sm text-gray-500 mt-1 mb-4">{t('user.settings.general.banner_hint')}</p>
      {error && (
        <div className="flex items-center bg-red-200 rounded-md text-red-950 px-4 py-2 text-sm mb-3">
          <FileWarning size={16} className="me-2" />
          <span className="font-semibold">{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-center bg-green-200 rounded-md text-green-950 px-4 py-2 text-sm mb-3">
          <Check size={16} className="me-2" />
          <span className="font-semibold">{success}</span>
        </div>
      )}
      <div className="h-32 w-full rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center text-gray-300">
        {bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bannerUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <ImageIcon size={36} strokeWidth={1.5} />
        )}
      </div>
      <div className="flex flex-wrap gap-2 mt-4">
        <input type="file" id="bannerInput" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={onFile} />
        <Button type="button" variant="outline" disabled={busy} onClick={() => document.getElementById('bannerInput')?.click()}>
          <UploadCloud size={16} className="me-2" />
          {busy ? t('user.settings.general.uploading') : t('user.settings.general.banner_upload')}
        </Button>
        {bannerUrl && (
          <Button type="button" variant="outline" disabled={busy} onClick={() => apply(() => deleteUserBanner(userId, accessToken), t('user.settings.general.banner_removed'))}>
            <Trash2 size={16} className="me-2" />
            {t('user.settings.general.banner_remove')}
          </Button>
        )}
      </div>
    </div>
  )
}
