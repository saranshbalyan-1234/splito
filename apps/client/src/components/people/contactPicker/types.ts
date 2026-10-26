/** One contact from the device: its name and every email and number it has. */
export type PickedContact = {
  name: string
  values: Array<{kind: 'email' | 'phone'; raw: string; label?: string}>
}
