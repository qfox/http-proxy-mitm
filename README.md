# http-proxy-mitm [![Build Status](https://travis-ci.org/zxqfox/http-proxy-mitm.svg?branch=master)](https://travis-ci.org/zxqfox/http-proxy-mitm)

Use it with [http-proxy][] to transform the response from the proxied server.

> Based on [node-http-proxy-json][] by [langjt][]. Thank you for your work!

## Motivation

There is very hard to modify non-XML response when using [http-proxy][]. For HTML/XML document you can try [Harmon](https://github.com/No9/harmon).

Usually the server will compress the data, confirm your server compression format before using this repository: `http-proxy-mitm` currently supports **gzip**、**deflate** and **uncompressed** content encoding.

If you need other compression format, try to pass in decoder and encoder as the first and the last transformer.

## Installation

```sh
npm i http-proxy-mitm
```

## Examples

### Handling server with gzip compression

```js
const zlib = require('zlib');
const http = require('http');
const httpProxy = require('http-proxy');
const httpProxyMitm = require('http-proxy-mitm');

// Create a proxy server
const proxy = httpProxy.createProxyServer({
    target: 'http://localhost:5001'
});

// Listen for the `proxyRes` event on `proxy`.
proxy.on('proxyRes', httpProxyMitm([
    {
        condition: function(res, req) { return req.url === '/1'; },
        bodyTransform: function (body) {
            body = JSON.parse(body);
            if (body) {
                body.age = 2;
                body.version = undefined;
            }
            return JSON.stringify(body);
        }
    },
    {
        condition: function(res, req) { return req.url === '/2'; },
        transform: through2(function (chunk, enc, cb) {
            cb(null, new Buffer(chunk.toString().replace(',"age":1', ',"age":2').replace(',"version":"1.0.0"', '')));
        })
    }
]));

// Create your server and then proxies the request
const server = http.createServer(function (req, res) {
    proxy.web(req, res);
}).listen(5000);

// Create your target server
const targetServer = http.createServer(function (req, res) {
    // Create gzipped content
    const gzip = zlib.Gzip();
    gzip.pipe(res);

    res.writeHead(200, {'Content-Type': 'application/json', 'Content-Encoding': 'gzip'});
    gzip.write(JSON.stringify({name: 'node-http-proxy-mitm', age: 1, version: '1.0.0'}));
    gzip.end();
}).listen(5001);
```

### Handling server with deflate compression

```js
const zlib = require('zlib');
const http = require('http');
const httpProxy = require('http-proxy');
const httpProxyMitm = require('http-proxy-mitm');

// Create a proxy server
const proxy = httpProxy.createProxyServer({
    target: 'http://localhost:5001'
});

// Listen for the `proxyRes` event on `proxy`.
proxy.on('proxyRes', httpProxyMitm([{
    transform: through2(function (chunk, enc, cb) {
        cb(null, new Buffer(chunk.toString().replace(',"age":1', ',"age":2').replace(',"version":"1.0.0"', '')));
    })
}]));

// Create your server and then proxies the request
const server = http.createServer(function (req, res) {
    proxy.web(req, res);
}).listen(5000);

// Create your target server
const targetServer = http.createServer(function (req, res) {
    // Create deflated content
    const deflate = zlib.Deflate();
    deflate.pipe(res);

    res.writeHead(200, {'Content-Type': 'application/json', 'Content-Encoding': 'deflate'});
    deflate.write(JSON.stringify({name: 'node-http-proxy-mitm', age: 1, version: '1.0.0'}));
    deflate.end();
}).listen(5001);
```

### Handling server without compression

```js
const http = require('http');
const httpProxy = require('http-proxy');
const modifyResponse = require('../');

// Create a proxy server
const proxy = httpProxy.createProxyServer({
    target: 'http://localhost:5001'
});

// Listen for the `proxyRes` event on `proxy`.
proxy.on('proxyRes', httpProxyMitm([{
    transform: through2(function (chunk, enc, cb) {
        cb(null, new Buffer(chunk.toString().replace(',"age":1', ',"age":2').replace(',"version":"1.0.0"', '')));
    })
}]));

// Create your server and then proxies the request
const server = http.createServer(function (req, res) {
    proxy.web(req, res);
}).listen(5000);

// Create your target server
const targetServer = http.createServer(function (req, res) {
    res.writeHead(200, {'Content-Type': 'application/json', 'Content-Encoding': 'deflate'});
    res.write(JSON.stringify({name: 'node-http-proxy-mitm', age: 1, version: '1.0.0'}));
    res.end();
}).listen(5001);
```

## Tests

To run the test suite, first install the dependencies, then run `npm test`:

```sh
npm install
npm test
```

## License

[MIT](http://opensource.org/licenses/MIT)


[http-proxy]: https://github.com/nodejitsu/node-http-proxy
[node-http-proxy-json]: https://github.com/langjt/node-http-proxy-json
[langjt]: https://github.com/langjt
