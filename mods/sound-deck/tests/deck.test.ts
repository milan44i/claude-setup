import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const HOME = '/fake/home'
const CANNON = { asset: 'sounds/cannon.wav' }
const HORN = { asset: 'sounds/horn.wav' }
const ALARM = { asset: 'sounds/alarm.wav' }

const MERGED_LOCAL = 'merged fm/x into local main (a -> b) in /p\n'
const MERGED_PR = 'verified: https://github.com/o/r/pull/1 is merged (state=MERGED, merged=true)\n'
const QUEUED_PR = 'verified: https://github.com/o/r/pull/1 is queued (state=OPEN, merged=false)\n'
const AXI_MERGED = 'merged:\n  number: 1\n  status: ok\n  method: squash\n'
const AXI_ALREADY = 'pull_request:\n  number: 1\n  state: merged\n'
const PAGES_DONE = '✨ Deployment complete! Take a peek over at https://x.pages.dev\n'
const WORKER_DONE = 'Deployed x triggers (1.2 sec)\nCurrent Version ID: abc\n'
const REFUSED = 'error: task x is still held for the captain\n'
const DEPLOY_ERROR = '✘ [ERROR] A request to the Cloudflare API failed.\n'
const AXI_RED = 'summary: "3 passed, 1 failed, 4 total"\nchecks[2]{name,conclusion}:\n  lint,pass\n  build,fail\n'
const AXI_GREEN = 'summary: "4 passed, 0 failed, 4 total"\nchecks[2]{name,conclusion}:\n  fail-fast,pass\n  build,pass\n'
const RAW_RED = 'lint\tpass\t10s\thttps://x\nbuild\tfail\t1m\thttps://x\n'
const RAW_GREEN = 'fail-fast\tpass\t10s\thttps://x\n'
const HEALTH_RED = 'pr-health: https://github.com/o/r/pull/1 has failing required checks at abc: lint (task x)'
const HEALTH_CONFLICT = 'pr-health: https://github.com/o/r/pull/1 conflicts with its base at abc (task x)'
const DRAIN = 'bin/fm-wake-drain.sh'

const drained = (row: string) => `1793445010\t11425\tcheck\tkey\tcheck: ${row}\nWAKE_ACK_REQUIRED: run it\n`

type Answer = { text: string; isError?: true; backgroundTaskId?: string; interrupted?: boolean }

const world = (on: On, answer: Answer, root = HOME, canPlay = true) => {
  const played: unknown[] = []

  on('session.root', () => ({ value: root }))
  on('fs.exists', (_, e) => ({ value: e.path === `${HOME}/bin/fm-crew-state.sh` }))
  on('fs.stat', (_, e) => {
    if (e.path !== `${HOME}/state`) return { deny: 'ENOENT' }

    return { value: { kind: 'dir' as const, size: 0, mtimeMs: 0, isLink: false } }
  })
  on('audio.play', (_, e) => {
    if (!canPlay) return { deny: 'no player' }

    played.push(e.clip)

    return { value: undefined }
  })
  on('tool.call', () =>
    answer.isError === true
      ? { isError: true as const, result: answer.text, text: answer.text }
      : {
          text: answer.text,
          result: {
            stdout: answer.text,
            stderr: '',
            interrupted: answer.interrupted ?? false,
            backgroundTaskId: answer.backgroundTaskId,
          },
        },
  )

  return played
}

const bash = ($: Engine, command: string) => $.tool.call({ tool: 'Bash', command })

const SUCCESSES: readonly (readonly [string, string, unknown])[] = [
  ['bin/fm-merge-local.sh x', MERGED_LOCAL, CANNON],
  ['/h/bin/fm-merge-local.sh x 2>&1 | tail -4', MERGED_LOCAL, CANNON],
  ['export FM_HOME=/h; $FM_HOME/bin/fm-merge-local.sh x 2>&1 | tail -2; git -C /p log -1', MERGED_LOCAL, CANNON],
  ['( cd /h && bin/fm-merge-local.sh x )', '', CANNON],
  ['bin/fm-pr-merge.sh https://github.com/o/r/pull/1', MERGED_PR, CANNON],
  ['bin/fm-pr-merge.sh https://github.com/o/r/pull/1 2>&1 | tail -1', MERGED_PR, CANNON],
  ['gh pr merge 1 --squash', '', CANNON],
  ['cd /p && gh pr merge 1 --squash --delete-branch', '', CANNON],
  ['npx gh-axi pr merge 1 --squash', AXI_MERGED, CANNON],
  ['npx -y gh-axi pr merge 1 --squash 2>&1 | head -5', AXI_MERGED, CANNON],
  ['wrangler deploy', WORKER_DONE, HORN],
  ['npx wrangler deploy 2>&1 | tail -3', WORKER_DONE, HORN],
  ['npx wrangler pages deploy dist --project-name=x 2>&1 | tail -4', PAGES_DONE, HORN],
  ['pnpm build >/dev/null 2>&1 && npx wrangler pages deploy dist', PAGES_DONE, HORN],
  ['git push; pnpm exec wrangler pages deploy dist 2>&1 | tail -2; echo done', PAGES_DONE, HORN],
  ['npx wrangler deploy >/dev/null 2>&1 && echo ok', 'ok\n', HORN],
  ["# don't skip this\nwrangler deploy", '', HORN],
]

for (const [command, output, sound] of SUCCESSES) {
  test(`a success plays one sound: ${command}`, async ($, on) => {
    const played = world(on, { text: output })

    await bash($, command)

    expect(played).toEqual([sound])
  })
}

const FAILURES: readonly (readonly [string, string])[] = [
  ['bin/fm-merge-local.sh x', REFUSED],
  ['bin/fm-pr-merge.sh https://github.com/o/r/pull/1', REFUSED],
  ['gh pr merge 1 --squash', REFUSED],
  ['npx gh-axi pr merge 1', REFUSED],
  ['wrangler deploy', DEPLOY_ERROR],
  ['npx wrangler pages deploy dist', DEPLOY_ERROR],
]

for (const [command, output] of FAILURES) {
  test(`a failed command plays nothing: ${command}`, async ($, on) => {
    const played = world(on, { text: output, isError: true })

    await bash($, command)

    expect(played).toEqual([])
  })
}

const HIDDEN_FAILURES: readonly (readonly [string, string])[] = [
  ['bin/fm-merge-local.sh x 2>&1 | tail -4', REFUSED],
  ['bin/fm-merge-local.sh x; echo done', `${REFUSED}done\n`],
  ['bin/fm-pr-merge.sh https://github.com/o/r/pull/1 || true', REFUSED],
  ['bin/fm-pr-merge.sh https://github.com/o/r/pull/1 2>&1 | tail -2', REFUSED],
  ['gh pr merge 1 2>&1 | tail -2', REFUSED],
  ['npx gh-axi pr merge 1 | tail -1', REFUSED],
  ['npx wrangler pages deploy dist 2>&1 | tail -4', DEPLOY_ERROR],
  ['npx wrangler deploy; echo done', `${DEPLOY_ERROR}done\n`],
  ['npx wrangler deploy || echo failed', `${DEPLOY_ERROR}failed\n`],
  ['test -f skip || wrangler deploy', ''],
  ['echo $(wrangler deploy)', ''],
  ['if wrangler deploy; then echo ok; else echo no; fi', `${DEPLOY_ERROR}no\n`],
  ['wrangler deploy &', ''],
]

for (const [command, output] of HIDDEN_FAILURES) {
  test(`a failure the shell hid plays nothing: ${command}`, async ($, on) => {
    const played = world(on, { text: output })

    await bash($, command)

    expect(played).toEqual([])
  })
}

const NON_RUNS: readonly (readonly [string, string])[] = [
  ['wrangler deploy --dry-run', '--dry-run: exiting now.\n'],
  ['wrangler pages deploy --help', 'wrangler pages deploy [directory]\n'],
  ['gh pr merge --help', 'Merge a pull request\n'],
  ['gh pr merge 1 --auto', ''],
  ['gh pr merge 1 --disable-auto', ''],
  ['npx gh-axi pr merge 1 --auto', AXI_MERGED],
  ['npx gh-axi pr merge 1', AXI_ALREADY],
  ['bin/fm-pr-merge.sh https://github.com/o/r/pull/1', QUEUED_PR],
  ['wrangler pages deployment list', ''],
  ['wrangler versions list', ''],
  ['echo wrangler deploy', 'wrangler deploy\n'],
  ['echo "bin/fm-merge-local.sh x"', 'bin/fm-merge-local.sh x\n'],
  ['rg -n "gh pr merge" README.md', ''],
  ['rg "Deployment complete" notes.md && git commit -m "wrangler deploy; gh pr merge"', PAGES_DONE],
  ['git commit -m "$(cat <<EOF\nwrangler deploy\nEOF\n)"', ''],
  ['cat <<EOF\nwrangler deploy\ngh pr merge 1\nEOF', ''],
  ['true # wrangler deploy', ''],
  ['true # then; wrangler deploy', ''],
  ['git commit -m "note; wrangler deploy --force && done"', ''],
  ["git commit -m 'note; bin/fm-merge-local.sh x && done'", ''],
  ['sed -n 2,25p bin/fm-merge-local.sh', MERGED_LOCAL],
  ['cat deploy.log | tail -1', PAGES_DONE],
]

for (const [command, output] of NON_RUNS) {
  test(`a command that lands nothing plays nothing: ${command}`, async ($, on) => {
    const played = world(on, { text: output })

    await bash($, command)

    expect(played).toEqual([])
  })
}

const RED_CHECKS: readonly (readonly [string, Answer])[] = [
  ['gh pr checks 1', { text: `Exit code 1\n${RAW_RED}`, isError: true }],
  ['gh pr checks 1', { text: RAW_RED }],
  ['npx gh-axi pr checks 1', { text: AXI_RED }],
  ['npx gh-axi pr checks 1 --repo o/r 2>&1 | head -14 | cut -c1-140', { text: AXI_RED }],
  ["npx gh-axi pr checks 1 2>/dev/null | grep '^summary'", { text: 'summary: "3 passed, 12 failed, 15 total"\n' }],
  ['npx gh-axi pr checks 1 | grep -iE "fail"', { text: '  build,fail\n' }],
  ['until s=$(npx gh-axi pr checks 1 | grep summary); do sleep 5; done', { text: AXI_RED }],
]

for (const [command, answer] of RED_CHECKS) {
  test(`a checks result with a failure sounds the alarm: ${command}`, async ($, on) => {
    const played = world(on, answer)

    await bash($, command)

    expect(played).toEqual([ALARM])
  })
}

const QUIET_CHECKS: readonly (readonly [string, string])[] = [
  ['npx gh-axi pr checks 1', AXI_GREEN],
  ['npx gh-axi pr checks 1', 'checks: "0 passed, 0 failed — this PR has no CI checks configured"\n'],
  ['gh pr checks 1', RAW_GREEN],
  ['npx gh-axi pr view 1', AXI_RED],
  ['rg "gh-axi pr checks" notes.md', AXI_RED],
  ['echo "gh pr checks 1"', RAW_RED],
]

for (const [command, output] of QUIET_CHECKS) {
  test(`no failed check, no alarm: ${command}`, async ($, on) => {
    const played = world(on, { text: output })

    await bash($, command)

    expect(played).toEqual([])
  })
}

test('a supervision drain reporting a failed check sounds the alarm', async ($, on) => {
  const played = world(on, { text: drained(HEALTH_RED) })

  await bash($, DRAIN)

  expect(played).toEqual([ALARM])
})

test('the same report drained again before its acknowledgement stays silent', async ($, on) => {
  const played = world(on, { text: drained(HEALTH_RED) })

  await bash($, DRAIN)
  await bash($, DRAIN)

  expect(played).toEqual([ALARM])
})

test('a new failure at a later commit sounds again', async ($, on) => {
  const answer: Answer = { text: drained(HEALTH_RED) }
  const played = world(on, answer)

  await bash($, DRAIN)
  answer.text = drained(HEALTH_RED.replace('at abc', 'at def'))
  await bash($, DRAIN)

  expect(played).toEqual([ALARM, ALARM])
})

test('a drain with no failed check stays silent', async ($, on) => {
  const played = world(on, { text: drained(HEALTH_CONFLICT) })

  await bash($, DRAIN)

  expect(played).toEqual([])
})

test('a report read any other way stays silent', async ($, on) => {
  const played = world(on, { text: drained(HEALTH_RED) })

  await bash($, 'rg pr-health state/inbox')

  expect(played).toEqual([])
})

test('a subagent plays nothing', async ($, on) => {
  const played = world(on, { text: MERGED_LOCAL })

  await $.tool.call({ tool: 'Bash', command: 'bin/fm-merge-local.sh x', agentId: 'agent-1' } as never)

  expect(played).toEqual([])
})

test('a session outside the firstmate home plays nothing', async ($, on) => {
  const played = world(on, { text: PAGES_DONE }, '/somewhere/else')

  await bash($, 'npx wrangler pages deploy dist')

  expect(played).toEqual([])
})

test('a backgrounded deploy plays nothing, its result is not known yet', async ($, on) => {
  const played = world(on, { text: '', backgroundTaskId: 'job-1' })

  await bash($, 'npx wrangler pages deploy dist')

  expect(played).toEqual([])
})

test('an interrupted merge plays nothing', async ($, on) => {
  const played = world(on, { text: '', interrupted: true })

  await bash($, 'gh pr merge 1')

  expect(played).toEqual([])
})

test('a merge and a deploy in one command play both, once each', async ($, on) => {
  const played = world(on, { text: `${MERGED_LOCAL}${PAGES_DONE}` })

  await bash($, 'bin/fm-merge-local.sh x && npx wrangler pages deploy dist && npx wrangler pages deploy other')

  expect(played).toEqual([CANNON, HORN])
})

test('a sound that cannot play leaves the result alone', async ($, on) => {
  world(on, { text: MERGED_LOCAL }, HOME, false)

  const ran = await bash($, 'bin/fm-merge-local.sh x')

  expect(ran.text).toBe(MERGED_LOCAL)
})
