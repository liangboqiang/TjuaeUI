import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceSvg = path.join(repositoryRoot, 'packages/desktop/src/renderer/assets/logos/brand/app.svg');
const coreBrandLogo = path.resolve(
  repositoryRoot,
  '../TjuaeCore/crates/tjuaeui-assets/assets/logos/brand/tjuae-cli.svg'
);

const renderPng = async (size) =>
  sharp(sourceSvg, { density: 384 }).resize(size, size, { fit: 'contain' }).png().toBuffer();

const writePng = async (relativePath, size) => {
  await fs.writeFile(path.join(repositoryRoot, relativePath), await renderPng(size));
};

const buildIco = async (sizes) => {
  const images = await Promise.all(sizes.map(renderPng));
  const headerSize = 6 + images.length * 16;
  let offset = headerSize;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  images.forEach((image, index) => {
    const size = sizes[index];
    const entryOffset = 6 + index * 16;
    header[entryOffset] = size >= 256 ? 0 : size;
    header[entryOffset + 1] = size >= 256 ? 0 : size;
    header[entryOffset + 2] = 0;
    header[entryOffset + 3] = 0;
    header.writeUInt16LE(1, entryOffset + 4);
    header.writeUInt16LE(32, entryOffset + 6);
    header.writeUInt32LE(image.length, entryOffset + 8);
    header.writeUInt32LE(offset, entryOffset + 12);
    offset += image.length;
  });
  return Buffer.concat([header, ...images]);
};

const buildIcns = async () => {
  const chunks = [
    ['ic11', 32],
    ['ic12', 64],
    ['ic07', 128],
    ['ic13', 256],
    ['ic08', 256],
    ['ic14', 512],
    ['ic09', 512],
    ['ic10', 1024],
  ];
  const encoded = await Promise.all(
    chunks.map(async ([type, size]) => {
      const image = await renderPng(size);
      const header = Buffer.alloc(8);
      header.write(type, 0, 4, 'ascii');
      header.writeUInt32BE(image.length + 8, 4);
      return Buffer.concat([header, image]);
    })
  );
  const body = Buffer.concat(encoded);
  const header = Buffer.alloc(8);
  header.write('icns', 0, 4, 'ascii');
  header.writeUInt32BE(body.length + 8, 4);
  return Buffer.concat([header, body]);
};

await fs.copyFile(sourceSvg, path.join(repositoryRoot, 'public/pwa/icon.svg'));
await fs.copyFile(sourceSvg, coreBrandLogo);
await Promise.all([
  writePng('resources/app.png', 512),
  writePng('resources/app_dev.png', 512),
  writePng('resources/icon.png', 512),
  writePng('public/pwa/icon-180.png', 180),
  writePng('public/pwa/icon-192.png', 192),
  writePng('public/pwa/icon-512.png', 512),
  writePng('mobile/assets/images/icon.png', 1024),
  fs.writeFile(path.join(repositoryRoot, 'resources/app.ico'), await buildIco([16, 24, 32, 48, 64, 128, 256])),
  fs.writeFile(path.join(repositoryRoot, 'resources/app.icns'), await buildIcns()),
]);

console.log('Generated Tjuae scheme B desktop, PWA, Core, installer, and mobile icons.');
