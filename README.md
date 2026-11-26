# pi-simple-tps

[![ci](https://github.com/goldentoaste/pi-simple-tps/actions/workflows/ci.yml/badge.svg)](https://github.com/goldentoaste/pi-simple-tps/actions/workflows/ci.yml)

A minimal Pi Coding Agent extension that shows one number in the footer: the average
tokens per second across the last 10 completed responses.

```
42 tok/s
```

## Install

```sh
pi install npm:@goldentoaste/pi-simple-tps
```

Or try it without touching settings:

```sh
pi -e npm:@goldentoaste/pi-simple-tps
```

Run `/reload` in a session after installing or updating. Remove it again with:

```sh
pi remove npm:@goldentoaste/pi-simple-tps
```

### Local development

Load this checkout directly — no install step, and edits are picked up by `/reload`:

```sh
pi -e ./extensions/tps.ts
```

Type-check it with `npm install && npm run typecheck`.

See [PUBLISHING.md](PUBLISHING.md) for the release process.

## Commands

| Command | Effect |
| --- | --- |
| `/tps` | Toggle the widget on or off |
| `/tps on` / `/tps off` | Show or hide explicitly |
| `/tps reset` | Clear the window |

## How the number is computed

- One sample per completed assistant response: its output tokens and its decode time.
- The rate is duration-weighted — total tokens over total decode time — so a long response
  counts more than a short one. It is not a mean of per-response rates. The footer shows the
  rounded whole number only.
- Decode time runs from the first streamed text, thinking, or tool-call delta to the end of
  the message. Time spent waiting for the first token is excluded, so a model that thinks
  for a while and then emits quickly is not punished for the wait.
- Tokens come from the provider's reported `usage.output`. Only when a provider reports
  nothing does the extension estimate from streamed bytes at 4 bytes per token, which
  over-counts CJK.
- The window is the last 10 responses.
- Nothing is shown until the first response finishes — no live estimates, no timers.

State is per session: `/new`, `/resume`, and `/fork` start the window over.
