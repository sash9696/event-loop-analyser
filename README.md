# Event Loop Analyser

A small teaching tool that steps through JavaScript and shows how work moves between the **call stack**, **Web APIs**, **microtask queue**, and **callback queue**.

Inspired by tools like Loupe — built to make interview-style `setTimeout` / Promise ordering obvious.

**Demo:** [js-event-loop-analyser.vercel.app](https://js-event-loop-analyser.vercel.app/)

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # golden simulator + player tests
npm run build
```

## What works today

- Sync execution on the call stack
- `setTimeout` → Web APIs → callback queue → stack
- Promises / `queueMicrotask` → microtask queue (drained before macrotasks)
- Focus mode, step/pause, speed control
- Labels like `timeout #1 · Timeout 1` so anonymous callbacks stay readable

## Roadmap

See [docs/ROADMAP.md](./docs/ROADMAP.md).

- [x] Phase 1 — stack, Web APIs, callback queue, `setTimeout`
- [x] Phase 2 — Promises + microtask queue (`then`, `queueMicrotask`)
- [ ] Later — `async`/`await`, CrackIt embed, other JS labs

## How it’s built

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

Short version: a pure simulator emits a **timeline of events**; the UI only plays that timeline. Queue rules live in tests under `tests/golden/`.

## Contributing

1. Add or adjust a golden test for the behaviour.
2. Watch it fail, then implement the minimum in `src/sim/`.
3. Keep UI free of a second queue implementation.

Supported JS is a **subset** (enough for teaching demos). Unsupported syntax should error clearly.

## License

MIT — see [LICENSE](./LICENSE).
