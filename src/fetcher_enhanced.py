from playwright.sync_api import sync_playwright
import logging
from typing import Tuple


def fetch_site_enhanced(domain: str, headless: bool = True, anti_detection: bool = False) -> Tuple[str, bytes]:
    """
    Enhanced fetcher with headful mode and anti-detection features.
    
    Args:
        domain: Domain to fetch
        headless: If True, runs in headless mode. If False, shows browser window.
        anti_detection: If True, applies anti-bot detection measures
        
    Returns:
        Tuple of (html_content, screenshot_bytes)
    """
    url = f"https://{domain}"
    
    for attempt in range(2):
        with sync_playwright() as p:
            # Configure browser launch options
            launch_options = {"headless": headless}
            
            if anti_detection:
                launch_options["args"] = [
                    '--disable-blink-features=AutomationControlled',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                    '--disable-dev-shm-usage',
                    '--no-sandbox',
                    '--disable-setuid-sandbox'
                ]
            
            browser = p.chromium.launch(**launch_options)
            
            # Configure context with realistic settings for anti-detection
            context_options = {}
            if anti_detection:
                context_options.update({
                    "user_agent": 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    "viewport": {'width': 1920, 'height': 1080},
                    "extra_http_headers": {
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'DNT': '1',
                        'Connection': 'keep-alive',
                        'Upgrade-Insecure-Requests': '1'
                    }
                })
            
            context = browser.new_context(**context_options)
            page = context.new_page()
            
            try:
                # Apply anti-detection scripts
                if anti_detection:
                    page.add_init_script("""
                        Object.defineProperty(navigator, 'webdriver', {
                            get: () => undefined,
                        });
                        
                        Object.defineProperty(navigator, 'languages', {
                            get: () => ['en-US', 'en'],
                        });
                        
                        Object.defineProperty(navigator, 'plugins', {
                            get: () => [1, 2, 3, 4, 5],
                        });
                    """)
                
                # Navigate with appropriate timeout
                timeout = 45000 if anti_detection else 30000
                page.goto(url, timeout=timeout, wait_until="domcontentloaded")
                
                # Wait for page to stabilize
                wait_time = 3000 if anti_detection else 1000
                page.wait_for_timeout(wait_time)
                
                # Enhanced cookie banner removal
                if anti_detection:
                    page.evaluate("""
                        const selectors = [
                            '[id*="cookie"]', '[class*="cookie"]', '[aria-label*="cookie"]',
                            '[id*="consent"]', '[class*="consent"]', '[aria-label*="consent"]',
                            '[id*="banner"]', '[class*="banner"]',
                            '[id*="modal"]', '[class*="modal"]',
                            '[id*="overlay"]', '[class*="overlay"]',
                            '[class*="popup"]', '[id*="popup"]',
                            '[class*="gdpr"]', '[id*="gdpr"]'
                        ];
                        
                        selectors.forEach(selector => {
                            document.querySelectorAll(selector).forEach(el => {
                                const style = window.getComputedStyle(el);
                                const rect = el.getBoundingClientRect();
                                
                                if (style.position === 'fixed' || 
                                    style.position === 'absolute' ||
                                    style.zIndex > 1000 ||
                                    rect.width > window.innerWidth * 0.8) {
                                    el.remove();
                                }
                            });
                        });
                        
                        // Try to click accept buttons
                        const acceptSelectors = [
                            'button[id*="accept"]', 'button[class*="accept"]',
                            'button[id*="agree"]', 'button[class*="agree"]',
                            'a[id*="accept"]', 'a[class*="accept"]'
                        ];
                        
                        acceptSelectors.forEach(selector => {
                            document.querySelectorAll(selector).forEach(btn => {
                                if (btn.offsetParent !== null) {
                                    btn.click();
                                }
                            });
                        });
                    """)
                else:
                    # Basic cookie banner removal
                    page.evaluate("""
                        document.querySelectorAll(
                            '[id*=cookie], [class*=cookie], [aria-label*=cookie]'
                        ).forEach(el => el.remove());
                    """)
                
                # Additional wait after cleanup for anti-detection mode
                if anti_detection:
                    page.wait_for_timeout(2000)
                
                html = page.content()
                screenshot = page.screenshot(full_page=True)
                
                logging.info(f"Successfully fetched {domain} (attempt {attempt+1}, headless={headless}, anti_detection={anti_detection})")
                return html, screenshot
                
            except Exception as e:
                logging.error(f"Error fetching {domain} (attempt {attempt+1}): {e}")
            finally:
                browser.close()
    
    raise RuntimeError(f"Failed to fetch site after retries: {domain}")


def fetch_site(domain: str) -> Tuple[str, bytes]:
    """
    Original fetch_site function for backward compatibility.
    Uses headless mode with basic settings.
    """
    return fetch_site_enhanced(domain, headless=True, anti_detection=False)
