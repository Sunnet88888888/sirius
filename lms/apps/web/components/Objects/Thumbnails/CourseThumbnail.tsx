'use client'
import { useOrg } from '@components/Contexts/OrgContext'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import ManageAccessPopover from '@components/Dashboard/Library/ManageAccessPopover'
import { getUriWithOrg } from '@services/config/config'
import { deleteCourseFromBackend, cloneCourse } from '@services/courses/courses'
import { exportCourse, downloadBlob, ExportStatus } from '@services/courses/transfer'
import { exportToast } from '@components/Objects/StyledElements/Toast/ExportToast'
import { getCourseThumbnailMediaDirectory } from '@services/media/media'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { getCourseMetadata } from '@services/courses/courses'
import { BookMinus, FilePenLine, Settings2, MoreVertical, Copy, Download, CheckSquare, Square, Lock } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import Link from 'next/link'
import React from 'react'
import toast from 'react-hot-toast'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu"
import { useTranslation } from 'react-i18next'
import { formatDate } from '@/lib/format'
import { useLHAnalytics, AnalyticsEvent } from '@services/analytics'
import { CourseCover, CourseCardShape, SCARD_ICON, useFavoriteCourse } from './CourseCardParts'

type Course = {
  course_uuid: string
  name: string
  description: string
  thumbnail_image: string
  org_id: string | number
  update_date: string
  public?: boolean
  published?: boolean
  tags?: string | null
  authors?: Array<{
    user: {
      id: string
      user_uuid: string
      avatar_image: string
      first_name: string
      last_name: string
      username: string
    }
    authorship: 'CREATOR' | 'CONTRIBUTOR' | 'MAINTAINER' | 'REPORTER'
    authorship_status: 'ACTIVE' | 'INACTIVE' | 'PENDING'
  }>
}

type PropsType = {
  course: Course
  orgslug: string
  customLink?: string
  isDashboard?: boolean
  isSelected?: boolean
  onToggleSelect?: (_courseUuid: string) => void
  isPriority?: boolean
}

export const removeCoursePrefix = (course_uuid: string) => course_uuid.replace('course_', '')

function CourseThumbnail({ course, orgslug, customLink, isDashboard = false, isSelected = false, onToggleSelect, isPriority = false }: PropsType) {
  const { t, i18n } = useTranslation()
  const org = useOrg() as any
  const session = useLHSession() as any
  const queryClient = useQueryClient()
  const { track } = useLHAnalytics('learner')

  const cleanUuid = removeCoursePrefix(course.course_uuid)

  const handleCardOpen = () => {
    track(AnalyticsEvent.CourseCardOpened, {
      course_uuid: cleanUuid,
      source: isDashboard ? 'dashboard' : 'catalog',
    })
  }

  // Prefetch course meta on hover so the course page feels instant
  const handleMouseEnter = () => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.courses.meta(cleanUuid),
      queryFn: () => getCourseMetadata(cleanUuid, {}, session?.data?.tokens?.access_token, { slim: true }),
      staleTime: 60_000,
    })
  }

  const handleSelectClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onToggleSelect?.(course.course_uuid)
  }

  const activeAuthors = course.authors?.filter(author => author.authorship_status === 'ACTIVE') || []

  const deleteCourse = async () => {
    const toastId = toast.loading(t('courses.deleting_course'))
    try {
      await deleteCourseFromBackend(course.course_uuid, session.data?.tokens?.access_token)
      queryClient.invalidateQueries({ queryKey: ['courses'] })
      toast.success(t('courses.course_deleted_success'))
    } catch (_error) {
      toast.error(t('courses.course_deleted_error'))
    } finally {
      toast.dismiss(toastId)
    }
  }

  const handleCloneCourse = async () => {
    const toastId = toast.loading(t('courses.cloning_course'))
    try {
      const result = await cloneCourse(course.course_uuid, session.data?.tokens?.access_token)
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['courses'] })
        toast.success(t('courses.course_cloned_success'))
      } else {
        toast.error(result.HTTPmessage || t('courses.course_cloned_error'))
      }
    } catch (_error) {
      toast.error(t('courses.course_cloned_error'))
    } finally {
      toast.dismiss(toastId)
    }
  }

  const handleExportCourse = async () => {
    const toastId = exportToast.start('single', course.name)

    try {
      const blob = await exportCourse(
        course.course_uuid,
        session.data?.tokens?.access_token,
        (progress, status) => {
          exportToast.update(toastId, status as ExportStatus, progress, course.name, undefined, 'single')
        }
      )
      const timestamp = new Date().toISOString().split('T')[0]
      downloadBlob(blob, `${course.name.replace(/[^a-z0-9]/gi, '_')}-${timestamp}.zip`)
      exportToast.complete(toastId, course.name, undefined, 'single')
    } catch (error: any) {
      exportToast.error(toastId, error.message || t('courses.course_exported_error'), course.name, undefined, 'single')
    }
  }

  const thumbnailImage = course.thumbnail_image
    ? getCourseThumbnailMediaDirectory(org?.org_uuid, course.course_uuid, course.thumbnail_image)
    : ''

  const courseLink = customLink ? customLink : getUriWithOrg(orgslug, `/course/${removeCoursePrefix(course.course_uuid)}`)

  const [favorite, toggleFavorite] = useFavoriteCourse(course.course_uuid)

  const leadAuthor = activeAuthors[0]?.user
  const leadAuthorName = leadAuthor
    ? [leadAuthor.first_name, leadAuthor.last_name].filter(Boolean).join(' ') || leadAuthor.username
    : ''
  const tags = (course.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean)
  const statusBadge = isDashboard
    ? { label: course.published ? t('courses.published') : t('courses.unpublished'), off: !course.published }
    : tags[0]
      ? { label: tags[0], off: false }
      : null
  const extraTags = (isDashboard ? tags : tags.slice(1)).slice(0, 2)

  return (
    <div onMouseEnter={handleMouseEnter} className={`scard group ${isSelected ? 'scard--selected' : ''}`}>
      <CourseCardShape className="scard__body">
        <Link prefetch={false} href={courseLink} onClick={handleCardOpen} className="scard__link" aria-label={course.name} />
        <div className="scard__head">
          <div className="scard__thumb">
            {thumbnailImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbnailImage}
                alt=""
                loading={isPriority ? 'eager' : 'lazy'}
                fetchPriority={isPriority ? 'high' : undefined}
              />
            ) : (
              <CourseCover seed={course.course_uuid} />
            )}
          </div>
          <div className="scard__info">
            <h3 className="scard__title" dir="auto">{course.name}</h3>
            {leadAuthorName && <p className="scard__author" dir="auto">{leadAuthorName}</p>}
            {(statusBadge || extraTags.length > 0) && (
              <div className="scard__meta">
                {statusBadge && <span className={`scard__badge ${statusBadge.off ? 'scard__badge--off' : ''}`}>{statusBadge.label}</span>}
                {extraTags.length > 0 && (
                  <span className="scard__nums">
                    {extraTags.map((tag, i) => (
                      <React.Fragment key={tag}>
                        {i > 0 && <i className="scard__dot" />}
                        {tag}
                      </React.Fragment>
                    ))}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="scard__divider" />
        <div className="scard__foot">
          <div className="scard__stats">
            {course.update_date && (
              <span className="kstat" title={t('common.updated')}>
                <span className="kicon">{SCARD_ICON.cal}</span>
                {formatDate(course.update_date, i18n.language, { dateStyle: undefined, month: 'short', day: 'numeric' })}
              </span>
            )}
            {activeAuthors.length > 0 && (
              <span className="kstat" title={t('courses.card_authors')}>
                <span className="kicon">{SCARD_ICON.users}</span>
                {activeAuthors.length}
              </span>
            )}
          </div>
          <AdminEditOptions
            course={course}
            orgSlug={orgslug}
            deleteCourse={deleteCourse}
            cloneCourse={handleCloneCourse}
            exportCourse={handleExportCourse}
            isDashboard={isDashboard}
          />
          <span className="scard__go" aria-hidden="true">{SCARD_ICON.arrow}</span>
        </div>
      </CourseCardShape>

      <button
        type="button"
        className="scard__fav"
        aria-pressed={favorite}
        aria-label={favorite ? t('courses.remove_from_favorites', { name: course.name }) : t('courses.add_to_favorites', { name: course.name })}
        onClick={toggleFavorite}
      >
        {SCARD_ICON.heart}
      </button>

      {/* Selection checkbox, dashboard only */}
      {isDashboard && onToggleSelect && (
        <button
          type="button"
          onClick={handleSelectClick}
          aria-pressed={isSelected}
          aria-label={isSelected ? 'Deselect course' : 'Select course'}
          className="scard__act scard__select"
        >
          {isSelected ? <CheckSquare /> : <Square />}
        </button>
      )}
    </div>
  )
}

const AdminEditOptions = ({ course, orgSlug, deleteCourse, cloneCourse, exportCourse, isDashboard = false }: {
  course: Course
  orgSlug: string
  deleteCourse: () => Promise<void>
  cloneCourse: () => Promise<void>
  exportCourse: () => Promise<void>
  isDashboard?: boolean
}) => {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = React.useState(false)
  const [accessOpen, setAccessOpen] = React.useState(false)

  return (
    <AuthenticatedClientElement
      action="update"
      ressourceType="courses"
      checkMethod="roles"
      orgId={course.org_id}
    >
      <div className={`relative z-20 shrink-0 transition-opacity ${
        isDashboard && !isOpen ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'
      }`}>
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="Course actions" className="scard__act">
              <MoreVertical size={18} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem asChild>
              <Link prefetch={false} href={getUriWithOrg(orgSlug, `/dash/courses/course/${removeCoursePrefix(course.course_uuid)}/content`)} className="flex items-center cursor-pointer">
                <FilePenLine className="me-2 h-4 w-4" /> {t('courses.edit_content')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link prefetch={false} href={getUriWithOrg(orgSlug, `/dash/courses/course/${removeCoursePrefix(course.course_uuid)}/general`)} className="flex items-center cursor-pointer">
                <Settings2 className="me-2 h-4 w-4" /> {t('common.settings')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <ConfirmationModal
                confirmationButtonText={t('courses.clone_course')}
                confirmationMessage={t('courses.clone_course_confirm')}
                dialogTitle={t('courses.clone_course_title', { name: course.name })}
                dialogTrigger={
                  <button className="w-full text-start flex items-center px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors">
                    <Copy className="me-2 h-4 w-4" /> {t('courses.clone_course')}
                  </button>
                }
                functionToExecute={cloneCourse}
                status="info"
              />
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <button
                onClick={exportCourse}
                className="w-full text-start flex items-center px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
              >
                <Download className="me-2 h-4 w-4" /> {t('courses.export_course')}
              </button>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <button
                onClick={() => setAccessOpen(true)}
                className="w-full text-start flex items-center px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
              >
                <Lock className="me-2 h-4 w-4" /> {t('library.manage_access')}
              </button>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <ConfirmationModal
                confirmationButtonText={t('courses.delete_course')}
                confirmationMessage={t('courses.delete_course_confirm')}
                dialogTitle={t('courses.delete_course_title', { name: course.name })}
                dialogTrigger={
                  <button className="w-full text-start flex items-center px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors">
                    <BookMinus className="me-2 h-4 w-4" /> {t('courses.delete_course')}
                  </button>
                }
                functionToExecute={deleteCourse}
                status="warning"
              />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Modal
          isDialogOpen={accessOpen}
          onOpenChange={setAccessOpen}
          minHeight="no-min"
          minWidth="md"
          dialogTitle={t('library.manage_access')}
          dialogContent={
            <ManageAccessPopover
              resource_uuid={course.course_uuid}
              resourceType="courses"
              orgslug={orgSlug}
            />
          }
        />
      </div>
    </AuthenticatedClientElement>
  )
}

export default CourseThumbnail
