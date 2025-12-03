/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  use: {
    // Use the pre-installed browsers
    executablePath: '/usr/bin/chromium-browser',
    channel: 'chrome',
  },
};
module.exports = config;
