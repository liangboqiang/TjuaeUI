#!/usr/bin/env node

/**
 * Generate every platform-specific TjuaeUI brand icon from the canonical SVG.
 *
 * Native shells cannot all consume SVG directly, so the checked-in PNG, ICO,
 * and ICNS files are deterministic derivatives of the renderer vector asset.
 */

const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const repositoryRoot = path.resolve(__dirname, '..');
const canonicalSvgPath = path.join(repositoryRoot, 'packages/desktop/src/renderer/assets/logos/brand/app.svg');
const checkOnly = process.argv.includes('--check');

const pngTargets = [
  ['mobile/assets/images/icon.png', 1024],
  ['public/pwa/icon-180.png', 180],
  ['public/pwa/icon-192.png', 192],
  ['public/pwa/icon-512.png', 512],
  ['resources/app.png', 512],
  ['resources/app_dev.png', 512],
  ['resources/icon.png', 512],
];

const icoSizes = [16, 24, 32, 48, 64, 128, 256];
const icnsEntries = [
  ['icp4', 16],
  ['icp5', 32],
  ['icp6', 64],
  ['ic07', 128],
  ['ic08', 256],
  ['ic09', 512],
  ['ic10', 1024],
  ['ic11', 32],
  ['ic12', 64],
  ['ic13', 256],
  ['ic14', 512],
];

const renderPng = (svg, size) =>
  sharp(svg, { density: 384 })
    .resize(size, size, { fit: 'fill' })
    .png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
    .toBuffer();

const buildIco = (images) => {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const directory = Buffer.alloc(images.length * 16);
  let offset = header.length + directory.length;
  images.forEach(({ size, bytes }, index) => {
    const entryOffset = index * 16;
    directory.writeUInt8(size === 256 ? 0 : size, entryOffset);
    directory.writeUInt8(size === 256 ? 0 : size, entryOffset + 1);
    directory.writeUInt8(0, entryOffset + 2);
    directory.writeUInt8(0, entryOffset + 3);
    directory.writeUInt16LE(1, entryOffset + 4);
    directory.writeUInt16LE(32, entryOffset + 6);
    directory.writeUInt32LE(bytes.length, entryOffset + 8);
    directory.writeUInt32LE(offset, entryOffset + 12);
    offset += bytes.length;
  });

  return Buffer.concat([header, directory, ...images.map(({ bytes }) => bytes)]);
};

const buildIcns = (images) => {
  const chunks = images.map(({ type, bytes }) => {
    const chunk = Buffer.alloc(8 + bytes.length);
    chunk.write(type, 0, 4, 'ascii');
    chunk.writeUInt32BE(chunk.length, 4);
    bytes.copy(chunk, 8);
    return chunk;
  });
  const header = Buffer.alloc(8);
  header.write('icns', 0, 4, 'ascii');
  header.writeUInt32BE(header.length + chunks.reduce((total, chunk) => total + chunk.length, 0), 4);
  return Buffer.concat([header, ...chunks]);
};

const writeOrCheck = (relativePath, expected, mismatches) => {
  const absolutePath = path.join(repositoryRoot, relativePath);
  if (checkOnly) {
    const actual = fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath) : null;
    if (!actual?.equals(expected)) mismatches.push(relativePath);
    return;
  }

  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, expected);
  console.log(`generated ${relativePath}`);
};

async function main() {
  const svg = fs.readFileSync(canonicalSvgPath);
  const mismatches = [];
  const pngBySize = new Map();
  const getPng = async (size) => {
    if (!pngBySize.has(size)) pngBySize.set(size, await renderPng(svg, size));
    return pngBySize.get(size);
  };

  writeOrCheck('public/pwa/icon.svg', svg, mismatches);

  for (const [relativePath, size] of pngTargets) {
    writeOrCheck(relativePath, await getPng(size), mismatches);
  }

  const icoImages = [];
  for (const size of icoSizes) icoImages.push({ size, bytes: await getPng(size) });
  writeOrCheck('resources/app.ico', buildIco(icoImages), mismatches);

  const icnsImages = [];
  for (const [type, size] of icnsEntries) {
    icnsImages.push({ type, bytes: await getPng(size) });
  }
  writeOrCheck('resources/app.icns', buildIcns(icnsImages), mismatches);

  if (mismatches.length > 0) {
    throw new Error(`brand assets are stale: ${mismatches.join(', ')}`);
  }
  if (checkOnly) console.log('brand assets match the canonical circular SVG');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
