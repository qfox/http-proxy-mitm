const assert = require('assert');
const util = require('util');
const zlib = require('zlib');

const pump = require('pump');
const through2 = require('through2');
const BufferHelper = require('bufferhelper');

/**
 * Make proxyRes listener handler that modifies the response on condition
 *
 * @param {Matcher|Matcher[]} matchers - Configuration.
 * @returns {function(proxyRes: ServerResponse, req: ClientRequest, res: ClientResponse)} - `proxyRes` event listener.
 */
module.exports = function(matchers) {
    'use strict';

    Array.isArray(matchers) || (matchers = [matchers]);
    matchers.forEach(function(matcher) {
        assert(matcher.transform || matcher.bodyTransform, 'Invalid matcher: ' + util.inspect(matcher));
    });

    return function(proxyRes, req, res) {
        const contentEncoding = proxyRes.headers['content-encoding'];
        // Now only deal with the gzip/deflate/undefined content-encoding.
        if (contentEncoding && contentEncoding !== 'gzip' && contentEncoding !== 'deflate') {
            console.error('Not supported content-encoding: ' + contentEncoding);
            return;
        }

        const handlers = matchers.filter(m => (!m.hasOwnProperty('condition') || m.condition(proxyRes, req)));
        if (!handlers.length) {
            // Just don't do anything if no need to transform
            return;
        }

        const enc = _enc(contentEncoding);

        const transforms = handlers.map(m => m.transform).filter(Boolean);
        const bodyTransforms = handlers.map(m => m.bodyTransform).filter(Boolean);

        // Store writing fns
        const resWrite = res.write;
        const resEnd = res.end;

        // Use unzip or t2 as the first stream
        const _in = enc.unzip || through2();
        const _out = enc.zip || through2();

        // ... and rewire data from proxy to stream
        res.write = (chunk) => _in.write(chunk);
        res.end = () => _in.end();
        _out.on('data', (chunk) => resWrite.call(res, chunk));
        _out.on('end', () => resEnd.call(res));

        pump.apply(pump, [].concat(_in, transforms, _concatTransform(bodyTransforms), _out, function(err) {
            err && console.error('pipe finished', err);
        }));
    };
};

function _concatTransform(fns) {
    'use strict';

    const buffer = new BufferHelper();
    return through2(function(chunk, enc, cb) {
        buffer.concat(chunk);
        cb();
    }, function(cb) {
        let str = buffer.toBuffer().toString();
        for (let i = 0, l = fns.length; i < l; i++) {
            str = fns[i](str);
        }
        cb(null, new Buffer(str));
    });
}

function _enc(contentEncoding) {
    'use strict';

    const res = {};
    switch (contentEncoding) {
        case 'gzip':
            res.unzip = zlib.Gunzip();
            res.zip = zlib.Gzip();
            break;
        case 'deflate':
            res.unzip = zlib.Inflate();
            res.zip = zlib.Deflate();
            break;
    }
    return res;
}

/**
 * An object with a condition and transformation stream and/or function
 *
 * @typedef {Object} Matcher
 *
 * @param {function(proxyRes: ServerResponse, req: ClientRequest)} [opts.condition] - Function to filter out responses
 * @param {TransformStream.<Buffer, Buffer>} [opts.transform] - Transform stream
 * @param {function(body: string): string} [opts.bodyTransform] - Transform function for the whole body.
 *   Beware that the whole content will be stored in memory before passing into this function.
 */
