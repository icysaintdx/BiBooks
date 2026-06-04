function logInfo(...args) {
  console.log('[bibooks]', ...args);
}

function logError(...args) {
  console.error('[bibooks]', ...args);
}

module.exports = {
  logError,
  logInfo,
};
