import csv
from typing import List, Dict


def write_results(results: List[Dict], output_file: str) -> None:
    """
    Writes classification results to a CSV file.
    CSV columns: domain, classification_label, summary
    """
    fieldnames = ['domain', 'classification_label', 'summary']
    with open(output_file, mode='w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        for item in results:
            writer.writerow({
                'domain': item.get('domain', ''),
                'classification_label': item.get('classification_label', ''),
                'summary': item.get('summary', '')
            })
