from PIL import Image
import pytesseract
import io


def ocr_image(screenshot_bytes: bytes) -> str:
    """
    Performs OCR on screenshot bytes to extract text.
    """
    image = Image.open(io.BytesIO(screenshot_bytes))
    text = pytesseract.image_to_string(image)
    return text
