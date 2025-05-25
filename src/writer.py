import csv
import os
from typing import List, Dict, Optional
from .database import ClassificationDatabase


def write_results(results: List[Dict], output_file: str, batch_id: str = None, config: Dict = None) -> str:
    """
    Writes classification results to both database and CSV file for backward compatibility.
    
    Args:
        results: List of classification result dictionaries
        output_file: CSV output file path (for backward compatibility)
        batch_id: Optional batch identifier
        config: Processing configuration used
    
    Returns:
        batch_id: The batch identifier used
    """
    # Write to database first
    db = ClassificationDatabase()
    used_batch_id = db.insert_results(results, batch_id, config)
    
    # Also write to CSV for backward compatibility
    write_csv_results(results, output_file)
    
    return used_batch_id


def write_csv_results(results: List[Dict], output_file: str) -> None:
    """
    Writes classification results to a CSV file (legacy format).
    CSV columns: domain, classification_label, summary, confidence_level, snippet
    """
    fieldnames = ['domain', 'classification_label', 'summary', 'confidence_level', 'snippet']
    
    # Create directory if it doesn't exist
    os.makedirs(os.path.dirname(output_file), exist_ok=True) if os.path.dirname(output_file) else None
    
    with open(output_file, mode='w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        for item in results:
            writer.writerow({
                'domain': item.get('domain', ''),
                'classification_label': item.get('classification_label', ''),
                'summary': item.get('summary', ''),
                'confidence_level': item.get('confidence_level', 0.0),
                'snippet': item.get('snippet', '')
            })


def write_database_only(results: List[Dict], batch_id: str = None, config: Dict = None) -> str:
    """
    Writes classification results to database only (no CSV).
    
    Args:
        results: List of classification result dictionaries
        batch_id: Optional batch identifier
        config: Processing configuration used
    
    Returns:
        batch_id: The batch identifier used
    """
    db = ClassificationDatabase()
    return db.insert_results(results, batch_id, config)
