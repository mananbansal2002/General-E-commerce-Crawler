import puppeteer from 'puppeteer';
import { state } from './utils.js';

const browserManager = {
  async initBrowsers() {
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

export default browserManager;
