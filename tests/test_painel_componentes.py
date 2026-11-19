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
