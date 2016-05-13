'use strict';
let args = require('../../lib/arguments');

/*eslint-env node,es6,mocha*/
describe('When parsing valid arguments w/ no profile, 1 command', function () {
  it('should properly get us a single element array for a single command',
    function () {
      let params = args.parseArgs([
        'node',
        'mycommand',
        '--',
        'testMeh'
      ]);

      params.command.should.have.length(1);
      params.command[0].should.equal('testMeh');
    });

  it('should get us a 2 element array for 2 element command', function () {
    let params = args.parseArgs([
      'node',
      'mycommand',
      '--',
      'echo',
      '"Hello World"'
    ]);

    params.command.should.have.length(2);
    params.command[0].should.equal('echo');
    params.command[1].should.equal('"Hello World"');
  });
});

describe('When parsing valid arguments with a profile', function () {
  it('should properly get the profile name', function () {
    let params = args.parseArgs([
      'node',
      'mycommand',
      'testProfile',
      '--',
      'goBlarg'
    ]);

    params.command.should.have.length(1);
    params.profile.should.equal('testProfile');
  });

  it('should properly get the profile and multiple commands', function () {
    let params = args.parseArgs([
      'node',
      'mycommand',
      'myProfile',
      '--',
      'echo',
      'hello world',
      '>',
      'test.txt'
    ]);

    params.command.should.have.length(4);
  });
});
