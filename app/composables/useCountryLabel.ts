import { countryName } from '#shared/reports'

/** ISO 3166 alpha-2 code → flag emoji (regional indicator pair). */
export function countryFlag(code: string | null | undefined): string {
    if (!code || !/^[A-Za-z]{2}$/.test(code)) return ''
    return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1f1e6 + c.charCodeAt(0) - 65))
}

/** "🇪🇸 España" */
export function countryLabel(code: string | null | undefined): string {
    const flag = countryFlag(code)
    return flag ? `${flag} ${countryName(code)}` : countryName(code)
}
