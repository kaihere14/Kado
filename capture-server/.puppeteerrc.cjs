const { join } = require("node:path");

// Chrome downloads into the project during install, so it's still there when the server starts on Render.
module.exports = { cacheDirectory: join(__dirname, ".cache", "puppeteer") };
