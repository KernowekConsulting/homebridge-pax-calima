"""Bounded Pause/return-to-automatic acceptance using existing loopback HAP.

No radio reset, direct BLE connection, config edit, or bridge restart. Existing
overrides/pending requests abort. The bridge credential stays in local memory.
Default is read-only. --run authorizes two sequential temporary Pause trials.
"""
import argparse
import datetime
import hashlib
import http.client
import json
import os
from pathlib import Path
import subprocess
import tarfile
import time

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--run', action='store_true')
args = parser.parse_args()
root = Path('/var/lib/homebridge')
raw = (root / 'config.json').read_bytes()
config = json.loads(raw)
platforms = [p for p in config['platforms'] if p.get('platform') == 'PaxCalima']
assert len(platforms) == 1
platform = platforms[0]
bridge = platform['_bridge']
out = None


def record(event, data):
    entry = {'utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
             'event': event, 'data': data}
    print(json.dumps(entry), flush=True)
    if out:
        with (out / 'trial.jsonl').open('a') as output:
            output.write(json.dumps(entry) + '\n')


def request(method, path, body=None):
    connection = http.client.HTTPConnection('127.0.0.1', bridge['port'], timeout=40)
    try:
        connection.request(method, path, None if body is None else json.dumps(body),
                           headers={'Authorization': bridge.get('pin') or config['bridge']['pin'],
                                    'Content-Type': 'application/hap+json'})
        response = connection.getresponse()
        data = response.read()
        assert response.status in (200, 204, 207), 'Unexpected HAP status'
        return response.status, json.loads(data) if data else {}
    finally:
        connection.close()


def kind(value):
    return value.upper().split('-')[0].lstrip('0')


def fields(aid, expected):
    _, tree = request('GET', '/accessories')
    accessories = [a for a in tree['accessories'] if a['aid'] == aid]
    assert len(accessories) == 1
    services = accessories[0]['services']
    fans = [s for s in services if kind(s['type']) == 'B7']
    assert len(fans) == 1
    fan = {kind(c['type']): c for c in fans[0]['characteristics']}
    assert fan['23']['value'] == expected, 'Fan identity changed'
    result = {'active': fan['B0']['iid'], 'measured_percent': fan['29']['iid']}
    for label in ('Boost', 'Pause'):
        matches = [s for s in services if kind(s['type']) == '49' and any(
            kind(c['type']) == '23' and c.get('value') == expected + ' ' + label + ' Fan'
            for c in s['characteristics'])]
        assert len(matches) == 1
        result[label.lower()] = next(c['iid'] for c in matches[0]['characteristics'] if kind(c['type']) == '25')
    return result


def read(aid, ids):
    _, data = request('GET', '/characteristics?id=' + ','.join(f'{aid}.{iid}' for iid in ids.values()))
    values = {c['iid']: c for c in data['characteristics']}
    return {key: {'value': values[iid].get('value'), 'status': values[iid].get('status', 0)}
            for key, iid in ids.items()}


def matches(values, paused):
    return (all(v['status'] == 0 for v in values.values())
            and values['pause']['value'] == int(paused)
            and values['boost']['value'] == 0
            and (not paused or (values['active']['value'] == 0 and values['measured_percent']['value'] == 0)))


def wait_for(aid, ids, paused, seconds):
    deadline = time.monotonic() + seconds
    while True:
        values = read(aid, ids)
        if matches(values, paused):
            record('pause-confirmed' if paused else 'automatic-confirmed', {'aid': aid, 'state': values})
            return True
        if time.monotonic() >= deadline:
            record('confirmation-timeout', {'aid': aid, 'paused': paused, 'state': values})
            return False
        time.sleep(5)


targets = [(3, 'Kitchen Fan'), (2, 'Pax Calima 47:56')]
identified = [(aid, fields(aid, name)) for aid, name in targets]
for aid, ids in identified:
    state = read(aid, ids)
    record('preflight', {'aid': aid, 'state': state})
    assert matches(state, False), 'Existing override or unavailable fan; abort'
for path in (root / 'accessories').glob('cachedAccessories*'):
    entries = json.loads(path.read_text())
    assert not any(a.get('context', {}).get('pendingManual') for a in entries), 'Existing pending command; abort'

if args.run:
    out = root / ('svarahome-pause-acceptance-' + datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
    out.mkdir(mode=0o700)
    with tarfile.open(out / 'rollback.tar.gz', 'w:gz') as archive:
        for name in ('config.json', 'node_modules/homebridge-pax-calima', 'accessories', 'persist'):
            archive.add(root / name, arcname=name)
    os.chmod(out / 'rollback.tar.gz', 0o600)
    with tarfile.open(out / 'rollback.tar.gz') as archive:
        assert archive.extractfile('config.json').read() == raw
        for name in ('lib/accessory.js', 'lib/transport.js'):
            assert archive.extractfile('node_modules/homebridge-pax-calima/' + name).read() == (root / 'node_modules/homebridge-pax-calima' / name).read_bytes()
    baseline = {name: hashlib.sha256((root / name).read_bytes()).hexdigest() for name in
                ('config.json', 'node_modules/homebridge-pax-calima/lib/accessory.js',
                 'node_modules/homebridge-pax-calima/lib/transport.js')}
    processes = subprocess.getoutput('ps -eo pid,ppid,comm | grep homebridge')
    record('backup-verified', {'directory': str(out), 'sha256': hashlib.sha256((out / 'rollback.tar.gz').read_bytes()).hexdigest()})
    for aid, ids in identified:
        assert matches(read(aid, ids), False), 'State changed before trial; abort'
        confirmed = False
        try:
            # The pending retry owns delivery: send On only once, then observe.
            status, data = request('PUT', '/characteristics', {'characteristics': [
                {'aid': aid, 'iid': ids['pause'], 'value': True}]})
            record('pause-request', {'aid': aid, 'http': status, 'response': data})
            confirmed = wait_for(aid, ids, True, 90)
        finally:
            # Off also cancels any still-pending Pause On. Leave the normal
            # persistent retry in charge of transient cancellation failures.
            status, data = request('PUT', '/characteristics', {'characteristics': [
                {'aid': aid, 'iid': ids['pause'], 'value': False}]})
            record('resume-request', {'aid': aid, 'http': status, 'response': data})
            assert wait_for(aid, ids, False, 120), 'Return to automatic remains unconfirmed; stop'
        assert confirmed, 'Pause delivery failed; no further fan trial'
    assert all(hashlib.sha256((root / name).read_bytes()).hexdigest() == digest for name, digest in baseline.items())
    assert subprocess.getoutput('ps -eo pid,ppid,comm | grep homebridge') == processes
    record('acceptance-complete', {'configAndSourceUnchanged': True, 'homebridgeProcessesUnchanged': True})
