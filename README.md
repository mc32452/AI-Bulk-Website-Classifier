# AI Bulk Website Classifier

An intelligent web scraping and classification system that analyzes websites using AI. The system fetches web content, extracts text via OCR and HTML parsing, and classifies sites using OpenAI's API with function calling.

## Features

- **Multiple Interfaces**: Streamlit webapp, CLI tool, and modern Next.js frontend
- **Intelligent Content Extraction**: HTML parsing + OCR for comprehensive text extraction
- **AI Classification**: OpenAI/Azure OpenAI powered categorization
- **High-Performance Storage**: SQLite database with advanced querying
- **Batch Processing**: Handle multiple domains efficiently
- **Export Capabilities**: CSV export with filtering options
- **Real-time Analytics**: Statistics and progress tracking

## Prerequisites

- Python 3.8+
- Node.js 18+ (for Next.js frontend)
- Tesseract OCR installed:
  - **macOS**: `brew install tesseract`
  - **Ubuntu/Debian**: `sudo apt-get install tesseract-ocr`
  - **Windows**: Download from [GitHub releases](https://github.com/UB-Mannheim/tesseract/wiki)

## Setup

### 1. Backend Setup

```bash
# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Install Playwright browsers
playwright install

# Create environment file
cp .env.example .env
# Edit .env with your OpenAI API key
```

### 2. Frontend Setup (Optional)

```bash
cd website-classifier
npm install
npm run build
```

### 3. Environment Configuration

Create a `.env` file with your API credentials:

```bash
# OpenAI Configuration
OPENAI_API_KEY=your_api_key_here

# Or Azure OpenAI Configuration
AZURE_OPENAI_API_KEY=your_azure_api_key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_VERSION=2024-02-15-preview
AZURE_OPENAI_DEPLOYMENT_NAME=your-deployment-name
```

## Usage

### Quick Start

```bash
# Start all services
./start.sh

# Or start individual components:

# 1. Streamlit App (http://localhost:8501)
streamlit run streamlit_app.py

# 2. Enhanced Flask API (http://localhost:5001)
python flask_backend_enhanced.py

# 3. Next.js Frontend (http://localhost:3000)
cd website-classifier && npm run dev
```

### CLI Usage

```bash
# Basic classification
python run_CLI_pipeline.py

# Advanced options
python run_CLI_pipeline.py \
  --method both \
  --domains custom_domains.txt \
  --workers 8 \
  --headful \
  --anti-detection
```

**CLI Options:**
- `--method [html|ocr|both]`: Text extraction method (default: html)
- `--domains <file>`: Input domains file (default: domains.txt)
- `--workers <num>`: Parallel threads (default: 4)
- `--headful`: Visible browser mode
- `--anti-detection`: Anti-bot measures
- `--overwrite`: Reprocess all domains

### Input Format

Create a `domains.txt` file with one domain per line:

```
github.com
stackoverflow.com
reddit.com
```

## API Endpoints

The Flask backend provides REST API endpoints:

- `GET /results` - Query results with filtering
- `GET /statistics` - Real-time statistics
- `GET /batches` - Batch management
- `POST /export/csv` - Export filtered CSV
- `GET /health` - System health check

Example:

```bash
# Get portal sites
curl "http://localhost:5001/results?label=Portal&limit=10"

# Export filtered results
curl -X POST http://localhost:5001/export/csv \
  -H "Content-Type: application/json" \
  -d '{"filename": "portals.csv", "filters": {"label": "Portal"}}'
```

## Project Structure

```
├── src/                    # Core modules
│   ├── database.py         # SQLite database operations
│   ├── fetcher_enhanced.py # Web scraping with Playwright
│   ├── text_extractor.py   # HTML text extraction
│   ├── ocr_module.py       # OCR processing
│   └── openai_client.py    # AI classification
├── website-classifier/     # Next.js frontend
├── streamlit_app.py        # Streamlit interface
├── flask_backend_enhanced.py # Flask API server
├── run_CLI_pipeline.py     # CLI tool
└── start.sh               # Startup script
```

## Customization

### Adding Classification Categories

Edit `src/openai_client.py` and update the `CLASSIFY_SITE_TOOL` enum:

```python
"classification_label": {
    "type": "string", 
    "enum": ["Marketing", "Portal", "Other", "Error", "YourCategory"],
    "description": "Classification categories"
}
```

### Database Schema

The SQLite database stores:
- Domain and URL information
- Classification results with confidence scores
- Batch metadata and timestamps
- Processing statistics

## Troubleshooting

### Common Issues

1. **Tesseract not found**: Ensure Tesseract is installed and in PATH
2. **Playwright browser errors**: Run `playwright install`
3. **API key errors**: Check `.env` file configuration
4. **Port conflicts**: Modify port numbers in startup scripts

### Performance Tips

- Use `--method html` for faster processing
- Adjust `--workers` based on your system
- Enable `--headful` only when necessary
- Use database storage for large datasets

## License

MIT License - see LICENSE file for details.
