#!/usr/bin/env python3
"""
SQLite database manager for website classification results.
Provides efficient storage, querying, and export capabilities.
"""

import sqlite3
import json
import csv
import os
from typing import List, Dict, Optional, Tuple
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class ClassificationDatabase:
    """Database manager for website classification results."""
    
    def __init__(self, db_path: str = "classification_results.db"):
        """Initialize database connection and create tables if needed."""
        self.db_path = db_path
        self.init_database()
    
    def init_database(self) -> None:
        """Initialize database schema."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS classification_results (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    domain TEXT NOT NULL,
                    classification_label TEXT NOT NULL,
                    summary TEXT,
                    confidence_level REAL,
                    snippet TEXT,
                    html_content TEXT,
                    ocr_content TEXT,
                    extraction_method TEXT,
                    processing_method TEXT,
                    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    batch_id TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Create indexes for better query performance
            conn.execute("CREATE INDEX IF NOT EXISTS idx_domain ON classification_results(domain)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_label ON classification_results(classification_label)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_batch ON classification_results(batch_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_processed_at ON classification_results(processed_at)")
            
            # Create table for batch metadata
            conn.execute("""
                CREATE TABLE IF NOT EXISTS batch_metadata (
                    batch_id TEXT PRIMARY KEY,
                    total_domains INTEGER,
                    config TEXT,
                    started_at TIMESTAMP,
                    completed_at TIMESTAMP,
                    status TEXT DEFAULT 'processing'
                )
            """)
            
            conn.commit()
    
    def insert_results(self, results: List[Dict], batch_id: str = None, config: Dict = None) -> str:
        """
        Insert classification results into database.
        
        Args:
            results: List of classification result dictionaries
            batch_id: Optional batch identifier
            config: Processing configuration used
            
        Returns:
            batch_id: The batch identifier used
        """
        if batch_id is None:
            batch_id = f"batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        with sqlite3.connect(self.db_path) as conn:
            # Insert batch metadata
            if config:
                conn.execute("""
                    INSERT OR REPLACE INTO batch_metadata 
                    (batch_id, total_domains, config, started_at, status)
                    VALUES (?, ?, ?, ?, ?)
                """, (batch_id, len(results), json.dumps(config), datetime.now(), 'processing'))
            
            # Insert results
            for result in results:
                conn.execute("""
                    INSERT INTO classification_results 
                    (domain, classification_label, summary, confidence_level, snippet, 
                     html_content, ocr_content, extraction_method, processing_method, batch_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    result.get('domain', ''),
                    result.get('classification_label', ''),
                    result.get('summary', ''),
                    result.get('confidence_level', 0.0),
                    result.get('snippet', ''),
                    result.get('html_content', ''),
                    result.get('ocr_content', ''),
                    result.get('extraction_method', ''),
                    result.get('processing_method', ''),
                    batch_id
                ))
            
            # Update batch status
            if config:
                conn.execute("""
                    UPDATE batch_metadata 
                    SET completed_at = ?, status = 'completed'
                    WHERE batch_id = ?
                """, (datetime.now(), batch_id))
            
            conn.commit()
        
        logger.info(f"Inserted {len(results)} results with batch_id: {batch_id}")
        return batch_id
    
    def get_results(self, 
                   limit: int = None,
                   offset: int = 0,
                   domain_filter: str = None,
                   label_filter: str = None,
                   batch_id: str = None,
                   min_confidence: float = None,
                   order_by: str = "processed_at DESC") -> List[Dict]:
        """
        Query classification results with filtering and pagination.
        
        Args:
            limit: Maximum number of results to return
            offset: Number of results to skip
            domain_filter: Filter by domain (supports LIKE patterns)
            label_filter: Filter by classification label
            batch_id: Filter by batch ID
            min_confidence: Minimum confidence level
            order_by: SQL ORDER BY clause
            
        Returns:
            List of result dictionaries
        """
        query = "SELECT * FROM classification_results WHERE 1=1"
        params = []
        
        if domain_filter:
            query += " AND domain LIKE ?"
            params.append(f"%{domain_filter}%")
        
        if label_filter:
            query += " AND classification_label = ?"
            params.append(label_filter)
        
        if batch_id:
            query += " AND batch_id = ?"
            params.append(batch_id)
        
        if min_confidence is not None:
            query += " AND confidence_level >= ?"
            params.append(min_confidence)
        
        query += f" ORDER BY {order_by}"
        
        if limit:
            query += " LIMIT ?"
            params.append(limit)
            if offset:
                query += " OFFSET ?"
                params.append(offset)
        
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(query, params)
            results = [dict(row) for row in cursor.fetchall()]
        
        return results
    
    def get_statistics(self, batch_id: str = None) -> Dict:
        """
        Get classification statistics.
        
        Args:
            batch_id: Optional batch to filter by
            
        Returns:
            Dictionary with statistics
        """
        query = "SELECT classification_label, COUNT(*) as count FROM classification_results"
        params = []
        
        if batch_id:
            query += " WHERE batch_id = ?"
            params.append(batch_id)
        
        query += " GROUP BY classification_label"
        
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(query, params)
            label_counts = dict(cursor.fetchall())
        
        # Get total count
        total_query = "SELECT COUNT(*) FROM classification_results"
        if batch_id:
            total_query += " WHERE batch_id = ?"
        
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(total_query, params[:1] if batch_id else [])
            total_count = cursor.fetchone()[0]
        
        return {
            "total": total_count,
            "by_label": label_counts
        }
    
    def export_to_csv(self, 
                     filename: str,
                     domain_filter: str = None,
                     label_filter: str = None,
                     batch_id: str = None) -> str:
        """
        Export results to CSV file.
        
        Args:
            filename: Output CSV filename
            domain_filter: Filter by domain
            label_filter: Filter by classification label
            batch_id: Filter by batch ID
            
        Returns:
            Path to created CSV file
        """
        results = self.get_results(
            domain_filter=domain_filter,
            label_filter=label_filter,
            batch_id=batch_id
        )
        
        with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
            if results:
                fieldnames = ['domain', 'classification_label', 'summary', 
                            'confidence_level', 'snippet', 'html_content', 'ocr_content',
                            'extraction_method', 'processed_at']
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                writer.writeheader()
                
                for result in results:
                    writer.writerow({
                        'domain': result.get('domain', ''),
                        'classification_label': result.get('classification_label', ''),
                        'summary': result.get('summary', ''),
                        'confidence_level': result.get('confidence_level', 0.0),
                        'snippet': result.get('snippet', ''),
                        'html_content': result.get('html_content', ''),
                        'ocr_content': result.get('ocr_content', ''),
                        'extraction_method': result.get('extraction_method', ''),
                        'processed_at': result.get('processed_at', '')
                    })
        
        logger.info(f"Exported {len(results)} results to {filename}")
        return filename
    
    def get_batches(self) -> List[Dict]:
        """Get list of all processing batches."""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute("""
                SELECT b.*, COUNT(r.id) as result_count
                FROM batch_metadata b
                LEFT JOIN classification_results r ON b.batch_id = r.batch_id
                GROUP BY b.batch_id
                ORDER BY b.started_at DESC
            """)
            return [dict(row) for row in cursor.fetchall()]
    
    def delete_batch(self, batch_id: str) -> int:
        """
        Delete a batch and all its results.
        
        Args:
            batch_id: Batch identifier to delete
            
        Returns:
            Number of deleted results
        """
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "DELETE FROM classification_results WHERE batch_id = ?", 
                (batch_id,)
            )
            deleted_count = cursor.rowcount
            
            conn.execute(
                "DELETE FROM batch_metadata WHERE batch_id = ?", 
                (batch_id,)
            )
            
            conn.commit()
        
        logger.info(f"Deleted batch {batch_id} with {deleted_count} results")
        return deleted_count
    
    def vacuum_database(self) -> None:
        """Optimize database by reclaiming space and rebuilding indexes."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("VACUUM")
            conn.commit()
        
        logger.info("Database vacuum completed")
    
    def get_all_results(self) -> List[Tuple]:
        """Get all results from the database for export purposes."""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("""
                SELECT id, domain, classification_label, summary, confidence_level, 
                       snippet, html_content, created_at
                FROM classification_results 
                ORDER BY created_at DESC
            """)
            return cursor.fetchall()
    
    def get_database_info(self) -> Dict:
        """Get database information and statistics."""
        with sqlite3.connect(self.db_path) as conn:
            # Get table info
            cursor = conn.execute(
                "SELECT COUNT(*) FROM classification_results"
            )
            total_results = cursor.fetchone()[0]
            
            cursor = conn.execute(
                "SELECT COUNT(*) FROM batch_metadata"
            )
            total_batches = cursor.fetchone()[0]
            
            # Get database file size
            file_size = os.path.getsize(self.db_path) if os.path.exists(self.db_path) else 0
            
            return {
                "database_path": self.db_path,
                "file_size_bytes": file_size,
                "file_size_mb": round(file_size / (1024 * 1024), 2),
                "total_results": total_results,
                "total_batches": total_batches
            }
    
    def clear_all_data(self) -> Dict:
        """
        Clear all data from the database (classification results and batch metadata).
        This is a destructive operation that cannot be undone.
        
        Returns:
            Dictionary with deletion counts and status
        """
        results_deleted = 0
        batches_deleted = 0
        
        with sqlite3.connect(self.db_path) as conn:
            # Count before deletion
            cursor = conn.execute("SELECT COUNT(*) FROM classification_results")
            results_deleted = cursor.fetchone()[0]
            
            cursor = conn.execute("SELECT COUNT(*) FROM batch_metadata")
            batches_deleted = cursor.fetchone()[0]
            
            # Delete all data
            conn.execute("DELETE FROM classification_results")
            conn.execute("DELETE FROM batch_metadata")
            
            # Reset auto-increment counters
            conn.execute("DELETE FROM sqlite_sequence WHERE name IN ('classification_results', 'batch_metadata')")
            
            conn.commit()
        
        logger.info(f"Cleared all database data - {results_deleted} results and {batches_deleted} batches deleted")
        
        return {
            "success": True,
            "results_deleted": results_deleted,
            "batches_deleted": batches_deleted,
            "message": f"Successfully cleared all data - {results_deleted} results and {batches_deleted} batches deleted"
        }

    def reset_database(self) -> Dict:
        """
        Reset the entire database by dropping and recreating all tables.
        This is the most thorough reset option.
        
        Returns:
            Dictionary with reset status
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                # Drop all tables
                conn.execute("DROP TABLE IF EXISTS classification_results")
                conn.execute("DROP TABLE IF EXISTS batch_metadata")
                conn.execute("DELETE FROM sqlite_sequence")
                conn.commit()
            
            # Recreate database schema
            self.init_database()
            
            logger.info("Database completely reset - all tables recreated")
            
            return {
                "success": True,
                "message": "Database completely reset - all tables recreated with fresh schema"
            }
        except Exception as e:
            logger.error(f"Error resetting database: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": f"Failed to reset database: {str(e)}"
            }

# Convenience functions for backward compatibility
def write_results(results: List[Dict], output_file: str = None, batch_id: str = None) -> str:
    """
    Write results to database (replaces CSV writer).
    
    Args:
        results: List of classification results
        output_file: Ignored (for compatibility)
        batch_id: Optional batch identifier
        
    Returns:
        batch_id used for the insert
    """
    db = ClassificationDatabase()
    return db.insert_results(results, batch_id)


def export_results_to_csv(filename: str, **filters) -> str:
    """Export database results to CSV file."""
    db = ClassificationDatabase()
    return db.export_to_csv(filename, **filters)


if __name__ == "__main__":
    # Example usage and testing
    db = ClassificationDatabase()
    
    # Test data
    test_results = [
        {
            "domain": "example.com",
            "classification_label": "Marketing",
            "summary": "Marketing website for products",
            "confidence_level": 0.85,
            "snippet": "Welcome to our products...",
            "html_content": "Welcome to our products page. We offer a wide range of high-quality items for your business needs. Our team is dedicated to providing excellent customer service and competitive pricing.",
            "ocr_content": "",
            "extraction_method": "html",
            "processing_method": "HTML"
        },
        {
            "domain": "portal.company.com",
            "classification_label": "Portal",
            "summary": "Employee portal system",
            "confidence_level": 0.92,
            "snippet": "Login to access your account...",
            "html_content": "Login to access your employee account. Please enter your credentials below. If you need assistance, contact IT support.",
            "ocr_content": "EMPLOYEE PORTAL\nLogin\nUsername: [____]\nPassword: [____]\n[Login Button]",
            "extraction_method": "both",
            "processing_method": "HTML"
        }
    ]
    
    # Insert test data
    batch_id = db.insert_results(test_results, config={"method": "HTML"})
    print(f"Inserted test data with batch_id: {batch_id}")
    
    # Query results
    results = db.get_results(limit=10)
    print(f"Retrieved {len(results)} results")
    
    # Get statistics
    stats = db.get_statistics()
    print(f"Statistics: {stats}")
    
    # Export to CSV
    csv_file = db.export_to_csv("test_export.csv")
    print(f"Exported to: {csv_file}")
    
    # Database info
    info = db.get_database_info()
    print(f"Database info: {info}")
