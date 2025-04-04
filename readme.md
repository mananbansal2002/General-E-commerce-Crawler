# E-Commerce Web Crawler

This project is a general-purpose web crawler designed to extract product URLs from e-commerce websites. It efficiently navigates through pages, identifies product links, and saves the extracted data. The crawler can be customized with domain-specific configurations to optimize performance for different websites.

## Table of Contents

- [Installation](#installation)
- [Understanding Headless vs Headful Mode](#understanding-headless-vs-headful-mode)
- [Understanding Concurrency and Depth](#understanding-concurrency-and-depth)
- [Default Configuration](#default-configuration)
- [Domains to Crawl](#domains-to-crawl)
- [How to Add a New Website](#how-to-add-a-new-website)
- [Running the Crawler](#running-the-crawler)

---

## Installation

To get started, clone the repository and install the required dependencies:

```sh
npm install
```

To start the project, run:

```sh
npm start
```

---

## Understanding Headless vs Headful Mode

- **Headless Mode**: Runs the browser in the background without a UI. This is faster, consumes fewer resources, and is preferred for automation.
- **Headful Mode (HEADFUL_FALLBACK: true)**: Opens a visible browser window for crawling. Useful for debugging and handling websites that require interactions like clicking buttons or scrolling.

The crawler defaults to headless mode but switches to headful mode when necessary.

---

## Understanding Concurrency and Depth

- **Concurrency (`CONCURRENCY_LIMIT`)**: Determines how many pages the crawler processes simultaneously. Higher values improve speed but can overload the target server or the local system.
- **Max Depth (`MAX_DEPTH`)**: Specifies how deep the crawler should navigate from the starting URL. A higher value results in deeper exploration but increases execution time and resource usage.

For example:

- A `CONCURRENCY_LIMIT` of `100` allows processing 100 pages in parallel.
- A `MAX_DEPTH` of `5` means the crawler will follow links up to five levels deep.

Balancing these values ensures optimal crawling without causing excessive load.

---

## Default Configuration

The crawler applies the following default settings unless overridden by a website-specific configuration:

| Option                  | Description                              | Default Value                              |
| ----------------------- | ---------------------------------------- | ------------------------------------------ |
| `CONCURRENCY_LIMIT`     | Max simultaneous pages processed         | `100`                                      |
| `MAX_DEPTH`             | Max depth for crawling links             | `20`                                       |
| `PAGE_LOAD_TIMEOUT_MS`  | Timeout for page load (ms)               | `10000`                                    |
| `NAVIGATION_TIMEOUT_MS` | Timeout for page navigation (ms)         | `100000`                                   |
| `RETRY_ATTEMPTS`        | Number of retries for a failed request   | `2`                                        |
| `RETRY_DELAY_MS`        | Delay between retries (ms)               | `2000`                                     |
| `OUTPUT_DIR`            | Directory for saving results             | `./results`                                |
| `BLOCK_RESOURCES`       | Resources to block for efficiency        | `['image', 'stylesheet', 'font', 'media']` |
| `WAIT_FOR_SELECTOR`     | Wait for this element before processing  | `'html'`                                   |
| `WAIT_UNTIL`            | Page load event to wait for              | `'domcontentloaded'`                       |
| `PRODUCT_PATTERNS`      | Patterns for identifying product URLs    | Various regex patterns                     |
| `HEADFUL_FALLBACK`      | Use headful mode if headless fails       | `false`                                    |
| `MIN_LINKS_THRESHOLD`   | Minimum links required to process a page | `1`                                        |
| `EXCLUDE_URL_PATTERNS`  | List of URLs to exclude                  | `[]`                                       |

These settings ensure efficient crawling while reducing unnecessary resource usage.

---

## Domains to Crawl

The crawler currently supports the following e-commerce websites:

- [Tatacliq](https://www.tatacliq.com/)
- [Virgio](https://www.virgio.com/)
- [Nykaa Fashion](https://www.nykaafashion.com/)
- [Westside](https://www.westside.com/)

To crawl additional websites, simply add their URLs to the `DOMAINS` list inside `configManager`.

---

## How to Add a New Website

To support a new e-commerce website:

1. Identify the domain and any necessary configurations.
2. Update `WEBSITE_CONFIGS` inside `configManager`.

Example:

```js
'www.example.com': {
  MAX_DEPTH: 15,
  CONCURRENCY_LIMIT: 80,
  HEADFUL_FALLBACK: true,
},
```

3. Add the domain to the `DOMAINS` array:

```js
'DOMAINS': [
  'https://www.example.com/',
]
```

4. Run the crawler to verify functionality.

---

## Running the Crawler

Once everything is set up, start the crawler using:

```sh
npm start
```

This will launch the crawler, applying the correct configurations for each domain and saving results in the output directory (`./results`).
