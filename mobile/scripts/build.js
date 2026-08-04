#!/usr/bin/env node
/**
 * Build script that auto-increments buildNumber before running eas build.
 *
 * Usage:
 *   node scripts/build.js --profile development --platform ios --local
 *   node scripts/build.js --profile production --platform ios
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Parse command line arguments
const args = process.argv.slice(2);
const profileIndex = args.indexOf('--profile');
const profile = profileIndex !== -1 ? args[profileIndex + 1] : null;
const platformIndex = args.indexOf('--platform');
const platform = platformIndex !== -1 ? args[platformIndex + 1] : 'ios';
const isLocal = args.includes('--local');

if (!profile) {
  console.error('Error: --profile is required (e.g., --profile preview or --profile production)');
  process.exit(1);
}

// Read current version
const versionPath = path.join(__dirname, '..', 'versions', 'version.json');
let versionData;
try {
  versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
} catch (error) {
  console.error('Error reading versions/version.json:', error.message);
  process.exit(1);
}

// Increment build number
const oldBuildNumber = versionData.buildNumber;
versionData.buildNumber = oldBuildNumber + 1;

try {
  fs.writeFileSync(versionPath, JSON.stringify(versionData, null, 2) + '\n');
  console.log(`Bumped buildNumber: ${oldBuildNumber} -> ${versionData.buildNumber}`);
  console.log(`  Version: ${versionData.version}`);
} catch (error) {
  console.error('Error writing versions/version.json:', error.message);
  process.exit(1);
}

// Build eas command args
const buildArgs = [...args];

// Local builds: add --non-interactive to avoid login prompts
if (isLocal) {
  buildArgs.push('--non-interactive');
}

// Build the eas command
const easCommand = `eas build ${buildArgs.join(' ')}`;
console.log(`\nRunning: ${easCommand}\n`);

// Execute eas build
try {
  execSync(easCommand, {
    stdio: 'inherit',
    env: {
      ...process.env,
      PATH: `/usr/bin:${process.env.PATH}`,
    },
  });
} catch (error) {
  // If build fails, revert the version bump
  console.log('\nBuild failed, reverting version bump...');
  versionData.buildNumber = oldBuildNumber;
  fs.writeFileSync(versionPath, JSON.stringify(versionData, null, 2) + '\n');
  console.log(`  Reverted buildNumber to ${oldBuildNumber}`);
  process.exit(1);
}
