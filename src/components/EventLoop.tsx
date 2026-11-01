import type { FrameItem, LoopPhase } from "../player/types";
import { loopPhaseCaption } from "../player/loopPhase";

type EventLoopProps = {
  phase: LoopPhase;
  transit: FrameItem | null;
  focused?: boolean;
};

export function EventLoop({ phase, transit, focused = false }: EventLoopProps) {
  return (
    <div
      className={`event-loop event-loop--${phase}${focused ? " event-loop--focused" : " event-loop--dimmed"}`}
      aria-live="polite"
    >
      <div className="event-loop__dial" aria-hidden="true">
        <svg viewBox="0 0 80 80" className="event-loop__svg">
          <circle className="event-loop__track" cx="40" cy="40" r="26" />
          <circle className="event-loop__arc" cx="40" cy="40" r="26" />
          <path className="event-loop__arrow" d="M40 14 L45 22 L35 22 Z" />
        </svg>
      </div>
      <div className="event-loop__copy">
        <p className="event-loop__title">Event loop</p>
        <p className="event-loop__caption">{loopPhaseCaption(phase)}</p>
      </div>
      {transit ? (
        <div className="event-loop__transit frame frame--transit">
          <div className="frame__main">
            <span className="frame__name">{transit.name}</span>
            <span className="frame__ready">→ stack</span>
          </div>
        </div>
      ) : (
        <p className="event-loop__hint">Moves one callback when the stack is empty</p>
      )}
    </div>
  );
}
