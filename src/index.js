import crawl from './crawler.js';

crawl().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
