'use strict';

// Payloads compared with the owner's serial Kitchen trials, 24 October 2026.
const UUID = Object.freeze({
  auth: '4cad343a209a40b7b9114d9b3df569b2',
  confirmation: 'd1ae6b70ee124f6db166d2063dcaffe1',
  status: '528b80e8c47a4c0abdf1916a7748f412',
  manual: '118c949c28c84139b0b336657fd055a9',
  mode: '90cabcd1bcda416785d816dcd8ab6a6b',
  silent: 'b5836b5557bd433e848046e4993c5ac0',
});
const MAX_RPM = 2500;
const MIN_MANUAL_RPM = 1000;
const normalise = value => String(value || '').replace(/-/g, '').toLowerCase();

class FanError extends Error {
  constructor(code) { super(code); this.code = code; }
}
function check(condition, code) { if (!condition) throw new FanError(code); }
function bytes(value, size) {
  check(Buffer.isBuffer(value) && value.length === size, 'INVALID_PAYLOAD');
  return value;
}
function encodePin(pin) {
  // Strings retain leading zeroes. Never include a PIN or backend error in logs.
  check(typeof pin === 'string' && /^(?:\d{6}|\d{8})$/.test(pin), 'INVALID_PIN');
  const result = Buffer.alloc(4);
  result.writeUInt32LE(Number(pin));
  return result;
}
function confirmAuth(value) {
  // Current fans return one byte; the historical driver also supports UInt32LE.
  check(Buffer.isBuffer(value) && [1, 4].includes(value.length), 'AUTH_RESPONSE_INVALID');
  check(value.readUIntLE(0, value.length) === 1, 'AUTH_REJECTED');
}
function decodeStatus(value) {
  bytes(value, 12);
  const rpm = value.readUInt16LE(6);
  check(rpm <= MAX_RPM, 'RPM_OUT_OF_RANGE');
  // Other words are not exposed as ambient temperature, humidity or lux.
  return { rpm, trigger: value[8] };
}
function decodeManual(value) {
  bytes(value, 5);
  check(value[0] <= 1, 'INVALID_MANUAL_STATE');
  const rpm = value.readUInt16LE(1), seconds = value.readUInt16LE(3);
  // Disabled payloads can retain the previous speed after native expiry.
  const enabled = value[0] === 1 && seconds > 0;
  check(!enabled || rpm <= MAX_RPM, 'INVALID_MANUAL_STATE');
  return { enabled, rpm, seconds, state: enabled ? (rpm === 0 ? 'pause' : 'boost') : 'automatic' };
}
function encodeManual(rpm, seconds) {
  check(Number.isInteger(rpm) && (rpm === 0 || (rpm >= MIN_MANUAL_RPM && rpm <= MAX_RPM && rpm % 25 === 0)), 'INVALID_SPEED');
  check(Number.isInteger(seconds) && seconds >= 1 && seconds <= 65535, 'INVALID_DURATION');
  const value = Buffer.alloc(5);
  value[0] = 1; value.writeUInt16LE(rpm, 1); value.writeUInt16LE(seconds, 3);
  return value;
}
function verifyManual(actual, requested) {
  const state = decodeManual(actual), want = decodeManual(requested);
  check(state.enabled === want.enabled && (!want.enabled ||
    (state.rpm === want.rpm && state.seconds > 0 && state.seconds <= want.seconds)), 'COMMAND_NOT_CONFIRMED');
  return state;
}
function decodeSilent(value) {
  bytes(value, 5);
  check(value[0] <= 1 && value[1] < 24 && value[2] < 60 && value[3] < 24 && value[4] < 60, 'INVALID_SCHEDULE');
  return { enabled: value[0] === 1, value: Buffer.from(value) };
}
function parseTime(value) {
  if (typeof value !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  return value.split(':').map(Number);
}
function configuredSchedule(start, end) {
  if (!start && !end) return null;
  const a = parseTime(start), b = parseTime(end);
  check(a && b && start !== end, 'INVALID_SCHEDULE');
  return Buffer.from([1, ...a, ...b]);
}
function publicError(error) { return error instanceof FanError ? error.code : 'BLE_OPERATION_FAILED'; }

module.exports = { UUID, MAX_RPM, MIN_MANUAL_RPM, normalise, FanError, check, bytes,
  encodePin, confirmAuth, decodeStatus, decodeManual, encodeManual, verifyManual,
  decodeSilent, configuredSchedule, publicError };
