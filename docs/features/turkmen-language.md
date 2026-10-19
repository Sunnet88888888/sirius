# Turkmen interface language

## What it does
Turkmen (Türkmen, `tk`, Latin script) is available in the language menu next to the other interface languages. Any text without a Turkmen translation is shown in English.

## Coverage
Every interface string has a Turkmen translation (5,212 of 5,212 keys). About 500 of them reuse the translation of an identical English string from another screen; a few names stay as they are (YouTube, Markdown, SCORM, API). The exact list is in `docs/i18n/turkmen-review.tsv`.

## Quality
The text was drafted by an AI model. It has not been reviewed by a native speaker. Known weak spots: strings that reuse the translation of an identical English string in a different context, technical vocabulary (assignment, submission, grading), word choice between `okuwçy` (pupil) and `talyp` (student), and long explanatory sentences. Use `docs/i18n/turkmen-review.tsv` (key, English, Turkmen) to review and send corrections.

## Files
- `lms/apps/web/locales/tk.json`: the translation.
- `lms/apps/web/lib/languages.ts` and `lib/i18n.ts`: registration (language list and lazy loader).
- `common.turkmen` (the language name) was added to `en.json`, `ru.json`, `ar.json`; other locales fall back to English for that one label.

## Terminology used
course = kurs, lesson/activity = sapak, chapter = bölüm, assignment/task = tabşyryk, submit = tabşyrmak, grade = baha, student = okuwçy, teacher = mugallym, dashboard = dolandyryş paneli, settings = sazlamalar, sign in = girmek, sign up = hasaba durmak, password = parol, e-mail = e-poçta.

## Rollback
Remove the `tk` entries from `lib/languages.ts` and `lib/i18n.ts`; the language disappears from the menu. Users who had picked it fall back to English.
