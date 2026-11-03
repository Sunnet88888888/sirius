from typing import List, Optional
from sqlalchemy import Column, Enum as SAEnum, ForeignKey, Index, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel
from enum import Enum
import re
from pydantic import BaseModel, field_validator
from src.db.users import UserReadAuthor
from src.db.trails import TrailRead
from src.db.courses.chapters import ChapterRead
from src.db.resource_authors import ResourceAuthorshipEnum, ResourceAuthorshipStatusEnum


_LANGUAGE_RE = re.compile(r"^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$")


def normalize_language(value: Optional[str]) -> Optional[str]:
    """Course language code: 'ru', 'en', 'pt-BR'... Empty means 'any language' (None).

    The primary subtag is lowercased and a 2-letter region is capitalized, so 'RU' and 'ru', or 'pt-br' and 'pt-BR', are the same language.
    """
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    value = value.replace("_", "-")
    primary, sep, rest = value.partition("-")
    # 2-letter region in capitals ('pt-br' -> 'pt-BR') so one language has one spelling
    if len(rest) == 2 and rest.isalpha():
        rest = rest.upper()
    value = primary.lower() + (f"-{rest}" if sep else "")
    if not _LANGUAGE_RE.match(value):
        raise ValueError("language must be a code like 'ru', 'en' or 'pt-BR'")
    return value


class CourseSEO(BaseModel):
    """SEO configuration for a course stored as JSON"""
    # Basic SEO
    title: Optional[str] = None
    description: Optional[str] = None
    keywords: Optional[str] = None
    canonical_url: Optional[str] = None
    # Open Graph
    og_title: Optional[str] = None
    og_description: Optional[str] = None
    og_image: Optional[str] = None
    # Twitter Card
    twitter_card: Optional[str] = None  # 'summary' | 'summary_large_image'
    twitter_title: Optional[str] = None
    twitter_description: Optional[str] = None
    # Robots & Structured Data
    robots_noindex: bool = False
    robots_nofollow: bool = False
    enable_jsonld: bool = True


class ThumbnailType(str, Enum):
    IMAGE = "image"
    VIDEO = "video"
    BOTH = "both"


class AuthorWithRole(SQLModel):
    # SECURITY: authors are returned to every reader of the resource (anonymous
    # included on public ones), so only the author-chip projection goes out,
    # never email/is_superadmin/signup_method/extra_metadata.
    user: UserReadAuthor
    authorship: ResourceAuthorshipEnum
    authorship_status: ResourceAuthorshipStatusEnum
    creation_date: str
    update_date: str


class CourseBase(SQLModel):
    name: str
    description: Optional[str] = None
    about: Optional[str] = None
    learnings: Optional[str] = None
    tags: Optional[str] = None
    thumbnail_type: Optional[ThumbnailType] = Field(default=ThumbnailType.IMAGE)
    thumbnail_image: Optional[str] = Field(default="")
    thumbnail_video: Optional[str] = Field(default="")
    public: bool
    published: bool = Field(default=False)
    open_to_contributors: bool
    # ISO-style code ('ru', 'en'). None = any language: shown to every visitor.
    language: Optional[str] = Field(default=None, max_length=10, index=True)


class Course(CourseBase, table=True):
    __table_args__ = (
        Index("ix_course_org_public_published_created", "org_id", "public", "published", "creation_date"),
        {"extend_existing": True},
    )
    id: Optional[int] = Field(default=None, primary_key=True)
    thumbnail_type: Optional[ThumbnailType] = Field(
        default=ThumbnailType.IMAGE,
        sa_column=Column(SAEnum(ThumbnailType, name="thumbnail_type"), nullable=True),
    )
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True)
    )
    course_uuid: str = Field(default="", index=True)
    creation_date: str = ""
    update_date: str = ""
    seo: Optional[dict] = Field(default=None, sa_column=Column(JSONB))
    extra_metadata: Optional[dict] = Field(default=None, sa_column=Column(JSONB))


class CourseCreate(CourseBase):
    org_id: int = Field(default=None, foreign_key="organization.id")
    thumbnail_type: Optional[ThumbnailType] = Field(default=ThumbnailType.IMAGE)
    thumbnail_image: Optional[str] = Field(default="")
    thumbnail_video: Optional[str] = Field(default="")
    extra_metadata: Optional[dict] = None

    @field_validator("language")
    @classmethod
    def _check_language(cls, v: Optional[str]) -> Optional[str]:
        return normalize_language(v)


class CourseUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None
    about: Optional[str] = None
    learnings: Optional[str] = None
    tags: Optional[str] = None
    thumbnail_type: Optional[ThumbnailType] = None
    thumbnail_image: Optional[str] = None
    thumbnail_video: Optional[str] = None
    public: Optional[bool] = None
    published: Optional[bool] = None
    open_to_contributors: Optional[bool] = None
    # '' clears the language (course becomes "any language").
    language: Optional[str] = None
    seo: Optional[dict] = None
    extra_metadata: Optional[dict] = None

    @field_validator("language")
    @classmethod
    def _check_language(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            return ""
        return normalize_language(v)


class CourseRead(CourseBase):
    id: int
    org_id: int = Field(default=None, foreign_key="organization.id")
    authors: List[AuthorWithRole]
    course_uuid: str
    creation_date: str
    update_date: str
    thumbnail_type: Optional[ThumbnailType] = Field(default=ThumbnailType.IMAGE)
    thumbnail_image: Optional[str] = Field(default="")
    thumbnail_video: Optional[str] = Field(default="")
    seo: Optional[dict] = None
    extra_metadata: Optional[dict] = None


class FullCourseRead(CourseBase):
    id: int
    org_id: int
    org_uuid: Optional[str] = None
    course_uuid: Optional[str] = None
    creation_date: Optional[str] = None
    update_date: Optional[str] = None
    thumbnail_type: Optional[ThumbnailType] = Field(default=ThumbnailType.IMAGE)
    thumbnail_image: Optional[str] = Field(default="")
    thumbnail_video: Optional[str] = Field(default="")
    seo: Optional[dict] = None
    extra_metadata: Optional[dict] = None
    # Chapters, Activities
    chapters: List[ChapterRead]
    authors: List[AuthorWithRole]
    pass


class FullCourseReadWithTrail(CourseBase):
    id: int
    course_uuid: Optional[str] = None
    creation_date: Optional[str] = None
    update_date: Optional[str] = None
    org_id: int = Field(default=None, foreign_key="organization.id")
    seo: Optional[dict] = None
    extra_metadata: Optional[dict] = None
    authors: List[AuthorWithRole]
    # Chapters, Activities
    chapters: List[ChapterRead]
    # Trail
    trail: TrailRead | None = None
    pass
