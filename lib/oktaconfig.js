'use strict';
let fs = require('fs');
let debug = require('debug')('auth:oktaconfig');
let ini = require('ini');

module.exports = {
  loadConfig: function () {
    let localConfig = fs.statSync('.okta');

    if (localConfig && localConfig.isFile()) {
      debug('Loading local config');
      return ini.parse(
        fs.readFileSync('.okta', 'utf-8')
      );
    }

    if (process.env.HOME) {
      let homeConfig = fs.statSync(`${process.env.HOME}/.okta-aws/config`);

      if (homeConfig && homeConfig.isFile()) {
        debug('Loading config from $HOME/.okta-aws/config');
        return ini.parse(
          fs.readFileSync(`${process.env.HOME}/.okta-aws/config`, 'utf-8')
        );
      }
    }

    debug('No config file found');
    throw new Error('Missing Okta config file');
  }
};
