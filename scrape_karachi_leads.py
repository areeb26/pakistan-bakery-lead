#!/usr/bin/env python3
"""
Karachi Google Maps Lead Scraper (Playwright)
Scrapes restaurants and bakeries in Karachi.

Usage:
  python3 scrape_karachi_leads.py --type restaurants --limit 100
  python3 scrape_karachi_leads.py --type bakeries --limit 100
  python3 scrape_karachi_leads.py --type both --limit 100
  python3 scrape_karachi_leads.py --type both --limit 100 --headless
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from playwright.async_api import Browser, Page, async_playwright

BETWEEN_LISTINGS_MS = 2200
BETWEEN_QUERIES_MS = 5000
SCROLL_PAUSE_MS = 1400
MAX_SCROLL_ROUNDS = 80
STALE_SCROLL_LIMIT = 6

QUERIES = {
    "restaurants": [
        "restaurants in Karachi",
        "best restaurants Karachi",
        "fine dining restaurants Karachi",
        "desi restaurants Karachi",
        "fast food restaurants Karachi",
        "seafood restaurants Karachi",
        "Chinese restaurants Karachi",
        "BBQ restaurants Karachi",
        "cafes restaurants Karachi Clifton",
        "restaurants in DHA Karachi",
        "restaurants in Gulshan Karachi",
        "restaurants in North Nazimabad Karachi",
        "restaurants in Saddar Karachi",
        "restaurants in PECHS Karachi",
        "restaurants in Korangi Karachi",
    ],
    "bakeries": [
        "bakeries in Karachi",
        "bakery Karachi",
        "cake shop Karachi",
        "pastry shop Karachi",
        "sweet shop bakery Karachi",
        "bread bakery Karachi",
        "bakeries in Clifton Karachi",
        "bakeries in DHA Karachi",
        "bakeries in Gulshan Karachi",
        "bakeries in North Nazimabad Karachi",
        "bakeries in PECHS Karachi",
        "bakeries in Saddar Karachi",
        "bakeries in Korangi Karachi",
        "cupcake bakery Karachi",
        "wedding cake bakery Karachi",
    ],
}


def lead_id(name: str, address: str) -> str:
    return hashlib.md5(f"{name.strip().lower()}|{address.strip().lower()}".encode()).hexdigest()[:12]


def clean_text(value: str | None) -> str:
    if not value:
        return ""
    # Strip Google Maps Private Use Area icon glyphs + control chars
    value = re.sub(r"[\ue000-\uf8ff\uf000-\uf0ff]", "", value)
    value = re.sub(r"[\x00-\x1f\x7f]", "", value)
    return re.sub(r"\s+", " ", value).strip()


def clean_phone(value: str | None) -> str:
    text = clean_text(value)
    text = re.sub(r"^(Phone:?\s*)", "", text, flags=re.I)
    # Keep digits, spaces, +, -, (), .
    text = re.sub(r"[^\d+\-().\s]", "", text)
    return re.sub(r"\s+", " ", text).strip()


async def dismiss_popups(page: Page) -> None:
    for selector in [
        'button:has-text("Accept all")',
        'button:has-text("Reject all")',
        'button:has-text("I agree")',
        'button:has-text("Accept")',
        'form[action*="consent"] button',
    ]:
        try:
            btn = page.locator(selector).first
            if await btn.is_visible(timeout=1200):
                await btn.click(timeout=2000)
                await page.wait_for_timeout(700)
                return
        except Exception:
            pass


async def wait_for_results(page: Page, timeout_ms: int = 20000) -> bool:
    selectors = [
        'div[role="feed"]',
        "a.hfpxzc",
        'div[role="main"] a[href*="/maps/place/"]',
    ]
    deadline = asyncio.get_event_loop().time() + (timeout_ms / 1000)
    while asyncio.get_event_loop().time() < deadline:
        for sel in selectors:
            try:
                if await page.locator(sel).count() > 0:
                    return True
            except Exception:
                pass
        await page.wait_for_timeout(400)
    return False


async def get_result_links(page: Page):
    links = page.locator("a.hfpxzc")
    count = await links.count()
    if count > 0:
        return links, count

    links = page.locator('div[role="feed"] a[href*="/maps/place/"]')
    count = await links.count()
    if count > 0:
        return links, count

    links = page.locator('a[href*="/maps/place/"]')
    count = await links.count()
    return links, count


async def scroll_results_until(page: Page, target: int) -> int:
    """Scroll the left feed until we have enough unique listing hrefs or stall."""
    seen_hrefs: set[str] = set()
    stale = 0

    for round_i in range(MAX_SCROLL_ROUNDS):
        links, count = await get_result_links(page)
        before = len(seen_hrefs)

        for i in range(count):
            try:
                href = await links.nth(i).get_attribute("href") or ""
                if "/maps/place/" in href:
                    seen_hrefs.add(href.split("&")[0])
            except Exception:
                continue

        after = len(seen_hrefs)
        print(f"    scroll {round_i + 1}: {after} unique listings", flush=True)

        if after >= target:
            return after

        if after == before:
            stale += 1
        else:
            stale = 0

        if stale >= STALE_SCROLL_LIMIT:
            print(f"    scroll stalled at {after} listings", flush=True)
            return after

        # End-of-list marker
        try:
            end = page.locator('span:has-text("You\'ve reached the end of the list")')
            if await end.count() > 0 and await end.first.is_visible(timeout=500):
                print(f"    reached end of list at {after}", flush=True)
                return after
        except Exception:
            pass

        scrolled = False
        for panel_sel in ['div[role="feed"]', 'div[aria-label*="Results"]', 'div.m6QErb[aria-label]']:
            try:
                panel = page.locator(panel_sel).first
                if await panel.count() == 0:
                    continue
                await panel.evaluate("el => el.scrollBy(0, 1200)")
                scrolled = True
                break
            except Exception:
                continue

        if not scrolled:
            try:
                await page.mouse.wheel(0, 1400)
            except Exception:
                pass

        await page.wait_for_timeout(SCROLL_PAUSE_MS)

    return len(seen_hrefs)


async def extract_listing_details(page: Page) -> dict:
    d: dict = {
        "name": "",
        "category": "",
        "address": "",
        "phone": "",
        "website": "",
        "rating": None,
        "review_count": 0,
        "plus_code": "",
        "hours": "",
        "gmaps_url": page.url,
    }

    # Name
    for sel in ["h1.DUwDvf", "h1.fontHeadlineLarge", "h1"]:
        try:
            text = clean_text(await page.locator(sel).first.inner_text(timeout=2500))
            if text and text.lower() not in {"results", "google maps"}:
                d["name"] = text
                break
        except Exception:
            pass

    # Category
    for sel in ["button.DkEaL", 'button[jsaction*="category"]', "span.DkEaL"]:
        try:
            text = clean_text(await page.locator(sel).first.inner_text(timeout=1500))
            if text:
                d["category"] = text
                break
        except Exception:
            pass

    # Rating
    for sel in [
        'div.F7nice span[aria-hidden="true"]',
        'span[aria-hidden="true"].ceNzKf',
        'div.F7nice span',
    ]:
        try:
            text = clean_text(await page.locator(sel).first.inner_text(timeout=1500))
            m = re.search(r"(\d+[.,]\d+)", text)
            if m:
                d["rating"] = float(m.group(1).replace(",", "."))
                break
        except Exception:
            pass

    # Review count
    for sel in [
        'div.F7nice span[aria-label*="review"]',
        'div.F7nice span[aria-label*="Review"]',
        'span[aria-label*="reviews"]',
        'button[aria-label*="reviews"]',
    ]:
        try:
            loc = page.locator(sel).first
            label = await loc.get_attribute("aria-label", timeout=1500)
            if not label:
                label = await loc.inner_text(timeout=1500)
            m = re.search(r"([\d,]+)", label or "")
            if m:
                d["review_count"] = int(m.group(1).replace(",", ""))
                break
        except Exception:
            pass

    # Address
    for sel in [
        'button[data-item-id="address"]',
        'button[data-tooltip="Copy address"]',
        '[data-item-id="address"]',
        'button[aria-label*="Address"]',
    ]:
        try:
            loc = page.locator(sel).first
            text = clean_text(await loc.inner_text(timeout=1500))
            if not text:
                text = clean_text(await loc.get_attribute("aria-label") or "")
            text = re.sub(r"^(Address:?\s*)", "", text, flags=re.I)
            if text:
                d["address"] = text
                break
        except Exception:
            pass

    # Phone
    for sel in [
        'button[data-item-id*="phone:tel"]',
        'button[data-item-id^="phone"]',
        'a[href^="tel:"]',
        'button[aria-label*="Phone"]',
    ]:
        try:
            loc = page.locator(sel).first
            text = await loc.inner_text(timeout=1500)
            if not text:
                href = await loc.get_attribute("href") or ""
                text = href.replace("tel:", "")
            text = clean_phone(text)
            if text and re.search(r"\d{5,}", text):
                d["phone"] = text
                break
        except Exception:
            pass

    # aria-label fallback for phone
    if not d["phone"]:
        try:
            btn = page.locator('button[data-item-id*="phone"]').first
            label = await btn.get_attribute("aria-label", timeout=1000) or ""
            text = clean_phone(label)
            if text and re.search(r"\d{5,}", text):
                d["phone"] = text
        except Exception:
            pass

    # Website
    for sel in [
        'a[data-item-id="authority"]',
        'a[aria-label*="Website"]',
        'a[data-tooltip="Open website"]',
    ]:
        try:
            href = await page.locator(sel).first.get_attribute("href", timeout=1500)
            if href and "google.com" not in href:
                d["website"] = href
                break
        except Exception:
            pass

    # Plus code
    for sel in [
        'button[data-item-id="oloc"]',
        'button[data-tooltip="Copy plus code"]',
    ]:
        try:
            loc = page.locator(sel).first
            text = clean_text(await loc.inner_text(timeout=1200))
            if not text:
                text = clean_text(await loc.get_attribute("aria-label") or "")
            text = re.sub(r"^(Plus code:?\s*)", "", text, flags=re.I)
            if text and len(text) > 2:
                d["plus_code"] = text
                break
        except Exception:
            pass

    # Hours summary
    for sel in [
        'button[data-item-id*="oh"][aria-label]',
        'div[aria-label*="Hours"]',
        'button[aria-label*="Open"]',
        'button[aria-label*="Closed"]',
        "div.t39EBf",
    ]:
        try:
            loc = page.locator(sel).first
            text = clean_text(await loc.get_attribute("aria-label") or "")
            if not text:
                text = clean_text(await loc.inner_text(timeout=1200))
            if text and 3 < len(text) < 220:
                d["hours"] = text
                break
        except Exception:
            pass

    d["gmaps_url"] = page.url
    return d


async def scrape_query(
    page: Page,
    query: str,
    needed: int,
    seen: set[str],
    lead_type: str,
) -> list[dict]:
    print(f"\n[SEARCH] {query} (need {needed} more {lead_type})", flush=True)
    url = f"https://www.google.com/maps/search/{query.replace(' ', '+')}"

    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=45000)
    except Exception as e:
        print(f"  goto warning: {e}", flush=True)

    await page.wait_for_timeout(2500)
    await dismiss_popups(page)

    if not await wait_for_results(page):
        print("  no results panel found", flush=True)
        return []

    await scroll_results_until(page, target=max(needed + 5, 20))

    links, count = await get_result_links(page)
    print(f"  processing up to {min(count, needed + 15)} of {count} visible links", flush=True)

    leads: list[dict] = []
    processed = 0

    for i in range(count):
        if len(leads) >= needed:
            break

        try:
            link = links.nth(i)
            href = await link.get_attribute("href") or ""
            name_preview = clean_text(await link.get_attribute("aria-label") or f"#{i + 1}")

            # Skip ad-like / non-place
            if href and "/maps/place/" not in href:
                continue

            print(f"  [{i + 1}/{count}] {name_preview[:60]}", flush=True)
            await link.click(timeout=8000)
            await page.wait_for_timeout(BETWEEN_LISTINGS_MS)

            # Wait for place panel
            try:
                await page.wait_for_selector("h1", timeout=8000)
            except Exception:
                pass

            details = await extract_listing_details(page)
            name = details.get("name") or name_preview
            address = details.get("address") or ""

            if not name:
                continue

            lid = lead_id(name, address or href)
            if lid in seen:
                print("    skip duplicate", flush=True)
                continue

            # Soft Karachi filter when address is present
            addr_l = address.lower()
            if address and ("karachi" not in addr_l and "pakistan" not in addr_l):
                # Still keep if query is Karachi-specific and Maps returned it
                pass

            seen.add(lid)
            lead = {
                "lead_id": lid,
                "type": lead_type,
                "business_name": name,
                "category": details.get("category") or lead_type.rstrip("s"),
                "address": address,
                "phone": details.get("phone") or "",
                "website": details.get("website") or "",
                "rating": details.get("rating"),
                "review_count": details.get("review_count") or 0,
                "plus_code": details.get("plus_code") or "",
                "hours": details.get("hours") or "",
                "gmaps_url": details.get("gmaps_url") or href,
                "search_query": query,
                "scraped_at": datetime.now(timezone.utc).isoformat(),
            }
            leads.append(lead)
            processed += 1
            print(
                f"    + {lead['business_name']} | {lead['phone'] or 'no phone'} | "
                f"★{lead['rating'] or '-'} ({lead['review_count']})",
                flush=True,
            )
        except Exception as e:
            print(f"  [{i + 1}] skip — {e}", flush=True)
            continue

    print(f"  got {len(leads)} new leads from this query", flush=True)
    return leads


async def run(
    lead_types: list[str],
    limit: int,
    output_dir: str,
    headless: bool,
    slow_mo: int,
) -> dict[str, list[dict]]:
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    results: dict[str, list[dict]] = {}

    async with async_playwright() as p:
        browser: Browser = await p.chromium.launch(
            headless=headless,
            slow_mo=slow_mo,
            args=[
                "--lang=en-US",
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
            ],
        )
        context = await browser.new_context(
            viewport={"width": 1400, "height": 960},
            locale="en-US",
            timezone_id="Asia/Karachi",
            geolocation={"latitude": 24.8607, "longitude": 67.0011},
            permissions=["geolocation"],
            user_agent=(
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            ),
        )
        await context.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined});"
        )
        page = await context.new_page()

        for lead_type in lead_types:
            print(f"\n{'=' * 60}\nSCRAPING {lead_type.upper()} (target: {limit})\n{'=' * 60}", flush=True)
            collected: list[dict] = []
            seen: set[str] = set()
            queries = QUERIES[lead_type]

            for qi, query in enumerate(queries):
                if len(collected) >= limit:
                    break
                if qi > 0:
                    await page.wait_for_timeout(BETWEEN_QUERIES_MS)

                needed = limit - len(collected)
                try:
                    batch = await scrape_query(page, query, needed, seen, lead_type)
                    collected.extend(batch)
                except Exception as e:
                    print(f"  QUERY FAILED: {e}", flush=True)
                    continue

                print(f"  progress: {len(collected)}/{limit} {lead_type}", flush=True)

            results[lead_type] = collected[:limit]
            save_outputs(collected[:limit], lead_type, output_dir)

        await browser.close()

    return results


def save_outputs(leads: list[dict], lead_type: str, output_dir: str) -> tuple[str, str]:
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    base = Path(output_dir) / f"karachi_{lead_type}_{ts}"
    # also keep a stable latest name
    latest_json = Path(output_dir) / f"karachi_{lead_type}.json"
    latest_csv = Path(output_dir) / f"karachi_{lead_type}.csv"

    fields = [
        "lead_id",
        "type",
        "business_name",
        "category",
        "address",
        "phone",
        "website",
        "rating",
        "review_count",
        "plus_code",
        "hours",
        "gmaps_url",
        "search_query",
        "scraped_at",
    ]

    for path in (base.with_suffix(".json"), latest_json):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(leads, f, indent=2, ensure_ascii=False)

    for path in (base.with_suffix(".csv"), latest_csv):
        with open(path, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
            writer.writeheader()
            for row in leads:
                writer.writerow(row)

    print(f"\nSaved {len(leads)} {lead_type} → {latest_json} + {latest_csv}", flush=True)
    return str(latest_json), str(latest_csv)


def parse_args():
    p = argparse.ArgumentParser(description="Scrape Karachi restaurants/bakeries from Google Maps")
    p.add_argument(
        "--type",
        choices=["restaurants", "bakeries", "both"],
        default="both",
        help="What to scrape (default: both)",
    )
    p.add_argument("--limit", type=int, default=100, help="Max leads per type (default: 100)")
    p.add_argument("--output-dir", default="output", help="Output directory (default: output)")
    p.add_argument("--headless", action="store_true", help="Run browser headless")
    p.add_argument("--slow-mo", type=int, default=50, help="Playwright slow_mo ms (default: 50)")
    p.add_argument(
        "--test",
        action="store_true",
        help="Quick test mode: 5 leads per type, headless",
    )
    return p.parse_args()


def main():
    args = parse_args()
    limit = 5 if args.test else args.limit
    headless = True if args.test else args.headless

    if args.type == "both":
        types = ["restaurants", "bakeries"]
    else:
        types = [args.type]

    print(
        f"Karachi Maps scraper | types={types} | limit={limit} | headless={headless}",
        flush=True,
    )

    results = asyncio.run(
        run(
            lead_types=types,
            limit=limit,
            output_dir=args.output_dir,
            headless=headless,
            slow_mo=args.slow_mo,
        )
    )

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    total = 0
    for t, leads in results.items():
        with_phone = sum(1 for x in leads if x.get("phone"))
        with_web = sum(1 for x in leads if x.get("website"))
        print(f"  {t}: {len(leads)} leads | phone={with_phone} | website={with_web}")
        total += len(leads)
    print(f"  TOTAL: {total}")
    print(f"  Output dir: {os.path.abspath(args.output_dir)}")

    if args.test and total == 0:
        print("TEST FAILED: 0 leads scraped", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
