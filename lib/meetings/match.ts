/** Which client a call belongs to: by attendee email first, then by the client's name in the call title. */
export function matchClient(
  clients: { id: string; name: string; slug: string; emails: string[] }[],
  call: { title: string; attendees: string[] },
  ownDomains: string[] = [],
): string | null {
  const theirs = call.attendees.map((e) => e.toLowerCase()).filter((e) => !ownDomains.some((d) => e.endsWith(`@${d.toLowerCase()}`)));
  const byEmail = clients.find((c) => c.emails.some((e) => theirs.includes(e.toLowerCase())));
  if (byEmail) return byEmail.id;
  const t = ` ${call.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
  const byName = clients
    .filter((c) => {
      const n = c.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      return n.length > 2 && (t.includes(` ${n} `) || t.includes(` ${c.slug.replace(/-/g, ' ')} `));
    })
    .sort((a, b) => b.name.length - a.name.length)[0];
  return byName?.id ?? null;
}
