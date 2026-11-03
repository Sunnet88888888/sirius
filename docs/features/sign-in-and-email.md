# Sign-up, email and Google sign-in

## Sign-up
After a successful sign-up (open or invite-only) a user whose email is verified is signed in at once with the password just typed and sent to `?next` or `/home`. If that automatic sign-in fails, or the email still has to be verified, the old message with a link to the login page is shown. Code: `services/auth/signInAfterSignup.ts`, used by `app/auth/signup/OpenSignup.tsx` and `InviteOnlySignUp.tsx`. In open-source mode (our case) emails are verified automatically.

## Email (forgot password, magic links)
The platform sends mail through Resend or SMTP, chosen in `.env` (`deploy/stack/env.example` lists the variables). Settings are read at start, so restart the app after changing them.
- Forgot password: `/forgot` asks for the email, the server sends an 8-character code valid for one hour, `/reset` takes the code and the new password. The API always answers the same, whether or not the account exists.
- Resend: the From address must be on a domain verified in Resend (DNS records: DKIM, SPF, MX for the sending subdomain). A key with "Sending access" is enough for the app. Until a domain is verified, only `onboarding@resend.dev` works, and only for the Resend account owner's address.
- Check: send a code and look at the app log for `Password reset code sent` and the absence of an email error.

## Google sign-in
Needs `LEARNHOUSE_GOOGLE_CLIENT_ID` and `LEARNHOUSE_GOOGLE_CLIENT_SECRET`. In Google Cloud Console: OAuth client of type "Web application", authorized JavaScript origin `https://<domain>`, redirect URI `https://<domain>/auth/callback/google`. The consent screen must be published ("In production") or only listed test users can sign in; with only the `openid`, `email` and `profile` scopes no Google review is needed. The button shows when the organization allows the `google` method.

## State on berdinov.com
Resend key and Google client are set. The sender is `noreply@mail.berdinov.com` (domain verified in Resend; the DNS records are on the berdinov.com zone). Google consent screen is published. Checked: Resend accepted a send from that address and the reset API logged a sent code. Still to check in practice: arrival and spam placement at Gmail, Yandex and mail.ru addresses of other users.
