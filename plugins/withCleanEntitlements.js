const { withInfoPlist, withDangerousMod } = require('@expo/config-plugins');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function configureInfoPlist(config) {
  return withInfoPlist(config, (c) => {
    delete c.modResults.NSMicrophoneUsageDescription;
    return c;
  });
}

// expo-camera registers an Info.plist mod that re-adds NSMicrophoneUsageDescription.
// Mod ordering inside the same phase isn't guaranteed, so as a final pass we
// rewrite the file on disk via PlistBuddy after Expo has finished.
function stripMicrophoneFromDisk(config) {
  return withDangerousMod(config, [
    'ios',
    async (c) => {
      const plistPath = path.join(
        c.modRequest.platformProjectRoot,
        c.modRequest.projectName,
        'Info.plist',
      );
      if (!fs.existsSync(plistPath)) return c;
      try {
        execFileSync(
          '/usr/libexec/PlistBuddy',
          ['-c', 'Delete :NSMicrophoneUsageDescription', plistPath],
          { stdio: 'ignore' },
        );
      } catch {
        // Key wasn't present — ignore.
      }
      return c;
    },
  ]);
}

module.exports = function withCleanEntitlements(config) {
  config = configureInfoPlist(config);
  config = stripMicrophoneFromDisk(config);
  return config;
};
