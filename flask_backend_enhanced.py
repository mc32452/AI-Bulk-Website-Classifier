#!/usr/bin/env python3
"""
Enhanced Flask backend service with SQLite database integration.
This service integrates with the existing Python pipeline and provides
efficient data storage and retrieval.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import os
import tempfile
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
import logging
from datetime import datetime

# Add the current directory to the path to import our modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from run_CLI_pipeline import process_domain
except ImportError:
    print("Warning: Could not import run_CLI_pipeline. Using mock processing.")
    process_domain = None

# Import database module
try:
    from src.database import ClassificationDatabase
except ImportError:
    print("Warning: Could not import database module. Using fallback.")
    ClassificationDatabase = None

app = Flask(__name__)
CORS(app)

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize database
if ClassificationDatabase:
    db = ClassificationDatabase()
else:
    db = None

def format_scan_duration(duration_seconds):
    """Format scan duration in a human-readable format."""
    total_seconds = int(duration_seconds)
    minutes = total_seconds // 60
    seconds = total_seconds % 60
    
    if minutes == 0:
        return f"{seconds} second{'s' if seconds != 1 else ''}"
    else:
        return f"{minutes} minute{'s' if minutes != 1 else ''} {seconds} second{'s' if seconds != 1 else ''}"

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint with AI provider information."""
    status = {"status": "healthy", "timestamp": datetime.now().isoformat()}
    
    # Database status
    if db:
        try:
            db_info = db.get_database_info()
            status["database"] = {
                "connected": True,
                "total_results": db_info["total_results"],
                "total_batches": db_info["total_batches"],
                "file_size_mb": db_info["file_size_mb"]
            }
        except Exception as e:
            status["database"] = {"connected": False, "error": str(e)}
    else:
        status["database"] = {"connected": False, "error": "Database module not available"}
    
    # AI provider status
    try:
        from src.openai_client import get_ai_provider_info, test_ai_connection
        ai_test = test_ai_connection()
        status["ai_provider"] = ai_test
    except Exception as e:
        status["ai_provider"] = {
            "success": False,
            "error": str(e),
            "message": "Failed to load AI provider configuration"
        }
    
    return jsonify(status)

@app.route('/classify', methods=['POST'])
def classify_domains():
    """
    Classify a list of domains and store results in database.
    
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
        start_time = time.time()  # Start timing
        
        data = request.get_json()
        
        if not data or 'domains' not in data:
            return jsonify({"error": "No domains provided"}), 400
        
        domains = data['domains']
        config = data.get('config', {})
        
        if not domains:
            return jsonify({"error": "Empty domains list"}), 400
        
        # Extract configuration
        text_method = config.get('method', 'HTML').lower()
        headless = config.get('headless', True)
        anti_detection = config.get('antiDetection', False)
        workers = config.get('workers', 4)
        overwrite = config.get('overwrite', False)
        
        logger.info(f"Processing {len(domains)} domains with config: {config}")
        
        # Check database for existing results to avoid duplicates
        domains_to_process = []
        existing_results = []
        
        if db and not overwrite:
            # Check which domains already exist in the database
            for domain in domains:
                existing = db.get_results(domain_filter=domain, limit=1)
                if existing:
                    logger.info(f"Skipping already processed domain: {domain}")
                    existing_results.extend(existing)
                else:
                    domains_to_process.append(domain)
        else:
            # Process all domains if overwrite is enabled or no database
            domains_to_process = domains
        
        if not domains_to_process:
            logger.info("No new domains to process - all domains already exist in database")
            end_time = time.time()
            duration = end_time - start_time
            duration_text = format_scan_duration(duration)
            return jsonify({
                "results": existing_results,
                "batch_id": None,
                "total_processed": 0,
                "skipped": len(domains),
                "duration_seconds": duration,
                "duration_text": duration_text,
                "message": f"Scan complete in {duration_text}! All domains already processed. Use overwrite option to reprocess."
            })
        
        logger.info(f"Processing {len(domains_to_process)} new domains (skipping {len(domains) - len(domains_to_process)} existing)")
        
        # Generate batch ID
        batch_id = f"batch_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}"
        
        # Process domains
        if process_domain is None:
            # Use mock processing if the main pipeline is not available
            results = []
            for i, domain in enumerate(domains_to_process):
                results.append({
                    "domain": domain,
                    "classification_label": ["Marketing", "Portal", "Other"][i % 3],
                    "summary": f"Mock summary for {domain}",
                    "confidence_level": 0.70 + (i % 30) / 100,  # Vary confidence
                    "snippet": f"Mock snippet for {domain}...",
                    "processing_method": text_method
                })
        else:
            # Use real processing
            results = []
            with ThreadPoolExecutor(max_workers=workers) as executor:
                future_to_domain = {
                    executor.submit(process_domain, domain, text_method, headless, anti_detection): domain
                    for domain in domains_to_process
                }
                
                for future in as_completed(future_to_domain):
                    domain = future_to_domain[future]
                    try:
                        result = future.result()
                        if result:
                            result["processing_method"] = text_method
                            results.append(result)
                    except Exception as e:
                        logger.error(f"Error processing {domain}: {e}")
                        results.append({
                            "domain": domain,
                            "classification_label": "Error",
                            "summary": str(e),
                            "confidence_level": 0.0,
                            "snippet": "Error occurred during processing",
                            "processing_method": text_method
                        })
        
        # Store results in database
        if db and results:
            try:
                stored_batch_id = db.insert_results(results, batch_id, config)
                logger.info(f"Stored {len(results)} results in database with batch_id: {stored_batch_id}")
            except Exception as e:
                logger.error(f"Error storing results in database: {e}")
                # Continue without database storage
        
        # Combine results with existing results
        all_results = existing_results + results
        
        # Calculate duration
        end_time = time.time()
        duration = end_time - start_time
        duration_text = format_scan_duration(duration)
        
        logger.info(f"Successfully processed {len(results)} new domains, total results: {len(all_results)}, duration: {duration_text}")
        
        # Create message with duration
        if len(results) > 0 and len(domains) - len(domains_to_process) > 0:
            message = f"Scan complete in {duration_text}! Processed {len(results)} new domains, skipped {len(domains) - len(domains_to_process)} existing domains"
        elif len(results) > 0:
            message = f"Scan complete in {duration_text}! Processed {len(results)} new domains"
        else:
            message = f"Scan complete in {duration_text}! {len(domains) - len(domains_to_process)} domains already in database"
        
        return jsonify({
            "results": all_results,
            "batch_id": batch_id if results else None,
            "total_processed": len(results),
            "skipped": len(domains) - len(domains_to_process),
            "duration_seconds": duration,
            "duration_text": duration_text,
            "message": message
        })
        
    except Exception as e:
        logger.error(f"API Error: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/results', methods=['GET'])
def get_results():
    """
    Get stored classification results with filtering and pagination.
    
    Query parameters:
    - limit: Maximum results to return
    - offset: Results to skip (for pagination)
    - domain: Filter by domain (supports partial matching)
    - label: Filter by classification label
    - batch_id: Filter by batch ID
    - min_confidence: Minimum confidence level
    """
    if not db:
        return jsonify({"error": "Database not available"}), 503
    
    try:
        # Parse query parameters
        limit = request.args.get('limit', type=int)
        offset = request.args.get('offset', 0, type=int)
        domain_filter = request.args.get('domain')
        label_filter = request.args.get('label')
        batch_id = request.args.get('batch_id')
        min_confidence = request.args.get('min_confidence', type=float)
        
        # Get results
        results = db.get_results(
            limit=limit,
            offset=offset,
            domain_filter=domain_filter,
            label_filter=label_filter,
            batch_id=batch_id,
            min_confidence=min_confidence
        )
        
        # Get total count for pagination
        total_results = db.get_results(
            domain_filter=domain_filter,
            label_filter=label_filter,
            batch_id=batch_id,
            min_confidence=min_confidence
        )
        
        return jsonify({
            "results": results,
            "pagination": {
                "total": len(total_results),
                "limit": limit,
                "offset": offset,
                "has_more": limit and len(total_results) > offset + limit
            }
        })
        
    except Exception as e:
        logger.error(f"Error retrieving results: {e}")
        return jsonify({"error": "Failed to retrieve results"}), 500

@app.route('/statistics', methods=['GET'])
def get_statistics():
    """Get classification statistics."""
    if not db:
        return jsonify({"error": "Database not available"}), 503
    
    try:
        batch_id = request.args.get('batch_id')
        stats = db.get_statistics(batch_id)
        
        # Add database info
        db_info = db.get_database_info()
        
        return jsonify({
            "statistics": stats,
            "database_info": db_info
        })
        
    except Exception as e:
        logger.error(f"Error getting statistics: {e}")
        return jsonify({"error": "Failed to get statistics"}), 500

@app.route('/batches', methods=['GET'])
def get_batches():
    """Get list of processing batches."""
    if not db:
        return jsonify({"error": "Database not available"}), 503
    
    try:
        batches = db.get_batches()
        return jsonify({"batches": batches})
        
    except Exception as e:
        logger.error(f"Error getting batches: {e}")
        return jsonify({"error": "Failed to get batches"}), 500

@app.route('/export/csv', methods=['POST'])
def export_csv():
    """
    Export results to CSV file.
    
    JSON payload:
    {
        "filename": "export.csv",
        "filters": {
            "domain": "example.com",
            "label": "Marketing",
            "batch_id": "batch_123"
        }
    }
    """
    if not db:
        return jsonify({"error": "Database not available"}), 503
    
    try:
        data = request.get_json() or {}
        filename = data.get('filename', f'export_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv')
        filters = data.get('filters', {})
        
        # Ensure filename ends with .csv
        if not filename.endswith('.csv'):
            filename += '.csv'
        
        # Export to CSV
        csv_path = db.export_to_csv(
            filename,
            domain_filter=filters.get('domain'),
            label_filter=filters.get('label'),
            batch_id=filters.get('batch_id')
        )
        
        # Get file size
        file_size = os.path.getsize(csv_path) if os.path.exists(csv_path) else 0
        
        return jsonify({
            "success": True,
            "filename": filename,
            "file_path": csv_path,
            "file_size_bytes": file_size
        })
        
    except Exception as e:
        logger.error(f"Error exporting CSV: {e}")
        return jsonify({"error": "Failed to export CSV"}), 500

@app.route('/batch/<batch_id>', methods=['DELETE'])
def delete_batch(batch_id: str):
    """Delete a batch and all its results."""
    if not db:
        return jsonify({"error": "Database not available"}), 503
    
    try:
        deleted_count = db.delete_batch(batch_id)
        return jsonify({
            "success": True,
            "batch_id": batch_id,
            "deleted_results": deleted_count
        })
        
    except Exception as e:
        logger.error(f"Error deleting batch {batch_id}: {e}")
        return jsonify({"error": "Failed to delete batch"}), 500

@app.route('/export-database', methods=['GET'])
def export_database():
    """Export all database records."""
    if not db:
        return jsonify({"error": "Database not available"}), 503
    
    try:
        results = db.get_all_results()
        
        # Convert results to the expected format
        formatted_results = []
        for result in results:
            formatted_results.append({
                'domain': result[1],  # domain
                'classification_label': result[2],  # classification_label
                'summary': result[3],  # summary
                'confidence_level': result[4],  # confidence_level
                'snippet': result[5],  # snippet
                'created_at': result[7]  # created_at
            })
        
        return jsonify({
            "success": True,
            "results": formatted_results,
            "total": len(formatted_results)
        })
        
    except Exception as e:
        logger.error(f"Error exporting database: {e}")
        return jsonify({"error": "Failed to export database"}), 500

@app.route('/database/vacuum', methods=['POST'])
def vacuum_database():
    """Optimize database performance."""
    if not db:
        return jsonify({"error": "Database not available"}), 503
    
    try:
        db.vacuum_database()
        return jsonify({"success": True, "message": "Database optimized"})
        
    except Exception as e:
        logger.error(f"Error vacuuming database: {e}")
        return jsonify({"error": "Failed to optimize database"}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))  # Default to 5001
    debug = os.environ.get('DEBUG', 'false').lower() == 'true'
    
    print(f"Starting Enhanced Flask backend server on port {port}")
    if db:
        print(f"Database initialized: {db.db_path}")
        db_info = db.get_database_info()
        print(f"Database contains {db_info['total_results']} results in {db_info['total_batches']} batches")
    else:
        print("Warning: Database not available - using basic functionality only")
    
    app.run(host='0.0.0.0', port=port, debug=debug)
