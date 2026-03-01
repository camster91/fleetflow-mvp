const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SOURCE_SVG = path.join(__dirname, '..', 'public', 'brand', 'logo', 'logo-icon.svg');
const ICONS_DIR = path.join(__dirname, '..', 'public', 'brand', 'icons');

// Ensure icons directory exists
if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

// Read the SVG file
const svgBuffer = fs.readFileSync(SOURCE_SVG);

async function generateIcons() {
  console.log('🎨 Generating FleetFlow icon assets...\n');

  try {
    // Generate 192x192 PNG
    await sharp(svgBuffer)
      .resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(ICONS_DIR, 'icon-192.png'));
    console.log('✅ Generated icon-192.png (192x192)');

    // Generate 512x512 PNG
    await sharp(svgBuffer)
      .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(ICONS_DIR, 'icon-512.png'));
    console.log('✅ Generated icon-512.png (512x512)');

    // Generate Apple touch icon (180x180 with padding)
    await sharp(svgBuffer)
      .resize(180, 180, { fit: 'contain', background: { r: 30, g: 58, b: 95, alpha: 1 } }) // Primary color background
      .png()
      .toFile(path.join(ICONS_DIR, 'apple-touch-icon.png'));
    console.log('✅ Generated apple-touch-icon.png (180x180)');

    // Generate favicon sizes
    const sizes = [16, 32, 48];
    for (const size of sizes) {
      await sharp(svgBuffer)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toFile(path.join(ICONS_DIR, `favicon-${size}.png`));
      console.log(`✅ Generated favicon-${size}.png (${size}x${size})`);
    }

    // Generate 32x32 favicon.png (for direct use)
    await sharp(svgBuffer)
      .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(ICONS_DIR, 'favicon.png'));
    console.log('✅ Generated favicon.png (32x32)');

    console.log('\n📦 Generating multi-size favicon.ico...');
    
    // Generate ICO file (multi-size)
    // ICO format: header + directory entries + image data
    const icoBuffers = await Promise.all([
      sharp(svgBuffer).resize(16, 16).png().toBuffer(),
      sharp(svgBuffer).resize(32, 32).png().toBuffer(),
      sharp(svgBuffer).resize(48, 48).png().toBuffer()
    ]);

    // Convert PNGs to BMPs for ICO (Windows ICO typically uses BMP format)
    const bmpBuffers = await Promise.all([
      sharp(svgBuffer).resize(16, 16).raw().toBuffer(),
      sharp(svgBuffer).resize(32, 32).raw().toBuffer(),
      sharp(svgBuffer).resize(48, 48).raw().toBuffer()
    ]);

    // Create ICO using png2ico approach - store PNGs directly in ICO
    // ICO Header: Reserved (2) + Type (2) + Count (2) = 6 bytes
    // ICONDIRENTRY: Width (1) + Height (1) + Colors (1) + Reserved (1) + 
    //               Planes (2) + BitCount (2) + SizeInBytes (4) + Offset (4) = 16 bytes each
    
    const entryCount = 3;
    const headerSize = 6;
    const entrySize = 16;
    const dataOffset = headerSize + (entryCount * entrySize);
    
    let currentOffset = dataOffset;
    const entries = [];
    
    // Build directory entries
    for (let i = 0; i < entryCount; i++) {
      const size = sizes[i];
      const buffer = icoBuffers[i];
      entries.push({
        width: size,
        height: size,
        colors: 0,
        reserved: 0,
        planes: 1,
        bitCount: 32,
        sizeInBytes: buffer.length,
        offset: currentOffset
      });
      currentOffset += buffer.length;
    }
    
    // Build ICO buffer
    const icoBuffer = Buffer.alloc(currentOffset);
    let pos = 0;
    
    // Write header
    icoBuffer.writeUInt16LE(0, pos); // Reserved
    pos += 2;
    icoBuffer.writeUInt16LE(1, pos); // Type (1 = ICO)
    pos += 2;
    icoBuffer.writeUInt16LE(entryCount, pos); // Count
    pos += 2;
    
    // Write directory entries
    for (const entry of entries) {
      icoBuffer.writeUInt8(entry.width === 256 ? 0 : entry.width, pos);
      pos += 1;
      icoBuffer.writeUInt8(entry.height === 256 ? 0 : entry.height, pos);
      pos += 1;
      icoBuffer.writeUInt8(entry.colors, pos);
      pos += 1;
      icoBuffer.writeUInt8(entry.reserved, pos);
      pos += 1;
      icoBuffer.writeUInt16LE(entry.planes, pos);
      pos += 2;
      icoBuffer.writeUInt16LE(entry.bitCount, pos);
      pos += 2;
      icoBuffer.writeUInt32LE(entry.sizeInBytes, pos);
      pos += 4;
      icoBuffer.writeUInt32LE(entry.offset, pos);
      pos += 4;
    }
    
    // Write image data
    for (let i = 0; i < entryCount; i++) {
      icoBuffers[i].copy(icoBuffer, pos);
      pos += icoBuffers[i].length;
    }
    
    fs.writeFileSync(path.join(ICONS_DIR, 'favicon.ico'), icoBuffer);
    console.log('✅ Generated favicon.ico (16x16, 32x32, 48x48 multi-size)\n');

    console.log('🎉 All icon assets generated successfully!');
    console.log(`📁 Output directory: ${ICONS_DIR}`);
    
  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
