// Limited, manually reviewed set of Cyrillic/Greek characters resembling Latin.
// Not the complete Unicode UTS #39 confusables.txt dataset.
// Deliberately no transliteration of arbitrary foreign-language words.
export const LATIN_LOOKALIKES = Object.freeze({
  // Cyrillic: common IDN spoofing characters (uppercase and lowercase).
  "А":"a", "а":"a", "В":"b", "в":"b", "С":"c", "с":"c",
  "Е":"e", "е":"e", "Н":"h", "н":"h", "І":"i", "і":"i",
  "Ј":"j", "ј":"j", "К":"k", "к":"k", "М":"m", "м":"m",
  "О":"o", "о":"o", "Р":"p", "р":"p", "Ѕ":"s", "ѕ":"s",
  "Т":"t", "т":"t", "У":"y", "у":"y", "Х":"x", "х":"x",
  "Ү":"y", "ү":"y", "ԁ":"d", "Ԍ":"g", "ԍ":"g", "ԛ":"q",
  "ѡ":"w", "ѵ":"v", "һ":"h", "ԝ":"w", "Ԝ":"w",
  "ӏ":"l", "Ӏ":"l", "ӑ":"a", "ӗ":"e", "ӧ":"o",
  "ԛ":"q", "ӽ":"x", "ӿ":"x", "ԃ":"d", "Ԃ":"d",
  // Greek: shapes that are commonly confused with Latin glyphs.
  "Α":"a", "Β":"b", "Ε":"e", "Ζ":"z", "Η":"h",
  "Ι":"i", "Κ":"k", "Μ":"m", "Ν":"n", "Ο":"o",
  "Ρ":"p", "Τ":"t", "Υ":"y", "Χ":"x",
  "ο":"o", "ρ":"p", "ν":"v", "ι":"i", "ϲ":"c", "Ϲ":"c",
  "ϳ":"j", "τ":"t", "χ":"x", "α":"a", "κ":"k"
});
