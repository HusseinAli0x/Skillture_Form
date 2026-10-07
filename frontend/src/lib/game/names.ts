import type { Locale } from '../../context/LanguageStore';

const EN_ADJECTIVES = [
  'Sneaky', 'Fluffy', 'Turbo', 'Cosmic', 'Captain', 'Ninja', 'Sleepy', 'Mighty', 'Wobbly', 'Spicy',
  'Lucky', 'Grumpy', 'Zesty', 'Giant', 'Tiny', 'Crispy', 'Funky', 'Brave', 'Chill', 'Sassy',
];
const EN_NOUNS = [
  'Falcon', 'Panda', 'Pickle', 'Waffle', 'Camel', 'Koala', 'Dragon', 'Taco', 'Penguin', 'Sphinx',
  'Falafel', 'Hummus', 'Gazelle', 'Octopus', 'Muffin', 'Rocket', 'Walrus', 'Cactus', 'Llama', 'Noodle',
];

// Masculine adjective + masculine noun, so the pair always agrees.
const AR_ADJECTIVES = ['سريع', 'ذكي', 'شجاع', 'نعسان', 'مرح', 'خفي', 'عملاق', 'مشاغب', 'هادئ', 'مبتسم', 'غريب', 'قوي'];
const AR_NOUNS = ['صقر', 'جمل', 'تنين', 'بطريق', 'فهد', 'نمر', 'غزال', 'صاروخ', 'دلفين', 'ثعلب', 'أسد', 'بطل'];

/** A silly, harmless nickname, e.g. "Spicy Falcon" or "صقر سريع". */
export function randomNickname(locale: Locale, rand: () => number = Math.random): string {
  const adjectives = locale === 'ar' ? AR_ADJECTIVES : EN_ADJECTIVES;
  const nouns = locale === 'ar' ? AR_NOUNS : EN_NOUNS;
  const a = adjectives[Math.floor(rand() * adjectives.length)];
  const n = nouns[Math.floor(rand() * nouns.length)];
  return locale === 'ar' ? `${n} ${a}` : `${a} ${n}`;
}
