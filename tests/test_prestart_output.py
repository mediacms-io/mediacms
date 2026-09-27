import os
import subprocess
from pathlib import Path

PRESTART = Path(__file__).resolve().parents[1] / "deploy" / "docker" / "prestart.sh"
GENERATED = "generatedpass42"

# python: prints a generated password for "python -c", "False" for "manage.py shell"
# (no existing installation), nothing otherwise. cp and rm do nothing, so the test
# never touches the nginx or supervisord configuration of the container.
STUBS = {
    "python": f"""#!/bin/sh
if [ "$1" = "-c" ]; then echo {GENERATED}; exit 0; fi
if [ "$2" = "shell" ]; then cat >/dev/null; echo False; fi
exit 0
""",
    "cp": "#!/bin/sh\nexit 0\n",
    "rm": "#!/bin/sh\nexit 0\n",
}


def run_prestart(tmp_path, **env):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    for name, body in STUBS.items():
        stub = bin_dir / name
        stub.write_text(body)
        stub.chmod(0o755)
    environ = {
        "PATH": f"{bin_dir}:{os.environ['PATH']}",
        "ENABLE_MIGRATIONS": "yes",
        "ADMIN_USER": "admin",
        "ADMIN_EMAIL": "admin@example.org",
        **env,
    }
    result = subprocess.run(["bash", str(PRESTART)], cwd=tmp_path, env=environ, capture_output=True, text=True, timeout=60)
    assert result.returncode == 0, result.stderr
    assert "Running loaddata and creating admin user" in result.stdout
    return result.stdout


def test_provided_password_is_not_printed(tmp_path):
    output = run_prestart(tmp_path, ADMIN_PASSWORD="given-secret")
    assert "given-secret" not in output


def test_generated_password_is_printed_once(tmp_path):
    output = run_prestart(tmp_path)
    assert output.count(GENERATED) == 1
