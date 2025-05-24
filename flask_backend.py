#!/usr/bin/env python3
"""
Flask backend service for website classification.
This service integrates with the existing Python pipeline.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import os
import tempfile
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
import logging

# Add the current directory to the path to import our modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from run_CLI_pipeline import process_domain
except ImportError:
    print("Warning: Could not import run_CLI_pipeline. Using mock processing.")
    process_domain = None

app = Flask(__name__)
CORS(app)

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({"status": "healthy"})

@app.route('/classify', methods=['POST'])
def classify_domains():
    """
    Classify a list of domains.
    
    Expected JSON payload:
    {
        "domains": ["example.com", "google.com"],
        "config": {
            "method": "HTML" | "OCR",
            "headless": true,
            "antiDetection": false,
            "workers": 4,
            "overwrite": false
        }
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'domains' not in data:
            return jsonify({"error": "No domains provided"}), 400
        
        domains = data['domains']
        config = data.get('config', {})
        
        if not domains:
            return jsonify({"error": "Empty domains list"}), 400
        
        # Extract configuration
        text_method = config.get('method', 'HTML').lower()  # Convert to lowercase
        headless = config.get('headless', True)
        anti_detection = config.get('antiDetection', False)
        workers = config.get('workers', 4)
        
        logger.info(f"Processing {len(domains)} domains with config: {config}")
        
        # Process domains
        if process_domain is None:
            # Use mock processing if the main pipeline is not available
            results = []
            for domain in domains:
                results.append({
                    "domain": domain,
                    "classification_label": "Marketing",  # Mock result
                    "summary": f"Mock summary for {domain}",
                    "confidence_level": 0.85,
                    "snippet": f"Mock snippet for {domain}..."
                })
        else:
            # Use real processing
            results = []
            with ThreadPoolExecutor(max_workers=workers) as executor:
                future_to_domain = {
                    executor.submit(process_domain, domain, text_method, headless, anti_detection): domain
                    for domain in domains
                }
                
                for future in as_completed(future_to_domain):
                    domain = future_to_domain[future]
                    try:
                        result = future.result()
                        results.append(result)
                    except Exception as e:
                        logger.error(f"Error processing {domain}: {e}")
                        results.append({
                            "domain": domain,
                            "classification_label": "Error",
                            "summary": str(e),
                            "confidence_level": 0.0,
                            "snippet": "Error occurred during processing"
                        })
        
        logger.info(f"Successfully processed {len(results)} domains")
        return jsonify({"results": results})
        
    except Exception as e:
        logger.error(f"API Error: {e}")
        return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('DEBUG', 'false').lower() == 'true'
    
    print(f"Starting Flask backend server on port {port}")
    app.run(host='0.0.0.0', port=port, debug=debug)
