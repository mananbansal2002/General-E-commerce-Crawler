import { URL } from 'url';

export const state = {
  visited: new Set(),
  queue: [],
  browsers: {
    headless: null,
    headful: null,
  },
  currentDepth: 0,
};

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

  isProductUrl(url, baseDomain, productPatterns) {
    return productPatterns.some((pattern) => pattern.test(url));
  },

  shouldCrawlUrl(url, baseDomain, config) {
    try {
      if (!url || url.startsWith('#') || url.startsWith('javascript:'))
        return false;
      if (url.endsWith('.jpg') || url.endsWith('.png') || url.endsWith('.pdf'))
        return false;
      const urlObj = new URL(url, baseDomain);
      return (
        urlObj.origin === new URL(baseDomain).origin &&
        !state.visited.has(this.normalizeUrl(urlObj.href)) &&
        config.EXCLUDE_URL_PATTERNS.every(
          (pattern) => !new RegExp(pattern).test(url)
        )
      );
    } catch (error) {
      console.log(error);
      return false;
    }
  },
};

export default utils;
