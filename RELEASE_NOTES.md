# SvaraHome 2.5.0 — Boost and Pause

Draft for release. This build still needs the Pi and Apple Home acceptance checks described below.

A little more airflow when you need it. A quiet moment when you want one.

SvaraHome 2.5.0 brings working Boost and Pause controls to Apple Home, with clearer fan state and more careful Bluetooth communication.

## Boost — then back to normal

Start a boost from Home, a scene or Siri. Choose the usual speed and duration in Plugin Config. When the fan's timer ends, it returns to its own automatic ventilation. Turn Boost off to return sooner, or start it again for a fresh period.

The speed slider now changes a temporary session. Your saved humidity, light and background-ventilation speeds stay in place.

## Pause — with a way back

Pause gives you a timed stop. The fan's own timer resumes automatic ventilation even if Homebridge disconnects. Turn Pause off to resume sooner; the motor may take a few seconds to start.

Boost and Pause are two views of one manual override. Starting either replaces the other, and the switches follow what the fan reports. Both are shown by default and can be hidden in Plugin Config. These controls currently require the tested automatic installation mode, mode 00.

## Clearer communication

Each fan uses its own address and six- or eight-digit PIN. Homebridge checks authentication before it reads operating state or sends controls, then checks the fan's response to a command. A missing or uncertain result is shown as a communication fault.

Bluetooth work is queued across fans, so a poll and a new command no longer compete for the same connection. After a restart, Homebridge reads the fan's current override instead of assuming it has finished.

Quiet-hours schedules are saved when their configured times change. Routine polling leaves later official-app changes alone.

## More honest readings

The old humidity and light tiles used bytes that describe heat settings, rather than measured humidity or light. Those tiles have been removed, alongside the temperature tile whose conversion remains unverified. Implausible speed samples now produce a fault rather than a plausible-looking percentage.

Your fan accessory keeps its identity. The old Boost event button is replaced, so check any scenes that used it. Each fan must have an address and its own PIN in Plugin Config; the plugin no longer guesses a default PIN.

The plugin now appears as SvaraHome, with a new blue house-and-fan logo prepared for Homebridge’s verification and icon process. Existing fan identities and room names are retained. Verification has not yet been granted.

## What we have checked

Earlier device trials on the newer Kitchen fan confirmed timed Boost, Pause, expiry, early resume and speed changes. This implementation adds automated tests with real Homebridge services and recorded telemetry. It has not yet been deployed to the Pi or exercised through Siri and Apple Home. The older fan still needs its identity/PIN checked before its controls can be validated.

Linux native dependency installation, the Bluetooth dependency audit and the final live acceptance checks remain release gates. This draft does not claim Homebridge verification or complete hardware compatibility.
