import { state } from './utils.js';
import browserManager from './browser.js';

const pageManager = {
  async getPageContent(url, baseDomain, config, useHeadful = false) {
    let page = null;

    try {
      const browser = useHeadful
        ? await browserManager.getHeadfulBrowser()
        : state.browsers.headless;

      page = await browser.newPage();

      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'
      );
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      });

      page.setDefaultNavigationTimeout(config.NAVIGATION_TIMEOUT_MS);
      page.setDefaultTimeout(config.PAGE_LOAD_TIMEOUT_MS);

      if (!useHeadful) {
        await page.setRequestInterception(true);
        page.on('request', (req) => {
          const resourceType = req.resourceType();
          if (config.BLOCK_RESOURCES.includes(resourceType)) {
            req.abort();
          } else {
            req.continue();
          }
        });
      }

      console.log(
        `Loading ${url} in ${useHeadful ? 'headful' : 'headless'} mode`
      );

      await page.goto(url, { waitUntil: config.WAIT_UNTIL });

      await page.waitForSelector(config.WAIT_FOR_SELECTOR);

      const content = await page.content();
      return content;
    } catch (error) {
      console.error(
        `Error fetching ${url} in ${useHeadful ? 'headful' : 'headless'} mode:`,
        error.message
      );
      throw error;
    } finally {
      if (page) {
        await page.close().catch(() => {});
      }
    }
  },
};

export default pageManager;
