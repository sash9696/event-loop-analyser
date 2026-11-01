import type { FrameItem } from "../player/types";

type PanelProps = {
  title: string;
  items: FrameItem[];
  emptyLabel?: string;
  variant?: "stack" | "queue" | "api" | "micro";
  focused?: boolean;
  count?: number;
};

export function Panel({
  title,
  items,
  emptyLabel = "empty",
  variant = "queue",
  focused = false,
  count,
}: PanelProps) {
  const ordered = variant === "stack" ? [...items].reverse() : items;
  const shownCount = count ?? items.length;

  return (
    <section
      className={`panel panel--${variant}${focused ? " panel--focused" : " panel--dimmed"}`}
    >
      <header className="panel__title">
        <span>{title}</span>
        <span className="panel__count">{shownCount}</span>
      </header>
      <div className="panel__body">
        {ordered.length === 0 ? (
          <p className="panel__empty">{emptyLabel}</p>
        ) : (
          <ul className="panel__list">
            {ordered.map((item, index) => {
              const isTop =
                variant === "stack" ? index === 0 : index === ordered.length - 1;
              const emphasize = focused && (variant === "queue" ? index === 0 : isTop);
              return (
                <li
                  key={item.id}
                  className={[
                    "frame",
                    item.status === "ready" ? "frame--ready" : "",
                    item.status === "waiting" ? "frame--waiting" : "",
                    emphasize ? "frame--hot" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div className="frame__main">
                    <span className="frame__name">{item.name}</span>
                    {item.status === "ready" ? (
                      <span className="frame__ready">ready</span>
                    ) : null}
                  </div>
                  {focused && item.detail ? (
                    <span className="frame__detail">{item.detail}</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
