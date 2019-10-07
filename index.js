const HarborBreezePlatform = require('./HarborBreezePlatform.js');

module.exports = function(homebridge) {
    homebridge.registerPlatform('homebridge-harbor-breeze-hub', 'HarborBreezePlatform',
        HarborBreezePlatform, true);
};
