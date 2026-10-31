import type { Register } from 'claude-code'

import { toPlainLatin } from './latin'

const USAGE = 'Usage: /wa <draft>, or /wa alone for the last reply.'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'wa',
      description: 'Convert a draft to plain Latin letters and copy it',
      argumentHint: '[draft]',
    })

    return next(e)
  })

  on('command.run', { command: 'wa' }, async ($, e) => {
    let source = e.args.trim()

    if (source === '') {
      const messages = await $.session.messages()
      const reply = Array.isArray(messages)
        ? messages.findLast(message => message.role === 'assistant' && message.text !== '')
        : undefined

      if (reply === undefined) return { text: USAGE }
      source = reply.text
    }

    const text = toPlainLatin(source)
    const { isCopied } = await $.ui.copy({ text })

    return { text: isCopied ? text : `Not copied.\n${text}` }
  })
}
