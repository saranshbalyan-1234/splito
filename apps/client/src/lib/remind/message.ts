import {formatAmount} from '@splito/domain'

/**
 * The friendly reminder text (F-1118). Pure: the words come in as `RemindWords` (translated by the caller,
 * `words.ts`), so this is tested in plain English and F-1501 reuses the same builder. Amounts are listed
 * per currency and never summed across currencies.
 */
export interface RemindWords {
  /** "Hi Riya," */
  greeting(name: string): string
  /** "A friendly reminder from Splito: you owe me ₹450.00 for Goa." */
  oweOne(amount: string, group: string | null): string
  /** "A friendly reminder from Splito: you owe me" (the amounts follow, one per line). */
  oweMany(group: string | null): string
  /** "Pay by UPI to me@upi:" (the link follows). */
  payUpi(upiId: string): string
  /** "Pay here:" (the link follows). */
  payLink(): string
  thanks(): string
}

export interface RemindInput {
  /** The friend's name. */
  name: string
  /** What they owe me, per currency, as positive minor units. */
  amounts: Record<string, bigint>
  groupName?: string | null
  locale: string
  /** My UPI id; a `upi://pay` link is added when rupees are owed. */
  upi?: {id: string; link: string} | null
  /** A payment link I gave (for instance a PayPal.me or bank page); added as a line. */
  paymentLink?: string | null
  words: RemindWords
}

/** Currencies in a stable order (code order), so a message never changes between two builds of the same debt. */
export function sortedAmounts(amounts: Record<string, bigint>): Array<[string, bigint]> {
  return Object.entries(amounts).sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0))
}

export function buildRemindMessage({name, amounts, groupName = null, locale, upi = null, paymentLink = null, words}: RemindInput): string {
  const lines = sortedAmounts(amounts).map(([currency, amount]) => formatAmount(amount, currency, locale))
  if (lines.length === 0) throw new Error('nothing is owed')
  const out = [words.greeting(name)]
  if (lines.length === 1) out.push(words.oweOne(lines[0]!, groupName))
  else out.push(words.oweMany(groupName), ...lines.map(line => `• ${line}`))
  if (upi && amounts.INR !== undefined) out.push('', words.payUpi(upi.id), upi.link)
  if (paymentLink) out.push('', words.payLink(), paymentLink)
  out.push('', words.thanks())
  return out.join('\n')
}

/** `https://wa.me/<digits>?text=...` for a phone number in any common spelling; null when it has no digits. */
export function whatsappUrl(phone: string | null | undefined, text: string): string | null {
  const digits = (phone ?? '').replace(/\D/g, '')
  return digits.length >= 6 ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : null
}

/**
 * Drops the payee name (`pn`) from a `upi://pay` link while my name is still the setup placeholder ("Me" or
 * empty): a friend would see "Pay Me" in their UPI app. A real name stays.
 */
export function upiLinkWithoutPlaceholderName(link: string, myName: string): string {
  const name = myName.trim()
  return name === '' || name === 'Me' ? link.replace(/([?&])pn=[^&]*&?/, '$1').replace(/[?&]$/, '') : link
}
