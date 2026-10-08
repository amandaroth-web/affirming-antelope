// Expo SDK 52+ auto-detects npm workspaces (watchFolders + node_modules
// resolution for the monorepo root), so @antelope/core (TypeScript source in
// packages/core) resolves and is transpiled with no manual overrides.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
