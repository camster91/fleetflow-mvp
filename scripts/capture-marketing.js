const puppeteer = require('puppeteer');
const path = require('path');

const brandDir = path.join(__dirname, '..', 'public', 'brand');

const images = [
  {
    name: 'og-image.png',
    htmlFile: 'og-image-mockup.html',
    width: 1200,
    height: 630
  },
  {
    name: 'twitter-card.png',
    htmlFile: 'twitter-card-mockup.html',
    width: 1200,
    height: 600
  }
];

async function captureImages() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  for (const image of images) {
    const filePath = path.join(brandDir, image.htmlFile);
    const outputPath = path.join(brandDir, image.name);
    
    console.log(`Capturing ${image.name}...`);
    
    const fileUrl = 'file://' + filePath;
    await page.goto(fileUrl, { waitUntil: 'networkidle0' });
    
    await page.setViewport({
      width: image.width,
      height: image.height
    });
    
    await new Promise(r => setTimeout(r, 2000));
    
    await page.screenshot({
      path: outputPath,
      fullPage: false
    });
    
    console.log(`✓ Saved ${image.name}`);
  }
  
  await browser.close();
  console.log('\nAll marketing images captured successfully!');
}

captureImages().catch(err => {
  console.error('Error capturing images:', err);
  process.exit(1);
});
