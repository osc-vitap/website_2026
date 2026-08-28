import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Set viewport to a good poster size.
  // We want to capture the poster. The event card might crop it.
  // Let's set a standard viewport and take a screenshot.
  await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 2 });
  
  // Wait, how do I view ID 14 specifically?
  // Is there a route for a specific poster?
  // Let's check `App.tsx` or router for how poster routing works.
  // E.g. `/events/gittyup26?id=14`?
})();
