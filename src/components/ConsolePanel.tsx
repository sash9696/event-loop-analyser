type ConsolePanelProps = {
  lines: string[];
  focused?: boolean;
  /** How many recent lines to emphasize; older stay collapsed visually. */
  recent?: number;
};

export function ConsolePanel({
  lines,
  focused = false,
  recent = 4,
}: ConsolePanelProps) {
  const start = Math.max(0, lines.length - recent);
  const older = lines.slice(0, start);
  const latest = lines.slice(start);

  return (
    <section
      className={`panel panel--console${focused ? " panel--focused" : " panel--dimmed"}`}
    >
      <header className="panel__title">
        <span>Console</span>
        <span className="panel__count">{lines.length}</span>
      </header>
      <div className="panel__body console">
        {lines.length === 0 ? (
          <p className="panel__empty">no output</p>
        ) : (
          <>
            {older.length > 0 ? (
              <details className="console__older">
                <summary>{older.length} earlier</summary>
                {older.map((line, i) => (
                  <div key={`old-${i}-${line}`} className="console__line console__line--old">
                    <span className="console__index">{i + 1}</span>
                    {line}
                  </div>
                ))}
              </details>
            ) : null}
            {latest.map((line, i) => (
              <div
                key={`new-${start + i}-${line}`}
                className={`console__line${i === latest.length - 1 && focused ? " console__line--hot" : ""}`}
              >
                <span className="console__index">{start + i + 1}</span>
                {line}
              </div>
            ))}
          </>
        )}
      </div>
    </section>
  );
}
