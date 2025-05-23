# AI Bulk Website Classifier
![Streamlit UI Screenshot](./images/streamlit_screenshot.png)
![Results Table Screenshot](./images/result_example.png)

[![oaicite:11](https://img.shields.io/badge/Playwright-1.48.2-brightgreen?style=for-the-badge\&logo=playwright\&logoColor=white)](https://playwright.dev/)
[![oaicite:14](https://img.shields.io/badge/BeautifulSoup4-4.12.3-green?style=for-the-badge)](https://www.crummy.com/software/BeautifulSoup/bs4/doc/)
[![oaicite:17](https://img.shields.io/badge/pytesseract-0.3.10-blue?style=for-the-badge)](https://pypi.org/project/pytesseract/)
[![oaicite:20](https://img.shields.io/badge/Pillow-9.5.0-yellow?style=for-the-badge)](https://pillow.readthedocs.io/en/stable/)
[![oaicite:23](https://img.shields.io/badge/OpenAI-0.27.0-93f6ef?style=for-the-badge\&logo=openai)](https://platform.openai.com/docs)
[![oaicite:26](https://img.shields.io/badge/python--dotenv-1.0.0-lightgrey?style=for-the-badge)](https://pypi.org/project/python-dotenv/)
[![oaicite:29](https://img.shields.io/badge/Streamlit-1.32.0-FF4B4B?style=for-the-badge\&logo=streamlit\&logoColor=white)](https://streamlit.io/)


This project scans a list of domains, fetches page HTML and screenshots, extracts text via BeautifulSoup and locally run OCR, and classifies sites using OpenAI's API (Or Azure OpenAI) with function calling.

## Prerequisites

- Python 3.8+
- Tesseract OCR installed:
  - **macOS**: `brew install tesseract`
  - **Windows**: 
    - Option 1: Download installer from [GitHub releases](https://github.com/UB-Mannheim/tesseract/wiki)
    - Option 2: Using Chocolatey: `choco install tesseract`
    - Option 3: Using conda: `conda install -c conda-forge tesseract`
- [Playwright browsers](https://playwright.dev/python/docs/installation) installed

## Setup

1. Clone the repository and navigate to the project folder.
2. Create and activate a virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Install Playwright browsers:
   ```bash
   playwright install
   ```
5. Create a `.env` file in the project root with your OpenAI API key:
   ```dotenv
   OPENAI_API_KEY=your_api_key_here
   ```

### Azure OpenAI Setup (Alternative)

If you prefer to use Azure OpenAI instead of OpenAI directly:

1. Set up an Azure OpenAI resource in the Azure portal
2. Deploy a GPT-4.1-nano model in your Azure OpenAI resource
3. Create a `.env` file with Azure-specific configuration:
   ```dotenv
   AZURE_OPENAI_API_KEY=your_azure_api_key_here
   AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com/
   AZURE_OPENAI_API_VERSION=2024-02-15-preview
   AZURE_OPENAI_DEPLOYMENT_NAME=your-gpt-4-1-nano-deployment-name
   ```
4. Update `src/openai_client.py` to use Azure OpenAI:
   ```python
   # Replace the client initialization with:
   from openai import AzureOpenAI
   client = AzureOpenAI(
       api_key=os.getenv("AZURE_OPENAI_API_KEY"),
       api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
       azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT")
   )
   
   # Update the model name in the API call to your deployment name:
   model=os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")
   ```

## Input

- `domains.txt`: Newline-separated domains to classify (e.g., `example.com`).

## Usage

The project offers two main ways to classify websites: a command-line interface and a web-based Streamlit application.

### `streamlit_app.py` (Web Application)

This application provides a user-friendly interface to input domains, start the classification process, and view results and logs in real-time.

**To run the Streamlit app:**

```bash
streamlit run streamlit_app.py
```

### `run_CLI_pipeline.py` (Command-Line Interface)

This script provides a command-line interface for processing websites. It allows for batch processing and configuration through command-line arguments.

**Key Features & Options:**

*   **`--method [html|ocr|both]`**: (Default: `html`) Specifies the text extraction method.
*   **`--domains <filepath>`**: (Default: `domains.txt`) Path to the input file containing domains.
*   **`--output <filepath>`**: (Default: `results_enhanced.csv`) Path to the output CSV file.
*   **`--headful`**: Runs the browser in headful mode (UI visible). Useful for sites that block headless browsers. When using this, the number of workers is automatically limited to 2.
*   **`--anti-detection`**: Enables various anti-bot detection measures (e.g., user-agent spoofing).
*   **`--workers <number>`**: (Default: `4`) Number of parallel threads for processing domains.
*   **`--overwrite`**: If specified, the script will re-process all domains in the input list and overwrite the output file. By default (if this flag is not present), the script will skip domains already found in the output file and append new results.

**Example Commands:**

```bash
# Run with HTML extraction, default settings
python run_CLI_pipeline.py

# Run with OCR, headful mode, and anti-detection for a specific domain list
python run_CLI_pipeline.py --method ocr --headful --anti-detection --domains test_domains.txt --output test_ocr_results.csv --workers 1

# Run with 'both' methods, overwriting previous results
python run_CLI_pipeline.py --method both --overwrite --domains domains.txt --output all_results_fresh.csv
```

Results will be written to `results_enhanced.csv` by default (or the file specified by `--output`) with columns: `domain`, `classification_label`, and `summary`.

## Customization

### Adding Your Own Classification Labels

You can add your own classification categories by modifying the `openai_client.py` file:

1. Open `src/openai_client.py`
2. Find the `CLASSIFY_SITE_TOOL` dictionary definition
3. Locate the `classification_label` property and update the enum values:

```python
"classification_label": {
    "type": "string", 
    "enum": ["Marketing", "Portal", "Other", "Error", "YourNewCategory"],
    "description": "The primary classification category: 'Marketing', 'Portal', 'Other', 'Error', or 'YourNewCategory'"
},
```

4. You may also want to update the system message in the `classify_site` function to inform the AI about your new category and when to use it.

Remember to update your classification logic if you also use the Streamlit interface.

## **Architecural Diagram**

```mermaid
graph LR;

    %% == Subgraphs (Representing Layers/Zones) ==

    subgraph "User Interaction Layer"
        direction TB
        CLI["CLI<br>(run_CLI_pipeline.py)"]:::userInteractionStyle
        STREAMLIT["Streamlit App<br>(streamlit_app.py)"]:::userInteractionStyle
    end

    subgraph "Processing Core Modules"
        direction LR
        INPUT_HANDLER["Input Handler<br>(Domains from file/UI)"]:::coreModuleStyle
        SITE_FETCHER["Site Fetcher<br>(src/fetcher_enhanced.py<br>- Playwright)"]:::coreModuleStyle
        TEXT_ORCH["Text Extraction<br>Orchestrator"]:::coreModuleStyle
        HTML_EXTRACT["HTML Text Extractor<br>(src/text_extractor.py<br>- BeautifulSoup)"]:::coreModuleStyle
        OCR_MODULE["OCR Module<br>(src/ocr_module.py<br>- Pytesseract, Pillow)"]:::coreModuleStyle
        AI_CLASSIFIER["AI Classifier<br>(src/openai_client.py)"]:::coreModuleStyle
        RESULTS_WRITER["Results Writer<br>(src/writer.py)"]:::coreModuleStyle
    end

    subgraph "External Services"
        OPENAI_API["OpenAI API /<br>Azure OpenAI Service"]:::externalServiceStyle
    end

    subgraph "Data Artifacts"
        direction TB
        INPUT_DATA["Input: domains.txt /<br>UI Text Area"]:::dataArtifactStyle
        LOGS["Output: In-memory Logs<br>(Streamlit) /<br>Console Logs (CLI)"]:::dataArtifactStyle
        OUTPUT_CSV["Output:<br>results_enhanced.csv"]:::dataArtifactStyle
    end

    %% == Connections ==
    %% User Interaction to Core
    CLI --> INPUT_HANDLER
    STREAMLIT --> INPUT_HANDLER
    INPUT_DATA --> INPUT_HANDLER

    %% Core Processing Flow
    INPUT_HANDLER --> SITE_FETCHER
    SITE_FETCHER --> TEXT_ORCH
    SITE_FETCHER -- "Generates Logs" --> LOGS
    TEXT_ORCH -- "Chooses HTML" --> HTML_EXTRACT
    TEXT_ORCH -- "Chooses OCR" --> OCR_MODULE
    HTML_EXTRACT --> AI_CLASSIFIER
    OCR_MODULE --> AI_CLASSIFIER
    AI_CLASSIFIER --> RESULTS_WRITER
    %% Connection to External Services
    AI_CLASSIFIER --> OPENAI_API
    RESULTS_WRITER --> OUTPUT_CSV

    %% UI Displaying Logs
    STREAMLIT -. "Displays" .-> LOGS

    %% == Styling Definitions ==
    %% Zone/Layer based styling (applied to nodes)
    classDef userInteractionStyle fill:#cce5ff,stroke:#0050b3,stroke-width:2px,color:#000;
    classDef coreModuleStyle fill:#d9f7be,stroke:#52c41a,stroke-width:2px,color:#000;
    classDef externalServiceStyle fill:#ffe7ba,stroke:#fa8c16,stroke-width:2px,color:#000;
    classDef dataArtifactStyle fill:#ffccc7,stroke:#f5222d,stroke-width:2px,color:#000;
```
