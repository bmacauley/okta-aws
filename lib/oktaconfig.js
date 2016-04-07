'use strict';
let fs = require('fs');
let debug = require('debug')('auth:oktaconfig');
let ini = require('ini');

module.exports = {
  loadConfig: function () {
    try {
      let localConfig = fs.statSync('.okta');

      if (localConfig && localConfig.isFile()) {
        debug('Loading local config');
        return ini.parse(
          fs.readFileSync('.okta', 'utf-8')
        );
      }
    } catch(e) {
      debug('Local config file doesnt exist, skipping');
    }

    if (process.env.HOME) {
      try {
        let homeConfig = fs.statSync(`${process.env.HOME}/.okta-aws/config`);

        if (homeConfig && homeConfig.isFile()) {
          debug('Loading config from $HOME/.okta-aws/config');
          return ini.parse(
            fs.readFileSync(`${process.env.HOME}/.okta-aws/config`, 'utf-8')
          );
        }
      } catch(e) {
        debug('home directory config file doesnt exist, skipping');
      }
    }

    debug('No config file found');
    throw new Error('Missing Okta config file');
  }
};
