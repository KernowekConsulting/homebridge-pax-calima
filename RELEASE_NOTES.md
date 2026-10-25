# SvaraHome 2.5.0-beta.1 — Boost and Pause

A little more airflow when you need it. A quiet moment when you want one.

Meet SvaraHome: the new name for our Pax Calima and Vent-Axia Svara Homebridge plugin. This first beta introduces timed Boost and Pause controls, more careful Bluetooth communication and a new house-and-fan identity.

## Boost — then back to normal

Start a temporary boost from Apple Home. For example, say, “Siri, boost the fan.” Choose its usual speed and duration in Plugin Config, and let the fan return to automatic ventilation when its timer ends. Turn Boost off to return sooner.

The speed slider now changes a temporary session, leaving your saved humidity, light and background-ventilation speed settings in place.

## Pause — with a way back

Pause stops the fan temporarily. Its own timer returns it to automatic ventilation, even if Homebridge disconnects. Turn Pause off to resume sooner; the motor may take a few seconds to respond.

Boost and Pause share one manual override. Starting either replaces the other, and their switches follow the fan’s reported state. Both are shown by default and can be hidden in Plugin Config.

Name the controls clearly in Home, then use them in scenes or with Siri.

## Clearer communication

Each fan uses its own Bluetooth address and six- or eight-digit PIN. SvaraHome checks authentication before reading operating state or sending controls, then checks command readback.

Bluetooth work is queued across fans. Missing responses, stale readings and implausible speed values produce a communication fault instead of an assumed success. After a restart, SvaraHome reads the current override from the fan.

Quiet-hours schedules are saved when their configured times change. Routine polling respects later changes made in the official app.

## Before you upgrade

Your fan accessory keeps its identity and existing room assignment. The old Boost event button is replaced by a working switch, so check scenes that referred to it.

Every fan now needs its own address and PIN in Plugin Config. SvaraHome no longer guesses a default PIN.

Temperature, humidity and light tiles are removed. The previous humidity/light values came from heat settings, and the temperature conversion remains unverified.

The approved SvaraHome logo is included. Its appearance on the Homebridge plugin tile depends on Homebridge’s verification and icon-registration process.

## About this beta

Manual controls currently require the tested operating mode, mode 00. SvaraHome does not change installation modes.

Automated checks cover real Homebridge services, simulated Bluetooth communication and recorded fan telemetry. Earlier device trials established the underlying Boost and Pause commands on the newer Kitchen fan. Live testing of this plugin implementation and validation of the older fan remain outstanding.

This is a testing release. Homebridge verification has not yet been granted.
