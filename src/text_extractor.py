from bs4 import BeautifulSoup


def extract_text(html: str) -> str:
    """
    Extracts visible text from HTML, stripping scripts, styles, nav, header, and footer.
    """
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(['script', 'style', 'nav', 'header', 'footer']):
        tag.decompose()
    text = soup.get_text(separator=' ', strip=True)
    return text
