package com.sparkleapp.plugins;

/**
 * JS-layer failures surfaced as Crashlytics non-fatals.
 *
 * Deliberately carries only the message: Crashlytics groups by exception class
 * and message, so a JS stack (which changes on every build and between
 * browsers) must NOT live in the message or every error becomes its own group.
 * The stack travels as a truncated log line + custom keys instead.
 */
public class SparkleJsException extends RuntimeException {
    public SparkleJsException(String message) {
        super(message);
    }
}