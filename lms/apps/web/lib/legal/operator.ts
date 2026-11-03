/**
 * Who runs the site (the "operator" of personal data and the seller). Shown in the legal texts, the footer
 * and the contacts page. Fill every field before publishing: while one is empty the legal pages show a
 * visible "draft" banner.
 */
export type Lang = 'ru' | 'en'

export const OPERATOR = {
  site: 'berdinov.com',
  name: {
    ru: 'ИП Бердинов Фархад',
    en: 'Sole proprietor Farkhad Berdinov',
  } as Record<Lang, string>,
  /** ИНН (tax id), 12 digits for an individual entrepreneur */
  inn: '',
  /** ОГРНИП, 15 digits */
  ogrnip: '',
  /** Postal / registration address */
  address: { ru: '', en: '' } as Record<Lang, string>,
  /** Public contact e-mail for requests about personal data and support */
  email: '',
}

export function missingOperatorFields(): string[] {
  const missing: string[] = []
  if (!OPERATOR.inn) missing.push('inn')
  if (!OPERATOR.ogrnip) missing.push('ogrnip')
  if (!OPERATOR.address.ru || !OPERATOR.address.en) missing.push('address')
  if (!OPERATOR.email) missing.push('email')
  return missing
}

export const isOperatorComplete = () => missingOperatorFields().length === 0
