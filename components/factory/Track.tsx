"use client";

export function trackFactory(type: string, path: string, meta = "") {
  fetch("/api/factory/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, path, meta }),
  }).catch(() => undefined);
}

export function TrackClick({
  type,
  path,
  meta,
  children,
  className,
  href,
}: {
  type: string;
  path: string;
  meta?: string;
  children: React.ReactNode;
  className?: string;
  href?: string;
}) {
  if (href) {
    return (
      <a
        href={href}
        className={className}
        onClick={() => trackFactory(type, path, meta)}
      >
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={className} onClick={() => trackFactory(type, path, meta)}>
      {children}
    </button>
  );
}
