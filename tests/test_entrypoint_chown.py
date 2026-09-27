import grp
import os
import pwd
import re
import subprocess
from pathlib import Path

import pytest

ENTRYPOINT = Path(__file__).resolve().parents[1] / "deploy" / "docker" / "entrypoint.sh"
APP_DIR = "/home/mediacms.io/mediacms"


def chown_command():
    """The find ... -exec chown line of entrypoint.sh"""

    lines = [line for line in ENTRYPOINT.read_text().splitlines() if re.match(rf"^find {re.escape(APP_DIR)} .*-exec chown ", line)]
    assert len(lines) == 1, lines
    return lines[0]


@pytest.mark.skipif(os.geteuid() != 0, reason="needs root to create files with another owner")
def test_chown_skips_files_already_owned(tmp_path):
    target_uid = pwd.getpwnam("www-data").pw_uid
    target_gid = grp.getgrnam("www-data").gr_gid

    tree = tmp_path / "app"
    owned, other = [], []
    for i in range(6):
        folder = tree / f"dir{i}"
        folder.mkdir(parents=True)
        for j in range(2):
            path = folder / f"file{j}.txt"
            path.write_text("x")
            (owned if i % 2 else other).append(path)
        if i % 2:
            os.chown(folder, target_uid, target_gid)
            for path in folder.iterdir():
                os.chown(path, target_uid, target_gid)
        else:
            other.append(folder)
    # right user, wrong group: still needs a chown
    wrong_group = tree / "dir1" / "wrong-group.txt"
    wrong_group.write_text("x")
    os.chown(wrong_group, target_uid, 0)
    other.extend([wrong_group, tree])

    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    record = tmp_path / "chown.log"
    stub = bin_dir / "chown"
    stub.write_text(f'#!/bin/sh\nshift\nfor f in "$@"; do echo "$f" >> {record}; done\n')
    stub.chmod(0o755)

    command = chown_command().replace(APP_DIR, str(tree), 1)
    env = {**os.environ, "PATH": f"{bin_dir}:{os.environ['PATH']}", "TARGET_GID": str(target_gid)}
    subprocess.run(["bash", "-c", command], env=env, check=True, timeout=60)

    chowned = set(record.read_text().split()) if record.exists() else set()
    assert chowned == {str(path) for path in other}
