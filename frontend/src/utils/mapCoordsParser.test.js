import test from 'node:test';
import assert from 'node:assert/strict';
import { extractCoordsFromInput } from './mapCoordsParser.js';

test('extractCoordsFromInput: parses raw coordinates', () => {
    const res = extractCoordsFromInput('-16.398892, -71.536912');
    assert.ok(res);
    assert.equal(res.lat, -16.398892);
    assert.equal(res.lng, -71.536912);
});

test('extractCoordsFromInput: parses Google Maps URL with @', () => {
    const res = extractCoordsFromInput('https://www.google.com/maps/@-16.40123,-71.53234,17z');
    assert.ok(res);
    assert.equal(res.lat, -16.40123);
    assert.equal(res.lng, -71.53234);
});

test('extractCoordsFromInput: parses WhatsApp location link', () => {
    const res = extractCoordsFromInput('https://maps.google.com/maps?q=loc:-16.38912,-71.54123');
    assert.ok(res);
    assert.equal(res.lat, -16.38912);
    assert.equal(res.lng, -71.54123);
});

test('extractCoordsFromInput: parses URL with ?q=lat,lng', () => {
    const res = extractCoordsFromInput('https://maps.google.com/?q=-16.42,-71.55');
    assert.ok(res);
    assert.equal(res.lat, -16.42);
    assert.equal(res.lng, -71.55);
});

test('extractCoordsFromInput: returns null for invalid text or out-of-range coords', () => {
    assert.equal(extractCoordsFromInput('Av. Cayma 205'), null);
    assert.equal(extractCoordsFromInput(''), null);
    assert.equal(extractCoordsFromInput('999, 999'), null);
});
