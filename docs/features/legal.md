# Legal pages and consent

## What the site now has
- Pages `/privacy` (Privacy Policy), `/terms` (Terms of Use), `/consent` (consent to personal-data processing), `/offer` (Public Offer for paid courses) and `/contacts`, in Russian and English (RU/EN switch on each page; the interface language picks the default). The Russian text is the binding one.
- A footer row with the five links and the operator's name on every organisation page; the "By continuing you agree to the Terms and Privacy Policy" line on the login and sign-up pages (it was hidden before because it needed a platform URL).
- A short cookie notice (necessary cookies and our own analytics only), dismissed once per browser.
- Sign-up (open and invite-only) has two required checkboxes: Terms + Privacy Policy, and consent to personal-data processing. The Google button on the sign-up page stays disabled until both are ticked.
- The accepted version and time are stored on the user: `user.legal_consent_version`, `user.legal_consent_at`.

## Where the texts live
- `apps/web/lib/legal/content.ts` - all texts (RU and EN) with placeholders.
- `apps/web/lib/legal/operator.ts` - who the operator is: name, INN, OGRNIP, address, e-mail. While a field is empty the pages show a visible DRAFT banner and print the missing value in brackets. Fill them before publishing.
- `apps/web/lib/legal/version.ts` - `LEGAL_VERSION` (YYYY-MM-DD). Bump it when the meaning of a text changes; it is sent with each sign-up.
- Readable previews for review: run `bun run render-legal.ts` style script or open `legal-drafts-ru.txt` / `legal-drafts-en.txt` on the owner's Desktop.

## Backend
- `UserCreate.legal_version` (optional, `YYYY-MM-DD`); `services/users/legal_consent.py` validates it and stamps the user.
- With `LEARNHOUSE_REQUIRE_LEGAL_CONSENT=true` a public password sign-up without a version is refused (HTTP 422, code `LEGAL_CONSENT_REQUIRED`). OAuth sign-ups and users created by a signed-in admin are not forced to send it.
- The Next.js gateway `app/api/signup/route.ts` forwards `legal_version`.
- Tests: `apps/api/src/tests/services/test_legal_consent.py`.

## Database
New columns on `user`; the app does not add columns to existing tables, so on a server that already has the table run once before deploying (also in Alembic revision `e2f3a4b5c6d7`):
```
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS legal_consent_version varchar(16);
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS legal_consent_at varchar;
```

## Settings
`LEARNHOUSE_REQUIRE_LEGAL_CONSENT=true` in `.env` (see `deploy/stack/env.example`).

## Known gaps
- Accounts created by "Sign in with Google" have no stored consent version (the Google flow creates the account outside the sign-up form). The login page shows the "By continuing you agree" line.
- The texts are drafts written from the platform's real behaviour; have a lawyer review them. In particular check: refund rules in the offer (14 days / 20% default), retention periods (backups 60 days, analytics 365 days), the list of recipients and the cross-border paragraph.
- The operator must notify Roskomnadzor that it processes personal data (done on their site by the owner).
- Payments: no payment service is named yet; the platform's payment code is built around Stripe. Name the real provider on the payment page and in the offer once chosen.
- Backups: the policy promises deletion within 60 days; deleting old backups is manual (the backup key cannot delete), so clean `daily/` folders monthly.
