'use strict';

/**
 * Derives the bit positions of an identity inside a Bloom Filter.
 *
 * The HMAC digest is already a keyed hash, so it is reused as the hash source:
 * double hashing (h1 + i * h2) produces k well distributed positions without
 * ever exposing the raw identity value.
 */
function derivePositions(hmacHex, bits, hashCount) {
    const digest = Buffer.from(String(hmacHex), 'hex');
    const h1 = digest.readUInt32BE(0);
    const h2 = digest.readUInt32BE(4) | 1;
    const positions = new Array(hashCount);
    for (let i = 0; i < hashCount; i++) {
        const combined = (h1 + Math.imul(i, h2)) % bits;
        positions[i] = combined < 0 ? combined + bits : combined;
    }
    return positions;
}

/**
 * The readiness token binds a populated filter to the HMAC secret and to the
 * geometry it was built with. A mismatch makes the filter untrusted.
 */
function buildReadyToken(fingerprint, bits, hashCount) {
    return `${fingerprint}.${bits}.${hashCount}`;
}

module.exports = { derivePositions, buildReadyToken };
