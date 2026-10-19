# Turkmen interface language

## What it does
Turkmen (Türkmen, `tk`, Latin script) is available in the language menu next to the other interface languages. Any text without a Turkmen translation is shown in English.

## Coverage
About 57% of the interface strings are translated (see `docs/i18n/turkmen-review.tsv` for the exact list):
- Complete: common labels, login and sign-up, account and profile, courses and course pages, lessons, assignments (student side), search, certificates, communities (forums), library, roles, time and validation messages.
- Teacher dashboard: navigation, home, course structure/settings/access/contributors, assignments (list, editor, submissions, analytics, create and edit), users, user groups, roles, invitations, dashboard search.
- Not translated yet (shown in English): organization settings (branding, landing page, SEO, domains, SSO, API, audit logs), billing and plans, payments, analytics pages, podcasts, playgrounds, boards, onboarding, import and migration tools, the long help texts in the editor blocks.

## Quality
The text was drafted by an AI model. It has not been reviewed by a native speaker. Known weak spots: technical vocabulary (assignment, submission, grading), word choice between `okuwçy` (pupil) and `talyp` (student), and long explanatory sentences. Use `docs/i18n/turkmen-review.tsv` (key, English, Turkmen) to review and send corrections.

## Files
- `lms/apps/web/locales/tk.json`: the translation.
- `lms/apps/web/lib/languages.ts` and `lib/i18n.ts`: registration (language list and lazy loader).
- `common.turkmen` (the language name) was added to `en.json`, `ru.json`, `ar.json`; other locales fall back to English for that one label.

## Terminology used
course = kurs, lesson/activity = sapak, chapter = bölüm, assignment/task = tabşyryk, submit = tabşyrmak, grade = baha, student = okuwçy, teacher = mugallym, dashboard = dolandyryş paneli, settings = sazlamalar, sign in = girmek, sign up = hasaba durmak, password = parol, e-mail = e-poçta.

## Rollback
Remove the `tk` entries from `lib/languages.ts` and `lib/i18n.ts`; the language disappears from the menu. Users who had picked it fall back to English.
