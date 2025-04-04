import pLimit from 'p-limit';
import { state } from './utils.js';
import browserManager from './browser.js';
import linkExtractor from './extractor.js';
import resultManager from './results.js';
import configManager from './config.js';

// Main crawler
async function crawl() {
  try {
    const startTime = Date.now();
    const DOMAINS = configManager.DOMAINS;
    const outputDir = configManager.DEFAULT_CONFIG.OUTPUT_DIR;

    // Create output directory
    await resultManager.createOutputDirectory(outputDir);

    // Initialize browsers
    console.log('Launching headless browser...');
    await browserManager.initBrowsers();

    // Set up concurrency control for each domain
    const domainLimits = {};
    const domainResults = {};

    // Initialize result collections
    for (const domain of DOMAINS) {
      const config = configManager.getConfigForDomain(domain);
      domainLimits[domain] = pLimit(config.CONCURRENCY_LIMIT);
      domainResults[domain] = [];
      state.queue.push({ link: domain, depth: 1, baseDomain: domain });
    }

    while (state.queue.length > 0) {
      const nextBatch = [];
      const batchMap = {};

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

      nextBatch.forEach((item) => {
        const index = state.queue.findIndex((q) => q.link === item.link);
        if (index !== -1) {
          state.queue.splice(index, 1);
        }
      });

      const batchResults = await Promise.all(
        nextBatch.map(({ link, depth, baseDomain }) => {
          return domainLimits[baseDomain](async () => {
            try {
              const config = configManager.getConfigForDomain(baseDomain);
              const productLinks = await linkExtractor.extractProductLinks(
                link,
                depth,
                baseDomain,
                config
              );

              return { baseDomain, productLinks };
            } catch (error) {
              console.error(`Error processing ${link}: ${error.message}`);
              return { baseDomain, productLinks: [] };
            }
          });
        })
      );

      for (const { baseDomain, productLinks } of batchResults) {
        if (productLinks.length > 0) {
          const existingUrls = new Set(domainResults[baseDomain]);
          for (const url of productLinks) {
            if (!existingUrls.has(url)) {
              domainResults[baseDomain].push(url);
              existingUrls.add(url);
            }
          }
        }
      }

      if (state.queue.length % 10 === 0 || state.queue.length === 0) {
        const totalLinks = Object.values(domainResults).reduce(
          (sum, links) => sum + links.length,
          0
        );

        console.log(
          `Queue: ${state.queue.length}, Visited: ${state.visited.size}, Products found: ${totalLinks}`
        );
      }
    }

    // Save all results at once at the end
    await resultManager.saveResults(domainResults, outputDir);

    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`Crawling completed in ${duration} seconds!`);
    console.log(`Visited ${state.visited.size} URLs`);

    const totalProducts = Object.values(domainResults).reduce(
      (sum, links) => sum + links.length,
      0
    );
    console.log(`Found ${totalProducts} product URLs`);
    console.log(`Results saved to ${outputDir}`);
  } catch (error) {
    console.error('Crawl failed:', error);
  } finally {
    await browserManager.cleanup();
  }
}

export default crawl;
