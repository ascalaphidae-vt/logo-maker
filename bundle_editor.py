"""Assemble the same standalone editor for Streamlit's srcdoc iframe."""
from pathlib import Path


def build_editor(root: Path | None = None) -> str:
    root = root or Path(__file__).parent
    html = (root / "editor.html").read_text(encoding="utf-8")
    css_tag = '<link rel="stylesheet" href="web/style.css">'
    html = html.replace(css_tag, '<style>' + (root / 'web/style.css').read_text(encoding='utf-8') + '</style>')
    for name in ("engine", "app"):
        tag = f'<script src="web/{name}.js"></script>'
        source = (root / 'web' / f'{name}.js').read_text(encoding='utf-8')
        html = html.replace(tag, '<script>' + source + '</script>')
    return html


if __name__ == "__main__":
    # Optional portable file, with no Streamlit or HTTP server dependency.
    target = Path(__file__).with_name("pop-logo-standalone.html")
    target.write_text(build_editor(), encoding="utf-8")
    print(target)
