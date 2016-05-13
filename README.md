# okta-aws

Assume role into your main account with the option off assuming role into a secondary account using okta/SAML SSO.

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
appUrl=https://<yourorghere>/app/<my_aws_app_name>/<somekeyfromokta>/sso/saml
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

I think that [AWS-Vault](https://github.com/99designs/aws-vault) is a super fantastic tool for managing non temporary AWS keys on your local machine. If you properly setup your `~/.aws/config` file you can use those keys to assume roles in the accounts where the user/keys have privileges. I wanted to use the same format for the profiles so that a single profile entry could potentially be used by AWS-Vault and okta-aws. Here is an example profile entry:

```
[profile mysecond-adm]
source_profile = myfirst-adm
role_arn = arn:aws:iam::<accountId>:role/<roleName>
```

`accountId` and `roleName` would be replaced with the info from the 2nd account/role that you are using the first role you assumed to jump in to. For our purposes here source_profile is ignored because that is set by the `appUrl` in the `~/.okta-aws/config` file and doesn't have an effect at this stage.

Once you add the entry for you secondary profile, you can run command with it by specifying it as you 1st parameter to `okta-aws`

```
okta-aws mysecond-adm -- /bin/bash
```

This will get you a bash prompt with the credentials for the 2nd role generated using the credentials from the first role. Basically something like this:

```
okta login ->
  SAML assumeRole to role arn in okta app (first role) ->
    get creds for first role ->
      assumeRole to arn in mysecond-adm profile ->
        get creds for mysecond-adm ->
          execute command with mysecond-adm creds in environment
```

## Debugging

I use the [debug](https://www.npmjs.com/package/debug) module so you can get more output along the way by running:

```
DEBUG=auth* okta-aws -- /bin/bash
```

`DEBUG=*` will also get you output from SuperAgent and some other modules I use.

## Known issues/Areas for improvement
  * Better parsing of parameters to make adding flags doable
  * Fix the ghetto role parsing from the SAML
  * Add --help flag
  * Add some better errors when second role is denied access
  * Break index.js into a couple of smaller modules so it doesn't code smell like a stinky long file
  * Write enough unit tests so that James will let us deploy this thing. Oh, wait.
