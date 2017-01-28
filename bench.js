/**
 * Test content-encoding for uncompressed
 */

const assert = require('assert');
const http = require('http');

const httpProxy = require('http-proxy');
const microtime = require('microtime');
const modifyResponse = require('./');

const SERVER_PORT = 5004;
const TARGET_SERVER_PORT = 5005;

// Create a proxy server
const proxy = httpProxy.createProxyServer({
    target: 'http://localhost:' + TARGET_SERVER_PORT
});

// Listen for the `proxyRes` event on `proxy`.
proxy.on('proxyRes', modifyResponse({ bodyTransform: function (body) {
    body = JSON.parse(body);
    if (body) {
        body.age = 2;
        body.version = undefined;
    }
    return JSON.stringify(body);
} }));

// Create your server and then proxies the request
const server = http.createServer(function (req, res) {
    proxy.web(req, res);
}).listen(SERVER_PORT);

// Create your target server
const targetServer = http.createServer(function (req, res) {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.write(JSON.stringify({name: 'http-proxy-mitm', age: 1, version: '1.0.0'}));
    res.end();
}).listen(TARGET_SERVER_PORT);


// OMGOMG
const sample = JSON.stringify({name: 'http-proxy-mitm', age: 2});
callManyTimes(1000, function(done) {
    http.get('http://localhost:' + SERVER_PORT, function (res) {
        var body = '';
        res.on('data', function (chunk) {
            body += chunk;
        }).on('end', function () {
            assert.equal(sample, body);
            done();
        });
    });
}, function() {
    proxy.close();
    server.close();
    targetServer.close();
});

function callManyTimes(n, fn, done) {
    const times = [];
    const busies = [];
    const count = n;
    var iterations;

    const z = setInterval(function() { iterations++; }, 0);
    (function next() {
        if (n) {
            const startedAt = microtime.now();
            iterations = 0;

            fn(function() {
                times.push(microtime.now() - startedAt);
                busies.push(iterations);
                next();
            });
        } else {
            done();
            clearInterval(z);
            const telapsed = times.reduce((r, v) => (r += v), 0);
            const tavg = telapsed / count / 1000;

            const bmin = busies.reduce((r, v) => Math.min(r, v), Infinity);
            const ntimes = times.map((v, i) => (v * bmin / busies[i]));
            const nelapsed = ntimes.reduce((r, v) => (r += v), 0);
            const navg = nelapsed / count / 1000;

            console.log(`cps: ${pad((1000 / tavg).toFixed(2))}
min: ${pad((times.reduce((r, v) => Math.min(r, v), Infinity) / 1000).toFixed(2))}ms
avg: ${pad(tavg.toFixed(2))}ms
max: ${pad((times.reduce((r, v) => Math.max(r, v), 0) / 1000).toFixed(2))}ms`);
            console.log(`cpsn: ${pad((1000 / navg).toFixed(2))}
minn: ${pad((ntimes.reduce((r, v) => Math.min(r, v), Infinity) / 1000).toFixed(2))}ms
avgn: ${pad(navg.toFixed(2))}ms
maxn: ${pad((ntimes.reduce((r, v) => Math.max(r, v), 0) / 1000).toFixed(2))}ms`);
        }
        n--;
    }())
};

function pad(s) {
    return ('      ' + s).slice(-7);
}
