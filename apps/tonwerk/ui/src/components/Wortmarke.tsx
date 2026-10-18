/**
 * The wordmark. TONWERK over AUDIOREGIE, with the Pegel in miniature beside it.
 *
 * The mark is four ticks — two unlit, one brass, one red past a gap — which is the signature bar
 * compressed to 16 pixels and the same reading: a scale, and one value that left it. Nothing else in
 * the identity is asked to be memorable, so this stays quiet and repeats the one idea.
 */
export function Wortmarke(): React.JSX.Element {
  return (
    <div className="wortmarke">
      <span className="wortmarke-mark" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span className="wortmarke-name">
        Tonwerk
        <span className="wortmarke-zusatz">Audioregie</span>
      </span>
    </div>
  );
}
