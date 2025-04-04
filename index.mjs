import fs from 'fs/promises';
import pLimit from 'p-limit';
import { URL } from 'url';
import path from 'path';
import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';

// Configuration
const configManager = {
  DEFAULT_CONFIG: {
    CONCURRENCY_LIMIT: 100,
    MAX_DEPTH: 3,
    PAGE_LOAD_TIMEOUT_MS: 3000,
    NAVIGATION_TIMEOUT_MS: 30000,
    RETRY_ATTEMPTS: 1,
    RETRY_DELAY_MS: 2000,
    OUTPUT_FILE: 'product_urls.json',
    BLOCK_RESOURCES: ['image', 'stylesheet', 'font', 'media'],
    WAIT_FOR_SELECTOR: 'html',
    WAIT_UNTIL: 'domcontentloaded',
    PRODUCT_PATTERNS: [
      /\/products\//,
      /\/p\//,
      /\/items\//,
      /\/product\//,
      /\/prod\//,
      /\/p-[a-zA-Z0-9]+/,
    ],
    HEADFUL_FALLBACK: false,
    MIN_LINKS_THRESHOLD: 1,
  },

  // Website-specific configurations
  WEBSITE_CONFIGS: {
    'www.tatacliq.com': {
      HEADFUL_FALLBACK: true,
    },
    'www.virgio.com': { MAX_DEPTH: 10 },
    'www.nykaafashion.com': { MAX_DEPTH: 10 },
    'www.westside.com': { MAX_DEPTH: 10 },
  },

  // Get config for a specific domain
  getConfigForDomain(domain) {
    try {
      const hostname = new URL(domain).hostname;
      const domainConfig = this.WEBSITE_CONFIGS[hostname] || {};
      return { ...this.DEFAULT_CONFIG, ...domainConfig };
    } catch (error) {
      console.error(`Invalid domain URL: ${domain}`);
      return this.DEFAULT_CONFIG;
    }
  },
};

// Sites to crawl
const DOMAINS = [
  'https://www.tatacliq.com/',
  'https://www.virgio.com/',
  'https://www.nykaafashion.com/',
  'https://www.westside.com/',
];

// Crawler state
const state = {
  visited: new Set(),
  queue: [],
  browsers: {
    headless: null,
    headful: null,
  },
};

// Helper functions
const utils = {
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),

  normalizeUrl(url) {
    try {
      const urlObj = new URL(url);
      urlObj.hash = '';

      const searchParams = new URLSearchParams(urlObj.search);
      ['utm_source', 'utm_medium', 'utm_campaign', 'ref'].forEach((param) => {
        searchParams.delete(param);
      });

      urlObj.search = searchParams.toString();
      return urlObj.toString().replace(/\/$/, '');
    } catch (error) {
      return url;
    }
  },

  isProductUrl(url, baseDomain) {
    const config = configManager.getConfigForDomain(baseDomain);
    return config.PRODUCT_PATTERNS.some((pattern) => pattern.test(url));
  },

  shouldCrawlUrl(url, baseDomain) {
    try {
      if (!url || url.startsWith('#') || url.startsWith('javascript:'))
        return false;
      if (url.endsWith('.jpg') || url.endsWith('.png') || url.endsWith('.pdf'))
        return false;

      const urlObj = new URL(url, baseDomain);

      return (
        urlObj.origin === new URL(baseDomain).origin &&
        !state.visited.has(this.normalizeUrl(urlObj.href))
      );
    } catch (error) {
      return false;
    }
  },
};

// Browser manager
const browserManager = {
  async initBrowsers() {
    // Initialize headless browser
    state.browsers.headless = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
      ],
      defaultViewport: { width: 1920, height: 1080 },
    });

    console.log('Headless browser initialized');
    return state.browsers.headless;
  },

  async getHeadfulBrowser() {
    if (!state.browsers.headful) {
      state.browsers.headful = await puppeteer.launch({
        headless: false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--window-size=1920,1080',
        ],
        defaultViewport: { width: 1920, height: 1080 },
      });
      console.log('Initialized headful browser for fallback');
    }
    return state.browsers.headful;
  },

  async cleanup() {
    if (state.browsers.headless) {
      await state.browsers.headless.close().catch(() => {});
      console.log('Headless browser closed');
    }
    if (state.browsers.headful) {
      await state.browsers.headful.close().catch(() => {});
      console.log('Headful browser closed');
    }
  },
};

// Page manager
const pageManager = {
  async getPageContent(url, baseDomain, useHeadful = false) {
    const config = configManager.getConfigForDomain(baseDomain);
    let page = null;

    try {
      // Select the appropriate browser instance
      const browser = useHeadful
        ? await browserManager.getHeadfulBrowser()
        : state.browsers.headless;

      page = await browser.newPage();

      // Set user agent and other headers
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'
      );
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      });

      // Set timeouts
      page.setDefaultNavigationTimeout(config.NAVIGATION_TIMEOUT_MS);
      page.setDefaultTimeout(config.PAGE_LOAD_TIMEOUT_MS);

      // Block unnecessary resources in headless mode to speed up loading
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

      // Log mode being used
      console.log(
        `Loading ${url} in ${useHeadful ? 'headful' : 'headless'} mode`
      );

      // Navigate to URL
      await page.goto(url, { waitUntil: config.WAIT_UNTIL });

      // Wait for content to load
      await page.waitForSelector(config.WAIT_FOR_SELECTOR);

      // Get the HTML content
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

// Link extractor
const linkExtractor = {
  extractLinksFromHTML(html, baseUrl, baseDomain) {
    const $ = cheerio.load(html);
    const productLinks = new Set();

    // Extract links
    $('a').each((_, element) => {
      try {
        const link = $(element).attr('href');
        if (!link) return;

        const absoluteLink = new URL(link, baseUrl).href;
        const normalizedLink = utils.normalizeUrl(absoluteLink);

        if (utils.isProductUrl(normalizedLink, baseDomain)) {
          productLinks.add(normalizedLink);
        } else if (utils.shouldCrawlUrl(normalizedLink, baseDomain)) {
          state.queue.push({
            link: normalizedLink,
            depth: state.currentDepth + 1,
            baseDomain,
          });
        }
      } catch (error) {
        // Silently ignore invalid URLs
      }
    });

    // Check for JSON-LD product metadata
    $('script[type="application/ld+json"]').each((_, element) => {
      try {
        const jsonData = JSON.parse($(element).html());
        if (jsonData['@type'] === 'Product') {
          productLinks.add(utils.normalizeUrl(baseUrl));
        }
      } catch (error) {
        // Silently ignore invalid JSON
      }
    });

    return productLinks;
  },

  async extractProductLinks(url, depth, baseDomain) {
    const normalizedUrl = utils.normalizeUrl(url);
    const config = configManager.getConfigForDomain(baseDomain);
    state.currentDepth = depth;

    if (depth > config.MAX_DEPTH || state.visited.has(normalizedUrl)) return [];
    state.visited.add(normalizedUrl);

    try {
      console.log(`Crawling: ${url} at depth ${depth}`);

      let html;
      let productLinks = new Set();
      let fallbackTriggered = false;

      try {
        // First attempt with headless browser
        html = await pageManager.getPageContent(url, baseDomain, false);
        productLinks = this.extractLinksFromHTML(html, url, baseDomain);

        // Check if we found enough links, if not and fallback is enabled, try headful
        if (
          config.HEADFUL_FALLBACK &&
          productLinks.size < config.MIN_LINKS_THRESHOLD
        ) {
          fallbackTriggered = true;
          console.log(
            `No product links found in headless mode for ${url}, trying headful mode...`
          );

          // Try with headful browser
          html = await pageManager.getPageContent(url, baseDomain, true);
          const headfulLinks = this.extractLinksFromHTML(html, url, baseDomain);
          headfulLinks.forEach((link) => productLinks.add(link));
        }
      } catch (error) {
        // If headless fails and we haven't tried headful yet, try headful as a fallback
        if (config.HEADFUL_FALLBACK && !fallbackTriggered) {
          console.log(
            `Headless browser failed for ${url}, trying headful mode as fallback...`
          );

          try {
            html = await pageManager.getPageContent(url, baseDomain, true);
            const headfulLinks = this.extractLinksFromHTML(
              html,
              url,
              baseDomain
            );
            headfulLinks.forEach((link) => productLinks.add(link));
          } catch (secondError) {
            console.error(`Both headless and headful mode failed for ${url}`);
            throw secondError;
          }
        } else {
          throw error;
        }
      }

      if (productLinks.size > 0) {
        console.log(`Found ${productLinks.size} product links on ${url}`);
      }

      return [...productLinks];
    } catch (error) {
      console.error(`Error processing ${url}:`, error.message);
      return [];
    }
  },
};

// Result manager
const resultManager = {
  async saveResults(results) {
    const outputDir = path.dirname(configManager.DEFAULT_CONFIG.OUTPUT_FILE);
    await fs.mkdir(outputDir, { recursive: true });

    for (const domain of DOMAINS) {
      const domainName = new URL(domain).hostname.replace(/\./g, '_');
      const domainFile = `${domainName}_products.json`;
      await fs.writeFile(
        domainFile,
        JSON.stringify(
          {
            domain,
            productCount: results[domain].length,
            crawlDate: new Date().toISOString(),
            products: results[domain],
          },
          null,
          2
        )
      );
    }

    await fs.writeFile(
      configManager.DEFAULT_CONFIG.OUTPUT_FILE,
      JSON.stringify(results, null, 2)
    );
  },
};

// Main crawler
async function crawl() {
  try {
    const results = {};
    const startTime = Date.now();

    // Initialize browsers
    console.log('Launching headless browser...');
    await browserManager.initBrowsers();

    // Set up concurrency control for each domain
    const domainLimits = {};

    for (const domain of DOMAINS) {
      const config = configManager.getConfigForDomain(domain);
      domainLimits[domain] = pLimit(config.CONCURRENCY_LIMIT);
      results[domain] = [];
      state.queue.push({ link: domain, depth: 1, baseDomain: domain });
    }

    while (state.queue.length > 0) {
      // Process in batches
      const nextBatch = [];
      const batchMap = {};

      // Group by domain and respect each domain's concurrency limit
      for (const domain of DOMAINS) {
        const domainItems = state.queue.filter(
          (item) => item.baseDomain === domain
        );
        const config = configManager.getConfigForDomain(domain);
        const batchSize = Math.min(
          config.CONCURRENCY_LIMIT,
          domainItems.length
        );

        if (batchSize > 0) {
          batchMap[domain] = domainItems.slice(0, batchSize);
          nextBatch.push(...batchMap[domain]);
        }
      }

      // Remove processed items from queue
      nextBatch.forEach((item) => {
        const index = state.queue.findIndex((q) => q.link === item.link);
        if (index !== -1) {
          state.queue.splice(index, 1);
        }
      });

      await Promise.all(
        nextBatch.map(({ link, depth, baseDomain }) => {
          return domainLimits[baseDomain](async () => {
            try {
              const links = await linkExtractor.extractProductLinks(
                link,
                depth,
                baseDomain
              );
              if (links.length > 0) {
                results[baseDomain] = [
                  ...new Set([...results[baseDomain], ...links]),
                ];
              }
            } catch (error) {
              console.error(`Error processing ${link}: ${error.message}`);
            }
          });
        })
      );

      if (state.queue.length % 10 === 0 || state.queue.length === 0) {
        const totalLinks = Object.values(results).flat().length;
        console.log(
          `Queue: ${state.queue.length}, Visited: ${state.visited.size}, Products found: ${totalLinks}`
        );
      }
    }

    await resultManager.saveResults(results);

    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`Crawling completed in ${duration} seconds!`);
    console.log(`Visited ${state.visited.size} URLs`);
    console.log(`Found ${Object.values(results).flat().length} product URLs`);
    console.log(
      `Results saved to ${configManager.DEFAULT_CONFIG.OUTPUT_FILE} and individual domain files`
    );
  } catch (error) {
    console.error('Crawl failed:', error);
  } finally {
    // Clean up browsers
    await browserManager.cleanup();
  }
}

// Start the crawler
crawl().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
