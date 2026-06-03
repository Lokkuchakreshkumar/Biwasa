#!/usr/bin/env python3
"""
scrapling_chatgpt.py — Automates ChatGPT web UI to generate a manga page image.

Usage:
  python3 scrapling_chatgpt.py \
    --prompt "Black and white manga page..." \
    --output-dir /path/to/public/generated \
    --page 1 \
    --title my-manga \
    [--chrome-profile /path/to/chrome/profile]

The script prints the relative URL (/generated/<filename>.png) to stdout on success.
Errors go to stderr. Exit code 0 = success, non-zero = failure.
"""

import argparse
import asyncio
import os
import sys
import time
from pathlib import Path

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------

parser = argparse.ArgumentParser(description="Scrape ChatGPT for manga image generation")
parser.add_argument("--prompt", required=True, help="Image generation prompt")
parser.add_argument("--output-dir", required=True, help="Directory to save the image")
parser.add_argument("--page", type=int, default=1, help="Page number")
parser.add_argument("--title", default="manga-maker", help="Safe manga title slug")
parser.add_argument(
    "--chrome-profile",
    default="",
    help="Path to Chrome user data directory (inherits login session). "
         "Leave empty to use Scrapling's default Chromium.",
)
args = parser.parse_args()

# ---------------------------------------------------------------------------
# Validate Scrapling
# ---------------------------------------------------------------------------

try:
    from scrapling.fetchers import DynamicFetcher
    from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError
except ImportError as e:
    print(f"Scrapling or Playwright not installed: {e}", file=sys.stderr)
    print("Run: pip install 'scrapling[fetchers]' && scrapling install", file=sys.stderr)
    sys.exit(1)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

OUTPUT_DIR = Path(args.output_dir)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

SAFE_PAGE = str(args.page).zfill(3)
FILENAME = f"{args.title}-page-{SAFE_PAGE}-{int(time.time())}.png"
OUTPUT_PATH = OUTPUT_DIR / FILENAME
RELATIVE_URL = f"/generated/{FILENAME}"

CHATGPT_URL = "https://chatgpt.com"
FULL_PROMPT = (
    f"Generate a highly detailed, professional manga comic page. "
    f"Cinematic manga art style, expressive line art, screen tones. "
    f"Manga page layout: {args.prompt}"
)

# Selectors — ChatGPT's DOM changes often; we use multiple fallbacks
PROMPT_SELECTORS = [
    "#prompt-textarea",
    "textarea[placeholder]",
    "[contenteditable='true']",
    "div[data-testid='chat-input']",
]

IMAGE_SELECTORS = [
    "img[alt*='Generated image']",
    "img[src*='oaidalleapiprodscus']",
    "img[src*='files.oaiusercontent']",
    ".group img[src^='https']",
    "article img[src^='https']",
]

# ---------------------------------------------------------------------------
# Main async scraping routine
# ---------------------------------------------------------------------------

async def get_active_page(context):
    """Return the most recently active page in the browser context."""
    pages = context.pages
    if not pages:
        return await context.new_page()
    # Return the last page (most recently opened/focused)
    return pages[-1]


async def scrape():
    print(f"[scrapling] Starting browser for page {args.page}...", file=sys.stderr)

    async with async_playwright() as pw:
        # Use user's Chrome profile or local persistent profile
        if args.chrome_profile:
            print(f"[scrapling] Using Chrome profile: {args.chrome_profile}", file=sys.stderr)
            context = await pw.chromium.launch_persistent_context(
                args.chrome_profile,
                headless=False,
                channel="chrome",
                args=["--disable-blink-features=AutomationControlled"],
            )
        else:
            profile_path = os.path.join(os.getcwd(), "scrapling_profile")
            print(f"[scrapling] Using local persistent profile: {profile_path}", file=sys.stderr)
            print("[scrapling] Note: Please log into ChatGPT in the browser window if you are not logged in.", file=sys.stderr)
            print("[scrapling] Once you log in once, your session will be saved forever!", file=sys.stderr)
            context = await pw.chromium.launch_persistent_context(
                profile_path,
                headless=False,
                args=["--disable-blink-features=AutomationControlled"],
            )

        # Use first page from context
        if context.pages:
            page = context.pages[0]
        else:
            page = await context.new_page()

        # Determine starting URL (check for active conversation URL to keep consistency)
        active_chat_file = os.path.join(os.getcwd(), "active_chat_url.txt")
        target_url = CHATGPT_URL

        if os.path.exists(active_chat_file):
            try:
                with open(active_chat_file, "r") as f:
                    saved_url = f.read().strip()
                    if saved_url.startswith("https://chatgpt.com"):
                        target_url = saved_url
                        print(f"[scrapling] Resuming previous ChatGPT conversation thread: {target_url}", file=sys.stderr)
            except Exception:
                pass

        # Navigate to ChatGPT
        print(f"[scrapling] Navigating to {target_url}...", file=sys.stderr)
        await page.goto(target_url, wait_until="domcontentloaded", timeout=60000)
        await asyncio.sleep(4)

        # Find the prompt input, waiting up to 180 seconds if they need to log in
        prompt_input = None
        print("[scrapling] Checking for prompt input (waiting up to 180s for login if needed)...", file=sys.stderr)
        
        login_check_start = time.time()
        while time.time() - login_check_start < 180:
            for selector in PROMPT_SELECTORS:
                try:
                    el = page.locator(selector).first
                    if await el.is_visible(timeout=1000):
                        prompt_input = el
                        print(f"[scrapling] Found prompt input: {selector}", file=sys.stderr)
                        break
                except Exception:
                    continue
            if prompt_input:
                break
            await asyncio.sleep(2)

        if not prompt_input:
            print("[scrapling] Could not find ChatGPT input box within 180 seconds. Are you logged in?", file=sys.stderr)
            await context.close()
            sys.exit(1)

        # Clear any existing text and type the prompt
        await prompt_input.click()
        await asyncio.sleep(0.5)

        await page.keyboard.press("Control+a")
        await page.keyboard.press("Delete")
        await asyncio.sleep(0.3)
        await prompt_input.fill(FULL_PROMPT)
        await asyncio.sleep(0.5)

        # Collect existing image sources before generation
        existing_srcs = await page.evaluate("""() => {
            return Array.from(document.querySelectorAll('img'))
                .map(img => img.src)
                .filter(src => src && !src.includes('avatar') && !src.includes('logo'));
        }""")
        print(f"[scrapling] Before generation: {len(existing_srcs)} existing images", file=sys.stderr)

        # Submit
        print("[scrapling] Submitting prompt...", file=sys.stderr)
        await page.keyboard.press("Enter")

        print("[scrapling] Waiting for generation and rendering to complete (up to 180s)...", file=sys.stderr)

        target_img = None
        try:
            for _ in range(180):
                new_img_handle = await page.evaluate_handle("""(existing) => {
                    const imgs = Array.from(document.querySelectorAll('img'));
                    for (const img of imgs) {
                        if (img.src && !img.src.includes('avatar') && !img.src.includes('logo') && !img.src.startsWith('data:image/svg')) {
                            if (!existing.includes(img.src)) {
                                const rect = img.getBoundingClientRect();
                                if (rect.width > 50 || img.naturalWidth > 50) {
                                    return img;
                                }
                            }
                        }
                    }
                    return null;
                }""", existing_srcs)
                
                target_img = new_img_handle.as_element()
                if target_img:
                    print("[scrapling] New image detected!", file=sys.stderr)
                    await target_img.scroll_into_view_if_needed()
                    break
                     
                await asyncio.sleep(1)
                
            if not target_img:
                print("[scrapling] Wait condition timed out after 180s.", file=sys.stderr)
        except Exception as e:
            print(f"[scrapling] Wait loop error: {e}", file=sys.stderr)

        active_page = page

        # Scroll to the very bottom of the page so the newest image is in the viewport
        await active_page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await asyncio.sleep(1)

        # Scroll the last article into view (ChatGPT uses internal scroll containers)
        try:
            await active_page.locator("article").last.scroll_into_view_if_needed()
            await asyncio.sleep(0.5)
        except Exception:
            pass

        # If we somehow didn't detect a new image, try to grab the last one on the page as fallback
        if not target_img:
            print("[scrapling] Attempting fallback to find last large image...", file=sys.stderr)
            all_imgs = await active_page.locator("img").all()
            for img in reversed(all_imgs):
                try:
                    src = await img.get_attribute("src")
                    if not src or "avatar" in src or "logo" in src or "google" in src:
                        continue
                    
                    await img.scroll_into_view_if_needed()
                    await asyncio.sleep(0.3)
                    box = await img.bounding_box()
                    if box and box["width"] > 100 and box["height"] > 100:
                        target_img = img
                        print(f"[scrapling] Found target image fallback (w={box['width']:.0f}px, h={box['height']:.0f}px)", file=sys.stderr)
                        break
                except Exception:
                    continue

        # ── Wait for the image pixels to FULLY LOAD before saving ────────────
        if target_img:
            print("[scrapling] Waiting for image pixels to finish loading...", file=sys.stderr)
            try:
                await active_page.wait_for_function(
                    """(imgEl) => imgEl.complete && imgEl.naturalWidth > 0""",
                    arg=target_img,
                    timeout=60000
                )
                print("[scrapling] Image fully loaded!", file=sys.stderr)
            except Exception as e:
                print(f"[scrapling] Image load wait: {e} — adding extra 8s pause...", file=sys.stderr)
                await asyncio.sleep(8)
        else:
            print("[scrapling] WARNING: Could not find any target image element!", file=sys.stderr)

        # Wait for network to go fully idle
        try:
            await active_page.wait_for_load_state("networkidle", timeout=20000)
            print("[scrapling] Network idle.", file=sys.stderr)
        except Exception:
            pass

        await asyncio.sleep(1)

        # ── Save the image ────────────────────────────────────────────────────
        saved = False
        if target_img:
            try:
                src = await target_img.get_attribute("src")
                print(f"[scrapling] Saving image (src={src[:80] if src else 'None'})...", file=sys.stderr)

                if src and src.startswith("blob:"):
                    b64_data = await active_page.evaluate("""async (url) => {
                        const response = await fetch(url);
                        const blob = await response.blob();
                        return new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result.split(',')[1]);
                            reader.readAsDataURL(blob);
                        });
                    }""", src)
                    import base64
                    OUTPUT_PATH.write_bytes(base64.b64decode(b64_data))
                    print(f"[scrapling] Saved blob image to {OUTPUT_PATH}", file=sys.stderr)
                    saved = True
                elif src and src.startswith("http"):
                    response = await active_page.request.get(src)
                    if response.ok:
                        OUTPUT_PATH.write_bytes(await response.body())
                        print(f"[scrapling] Saved image from URL to {OUTPUT_PATH}", file=sys.stderr)
                        saved = True
                    else:
                        print(f"[scrapling] URL download HTTP {response.status} — will screenshot", file=sys.stderr)

                # Screenshot fallback (always works)
                if not saved:
                    await target_img.screenshot(path=str(OUTPUT_PATH))
                    print(f"[scrapling] Saved element screenshot to {OUTPUT_PATH}", file=sys.stderr)
                    saved = True
            except Exception as e:
                print(f"[scrapling] Image save error: {e}", file=sys.stderr)



        # Last resort: screenshot the whole last article
        if not saved:
            print("[scrapling] Falling back to full article screenshot...", file=sys.stderr)
            try:
                last_article = active_page.locator("article").last
                await last_article.screenshot(path=str(OUTPUT_PATH))
                print(f"[scrapling] Saved article screenshot to {OUTPUT_PATH}", file=sys.stderr)
                saved = True
            except Exception as e2:
                print(f"[scrapling] Article screenshot failed: {e2}", file=sys.stderr)
                await context.close()
                sys.exit(1)

        # Capture the current conversation URL and save it for future runs!
        try:
            current_url = active_page.url
            if "/c/" in current_url:
                with open(active_chat_file, "w") as f:
                    f.write(current_url)
                print(f"[scrapling] Saved active conversation thread URL: {current_url}", file=sys.stderr)
        except Exception as e:
            print(f"[scrapling] Failed to save conversation URL: {e}", file=sys.stderr)

        await context.close()

    # Output the relative URL for Node.js to pick up
    print(RELATIVE_URL)



# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # Patch argparse attribute name (--chrome-profile → chrome_profile)
    args.chrome_profile = args.chrome_profile  # already normalized by argparse
    asyncio.run(scrape())
