export function classify(
  request: {method: string; mode: string; destination: string; url: string},
  origin: string,
  precached: ReadonlySet<string>,
): 'network' | 'navigate' | 'precache' | 'swr'
