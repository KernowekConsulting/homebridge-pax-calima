"""Retain only SvaraHome command/communication logs for at most 48 hours/8 MiB.

Run on the Pi with one output filename inside a private diagnostic directory.
Reads the existing log only; makes no HAP, Bluetooth or service requests.
"""
import os
import pathlib
import selectors
import subprocess
import sys
import time

LIMIT = 8 * 1024 * 1024
MARKERS = (b' request received.', b' request confirmed;', b' request replaced ',
           b' request stopped:', b' request pending;', b' manual readback differs;',
           b': Bluetooth attempt ',
           b': CO2 Clear ', b'SvaraHome runtime ',
           b' unavailable:', b' retrying communication:', b' communication restored.')


def keep(line):
    return b'SvaraHome ' in line and any(marker in line for marker in MARKERS)


def main():
    output = pathlib.Path(sys.argv[1])
    if output.parent.stat().st_mode & 0o077:
        raise SystemExit('Output directory must be private (0700)')
    # Exclusive creation prevents overwriting earlier evidence or following a symlink.
    fd = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'wb', buffering=0) as saved:
        proc = subprocess.Popen(['tail', '-n', '0', '-F', '/var/lib/homebridge/homebridge.log'],
                                stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        try:
            deadline = time.monotonic() + 48 * 3600
            total = 0
            pending = b''
            with selectors.DefaultSelector() as selector:
                selector.register(proc.stdout, selectors.EVENT_READ)
                while time.monotonic() < deadline and total < LIMIT:
                    if not selector.select(timeout=min(1, max(0, deadline - time.monotonic()))):
                        continue
                    chunk = os.read(proc.stdout.fileno(), 65536)
                    if not chunk:
                        break
                    pending += chunk
                    while b'\n' in pending:
                        line, pending = pending.split(b'\n', 1)
                        if keep(line):
                            line = line[:8192] + b'\n'
                            if total + len(line) > LIMIT:
                                return
                            saved.write(line)
                            total += len(line)
                    # Do not retain an unbounded malformed line in memory.
                    if len(pending) > 65536:
                        pending = b''
        finally:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()


if __name__ == '__main__':
    main()
