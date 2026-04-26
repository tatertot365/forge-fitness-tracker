const { withEntitlementsPlist } = require('@expo/config-plugins');

module.exports = function withCleanEntitlements(config) {
  return withEntitlementsPlist(config, (c) => {
    // These require a paid Apple Developer account — remove them so free-team
    // builds succeed. Re-add when upgrading to a paid account.
    delete c.modResults['aps-environment'];
    delete c.modResults['com.apple.developer.healthkit'];
    delete c.modResults['com.apple.developer.healthkit.access'];
    return c;
  });
};
