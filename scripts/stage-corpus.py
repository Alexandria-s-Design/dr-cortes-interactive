"""
Stage corpus for Dr. Cortes chatbot Gemini File Search upload.

Collects + cleans source materials into corpus/ for one-time upload.
- HTML from carlosecortes.com + crankyoldmancarlos.com -> cleaned plain text
- Bibliography, chronology, KB, database copied as-is
- PDFs copied as-is (Gemini File Search handles PDF natively)
"""
import html
import re
import shutil
from pathlib import Path

VAULT = Path(r"C:\Users\MarieLexisDad\Documents\Obsidian Vault")
PROJECT = VAULT / "01_Projects" / "Cortes--Interactive"
ARCHIVE = VAULT / "04_Archive" / "projects-2025"
POETRY = VAULT / "01_Projects" / "Personal--Cortes-Poetry"

OUT = PROJECT / "corpus"
OUT_WEB = OUT / "websites"
OUT_WEB.mkdir(parents=True, exist_ok=True)


def strip_html(raw: str) -> str:
    """Basic HTML -> readable text. Drops scripts/styles/nav/boilerplate, keeps article content."""
    # drop script/style blocks entirely
    raw = re.sub(r"<(script|style)\b[^>]*>.*?</\1>", " ", raw, flags=re.DOTALL | re.IGNORECASE)
    # drop header/footer/nav/aside/form blocks (WP boilerplate)
    raw = re.sub(r"<(header|footer|nav|aside|form)\b[^>]*>.*?</\1>", " ",
                 raw, flags=re.DOTALL | re.IGNORECASE)
    # preserve paragraph breaks
    raw = re.sub(r"</(p|div|h[1-6]|li|br)\s*>", "\n", raw, flags=re.IGNORECASE)
    raw = re.sub(r"<br\s*/?>", "\n", raw, flags=re.IGNORECASE)
    # strip remaining tags
    raw = re.sub(r"<[^>]+>", " ", raw)
    # decode entities
    raw = html.unescape(raw)
    # collapse whitespace
    raw = re.sub(r"[ \t]+", " ", raw)
    raw = re.sub(r"\n\s*\n\s*\n+", "\n\n", raw)
    return raw.strip()


def slugify(p: Path) -> str:
    # e.g. carlosecortes.com/2012/some-post/index.html -> carlosecortes-2012-some-post
    parts = p.relative_to(p.parents[len(p.parents) - 2]).with_suffix("").parts
    slug = "-".join(parts).replace("_", "-").replace("--", "-").strip("-")
    if slug.endswith("-index"):
        slug = slug[:-6]
    return slug or "index"


def stage_website(site_root: Path, prefix: str) -> int:
    """Walk HTML files in a scraped WP site, extract clean text, write one .txt per page."""
    count = 0
    for html_path in site_root.rglob("*.html"):
        # skip WP admin/feed/paginated noise
        rel = html_path.relative_to(site_root).as_posix().lower()
        if any(skip in rel for skip in ("/feed/", "/page/", "/comments/", "/wp-admin/", "/wp-content/")):
            continue
        try:
            raw = html_path.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        text = strip_html(raw)
        if len(text) < 300:  # drop tiny pages (tag archives etc.)
            continue
        parts = html_path.relative_to(site_root).with_suffix("").parts
        slug = "-".join(p for p in parts if p != "index") or "home"
        out_path = OUT_WEB / f"{prefix}--{slug}.txt"
        out_path.write_text(f"SOURCE: {prefix} — {'/'.join(parts)}\n\n{text}\n",
                            encoding="utf-8")
        count += 1
    return count


def main() -> None:
    # 1. Websites (cleaned)
    cec_count = stage_website(
        ARCHIVE / "Cortes--Archive" / "dr-cortes-archive" / "carlosecortes.com",
        "carlosecortes"
    )
    cranky_count = stage_website(
        ARCHIVE / "Cortes--Archive" / "dr-cortes-archive" / "crankyoldmancarlos.com",
        "crankyoldmancarlos"
    )
    print(f"websites staged: carlosecortes={cec_count}  crankyoldmancarlos={cranky_count}")

    # 2. Direct-copy sources (Gemini File Search handles .txt/.pdf/.csv/.doc natively)
    sources = [
        (ARCHIVE / "Cortes--Chatbot" / "knowledge_base.txt", "01-knowledge-base.txt"),
        (ARCHIVE / "Cortes--Website" / "Dr_Carlos_Cortes_Annotated_Bibliography_APA7.txt",
         "02-annotated-bibliography-apa7.txt"),
        (ARCHIVE / "Cortes--Website" / "Dr_Carlos_Cortes_Comprehensive_Database.csv",
         "03-works-database.csv"),
        (ARCHIVE / "Cortes--Website" / "Renewing_Multicultural_Education_Ancient_Mariners_Manifesto.pdf",
         "04-ancient-mariners-manifesto.pdf"),
        (ARCHIVE / "Cortes--Website" / "Cortes_Research.article.BeyondFreespeech.pdf",
         "05-beyond-free-speech.pdf"),
        (PROJECT / "chronology-revision-2026-02-19.doc", "06-chronology-2026-02-19.doc"),
        (POETRY / "Cortes-Poems-Preview.pdf", "07-poetry-preview-fourth-quarter.pdf"),
        (POETRY / "poems" / "LastManStanding.txt", "08-poem-last-man-standing.txt"),
        (POETRY / "poems" / "SunCity.txt", "09-poem-sun-city.txt"),
        (POETRY / "poems" / "Tomorrow.txt", "10-poem-tomorrow.txt"),
    ]

    copied = 0
    for src, dest_name in sources:
        if not src.exists():
            print(f"  MISSING: {src}")
            continue
        shutil.copy2(src, OUT / dest_name)
        copied += 1

    print(f"direct-copy sources staged: {copied}/{len(sources)}")

    # summary
    total_files = sum(1 for _ in OUT.rglob("*") if _.is_file())
    total_bytes = sum(f.stat().st_size for f in OUT.rglob("*") if f.is_file())
    print(f"\nTOTAL: {total_files} files, {total_bytes/1024/1024:.1f} MB")
    print(f"OUTPUT: {OUT}")


if __name__ == "__main__":
    main()
