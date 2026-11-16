/**
 * "Перед цим": the line a phrase answers or follows (Item.ctx), shown above
 * it so the card says what exactly is expected — "Jól vagyok, köszönöm." is
 * the answer to "Hogy vagy?". The Hungarian line is always shown; its
 * translation when asked for (the Ukrainian side of a card, or after flipping).
 */
export function CtxLine({ ctx, showUa }: { ctx: { hu: string; ua: string }; showUa: boolean }) {
  return (
    <p className="ctx">
      <span className="ctx-label">перед цим:</span>
      <br />
      <span lang="hu">— {ctx.hu}</span>
      {showUa && (
        <>
          <br />
          <span className="ctx-ua" lang="uk">
            {ctx.ua}
          </span>
        </>
      )}
    </p>
  );
}

/** «Теж правильно»: other correct answers on the back of a card (Item.alt). */
export function AltLine({ alt }: { alt?: string[] }) {
  if (!alt?.length) return null;
  return (
    <p className="alt-line">
      Теж правильно: <span lang="hu">{alt.join(" · ")}</span>
    </p>
  );
}
