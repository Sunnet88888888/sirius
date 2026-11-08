# Rich course About

The About block of a course (Dashboard > Course > General) is edited with a small Tiptap editor and shown formatted on the course page.

- Formatting: bold, italic, headings (H2/H3), bullet and numbered lists, quotes, links, images.
- Storage: the existing `course.about` string column. New content is a Tiptap JSON document; older plain-text values still display (as paragraphs) and are converted on first edit. No migration.
- Images: `POST /courses/{course_uuid}/about-image` (multipart field `image`, images only, 10 MB max, needs UPDATE rights on the course). Files go to `content/orgs/{org}/courses/{course}/about/`. The document stores only the file name; the URL is built when rendering.
- Code: `apps/web/lib/aboutContent.ts` (parsing, image node), `apps/web/components/Objects/Courses/CourseAbout/CourseAboutEditor.tsx` (editor and read-only view).
- Not included: callouts, code blocks, video. Text search still matches the raw stored JSON, as it already does for `learnings`.
