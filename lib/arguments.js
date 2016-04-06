'use strict';

let debug = require('debug')('auth:arguments');

module.exports = {
  getCommand: function (argumentArray, start) {
    let commandArray = [];
    for(let loopy = start; loopy < argumentArray.length; loopy++) {
      commandArray.push(argumentArray[loopy]);
    }

    return commandArray;
  },

  parseArgs: function (argumentArray) {
    let paramObject = {
      profile: '',
      command: ['env', 'bash']
    };

    if (argumentArray[2] === '--') {
      debug('using initial account');
      if (argumentArray.length <= 3) {
        throw new Error('No command specified');
      }

      paramObject.command = this.getCommand(argumentArray, 3);

      return paramObject;
    } else if (argumentArray[3] === '--') {
      if (argumentArray.length <= 3) {
        throw new Error('No command specified');
      }

      paramObject.profile = argumentArray[2];
      debug('using profile', paramObject.profile);

      paramObject.command = this.getCommand(argumentArray, 4);

      return paramObject;
    }

    return paramObject;
  }
};
