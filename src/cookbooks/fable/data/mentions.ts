/** @mention parsing for group threads. */

export type MentionSpan = {
  text: string;
  /** The matched first name (original case), when this span is a mention. */
  name?: string;
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Splits text into plain and @mention spans. A token counts as a mention
 * when its name matches one of `names` (case-insensitive) and isn't
 * immediately followed by another word character.
 */
export function splitMentions(
  text: string,
  names: string[],
): MentionSpan[] {
  const clean = names.filter(Boolean);
  if (!clean.length) return [{ text }];
  const re = new RegExp(
    `@(${clean.map(escapeRegExp).join("|")})(?![\\p{L}\\p{N}_])`,
    "giu",
  );
  const spans: MentionSpan[] = [];
  let i = 0;
  let m: RegExpExecArray | null;
  re.lastIndex = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > i) spans.push({ text: text.slice(i, m.index) });
    spans.push({ text: m[0], name: m[1] });
    i = m.index + m[0].length;
  }
  if (i < text.length) spans.push({ text: text.slice(i) });
  return spans;
}

/** Ids of members whose @FirstName appears in the text. */
export function mentionedIds(
  text: string,
  members: { id: string; first: string }[],
): string[] {
  const found = new Set<string>();
  for (const span of splitMentions(
    text,
    members.map((m) => m.first),
  )) {
    if (!span.name) continue;
    const member = members.find(
      (m) => m.first.toLowerCase() === span.name!.toLowerCase(),
    );
    if (member) found.add(member.id);
  }
  return [...found];
}
