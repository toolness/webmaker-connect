# Web Literacy Mapper [![Build Status](https://secure.travis-ci.org/toolness/weblitmapper.png?branch=master)](http://travis-ci.org/toolness/weblitmapper)

This is an attempt to make it easy to submit web resources that
are on the [Web Literacy Map](https://webmaker.org/standard)
to the Webmaker community via a bookmarklet.

## Prerequisites

Node 0.10.

[PhantomJS][] 1.8 or later is used to automatically run the
browser-side tests from the command-line, but this can be optionally
disabled.

## Quick Start

```
git clone git://github.com/toolness/weblitmapper.git
cd weblitmapper
npm install
npm test
source .env.example
node bin/app.js
```

Then visit http://localhost:3000.

## Environment Variables

**Note:** When an environment variable is described as representing a
boolean value, if the variable exists with *any* value (even the empty
string), the boolean is true; otherwise, it's false.

* `LOGINAPI_AUTH` is the *username:password* pair that will be
  used to authenticate with the Webmaker login server, e.g.
  `john:1234`.

* `LOGINAPI_URL` is the URL for the Webmaker login server.
  Defaults to https://login.webmaker.org. Use `:fake:` to always map
  the username part of the user's email address to their Webmaker username,
  which is useful for debugging/offline development.

* `MAKEAPI_PRIVATE_KEY` is the secret shared key for the Webmaker Make API.

* `MAKEAPI_PUBLIC_KEY` is the public key for the Webmaker Make API.

* `MAKEAPI_URL` is the URL for the Webmaker Make API. Defaults
  to https://makeapi.webmaker.org. Use `:memory:` to use an in-memory
  store for debugging/offline development.

* `WEBMAKER_URL` is the URL for the user-facing Webmaker site. It will
  be used for display purposes only, as a means to direct users to
  create an account there if necessary, as well as other sundry
  off-site links. Defaults to https://webmaker.org.

* `COOKIE_SECRET` is the secret used to encrypt and sign cookies,
  to prevent tampering.

* `DEBUG` represents a boolean value. Setting this to true makes the server
  use unminified source code on the client-side, among other things.

* `ORIGIN` is the origin of the server, as it appears
  to users. If `DEBUG` is enabled, this defaults to
  `http://localhost:PORT`. Otherwise, it must be defined.

* `ENABLE_STUBBYID` represents a boolean value. If it *and* `DEBUG` are
  both true, then the [stubbyid][] persona simulator is enabled. This allows
  anyone to easily log in as anyone they want, which makes manual testing
  and debugging easier. However, it should also *never* be enabled on
  production sites, which is why `DEBUG` must also be enabled for this
  feature to work.

* `PORT` is the port that the server binds to. Defaults to 3000.

* `SSL_KEY` is the path to a private key to use for SSL. If this
  is provided, the server must be accessed over HTTPS rather
  than HTTP, and the `SSL_CERT` environment variable must also
  be defined.

* `SSL_CERT` is the path to a SSL certificate. If this
  is provided, the server must be accessed over HTTPS rather
  than HTTP, and the `SSL_KEY` environment variable must also
  be defined.

* `STATIC_ROOT` is a URL pointing to the location of static assets. If
  not provided, the app will self-host its own static assets. Note that
  this URL should *not* end with a `/`.

## Tests

All tests can be run via `npm test`.

Individual test suites can be run via
<code>node_modules/.bin/mocha test/<em>filename</em></code>, where
*filename* is the name of the test. See [mocha(1)][] for more options.

By default, PhantomJS is used to run the browser-side tests, but they
can be skipped if the `DISABLE_PHANTOM_TESTS` environment variable is
defined.

### Test Coverage

Build/install [jscoverage][], run `make test-cov`, then open
`coverage.html` in a browser.

  [PhantomJS]: http://phantomjs.org/
  [stubbyid]: http://toolness.github.io/stubbyid/
  [mocha(1)]: http://visionmedia.github.io/mocha/#usage
  [jscoverage]: https://github.com/visionmedia/node-jscoverage
