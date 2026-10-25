"""Use the existing local Homebridge HAP interface; never change its security settings.

The bridge PIN is read locally and sent only to its loopback HAP listener.
No PIN, full accessory description or configuration is printed or saved.
"""
import argparse
import datetime
import http.client
import json
import pathlib
import time

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--aid', type=int, required=True)
parser.add_argument('--expect', required=True, help='Exact fan service name observed in Homebridge UI')
parser.add_argument('action', choices=['read', 'resume', 'speed', 'boost-on', 'boost-off', 'pause-on', 'pause-off'])
parser.add_argument('--percent', type=int, choices=[60, 96, 100])
args = parser.parse_args()
if args.action == 'speed' and args.percent is None:
    parser.error('speed requires --percent 60, 96 or 100')

root = pathlib.Path('/var/lib/homebridge')
config = json.loads((root / 'config.json').read_text())
platforms = [p for p in config['platforms'] if p.get('platform') == 'PaxCalima']
assert len(platforms) == 1
bridge = platforms[0]['_bridge']
port = bridge['port']
pin = bridge.get('pin') or config['bridge']['pin']


def request(method, path, body=None):
    connection = http.client.HTTPConnection('127.0.0.1', port, timeout=40)
    try:
        headers = {'Authorization': pin, 'Content-Type': 'application/hap+json'}
        connection.request(method, path, None if body is None else json.dumps(body), headers)
        response = connection.getresponse()
        data = response.read()
        assert response.status in (200, 204, 207), 'Local HAP interface refused this request'
        return response.status, json.loads(data) if data else {}
    finally:
        connection.close()


def kind(value):
    return value.upper().split('-')[0].lstrip('0')


_, tree = request('GET', '/accessories')
accessories = [a for a in tree['accessories'] if a['aid'] == args.aid]
assert len(accessories) == 1
services = accessories[0]['services']
fans = [s for s in services if kind(s['type']) == 'B7']
assert len(fans) == 1
fan = {kind(c['type']): c for c in fans[0]['characteristics']}
assert fan['23']['value'] == args.expect, 'Accessory identity differs from the observed UI'
fields = {'active': fan['B0']['iid'], 'measured_percent': fan['29']['iid']}
for label in ['Boost', 'Pause']:
    matches = [s for s in services if kind(s['type']) == '49' and any(
        kind(c['type']) == '23' and c.get('value') == args.expect + ' ' + label
        for c in s['characteristics'])]
    assert len(matches) == 1, 'Cannot uniquely identify ' + label
    fields[label.lower()] = next(c['iid'] for c in matches[0]['characteristics'] if kind(c['type']) == '25')


def readback():
    ids = ','.join(str(args.aid) + '.' + str(iid) for iid in fields.values())
    _, data = request('GET', '/characteristics?id=' + ids)
    values = {c['iid']: c for c in data['characteristics']}
    return {label: {'value': values[iid].get('value'), 'status': values[iid].get('status', 0)}
            for label, iid in fields.items()}


def record(event, data):
    entry = {'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'aid': args.aid,
             'action': args.action, 'requested_percent': args.percent, 'event': event, 'data': data}
    with pathlib.Path('/tmp/svarahome-hap-evidence.jsonl').open('a') as output:
        output.write(json.dumps(entry) + '\n')
    print(event, json.dumps(data), flush=True)


record('BEFORE', readback())
if args.action != 'read':
    if args.action == 'speed':
        target, value = fields['measured_percent'], args.percent
    elif args.action == 'boost-off':
        target, value = fields['boost'], False
    elif args.action == 'boost-on':
        target, value = fields['boost'], True
    elif args.action == 'pause-on':
        target, value = fields['pause'], True
    else:
        # Resume is intentionally Pause-off, matching the plugin's native control.
        target, value = fields['pause'], False
    status, result = request('PUT', '/characteristics', {'characteristics': [
        {'aid': args.aid, 'iid': target, 'value': value}]})
    record('REQUEST', {'http': status, 'response': result})
    for _ in range(3):
        time.sleep(10)
        record('READBACK', readback())
