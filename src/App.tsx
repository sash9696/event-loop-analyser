import { useState } from "react";
import { ConsolePanel } from "./components/ConsolePanel";
import { EventLoop } from "./components/EventLoop";
import { NowBanner } from "./components/NowBanner";
import { Panel } from "./components/Panel";
import { usePlayback } from "./hooks/usePlayback";
import { deriveFocus } from "./player/focus";
import { deriveLoopPhase } from "./player/loopPhase";
import { DEFAULT_CODE, PRESETS } from "./presets";

export default function App() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [editing, setEditing] = useState(false);
  const [focusMode, setFocusMode] = useState(true);
  const playback = usePlayback(code);
  const focus = deriveFocus(
    playback.status,
    playback.snapshot,
    playback.currentEvent,
  );
  const phase = deriveLoopPhase(
    playback.status,
    playback.snapshot,
    playback.currentEvent,
  );
  const watching =
    playback.status === "running" ||
    playback.status === "paused" ||
    playback.status === "finished";
  const showEditor = editing || !focusMode || !watching;

  return (
    <div className={`app${watching && focusMode && !editing ? " app--focus" : ""}`}>
      <header className="topbar">
        <div className="brand">
          <p className="brand__name">Event Loop Analyser</p>
          <p className="brand__tag">
            {watching && focusMode && !editing
              ? "Focus mode — editor hidden"
              : "Watch one place at a time"}
          </p>
        </div>
        <div className="controls">
          {editing ? (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                setEditing(false);
                playback.run();
              }}
            >
              Run
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  playback.pause();
                  setEditing(true);
                }}
              >
                Edit
              </button>
              <button type="button" className="btn" onClick={playback.rerun}>
                Rerun
              </button>
              <button
                type="button"
                className="btn"
                onClick={playback.pause}
                disabled={playback.status !== "running"}
              >
                Pause
              </button>
              <button
                type="button"
                className="btn"
                onClick={playback.resume}
                disabled={playback.status !== "paused"}
              >
                Resume
              </button>
              <button type="button" className="btn" onClick={playback.step}>
                Step
              </button>
            </>
          )}
          <button
            type="button"
            className={`btn${focusMode ? " btn--active" : ""}`}
            aria-pressed={focusMode}
            title="Hide the editor while watching playback"
            onClick={() => setFocusMode((value) => !value)}
          >
            Focus
          </button>
          <label className="speed">
            Speed
            <select
              value={playback.speed}
              onChange={(e) => playback.setSpeed(Number(e.target.value))}
            >
              <option value={0.25}>0.25×</option>
              <option value={0.5}>0.5×</option>
              <option value={1}>1×</option>
              <option value={2}>2×</option>
              <option value={4}>4×</option>
            </select>
          </label>
        </div>
      </header>

      <main className={`layout${showEditor ? "" : " layout--focus"}`}>
        {showEditor ? (
          <section className="editor-pane">
            <div className="presets">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="preset"
                  onClick={() => {
                    setCode(preset.code);
                    setEditing(true);
                    playback.pause();
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <textarea
              className="editor"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setEditing(true);
              }}
              spellCheck={false}
              aria-label="JavaScript source"
            />
            {playback.error ? (
              <p className="error" role="alert">
                {playback.error}
              </p>
            ) : null}
          </section>
        ) : null}

        <section className="viz-pane">
          <NowBanner
            text={playback.error ? playback.error : focus.now}
            status={playback.status}
            step={
              playback.timeline.length > 0
                ? `${Math.max(playback.cursor, 0) + 1}/${playback.timeline.length}`
                : undefined
            }
          />
          <div className="viz-grid">
            <Panel
              title="Call Stack"
              items={playback.snapshot.callStack}
              variant="stack"
              focused={focus.zone === "stack"}
            />
            <Panel
              title="Web APIs"
              items={playback.snapshot.webApis}
              variant="api"
              focused={focus.zone === "api"}
            />
            <EventLoop
              phase={phase}
              transit={playback.snapshot.transit}
              focused={focus.zone === "loop"}
            />
            <Panel
              title="Callback Queue"
              items={playback.snapshot.callbackQueue}
              variant="queue"
              focused={focus.zone === "queue"}
            />
            <ConsolePanel
              lines={playback.snapshot.console}
              focused={focus.zone === "console"}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
