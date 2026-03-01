const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const screenshotsDir = path.join(__dirname, '..', 'public', 'brand', 'screenshots');

const screenshots = [
  {
    name: 'dashboard.png',
    htmlFile: 'dashboard-mockup.html',
    width: 1920,
    height: 1080
  },
  {
    name: 'vehicles.png',
    htmlFile: 'vehicles-mockup.html',
    width: 1920,
    height: 1080
  },
  {
    name: 'deliveries.png',
    htmlFile: 'deliveries-mockup.html',
    width: 1920,
    height: 1080
  },
  {
    name: 'maintenance.png',
    htmlFile: 'maintenance-mockup.html',
    width: 1920,
    height: 1080
  },
  {
    name: 'vehicle-detail.png',
    htmlFile: 'vehicle-detail-mockup.html',
    width: 1920,
    height: 1080
  },
  {
    name: 'mobile-dashboard.png',
    htmlFile: 'mobile-dashboard-mockup.html',
    width: 390,
    height: 844
  }
];

async function captureScreenshots() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  for (const screenshot of screenshots) {
    const filePath = path.join(screenshotsDir, screenshot.htmlFile);
    const outputPath = path.join(screenshotsDir, screenshot.name);
    
    console.log(`Capturing ${screenshot.name}...`);
    
    // Load the HTML file
    const fileUrl = 'file://' + filePath;
    await page.goto(fileUrl, { waitUntil: 'networkidle0' });
    
    // Set viewport size
    await page.setViewport({
      width: screenshot.width,
      height: screenshot.height
    });
    
    // Wait a bit for any animations/fonts to load
    await new Promise(r => setTimeout(r, 2000));
    
    // Capture screenshot
    await page.screenshot({
      path: outputPath,
      fullPage: false
    });
    
    console.log(`✓ Saved ${screenshot.name}`);
  }
  
  await browser.close();
  console.log('\nAll screenshots captured successfully!');
}

captureScreenshots().catch(err => {
  console.error('Error capturing screenshots:', err);
  process.exit(1);
});
