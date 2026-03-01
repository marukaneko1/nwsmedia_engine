import asyncio
import random

from playwright.async_api import BrowserContext, Page, async_playwright
from playwright_stealth import Stealth

from src.utils.proxy import get_proxy_config, random_headers, random_user_agent, random_viewport


async def create_stealth_browser(headless: bool = True) -> tuple:
    """Launch a stealth Playwright browser with anti-detection measures.

    Returns (playwright_instance, browser, context, page).
    Caller is responsible for closing via playwright_instance.stop().
    """
    pw = await async_playwright().start()

    proxy = get_proxy_config()
    browser = await pw.chromium.launch(
        headless=headless,
        args=[
            "--disable-blink-features=AutomationControlled",
            "--disable-features=IsolateOrigins,site-per-process",
            "--no-sandbox",
        ],
    )

    viewport = random_viewport()
    ctx_kwargs = dict(
        viewport=viewport,
        user_agent=random_user_agent(),
        locale="en-US",
        timezone_id="America/New_York",
        extra_http_headers=random_headers(),
        permissions=["geolocation"],
        ignore_https_errors=True,
    )
    if proxy:
        ctx_kwargs["proxy"] = proxy

    context = await browser.new_context(**ctx_kwargs)

    stealth = Stealth()
    await stealth.apply_stealth_async(context)

    page = await context.new_page()

    return pw, browser, context, page


async def human_delay(min_sec: float = 1.0, max_sec: float = 3.0) -> None:
    await asyncio.sleep(random.uniform(min_sec, max_sec))


async def smooth_scroll(page: Page, selector: str, scrolls: int = 3) -> None:
    """Scroll an element gradually like a human would."""
    for _ in range(scrolls):
        await page.evaluate(
            f"""
            (sel) => {{
                const el = document.querySelector(sel);
                if (el) el.scrollBy({{ top: 600 + Math.random() * 400, behavior: 'smooth' }});
            }}
            """,
            selector,
        )
        await human_delay(0.8, 2.0)
