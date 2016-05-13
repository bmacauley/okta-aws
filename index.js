#!/usr/bin/env node
/* eslint no-console: 0 */
/* global Buffer */

'use strict';

let request = require('superagent');
let read = require('read');
let pluck = require('pluck');
let cheerio = require('cheerio');
let debugOkta = require('debug')('auth:okta');
let debugAws = require('debug')('auth:aws');
let AWS = require('aws-sdk');
let argsLib = require('./lib/arguments');
let ini = require('ini');
let fs = require('fs');
let oktaConfig = require('./lib/oktaconfig');
let spawnProcess = require('./lib/spawnprocess').spawnProcess;

let username;
let password;

let myArgs = argsLib.parseArgs(process.argv);
debugAws('cli params', myArgs);

/**
 * Load our AWS profile information
 */
let awsConfig = ini.parse(
  fs.readFileSync(`${process.env.HOME}/.aws/config`, 'utf-8')
);
let profileObject = awsConfig[`profile ${myArgs.profile}`];
debugAws('profile info', profileObject);

if (!profileObject) {
  console.log(`Invalid profile, no match found for ${myArgs.profile}`);
  process.exit(1);
}

if (!profileObject.role_arn) {
  console.log(`Invalid profile, missing role_arn on profile ${myArgs.profile}`);
  process.exit(1);
}

/**
 * Load our settings for okta
 */
let oktaSettings = oktaConfig.loadConfig();

/**
 * Login to okta's main URL.
 * @param {String} username
 * @param {String} password
 * @param {Function} callback
 */
function login (username, password, callback) {
  request
    .post(`${oktaSettings.okta.baseUrl}api/v1/authn`)
    .set('Accept',  'application/json')
    .set('Content-Type', 'application/json')
    .send({
      username: username,
      password: password,
      options: {
        multiOptionalFactorEnroll: false,
        warnBeforePasswordExpired: false
      }
    })
    .end(function (err, res) {
      if (err) return callback(err);

      return callback(undefined, res.body);
    });
}

/**
 * Handle the response from the login request against the main Okta URL.
 * @param {Error} err
 * @param {Object} result SuperAgent response
 * @return {Boolean} false if the login fails, else ignored
 */
function processLoginResponse(err, result) {
  if (err) {
    console.log('Login failed');
    console.log(err);
    return;
  }

  if (result && result.status === 'MFA_REQUIRED') {
    let factors = pluck('_embedded.factors', result);

    if (!factors || !factors.length) {
      console.log('MFA required but no configured factors');
      return false;
    }

    let tokenFactor;
    factors.forEach(function (factor) {
      if (factor && factor.factorType === 'token:software:totp') {
        tokenFactor = factor;
      }
    });

    if (!tokenFactor) {
      console.log('Token factor not configured!');
      return false;
    }

    let verifyLink = pluck('_links.verify', tokenFactor);
    if (!verifyLink) {
      console.log('No verify link for token');
      return false;
    }

    getMfaCode(function (inputErr, mfaCode) {
      if (inputErr) {
        // log a newline so the prompt starts on the next line
        console.log('');
        return;
      }
      doMfa(result.stateToken, tokenFactor, mfaCode, processMfaResponse);
    });
  }
}

/**
 * Do our MFA authorization post after a successful login.
 * @param {String} loginToken
 * @param {String} tokenFactor
 * @param {String} mfaCode
 * @param {Function} callback
 */
function doMfa(loginToken, tokenFactor, mfaCode, callback) {
  request
    .post(`${tokenFactor._links.verify.href}`)
    .set('Accept',  'application/json')
    .set('Content-Type', 'application/json')
    .send({
      stateToken: loginToken,
      passCode: mfaCode
    })
    .end(function (err, res) {
      if (err) return callback(err);

      return callback(undefined, res.body);
    });
}

/**
 * Process the response from the MFA post.
 * @param {Error} err
 * @param {Object} result SuperAgent response object
 */
function processMfaResponse(err, result) {
  if (err) {
    console.log('Error doing MFA');
    console.log(err);
    return;
  }

  if (result && result.status === 'SUCCESS') {
    getOktaSamlForAws(result.sessionToken);
  } else {
    console.log('Login Failed');
  }

}

/**
 * Prompt the user for their MFA code.
 */
function getMfaCode(callback) {
  read({
    prompt: 'MFA Code: ',
    silent: false
  }, callback);
}

/**
 * Post to the Okta application URL to get the SAML we need to auth
 * against AWS.
 * @param {String} sessionToken
 */
function getOktaSamlForAws(sessionToken) {
  request
    .get(oktaSettings.okta.appUrl)
    .query('onetimetoken=' + sessionToken)
    .set('Accept',  '*/*')
    .end(function (err, res) {
      if (err) {
        console.log('Error getting SAML', err);
        return;
      }

      let dom = cheerio.load(res.text);
      let samlElements = dom('input[name="SAMLResponse"]');
      if (samlElements && samlElements[0]) {
        let saml = pluck('attribs.value', samlElements[0]);

        return getAwsCreds(saml);
      } else {
        console.log('Invalid SAML');
        debugOkta(res.text);
      }
    });
}

/**
 * Get our AWS credentials in our main/initial account based on the
 * response from our SAML login.
 * @param {Buffer} saml
 */
function getAwsCreds(saml) {
  let myBuffer = new Buffer(saml, 'base64');
  let samlXml = myBuffer.toString();

  /*
   * This is undeniably and totally ghetto. It's based on some Java
   * that does SAML login stuff (specifically from here:
   * https://github.com/nshobayo/AWS-CLI) and needs to be done
   * propery at some point. For now it works and gets us what we
   * need: our SAML login options.
   *
   * This is a list of ARN's that we can login to and what role we
   * are using to do the login. I think.
   */
  let arnString = samlXml.substring(
    samlXml.indexOf('arn:'),
    samlXml.indexOf('</saml2:AttributeValue')
  );

  let arnArray = arnString.split(',');
  let awsPrincipalArn = arnArray[1];
  let awsRoleArn = arnArray[0];

  debugAws('Available Roles', arnArray);
  debugAws('Using Role', awsRoleArn);

  let assumeRoleParams = {
    PrincipalArn: awsPrincipalArn,
    RoleArn: awsRoleArn,
    SAMLAssertion: saml,
    DurationSeconds: 3600
  };

  debugAws('Assume role Params', assumeRoleParams);

  assumeRoleWithSAML(assumeRoleParams);
}

/**
 * Use STS and the info from our SAML request to actually assume
 * the role we want in the primary AWS account.
 * @param {Object} assumeRoleParams
 */
function assumeRoleWithSAML(assumeRoleParams) {
  let sts = new AWS.STS({
    apiVersion: '2011-06-15'
  });

  sts.assumeRoleWithSAML(assumeRoleParams, handleAssumeRoleWithSAML);
}

/**
 * Handle the response from our SAML assume role request.
 * @param {Error}
 * @param {Object} Our response from the assume role request.
 */
function handleAssumeRoleWithSAML(err, responseData) {
  if (err) {
    debugAws('Error assuming role', err);
    return;
  }

  let credentials = pluck('Credentials', responseData);

  if (!credentials) {
    debugAws('Empty credentials returned');
    return;
  }

  /*
   * If we are only running in the primary account we can spawn
   * off that process here.
   */
  if (!myArgs.profile || !myArgs.profile.toString().length) {
    return spawnProcess(credentials, myArgs);
  }

  /*
   * Build our request to assume role into the secondary account.
   */
  let sts = new AWS.STS({
    apiVersion: '2011-06-15'
  });

  AWS.config.credentials = credentials;
  AWS.config.credentials = sts.credentialsFrom(responseData);

  assumeRoleSecondary();
}

/**
 * If we have a profile specified then we will be going to a secondary role.
 * This function will get us in based on the credentials set on
 * AWS.config.credentials from our first assume role.
 */
function assumeRoleSecondary() {
  let sts = new AWS.STS({
    apiVersion: '2011-06-15'
  });

  let requestParams = {
    RoleArn: profileObject.role_arn,
    RoleSessionName: 'fromRvMain'
  };

  debugAws('Making secondary assume role', requestParams);

  sts.assumeRole(requestParams, handleAssumeRoleSecondary);
}

/**
 * Handle our second role assumption response.
 * @param {Error}
 * @param {Object} A response object from the assume role request.
 */
function handleAssumeRoleSecondary(err, responseData) {
  // debugAws('Secondary Assume', err, responseData);
  if (err) {
    console.log('Error assuming secondary role', err);
    return;
  }

  let credentials = pluck('Credentials', responseData);

  if (!credentials) {
    console.log('Empty credentials returned');
    return;
  }

  console.log('Executing command', myArgs.command);
  return spawnProcess(credentials, myArgs);
}

/**
 * Get our username and password to get the process started.
 * @param {Object} username prompt config
 * @param {Function} callback for after username entry
 */
read({
  prompt: 'Username: ',
  silent: false,
  default: ''
}, function(er, inputUser) {
  if (er) {
    // calls w/error on sigint (i.e. control-c)
    console.log('');
    return;
  }

  username = inputUser;

  read({
    prompt: 'Password: ',
    silent: true,
    default: ''
  }, function(er, inputPass) {
    if (er) {
      // calls w/error on sigint (i.e. control-c)
      console.log('');
      return;
    }

    password = inputPass;

    if (!username || !password) {
      console.log('No username and password supplied!');
      return;
    }

    login(username, password, processLoginResponse);
  });
});
