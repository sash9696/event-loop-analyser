# Architecture

```
Editor / presets
      │
      ▼
src/sim/runSimulation(source)
      │  parse (acorn) → interpret
      │  emit timeline events
      ▼
{ console, timeline[] }
      │
      ▼
src/player/          snapshotAt(timeline, cursor)
      │  stack / webApis / queue / transit / console
      ▼
React UI (panels + Now banner + focus spotlight)
```

## Simulator (`src/sim/`)

Owns the event-loop rules. No React.

Important outputs:

| Event | Meaning |
|---|---|
| `pushStack` / `popStack` | Sync frames |
| `log` | Simulated `console.log` |
| `scheduleTimer` | `setTimeout` registered in Web APIs |
| `timerReady` | Delay elapsed |
| `enqueueTask` | Macrotask waiting in callback queue |
| `dequeueTask` | Event loop moves one task toward the stack |

Timers get stable labels (`timeout #N`) and an optional hint from the callback’s first string `console.log`.

## Player (`src/player/`)

Turns the timeline into panel state. Also derives:

- **Loop phase** — idle / executing / waiting / transfer
- **Focus zone** — which panel the “Now” banner points at

## UI (`src/`)

Renders snapshots only. Focus mode can hide the editor while watching.

## Tests

| Path | Role |
|---|---|
| `tests/golden/` | Console order + queue behaviour |
| `tests/player/` | Timeline → panels / focus |

Add a golden before changing simulator rules.
