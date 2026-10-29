/** A pasted code ("123 456", "code: 123456") keeps only its digits, at most six. */
export const onlyDigits = (value: string) => value.replace(/\D/g, '').slice(0, 6)
