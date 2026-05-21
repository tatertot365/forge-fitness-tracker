const { withDangerousMod } = require('@expo/config-plugins');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Forge is a fully on-device app: no analytics, no remote storage, no tracking.
// This plugin overwrites the auto-generated PrivacyInfo.xcprivacy after prebuild
// so our declarations are source-controlled rather than relying on Expo defaults.
//
// Required-reason API codes documented at:
// https://developer.apple.com/documentation/bundleresources/privacy_manifest_files/describing_use_of_required_reason_api
const MANIFEST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>NSPrivacyAccessedAPITypes</key>
\t<array>
\t\t<dict>
\t\t\t<key>NSPrivacyAccessedAPIType</key>
\t\t\t<string>NSPrivacyAccessedAPICategoryUserDefaults</string>
\t\t\t<key>NSPrivacyAccessedAPITypeReasons</key>
\t\t\t<array>
\t\t\t\t<string>CA92.1</string>
\t\t\t</array>
\t\t</dict>
\t\t<dict>
\t\t\t<key>NSPrivacyAccessedAPIType</key>
\t\t\t<string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
\t\t\t<key>NSPrivacyAccessedAPITypeReasons</key>
\t\t\t<array>
\t\t\t\t<string>0A2A.1</string>
\t\t\t\t<string>3B52.1</string>
\t\t\t\t<string>C617.1</string>
\t\t\t</array>
\t\t</dict>
\t\t<dict>
\t\t\t<key>NSPrivacyAccessedAPIType</key>
\t\t\t<string>NSPrivacyAccessedAPICategoryDiskSpace</string>
\t\t\t<key>NSPrivacyAccessedAPITypeReasons</key>
\t\t\t<array>
\t\t\t\t<string>E174.1</string>
\t\t\t\t<string>85F4.1</string>
\t\t\t</array>
\t\t</dict>
\t\t<dict>
\t\t\t<key>NSPrivacyAccessedAPIType</key>
\t\t\t<string>NSPrivacyAccessedAPICategorySystemBootTime</string>
\t\t\t<key>NSPrivacyAccessedAPITypeReasons</key>
\t\t\t<array>
\t\t\t\t<string>35F9.1</string>
\t\t\t</array>
\t\t</dict>
\t</array>
\t<key>NSPrivacyCollectedDataTypes</key>
\t<array/>
\t<key>NSPrivacyTracking</key>
\t<false/>
\t<key>NSPrivacyTrackingDomains</key>
\t<array/>
</dict>
</plist>
`;

module.exports = function withPrivacyManifest(config) {
  return withDangerousMod(config, [
    'ios',
    async (c) => {
      const manifestPath = path.join(
        c.modRequest.platformProjectRoot,
        c.modRequest.projectName,
        'PrivacyInfo.xcprivacy',
      );
      fs.writeFileSync(manifestPath, MANIFEST);
      // Sanity-check via plutil — fails the build early if the plist is invalid.
      try {
        execFileSync('/usr/bin/plutil', ['-lint', manifestPath], {
          stdio: 'ignore',
        });
      } catch (e) {
        throw new Error(
          `withPrivacyManifest: generated PrivacyInfo.xcprivacy failed plutil lint at ${manifestPath}`,
        );
      }
      return c;
    },
  ]);
};
