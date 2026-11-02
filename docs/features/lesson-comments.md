# Lesson comments (formatted)

## What it does
Under each lesson students and teachers discuss in comments and replies (one level deep, votes, pinning, notifications). Comments can now be formatted: bold, italic, inline code, links, bulleted and numbered lists, and code blocks with syntax highlighting. Ctrl/Cmd+Enter sends. The limit is 2000 characters of visible text (formatting does not count).

## How it works
- A formatted comment is stored as a Tiptap/ProseMirror JSON document in `activitycomment.content`, with `content_format = 'tiptap'`. Older comments keep `content_format = 'text'` and show as plain text.
- The server never stores what the browser sends as-is. `comment_rich_text.py` rebuilds the document from a whitelist: nodes `doc, paragraph, text, hardBreak, bulletList, orderedList, listItem, codeBlock`; marks `bold, italic, code, link`; links only `http://`, `https://`, `mailto:`; limits on depth, node count and size. Anything else gives HTTP 422. The visible text it extracts is used for the length limit, the empty check and notification previews.
- The page draws the JSON as React elements (`CommentRichText.tsx`); no HTML from users is inserted into the page. Links open in a new tab with `rel="noopener noreferrer nofollow ugc"`. The editor (`CommentEditor.tsx`, Tiptap) is downloaded only when someone starts writing.
- API: `POST /comments/activity/{activity_uuid}` and `PUT /comments/{comment_uuid}` accept `content_format` (`text` default, or `tiptap`; on edit, omitted keeps the current format). Responses include `content_format`.
- Tests: `apps/api/src/tests/services/test_comment_rich_text.py`.

## Database
New column `activitycomment.content_format` (varchar 16, default `text`). The app creates tables with `create_all`, which does not add columns to existing tables, so on a server that already has the table run once (also in Alembic revision `c9d8e7f6a5b4`):
```
ALTER TABLE activitycomment ADD COLUMN IF NOT EXISTS content_format varchar(16) NOT NULL DEFAULT 'text';
```
Run it before deploying the code that reads the column. It is already applied on berdinov.com.

## Not included
Headings, tables, images, files, mentions, emoji; community discussions and assignment feedback still use plain text.
