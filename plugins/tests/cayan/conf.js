exports.config = {
  seleniumAddress: 'http://localhost:4444/wd/hub',

  capabilities: {
    'browserName': 'chrome'
  },

  specs: ['EFT-Cayan-Device-Controller-Spec.js'],

  jasmineNodeOpts: {
    showColors: true
  }
};
