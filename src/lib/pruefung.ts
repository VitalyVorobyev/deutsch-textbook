/**
 * The exams Prüfung prepares for, in the order the hub shows them. The Goethe levels are
 * routes (`/pruefung/<level>`) whether or not the official sets are on this device: a level
 * page without them says so (ADR 0009). Leben in Deutschland lives under `/pruefung/leben`.
 */
export const GOETHE_EXAMS = [
  { level: 'a1', title: 'Goethe-Zertifikat A1', subtitle: 'Start Deutsch 1' },
  { level: 'a2', title: 'Goethe-Zertifikat A2', subtitle: undefined },
  { level: 'b1', title: 'Goethe-/ÖSD-Zertifikat B1', subtitle: undefined },
] as const;
