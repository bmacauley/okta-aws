# okta-aws

At Red Ventures we have one interesting problem. Right, just one. Go with that.

In our cloud infrastructure we need to have users. Interesting right? That's not the good part.

These users need to be controlled by single sign-on for which we use Okta. Ok Ok, I know the O word might have just turned you off on this whole thing, but bare with me.

Okta gives us SAML sometimes, when we ask nice, cross our T's, and the moon is properly lined up with Venus and Jupiter. Surprisingly this happens a lot, but you're right, still not interesting.

We want to use that SAML to Assume Role into an AWS account. Once we assume role we want to use our temporary creds to be able to run the AWS cli or our own commands that are powered by the AWS SDK. Now the good part.

We also want to be able to use those temporary creds to generate a second set of temporary creds by assuming role into another account. Go ahead, try it. I'll wait.

Or you can go ahead and use this handy little somewhat poorly written NodeJS script. Or look at my code and write it in Golang like it should have been (then send me a link to your repo so I can switch over to yours).

## Requirements
If you only want to assume role into a single account, you just need the Okta base URL for your organization (https://<yourorgname>.okta.com) and the SAML endpoint for the Okta application that is setup to log you into your initial AWS account. The SAML endpoint can be found in the admin console under the settings for the application. These will need to go in a file in your home directory called `~/.okta-aws/config` that looks like this:

```
[okta]
baseUrl=https://<yourorghere>.okta.com/
appUrl=https://<yourorghere/app/<my_aws_app_name>/<somekeyfromokta>/sso/saml
```

## Installing

```
npm install -g okta-aws
```

## Using with your primary account (i.e. the one you have your Okta app pointed at)
So now you want to be able to execute commands with `aws-cli` in your main account. Easy peasy, try this on for size:

```
$ okta-aws -- /bin/bash
Username:
Password:
MFA Code:
bash-3.2$
```

## Assuming role into a second account

Coming soon to a README near you.
