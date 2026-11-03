import { signIn } from '@components/Contexts/AuthContext'

/**
 * Signs a user in right after they created an account, with the credentials they just typed.
 * Returns false (never throws) when it did not work, so the caller can fall back to the
 * "go to the login page" message.
 */
export async function signInAfterSignup(opts: {
  email: string
  password: string
  orgSlug?: string
  callbackUrl: string
}): Promise<boolean> {
  try {
    const res: any = await signIn('credentials', {
      redirect: false,
      email: opts.email,
      password: opts.password,
      orgSlug: opts.orgSlug,
      callbackUrl: opts.callbackUrl,
    })
    return !!res && !res.error && !res.mfa_required
  } catch {
    return false
  }
}
