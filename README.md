# Event Loop Analyser

A small teaching tool that steps through JavaScript and shows how work moves between the **call stack**, **Web APIs**, **callback queue**, and (soon) the **microtask queue**.

Inspired by tools like Loupe — built to make interview-style `setTimeout` / Promise ordering obvious.

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
- Focus mode, step/pause, speed control
- Labels like `timeout #1 · Timeout 1` so anonymous callbacks stay readable

## Roadmap

- [ ] Promises / `queueMicrotask` (microtask queue)
- [ ] `async` / `await` as sugar over Promises
- [ ] Embeddable build for learning platforms

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
