import { chromium } from "playwright";
import { createLogger } from "./logger";

const log = createLogger("caleprocure-detail");

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export const CALEPROCURE_EVENT_SEARCH_URL =
  "https://caleprocure.ca.gov/pages/Events-BS3/event-search.aspx";

export type CaleProcureDetail = {
  text: string;
  /** Working PeopleSoft detail URL (event-details.aspx links 404). */
  viewUrl: string | null;
};

export function extractCaleProcureEventId(url: string, rawText = ""): string | null {
  const fromUrl = url.match(/EventId=([^&]+)/i)?.[1];
  if (fromUrl) return decodeURIComponent(fromUrl);
  const fromText = rawText.match(/Event ID\s+(\d{5,}|[\dA-Z-]+)/i)?.[1];
  return fromText ?? null;
}

export function isBrokenCaleProcureDetailUrl(url: string): boolean {
  return /caleprocure\.ca\.gov.*event-details\.aspx/i.test(url);
}

/** PeopleSoft detail page — buyer name, phone, email (not on the search listing). */
export async function fetchCaleProcureEventDetail(
  eventId: string
): Promise<CaleProcureDetail> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ userAgent: USER_AGENT });
    log.info(`fetching Cal eProcure detail for event ${eventId}`);
    await page.goto(CALEPROCURE_EVENT_SEARCH_URL, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    await page.waitForTimeout(2500);
    await page.fill("#RESP_INQA_WK_AUC_ID", eventId);
    await page.getByRole("button", { name: /^Search$/i }).click();
    await page.waitForTimeout(5000);

    await page.evaluate((id) => {
      const td = [...document.querySelectorAll("td[id^='AUC_ID_COL']")].find(
        (el) =>
          (el.textContent ?? "").includes(id) &&
          el.getBoundingClientRect().height > 0
      ) as HTMLElement | undefined;
      td?.click();
    }, eventId);
    await page.waitForTimeout(2000);

    const portalUrl = await page.evaluate(() => {
      const html = document.querySelector("#doPortalUrlText")?.innerHTML ?? "";
      return (
        html.match(/DoPortalUrl\('([^']+)'\)/)?.[1]?.replace(/&amp;/g, "&") ?? null
      );
    });
    if (!portalUrl) {
      log.warn(`no DoPortalUrl for event ${eventId}`);
      return { text: "", viewUrl: null };
    }

    await page.goto(portalUrl, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForTimeout(6000);

    const contentFrame = page
      .frames()
      .find(
        (f) =>
          f.url().includes("/psc/") && f.url().includes("AUC_RESP_INQ_DTL")
      );
    const text = contentFrame
      ? await contentFrame.evaluate(() =>
          document.body.innerText.replace(/\s+/g, " ").trim()
        )
      : await page.evaluate(() =>
          document.body.innerText.replace(/\s+/g, " ").trim()
        );
    log.info(`Cal eProcure detail for ${eventId}: ${text.length} chars`);
    return { text, viewUrl: portalUrl };
  } catch (err) {
    log.error(`Cal eProcure detail fetch failed for ${eventId}`, err);
    return { text: "", viewUrl: null };
  } finally {
    await browser.close();
  }
}

/** @deprecated use fetchCaleProcureEventDetail */
export async function fetchCaleProcureEventDetailText(eventId: string): Promise<string> {
  const { text } = await fetchCaleProcureEventDetail(eventId);
  return text;
}
