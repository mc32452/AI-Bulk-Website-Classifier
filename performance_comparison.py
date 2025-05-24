#!/usr/bin/env python3
"""
Performance comparison script: CSV vs SQLite
Tests various operations to demonstrate the performance benefits of SQLite.
"""

import time
import csv
import pandas as pd
import os
import sys
import random
from datetime import datetime

# Add the current directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.database import ClassificationDatabase

def generate_test_data(num_records=1000):
    """Generate test data for performance comparison."""
    domains = [
        "example.com", "google.com", "github.com", "stackoverflow.com", 
        "microsoft.com", "apple.com", "amazon.com", "facebook.com",
        "linkedin.com", "twitter.com", "instagram.com", "youtube.com",
        "portal.company.com", "intranet.corp.com", "dashboard.app.com"
    ]
    
    labels = ["Marketing", "Portal", "Other"]
    methods = ["HTML", "OCR"]
    
    results = []
    for i in range(num_records):
        base_domain = random.choice(domains)
        subdomain = random.choice(["www", "app", "api", "portal", "admin", "dashboard"])
        domain = f"{subdomain}.{base_domain}" if random.random() > 0.5 else base_domain
        
        results.append({
            "domain": domain,
            "classification_label": random.choice(labels),
            "summary": f"Mock summary for {domain} - " + " ".join([f"word{j}" for j in range(20)]),
            "confidence_level": round(random.uniform(0.6, 0.95), 2),
            "snippet": f"Mock snippet for {domain} - " + " ".join([f"snippet{j}" for j in range(30)]),
            "processing_method": random.choice(methods),
            "processed_at": datetime.now().isoformat()
        })
    
    return results

def test_csv_performance(data, filename="test_performance.csv"):
    """Test CSV operations performance."""
    print(f"Testing CSV performance with {len(data)} records...")
    
    # Write performance
    start_time = time.time()
    with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = ['domain', 'classification_label', 'summary', 'confidence_level', 'snippet', 'processing_method', 'processed_at']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        for record in data:
            writer.writerow(record)
    write_time = time.time() - start_time
    
    # Read all records
    start_time = time.time()
    df = pd.read_csv(filename)
    read_time = time.time() - start_time
    
    # Search by domain
    start_time = time.time()
    filtered_df = df[df['domain'].str.contains('github', na=False)]
    search_time = time.time() - start_time
    
    # Filter by label
    start_time = time.time()
    portal_df = df[df['classification_label'] == 'Portal']
    filter_time = time.time() - start_time
    
    # Calculate statistics
    start_time = time.time()
    stats = df['classification_label'].value_counts().to_dict()
    stats_time = time.time() - start_time
    
    # Export filtered results
    start_time = time.time()
    portal_df.to_csv('filtered_export.csv', index=False)
    export_time = time.time() - start_time
    
    file_size = os.path.getsize(filename)
    
    return {
        "write_time": write_time,
        "read_time": read_time,
        "search_time": search_time,
        "filter_time": filter_time,
        "stats_time": stats_time,
        "export_time": export_time,
        "file_size": file_size
    }

def test_sqlite_performance(data):
    """Test SQLite operations performance."""
    print(f"Testing SQLite performance with {len(data)} records...")
    
    db = ClassificationDatabase("test_performance.db")
    
    # Write performance
    start_time = time.time()
    batch_id = db.insert_results(data, "performance_test")
    write_time = time.time() - start_time
    
    # Read all records
    start_time = time.time()
    all_results = db.get_results()
    read_time = time.time() - start_time
    
    # Search by domain
    start_time = time.time()
    search_results = db.get_results(domain_filter="github")
    search_time = time.time() - start_time
    
    # Filter by label
    start_time = time.time()
    portal_results = db.get_results(label_filter="Portal")
    filter_time = time.time() - start_time
    
    # Calculate statistics
    start_time = time.time()
    stats = db.get_statistics()
    stats_time = time.time() - start_time
    
    # Export filtered results
    start_time = time.time()
    db.export_to_csv("sqlite_filtered_export.csv", label_filter="Portal")
    export_time = time.time() - start_time
    
    db_info = db.get_database_info()
    file_size = db_info["file_size_bytes"]
    
    return {
        "write_time": write_time,
        "read_time": read_time,
        "search_time": search_time,
        "filter_time": filter_time,
        "stats_time": stats_time,
        "export_time": export_time,
        "file_size": file_size
    }

def format_time(seconds):
    """Format time in milliseconds."""
    return f"{seconds * 1000:.1f}ms"

def format_size(bytes_size):
    """Format file size in KB/MB."""
    if bytes_size < 1024:
        return f"{bytes_size}B"
    elif bytes_size < 1024 * 1024:
        return f"{bytes_size / 1024:.1f}KB"
    else:
        return f"{bytes_size / (1024 * 1024):.1f}MB"

def run_performance_comparison():
    """Run comprehensive performance comparison."""
    print("=== Website Classification Storage Performance Comparison ===\n")
    
    # Test with different dataset sizes
    sizes = [100, 1000, 5000]
    
    for size in sizes:
        print(f"Testing with {size} records...")
        data = generate_test_data(size)
        
        csv_results = test_csv_performance(data, f"test_csv_{size}.csv")
        sqlite_results = test_sqlite_performance(data)
        
        print(f"\n--- Results for {size} records ---")
        print(f"{'Operation':<20} {'CSV':<15} {'SQLite':<15} {'Improvement':<15}")
        print("-" * 65)
        
        operations = [
            ("Write", "write_time"),
            ("Read All", "read_time"),
            ("Domain Search", "search_time"),
            ("Label Filter", "filter_time"),
            ("Statistics", "stats_time"),
            ("Export Filtered", "export_time")
        ]
        
        for op_name, op_key in operations:
            csv_time = csv_results[op_key]
            sqlite_time = sqlite_results[op_key]
            improvement = csv_time / sqlite_time if sqlite_time > 0 else float('inf')
            
            print(f"{op_name:<20} {format_time(csv_time):<15} {format_time(sqlite_time):<15} {improvement:.1f}x faster")
        
        print(f"{'File Size':<20} {format_size(csv_results['file_size']):<15} {format_size(sqlite_results['file_size']):<15} {csv_results['file_size'] / sqlite_results['file_size']:.1f}x smaller")
        print()
        
        # Cleanup
        for file in [f"test_csv_{size}.csv", "test_performance.db", "filtered_export.csv", "sqlite_filtered_export.csv"]:
            if os.path.exists(file):
                os.remove(file)

if __name__ == "__main__":
    run_performance_comparison()
