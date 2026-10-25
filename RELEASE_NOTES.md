# SvaraHome 2.5.0-beta.2 — Patient requests, truthful tiles

Ask for a boost. Let SvaraHome work through a temporary Bluetooth interruption. See what the fan has confirmed.

This beta builds on SvaraHome's timed Boost and Pause controls, with recovery improvements tested on both the newer Kitchen fan and the older Wetroom fan.

## A request worth waiting for

Boost, Pause and speed requests now stay pending through temporary Bluetooth failures. SvaraHome retries after a failed attempt, including after a child-bridge restart. A newer manual command replaces the waiting request.

For example, say, “Siri, boost the kitchen fan.” Siri may still time out while Bluetooth recovers; the request can continue afterwards. Turn Boost off to cancel a pending Boost, or Pause off to cancel a pending Pause. A waiting request can start when the fan becomes reachable later.

Rejected authentication, invalid data, unsupported operating modes and an explicitly different control readback stop retries and need attention.

## What Home shows

Boost and Pause follow the fan's confirmed manual state. The speed slider returns to measured speed after a request, rather than staying at the percentage you asked for.

An uncertain write is checked before it is repeated, so an already-running timer is preserved. A missed background poll retains the last verified reading only within the existing 45-second freshness limit. Failed commands and stale or invalid readings report a communication fault.

Bluetooth recovery now retries stalled disconnects and waits for scanning to stop before connecting. Logs identify which fan needs attention, and Boost and Pause have explicit tile names.

## A limit for each fan

The optional **Maximum requested speed** setting caps Boost and slider targets separately for each fan. Measured speed remains unchanged.

Our older Wetroom fan accepted 2400 RPM but returned a zero-RPM override for a 2450 RPM request. Its tested limit is now 2400 RPM; Kitchen retains 2450 RPM. This is evidence from these fans, rather than a universal limit for every firmware version.

## Before you upgrade

Check that each fan has its own Bluetooth address and correct six- or eight-digit PIN. Close the official app while Homebridge connects. After saving configuration changes, use **Restart Child Bridge** on SvaraHome's plugin card so the saved settings are loaded.

Timed controls keep the fan's own expiry timer and leave persistent ventilation presets in place. Existing fan identities and room assignments are retained. If upgrading from 2.4.x, check scenes that used the old Boost event button; it is replaced by a working switch. Unsupported temperature, humidity and light tiles are removed.

Setup guidance and support now live at the [SvaraHome website](https://homebridge.svarahome.kernowekconsulting.co.uk).

## Tested, with more to learn

Live checks confirmed Boost, Pause and cancellation on both fans, plus the capped speed slider on Wetroom. The control implementation passed 48 automated tests in each Node 22/24 and Homebridge 1/2 combination. Short successful trials do not establish uninterrupted Bluetooth reliability, and Siri voice recognition still depends on your Home names and scenes.

This is a testing release. Homebridge verification remains pending.
