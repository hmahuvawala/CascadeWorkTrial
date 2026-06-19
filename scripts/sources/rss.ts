/** Minimal RSS 2.0 parser for feeds that expose `<item>` blocks. */
export type RssItem = {
  title: string;
  link: string;
  description: string;
  pubDate: string | null;
  author: string | null;
};

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, name: string): string {
  const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i");
  const m = block.match(re);
  return m ? m[1].trim() : "";
}

/** Parse RSS XML into items. Returns [] on malformed input. */
export function parseRss(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  for (const block of blocks) {
    const title = stripHtml(tag(block, "title"));
    const link = tag(block, "link") || tag(block, "guid");
    if (!title || !link) continue;
    items.push({
      title,
      link,
      description: stripHtml(tag(block, "description")),
      pubDate: tag(block, "pubDate") || null,
      author: stripHtml(tag(block, "dc:creator")) || null,
    });
  }
  return items;
}

export function rssPubDateToIso(pubDate: string | null): string {
  if (!pubDate) return new Date().toISOString();
  const parsed = new Date(pubDate);
  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString()
    : parsed.toISOString();
}
