import os
import sys

# Make the repo root importable so tests can import the app modules directly.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Tests always run the app in self-host (BYOK) mode. app.py freezes
# BILLING_ENABLED at import time and load_dotenv never overrides an existing
# variable, so this must be set here — before any test module imports app — or
# the suite's behavior would depend on the developer's personal .env.
os.environ["BILLING_ENABLED"] = "0"

# The owner's login (acesso.json) is versioned in the repo; the suite tests
# the API without it, and tests that need a login set it themselves. The
# session key goes to a throwaway file, never the developer's ~/.openshorts.
import tempfile as _tempfile
_TMP = _tempfile.mkdtemp(prefix="os-tests-")
os.environ["OPENSHORTS_ACESSO_FILE"] = os.path.join(_TMP, "sem-acesso.json")
os.environ["OPENSHORTS_SESSAO_KEY_FILE"] = os.path.join(_TMP, "sessao.key")
