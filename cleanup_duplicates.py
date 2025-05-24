#!/usr/bin/env python3
"""
Script to clean up duplicate domain entries in the classification database.
Keeps only the most recent entry for each domain.
"""

import sqlite3
from datetime import datetime

def cleanup_duplicates(db_path: str = "classification_results.db"):
    """Remove duplicate domain entries, keeping only the most recent one for each domain."""
    
    print("🧹 Starting database duplicate cleanup...")
    
    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()
        
        # First, let's see what we're working with
        cursor.execute("SELECT COUNT(*) FROM classification_results")
        total_before = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(DISTINCT domain) FROM classification_results")
        unique_domains = cursor.fetchone()[0]
        
        duplicates_before = total_before - unique_domains
        
        print(f"📊 Before cleanup:")
        print(f"   Total entries: {total_before}")
        print(f"   Unique domains: {unique_domains}")
        print(f"   Duplicate entries: {duplicates_before}")
        
        if duplicates_before == 0:
            print("✅ No duplicates found - database is already clean!")
            return
        
        # Find duplicates with details
        cursor.execute("""
            SELECT domain, COUNT(*) as count 
            FROM classification_results 
            GROUP BY domain 
            HAVING COUNT(*) > 1 
            ORDER BY count DESC
        """)
        
        duplicate_domains = cursor.fetchall()
        print(f"\n🔍 Found duplicates for {len(duplicate_domains)} domains:")
        for domain, count in duplicate_domains:
            print(f"   {domain}: {count} entries")
        
        # Remove duplicates - keep only the most recent entry for each domain
        # This query deletes all but the newest entry (highest id/latest created_at) for each domain
        cursor.execute("""
            DELETE FROM classification_results 
            WHERE id NOT IN (
                SELECT MAX(id) 
                FROM classification_results 
                GROUP BY domain
            )
        """)
        
        deleted_count = cursor.rowcount
        conn.commit()
        
        # Verify cleanup
        cursor.execute("SELECT COUNT(*) FROM classification_results")
        total_after = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(DISTINCT domain) FROM classification_results")
        unique_after = cursor.fetchone()[0]
        
        print(f"\n✅ Cleanup completed!")
        print(f"📊 After cleanup:")
        print(f"   Total entries: {total_after}")
        print(f"   Unique domains: {unique_after}")
        print(f"   Entries removed: {deleted_count}")
        print(f"   Duplicates remaining: {total_after - unique_after}")
        
        if total_after == unique_after:
            print("🎉 All duplicates successfully removed!")
        else:
            print("⚠️  Some duplicates may still remain")
        
        # Show final state of previously duplicated domains
        print(f"\n📋 Final state of cleaned domains:")
        for domain, _ in duplicate_domains:
            cursor.execute("""
                SELECT created_at, batch_id, classification_label, confidence_level 
                FROM classification_results 
                WHERE domain = ?
            """, (domain,))
            
            result = cursor.fetchone()
            if result:
                created_at, batch_id, label, confidence = result
                print(f"   {domain}: {created_at} | {label} | {confidence:.2f}")

if __name__ == "__main__":
    cleanup_duplicates()
