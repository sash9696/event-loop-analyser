type NowBannerProps = {
  text: string;
  status: string;
  step?: string;
};

export function NowBanner({ text, status, step }: NowBannerProps) {
  return (
    <div className="now-banner" aria-live="polite">
      <div className="now-banner__label">Now</div>
      <p className="now-banner__text">{text}</p>
      <div className="now-banner__meta">
        <span>{status}</span>
        {step ? <span>{step}</span> : null}
      </div>
    </div>
  );
}
