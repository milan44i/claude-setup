const PLAIN: Record<string, string> = {
  ć: 'c',
  č: 'c',
  ž: 'z',
  š: 's',
  đ: 'dj',
  Ć: 'C',
  Č: 'C',
  Ž: 'Z',
  Š: 'S',
}

const isCapital = (char: string | undefined) =>
  char !== undefined && char !== char.toLowerCase() && char === char.toUpperCase()

export const toPlainLatin = (text: string) =>
  Array.from(text)
    .map((char, i, chars) => {
      if (char === 'Đ') return isCapital(chars[i + 1]) ? 'DJ' : 'Dj'

      return PLAIN[char] ?? char
    })
    .join('')
