import { expect, test } from 'claude-code/testing'

const run = (
  $: { command: { run: (a: { command: string; args?: string }) => Promise<{ text?: string }> } },
  args = '',
) => $.command.run({ command: 'wa', args })

test('every letter converts in both cases and is copied', async ($, on) => {
  const copied: string[] = []

  on('ui.copy', (_, e) => {
    copied.push(e.text)

    return { value: { isCopied: true as const } }
  })

  const cases: Record<string, string> = {
    'ć č ž š đ': 'c c z s dj',
    'Ć Č Ž Š': 'C C Z S',
    'Đorđe': 'Djordje',
    'ĐORĐE': 'DJORDJE',
    'Đ': 'Dj',
    'Đ.': 'Dj.',
    'ĐA': 'DJA',
    'Đa': 'Dja',
    'Šta ćeš, čoveče? Žuto.': 'Sta ces, covece? Zuto.',
    'plain ASCII': 'plain ASCII',
  }

  for (const [input, output] of Object.entries(cases)) {
    expect((await run($, input)).text).toBe(output)
    expect(copied.at(-1)).toBe(output)
  }
})

test('without a draft it converts the last assistant reply', async ($, on) => {
  on('session.messages', () => ({
    value: [
      { role: 'assistant', text: 'Dobro jutro, šefe', toolUses: [] },
      { role: 'user', text: 'ćao', toolUses: [] },
    ],
  }))
  on('ui.copy', () => ({ value: { isCopied: true as const } }))

  expect((await run($)).text).toBe('Dobro jutro, sefe')
})

test('without a draft or a reply it gives one usage line', async ($, on) => {
  on('session.messages', () => ({ value: [] }))

  expect((await run($, '  ')).text).toBe('Usage: /wa <draft>, or /wa alone for the last reply.')
})
