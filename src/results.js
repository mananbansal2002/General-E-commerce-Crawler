import fs from 'fs/promises';
import path from 'path';
import { URL } from 'url';

const resultManager = {
  async createOutputDirectory(outputDir) {
    await fs.mkdir(outputDir, { recursive: true });
    return outputDir;
  },

  async saveResults(domainResults, outputDir) {
    const domainFiles = {};
    const summary = {};

    for (const [domain, productUrls] of Object.entries(domainResults)) {
      const domainName = new URL(domain).hostname.replace(/\./g, '_');
      const domainFile = path.join(outputDir, `${domainName}_products.json`);

      const data = {
        domain,
        productCount: productUrls.length,
        crawlDate: new Date().toISOString(),
        products: productUrls,
      };

      await fs.writeFile(domainFile, JSON.stringify(data, null, 2));
      console.log(`Saved ${productUrls.length} product URLs to ${domainFile}`);

      domainFiles[domain] = domainFile;
      summary[domain] = productUrls;
    }

    const summaryFile = path.join(outputDir, 'all_products.json');
    await fs.writeFile(summaryFile, JSON.stringify(summary, null, 2));
    console.log(`Summary saved to ${summaryFile}`);

    return { domainFiles, summaryFile };
  },
};

export default resultManager;
