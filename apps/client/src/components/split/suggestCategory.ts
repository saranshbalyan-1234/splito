/*
 * Offline category suggestion from the expense title: a keyword list per
 * built-in category (English, plus common Hinglish words), then any
 * category whose own name appears in the title.
 * ponytail: word lookup only, no stemming or learning from past expenses; add
 * per-user history once Activity exposes it.
 */
const KEYWORDS: Record<string, string[]> = {
  food: ['dinner', 'lunch', 'breakfast', 'brunch', 'restaurant', 'cafe', 'coffee', 'chai', 'tea', 'pizza', 'burger', 'biryani', 'dosa', 'snacks', 'food', 'meal', 'swiggy', 'zomato', 'bar', 'drinks', 'beer', 'wine', 'dhaba', 'thali', 'sushi', 'takeaway', 'khana', 'dessert', 'icecream'],
  transport: ['cab', 'taxi', 'uber', 'ola', 'auto', 'rickshaw', 'metro', 'train', 'bus', 'flight', 'flights', 'airport', 'fuel', 'petrol', 'diesel', 'parking', 'toll', 'scooter', 'bike', 'car', 'ferry', 'rapido'],
  stay: ['hotel', 'hostel', 'airbnb', 'villa', 'stay', 'room', 'resort', 'homestay', 'lodge', 'booking', 'nights'],
  shopping: ['shopping', 'clothes', 'shoes', 'amazon', 'flipkart', 'myntra', 'gift', 'gifts', 'mall', 'souvenir', 'souvenirs'],
  entertainment: ['movie', 'movies', 'cinema', 'tickets', 'concert', 'show', 'party', 'game', 'games', 'netflix', 'spotify', 'club', 'parasailing', 'museum', 'bowling', 'karaoke'],
  bills: ['rent', 'electricity', 'wifi', 'internet', 'bill', 'bills', 'water', 'gas', 'phone', 'recharge', 'maintenance', 'subscription', 'insurance', 'kiraya', 'bijli'],
  groceries: ['groceries', 'grocery', 'supermarket', 'bigbasket', 'blinkit', 'zepto', 'instamart', 'vegetables', 'fruits', 'milk', 'dmart', 'sabzi', 'doodh', 'kirana'],
}

const WORD_TO_CATEGORY = new Map(
  Object.entries(KEYWORDS).flatMap(([id, words]) => words.map(w => [w, id] as const)),
)

/** Normalises "Wi-Fi" to "wifi" and splits on anything that is not a letter or digit. */
function words(text: string) {
  return text
    .toLowerCase()
    .replace(/[-']/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
}

/**
 * The category id to suggest for `title`, among the person's visible
 * categories, or undefined when nothing matches.
 */
export function suggestCategory(
  title: string,
  categories: ReadonlyArray<{id: string; name: string}>,
): string | undefined {
  const available = new Set(categories.map(c => c.id))
  const byName = new Map(categories.map(c => [c.name.toLowerCase(), c.id]))
  for (const w of words(title)) {
    const id = byName.get(w) ?? WORD_TO_CATEGORY.get(w)
    if (id && available.has(id)) return id
  }
  return undefined
}
