// Expo SDK 52+ auto-detects npm workspaces (watchFolders + node_modules
// resolution for the monorepo root), so @antelope/core (TypeScript source in
// packages/core) resolves and is transpiled with no manual overrides.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Rive animation files are bundled as assets: require('./x.riv').
config.resolver.assetExts.push('riv');

module.exports = config;
