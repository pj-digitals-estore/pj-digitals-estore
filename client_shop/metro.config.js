const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// Four NearBy apps run together; limit workers to avoid exhausting local memory.
config.maxWorkers = 2;

module.exports = config;
