/* global XMLSerializer */
const path = require('path')
const puppeteer = require('puppeteer')

class SyntaxError extends Error {
  constructor () {
    super('Syntax error in graph')
  }
}

class Worker {
  constructor (browserInstance) {
    this.browserWSEndpoint = browserInstance.wsEndpoint()
    this.pageUrl = process.env.KROKI_MERMAID_PAGE_URL || `file://${path.join(__dirname, '..', 'assets', 'index.html')}`
  }

  async convert (task) {
    const browser = await puppeteer.connect({
      browserWSEndpoint: this.browserWSEndpoint,
      ignoreHTTPSErrors: true
    })
    const page = await browser.newPage()
    try {
      page.setViewport({ height: 800, width: 600 })
      await page.goto(this.pageUrl)
      // QUESTION: should we reuse the page for performance reason ?
      await page.evaluate((source) => {
        return render({
          xml: source,
          format: 'svg'
        });
      }, task.source);

      //default timeout is 30000 (30 sec)
      await page.waitForSelector('#LoadingComplete')

      //const bounds = await page.mainFrame().$eval('#LoadingComplete', div => div.getAttribute('bounds'))
      //const pageId = await page.mainFrame().$eval('#LoadingComplete', div => div.getAttribute('page-id'))
      //const scale = await page.mainFrame().$eval('#LoadingComplete', div => div.getAttribute('scale'))
      //const pageCount = parseInt(await page.mainFrame().$eval('#LoadingComplete', div => div.getAttribute('pageCount')))

      // diagrams are directly under #graph, while the SVG generated upon syntax error is wrapped in a div
      const svg = await page.$('#graph > svg')
      if (task.isPng) {
        return await svg.screenshot({
          type: 'png',
          omitBackground: true
        })
      } else {
        return await page.$eval('#graph', container => {
          const xmlSerializer = new XMLSerializer()
          const nodes = []
          for (let i = 0; i < container.childNodes.length; i++) {
            nodes.push(xmlSerializer.serializeToString(container.childNodes[i]))
          }
          return nodes.join('')
        })
      }
    } finally {
      try {
        await page.close()
      } catch (e) {
        console.warn('Unable to close the page', e)
      }
      try {
        await browser.disconnect()
      } catch (e) {
        console.warn('Unable to disconnect from the browser', e)
      }
    }
  }
}

module.exports = {
  Worker,
  SyntaxError
}