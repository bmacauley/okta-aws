'use strict';

let spawn = require('child_process').spawn;
let debug = require('debug')('auth:spawnprocess');

module.exports = {
  spawnProcess: function (credentials, args) {
    debug('executing command with args', args);
    let commandArray = args.command || {};
    let command = commandArray.shift();

    let localEnv = Object.create(process.env);

    localEnv.AWS_SESSION_TOKEN = credentials.SessionToken;
    localEnv.AWS_ACCESS_KEY_ID = credentials.AccessKeyId;
    localEnv.AWS_SECRET_ACCESS_KEY = credentials.SecretAccessKey;

    spawn(command, commandArray, {
      env: localEnv,
      stdio: 'inherit'
    });
  }
};
