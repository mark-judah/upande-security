// The MRZ reader's jmrtd pulls in org.bouncycastle:bcprov-jdk15on:1.64, while
// another dependency already ships the newer bcprov/bcutil-jdk15to18:1.78.1 -
// the same classes twice, which fails :app:checkReleaseDuplicateClasses.
// Drop the old jar; jmrtd runs on the newer one.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// withoutOldBouncyCastle';

module.exports = function withoutOldBouncyCastle(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes(MARKER)) {
      cfg.modResults.contents +=
        `\n${MARKER}\nconfigurations.all {\n    exclude group: 'org.bouncycastle', module: 'bcprov-jdk15on'\n}\n`;
    }
    return cfg;
  });
};
