'use strict';
const { createPlatform } = require('./lib/platform');
module.exports = homebridge => {
  homebridge.registerPlatform('homebridge-pax-calima', 'PaxCalima', createPlatform(homebridge));
};
