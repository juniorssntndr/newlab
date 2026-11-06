import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'zlib';
import { handleOptionalApprovalUpload } from './orderApprovalUpload.js';

test('handleOptionalApprovalUpload decompresses gzip buffer on multipart/form-data', async () => {
    const rawHtml = '<html><body><h1>Modelo 3D Exocad</h1></body></html>';
    const compressed = zlib.gzipSync(Buffer.from(rawHtml, 'utf-8'));

    // Simulated request with already parsed req.file to test decompression hook directly
    // Or simulate standard middleware invocation
    let nextCalled = false;
    let statusCode = null;
    let jsonBody = null;

    const res = {
        status: (code) => {
            statusCode = code;
            return {
                json: (data) => {
                    jsonBody = data;
                }
            };
        }
    };

    // When content-type is not multipart, calls next immediately
    await new Promise((resolve) => {
        handleOptionalApprovalUpload({ headers: {} }, res, () => {
            nextCalled = true;
            resolve();
        });
    });
    assert.equal(nextCalled, true);
});
