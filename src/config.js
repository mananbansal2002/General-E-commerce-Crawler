import { URL } from 'url';

// Configuration manager
const configManager = {
  DEFAULT_CONFIG: {
    CONCURRENCY_LIMIT: 100,
    MAX_DEPTH: 20,
    PAGE_LOAD_TIMEOUT_MS: 10000,
    NAVIGATION_TIMEOUT_MS: 100000,
    RETRY_ATTEMPTS: 2,
    RETRY_DELAY_MS: 2000,
    OUTPUT_DIR: './results',
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
    EXCLUDE_URL_PATTERNS: [],
  },

  // Website-specific configurations
  WEBSITE_CONFIGS: {
    'www.tatacliq.com': {
      CONCURRENCY_LIMIT: 50,
      HEADFUL_FALLBACK: true,
    },
    'www.virgio.com': { MAX_DEPTH: 10 },
    'www.nykaafashion.com': { MAX_DEPTH: 5 },
    'www.westside.com': {
      MAX_DEPTH: 10,
      EXCLUDE_URL_PATTERNS: ['/apps/buy/'],
      CONCURRENCY_LIMIT: 100,
      HEADFUL_FALLBACK: true,
    },
  },

  // Sites to crawl
  DOMAINS: [
    'https://www.tatacliq.com/',
    'https://www.virgio.com/',
    'https://www.nykaafashion.com/',
    'https://www.westside.com/',
  ],

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

export default configManager;
