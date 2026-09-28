import re
from pathlib import Path

import pytest

DOCKERFILE = Path(__file__).resolve().parents[1] / "Dockerfile"


def uv_install_commands():
    """Every "uv pip install" command of the Dockerfile, continuation lines joined"""

    text = re.sub(r"\\\n\s*", " ", DOCKERFILE.read_text())
    return [command.strip() for command in re.findall(r"uv pip install[^&;\n]*", text)]


def test_dockerfile_has_uv_install_commands():
    assert uv_install_commands()


@pytest.mark.parametrize("command", uv_install_commands())
def test_uv_install_leaves_no_cache(command):
    """uv keeps downloaded wheels and built sdists in /root/.cache/uv unless told not to"""

    assert "--no-cache" in command.split()
