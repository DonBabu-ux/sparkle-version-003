'use strict';

// Pure helpers for matching a provider's confirmation against the deposit we
// created. Kept dependency-free so money rules can be unit-tested without a DB.

function normalizeCurrency(value) {
    return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function isValidCents(value) {
    return Number.isSafeInteger(value) && value > 0;
}

function reconcileDepositAmount({ expectedCents, expectedCurrency, confirmedCents, confirmedCurrency }) {
    if (!isValidCents(expectedCents)) {
        return { ok: false, reason: 'invalid_expected_amount' };
    }
    if (!isValidCents(confirmedCents)) {
        return { ok: false, reason: 'invalid_confirmed_amount' };
    }

    const normalizedExpected = normalizeCurrency(expectedCurrency);
    const normalizedConfirmed = normalizeCurrency(confirmedCurrency);

    if (!normalizedExpected || !normalizedConfirmed) {
        return { ok: false, reason: 'invalid_currency' };
    }
    if (expectedCents !== confirmedCents) {
        return {
            ok: false,
            reason: 'amount_mismatch',
            expectedCents,
            confirmedCents,
            expectedCurrency: normalizedExpected,
            confirmedCurrency: normalizedConfirmed
        };
    }
    if (normalizedExpected !== normalizedConfirmed) {
        return {
            ok: false,
            reason: 'currency_mismatch',
            expectedCents,
            confirmedCents,
            expectedCurrency: normalizedExpected,
            confirmedCurrency: normalizedConfirmed
        };
    }

    return { ok: true, amountCents: confirmedCents, currency: normalizedConfirmed };
}

module.exports = { normalizeCurrency, isValidCents, reconcileDepositAmount };
