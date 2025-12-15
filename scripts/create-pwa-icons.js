const sharp = require('sharp');
const path = require('path');

const sizes = [192, 512];
const outputDir = path.join(__dirname, '..', 'public', 'icons');

// Create a simple green circle with white "H" for HortiTrack
async function createIcon(size) {
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="#f0fdf4"/>
      <circle cx="${size/2}" cy="${size/2}" r="${size * 0.4}" fill="#22c55e"/>
      <text x="${size/2}" y="${size/2 + size * 0.14}"
            font-family="Arial, sans-serif"
            font-size="${size * 0.45}"
            font-weight="bold"
            fill="white"
            text-anchor="middle">H</text>
      <ellipse cx="${size * 0.68}" cy="${size * 0.32}"
               rx="${size * 0.06}" ry="${size * 0.1}"
               fill="#16a34a"
               transform="rotate(45 ${size * 0.68} ${size * 0.32})"/>
    </svg>
  `;

  const outputPath = path.join(outputDir, `icon-${size}x${size}.png`);

  await sharp(Buffer.from(svg))
    .png()
    .toFile(outputPath);

  console.log(`Created ${outputPath}`);
}

async function main() {
  for (const size of sizes) {
    await createIcon(size);
  }
  console.log('Done!');
}

main().catch(console.error);
