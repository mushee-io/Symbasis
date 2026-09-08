"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Symbasis UI error", error);
  }, [error]);

  return (
    <main>
      <div className="workspace">
        <section className="panel" style={{ padding: 24, maxWidth: 720 }}>
          <div className="eyebrow">SYMBASIS / RECOVERY</div>
          <h2>Trading terminal hit an unexpected error.</h2>
          <p className="muted">
            No transaction is sent automatically. Check your wallet network and retry the terminal.
          </p>
          {error.digest ? <p className="muted">Error reference: {error.digest}</p> : null}
          <button className="secondary" type="button" onClick={reset}>
            RETRY TERMINAL
          </button>
        </section>
      </div>
    </main>
  );
}
