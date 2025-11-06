// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Configurações agressivas para reduzir o número de arquivos assistidos
config.watchFolders = [__dirname];

// Configuração do watcher para ignorar mais arquivos
config.watcher = {
  ...config.watcher,
  additionalExts: ['cjs', 'mjs'],
  watchman: {
    deferStates: ['hg.update'],
  },
};

// Bloqueia arquivos duplicados em node_modules
config.resolver = {
  ...config.resolver,
  blockList: [
    /node_modules\/.*\/node_modules\/react-native\/.*/,
  ],
};

// Reduz o escopo de busca de arquivos
config.projectRoot = __dirname;

module.exports = config;

