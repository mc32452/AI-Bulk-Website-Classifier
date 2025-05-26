#!/usr/bin/env python3
"""
Database Management CLI Tool
Simple command-line interface for managing the classification database.
"""

import os
import sys
import argparse
from typing import Dict

# Add the current directory to the path to import our modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from src.database import ClassificationDatabase
except ImportError:
    print("Error: Could not import database module.")
    print("Make sure you're running this from the project root directory.")
    sys.exit(1)

def confirm_action(action: str) -> bool:
    """Ask user to confirm destructive action."""
    print(f"\n⚠️  WARNING: This will {action} ALL data in your database!")
    print("This action cannot be undone.")
    
    while True:
        response = input("\nDo you want to continue? (yes/no): ").lower().strip()
        if response in ['yes', 'y']:
            return True
        elif response in ['no', 'n']:
            return False
        else:
            print("Please enter 'yes' or 'no'")

def show_database_info(db: ClassificationDatabase) -> None:
    """Display current database information."""
    try:
        info = db.get_database_info()
        print("\n📊 Current Database Status:")
        print(f"   • Total results: {info['total_results']:,}")
        print(f"   • Total batches: {info['total_batches']:,}")
        print(f"   • Database size: {info['file_size_mb']:.2f} MB")
        print(f"   • Database file: {db.db_path}")
    except Exception as e:
        print(f"❌ Error getting database info: {e}")

def clear_database(db: ClassificationDatabase, force: bool = False) -> None:
    """Clear all data from database."""
    if not force and not confirm_action("clear"):
        print("❌ Operation cancelled.")
        return
    
    try:
        result = db.clear_all_data()
        if result['success']:
            print(f"✅ {result['message']}")
        else:
            print(f"❌ {result.get('message', 'Failed to clear database')}")
    except Exception as e:
        print(f"❌ Error clearing database: {e}")

def reset_database(db: ClassificationDatabase, force: bool = False) -> None:
    """Reset entire database schema."""
    if not force and not confirm_action("reset (recreate all tables)"):
        print("❌ Operation cancelled.")
        return
    
    try:
        result = db.reset_database()
        if result['success']:
            print(f"✅ {result['message']}")
        else:
            print(f"❌ {result.get('message', 'Failed to reset database')}")
    except Exception as e:
        print(f"❌ Error resetting database: {e}")

def vacuum_database(db: ClassificationDatabase) -> None:
    """Optimize database performance."""
    try:
        print("🔧 Optimizing database...")
        db.vacuum_database()
        print("✅ Database optimized successfully!")
    except Exception as e:
        print(f"❌ Error optimizing database: {e}")

def delete_file(db_path: str, force: bool = False) -> None:
    """Delete the entire database file."""
    if not os.path.exists(db_path):
        print(f"❌ Database file not found: {db_path}")
        return
    
    if not force and not confirm_action("DELETE the entire database file"):
        print("❌ Operation cancelled.")
        return
    
    try:
        os.remove(db_path)
        print(f"✅ Database file deleted: {db_path}")
        print("💡 A new database will be created when you next run the application.")
    except Exception as e:
        print(f"❌ Error deleting database file: {e}")

def main():
    parser = argparse.ArgumentParser(
        description="Manage the bulk website classifier database",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python manage_database.py --info                 # Show database information
  python manage_database.py --clear               # Clear all data (with confirmation)
  python manage_database.py --reset               # Reset database schema
  python manage_database.py --vacuum              # Optimize database
  python manage_database.py --delete-file         # Delete entire database file
  python manage_database.py --clear --force       # Clear without confirmation
        """
    )
    
    parser.add_argument('--info', action='store_true', 
                       help='Show current database information')
    parser.add_argument('--clear', action='store_true', 
                       help='Clear all data from database (keeps schema)')
    parser.add_argument('--reset', action='store_true', 
                       help='Reset database by recreating all tables')
    parser.add_argument('--vacuum', action='store_true', 
                       help='Optimize database performance')
    parser.add_argument('--delete-file', action='store_true', 
                       help='Delete the entire database file')
    parser.add_argument('--force', action='store_true', 
                       help='Skip confirmation prompts (dangerous!)')
    parser.add_argument('--db-path', default='classification_results.db',
                       help='Path to database file (default: classification_results.db)')
    
    args = parser.parse_args()
    
    # Show help if no arguments provided
    if not any([args.info, args.clear, args.reset, args.vacuum, args.delete_file]):
        parser.print_help()
        return
    
    print("🗄️  Database Management Tool")
    print("=" * 40)
    
    # Handle file deletion separately (doesn't need database connection)
    if args.delete_file:
        delete_file(args.db_path, args.force)
        return
    
    # Initialize database connection for other operations
    try:
        db = ClassificationDatabase(args.db_path)
    except Exception as e:
        print(f"❌ Error connecting to database: {e}")
        return
    
    # Execute requested operations
    if args.info:
        show_database_info(db)
    
    if args.vacuum:
        vacuum_database(db)
    
    if args.clear:
        clear_database(db, args.force)
    
    if args.reset:
        reset_database(db, args.force)
    
    print("\n✨ Done!")

if __name__ == "__main__":
    main()
