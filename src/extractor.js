import * as cheerio from 'cheerio';
import { URL } from 'url';
import { state } from './utils.js';
import utils from './utils.js';
import pageManager from './page.js';

const linkExtractor = {
  extractLinksFromHTML(html, baseUrl, baseDomain, config) {
    const $ = cheerio.load(html);
    const productLinks = new Set();

    $('a').each((_, element) => {
      try {
        const link = $(element).attr('href');
        if (!link) return;

        const absoluteLink = new URL(link, baseUrl).href;
        const normalizedLink = utils.normalizeUrl(absoluteLink);

        if (
          utils.isProductUrl(
            normalizedLink,
            baseDomain,
            config.PRODUCT_PATTERNS
          )
        ) {
          productLinks.add(normalizedLink);
        } else if (utils.shouldCrawlUrl(normalizedLink, baseDomain, config)) {
          state.queue.push({
            link: normalizedLink,
            depth: state.currentDepth + 1,
            baseDomain,
          });
        }
      } catch (error) {
        console.log(error);
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

  async extractProductLinks(url, depth, baseDomain, config) {
    const normalizedUrl = utils.normalizeUrl(url);
    state.currentDepth = depth;

    if (depth > config.MAX_DEPTH || state.visited.has(normalizedUrl)) return [];
    state.visited.add(normalizedUrl);

    try {
      console.log(`Crawling: ${url} at depth ${depth}`);

      let html;
      let productLinks = new Set();
      let fallbackTriggered = false;

      try {
        html = await pageManager.getPageContent(url, baseDomain, config, false);
        productLinks = this.extractLinksFromHTML(html, url, baseDomain, config);

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
          html = await pageManager.getPageContent(
            url,
            baseDomain,
            config,
            true
          );
          const headfulLinks = this.extractLinksFromHTML(
            html,
            url,
            baseDomain,
            config
          );
          headfulLinks.forEach((link) => productLinks.add(link));
        }
      } catch (error) {
        // If headless fails and we haven't tried headful yet, try headful as a fallback
        if (config.HEADFUL_FALLBACK && !fallbackTriggered) {
          console.log(
            `Headless browser failed for ${url}, trying headful mode as fallback...`
          );

          try {
            html = await pageManager.getPageContent(
              url,
              baseDomain,
              config,
              true
            );
            const headfulLinks = this.extractLinksFromHTML(
              html,
              url,
              baseDomain,
              config
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

export default linkExtractor;
