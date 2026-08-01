import { describe, expect, it } from "vitest";
import { domainMatches, parseBingRss } from "../extensions/web-search.js";

const rss = `<?xml version="1.0"?><rss><channel>
  <item><title>Pi &amp; Docs</title><link>https://pi.dev/docs</link><description>Latest &#38; greatest</description></item>
  <item><title>Example</title><link>https://blog.example.com/post</link><description><![CDATA[A <useful> result]]></description></item>
</channel></rss>`;

describe("WebSearch helpers", () => {
  it("parses Bing RSS results and decodes entities", () => {
    expect(parseBingRss(rss)).toEqual([
      { title: "Pi & Docs", url: "https://pi.dev/docs", description: "Latest & greatest" },
      { title: "Example", url: "https://blog.example.com/post", description: "A <useful> result" },
    ]);
  });

  it("matches a domain and its subdomains", () => {
    expect(domainMatches("https://docs.example.com/page", ["example.com"])).toBe(true);
    expect(domainMatches("https://notexample.com/page", ["example.com"])).toBe(false);
  });
});
