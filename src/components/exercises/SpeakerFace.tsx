import { castPortrait } from '../../lib/cast';

/**
 * A cast member's portrait beside their name as a speaker (ADR 0016): it tells the speakers apart,
 * so it stands where a name stands, small and round. Anyone else (a role, a legacy name, a cast
 * member without a portrait) renders nothing, or with `placeholder` an empty disc of the same
 * size, so a row of options keeps one shape and the faceless one does not stand out.
 *
 * The box is sized before the image arrives, so nothing moves when it does. The name beside it
 * says who it is; the image itself is decoration to a screen reader.
 */
export function SpeakerFace({
  name,
  size,
  placeholder = false,
}: {
  name: string;
  size: number;
  placeholder?: boolean;
}) {
  const src = castPortrait(name);
  const box = { width: size, height: size };
  if (!src)
    return placeholder ? (
      <span
        aria-hidden="true"
        style={box}
        className="inline-block shrink-0 rounded-full bg-stone-200 align-middle dark:bg-stone-700"
      />
    ) : null;
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      style={box}
      className="inline-block shrink-0 rounded-full bg-stone-200 object-cover align-middle dark:bg-stone-700"
    />
  );
}

/** A transcript line's speaker: the portrait where there is one, then the name. */
export function SpeakerLabel({ name }: { name: string }) {
  const face = castPortrait(name) !== undefined;
  return (
    <>
      {face && (
        <>
          <SpeakerFace name={name} size={20} />{' '}
        </>
      )}
      <strong>{name}:</strong>
    </>
  );
}
