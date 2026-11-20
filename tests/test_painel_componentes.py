"""Every <Component> the panel renders must exist in its file.

ESLint's no-undef does not look at JSX tag names (that needs
eslint-plugin-react's jsx-no-undef, which this project does not ship), so a
`<Icon />` whose `icon: Icon` was dropped from a destructure built fine and
only crashed when the page opened (#legal and #/pricing, 19-nov-2026).
"""
import pathlib
import re

SRC = pathlib.Path(__file__).resolve().parent.parent / "dashboard" / "src"


def test_no_jsx_component_is_used_without_being_defined():
    faltando = []
    for f in sorted(SRC.rglob("*.js*")):
        if f.suffix not in (".js", ".jsx"):
            continue
        s = f.read_text(encoding="utf-8")
        for nome in sorted(set(re.findall(r"<([A-Z][A-Za-z0-9_]*)[\s/>.]", s))):
            resto = re.sub(r"</?" + nome + r"\b", "", s)
            if not re.search(r"\b" + nome + r"\b", resto):
                faltando.append(f"{f.relative_to(SRC)}: <{nome}>")
    assert not faltando, "componentes sem definição: " + ", ".join(faltando)


def test_every_lucide_icon_imported_exists():
    """An icon name that this lucide-react version does not export builds a
    panel that never opens (TriangleAlert, 20-nov-2026, caught at build)."""
    import pytest
    dts = SRC.parent / "node_modules" / "lucide-react" / "dist" / "lucide-react.d.ts"
    if not dts.is_file():
        pytest.skip("node_modules ausente")
    txt = dts.read_text(encoding="utf-8")
    existe = set(re.findall(r"declare const (\w+)", txt)) | set(re.findall(r"\bas (\w+)", txt))
    faltando = []
    for f in sorted(SRC.rglob("*.js*")):
        if f.suffix not in (".js", ".jsx"):
            continue
        for bloco in re.findall(r"import\s*\{([^}]*)\}\s*from\s*['\"]lucide-react['\"]", f.read_text(encoding="utf-8")):
            for nome in (n.strip().split(" as ")[0].strip() for n in bloco.split(",")):
                if nome and nome not in existe:
                    faltando.append(f"{f.relative_to(SRC)}: {nome}")
    assert not faltando, "ícones que não existem no lucide-react: " + ", ".join(faltando)
