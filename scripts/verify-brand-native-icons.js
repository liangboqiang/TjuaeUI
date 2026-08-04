#!/usr/bin/env node

const path = require('node:path');
const { app, nativeImage } = require('electron');

const repositoryRoot = path.resolve(__dirname, '..');
const iconPaths = ['resources/app.ico', 'resources/app.png', 'resources/app_dev.png'];

app
  .whenReady()
  .then(() => {
    for (const relativePath of iconPaths) {
      const image = nativeImage.createFromPath(path.join(repositoryRoot, relativePath));
      if (image.isEmpty()) throw new Error(`Electron could not load ${relativePath}`);
      const { width, height } = image.getSize();
      if (width < 16 || height < 16) throw new Error(`${relativePath} has an invalid native size: ${width}x${height}`);
      console.log(`${relativePath}: ${width}x${height}`);
    }
  })
  .then(() => app.quit())
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    app.exit(1);
  });
