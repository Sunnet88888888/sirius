# Course language

## What it does
Every course can have a language (`ru`, `en`, `tk`, or any short code like `pt-BR`). Public course lists show visitors the courses in their own language, so a Russian visitor does not see English courses and the other way round. A switch, "Show courses in other languages", shows the rest; the choice is remembered in the browser.

## Rules
- The visitor's language is the interface language: it starts from the browser language and changes with the language switcher.
- A course with no language is shown to everyone.
- A direct link to a course always works, whatever its language.
- Filtered: the public Courses page (including its search), the home page (classic and custom landing, featured courses). Not filtered: the dashboard (authors and admins see everything, with a language label on the card), "my courses" of enrolled students, the sitemap, the API unless asked.
- With the switch on, course cards show their language code.

## Where to set it
- Create course dialog: a Language field, preset to the author's interface language.
- Course settings > General > Course language. "Any language" clears it.

## How it works
- Column `course.language` (varchar 10, nullable, indexed). The code is validated and normalized on write (`normalize_language` in `db/courses/courses.py`): `RU` becomes `ru`, `pt_BR` becomes `pt-BR`, anything else is HTTP 422. On update an empty string clears it.
- API: `GET /courses/org_slug/{org}/page/{p}/limit/{l}?language=ru` and `.../search?language=ru` return courses in that language plus courses without one. Without the parameter nothing changes (API tokens and integrations are unaffected). The anonymous list cache has the language in its key. `POST /courses/` takes an optional `language` form field; `PUT` takes `language` in the body. Cloning a course keeps its language.
- The site itself loads the whole list and filters in the browser (`hooks/useCourseLanguageFilter.ts`), so the switch is instant and search works inside the chosen set.
- Tests: `apps/api/src/tests/services/test_course_language.py`.

## Database
The app creates tables with `create_all`, which does not add columns to existing tables. On a server that already has the table run once (also in Alembic revision `d1e2f3a4b5c6`), before deploying the code:
```
ALTER TABLE course ADD COLUMN IF NOT EXISTS language varchar(10);
CREATE INDEX IF NOT EXISTS ix_course_language ON course (language);
```
Applied on berdinov.com.

## Not included
A link between a course and its translation ("also available in English"), `hreflang` tags, filtering of the library and communities, setting the language during the Stepik import.
