#!/usr/bin/env python3
"""
Enhanced pipeline with headful browser option for bypassing bot detection.
"""
import logging
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import csv
import os

from src.fetcher_enhanced import fetch_site_enhanced
from src.text_extractor import extract_text
from src.ocr_module import ocr_image
from src.openai_client import classify_site
from src.writer import write_results


def extract_snippet(text_content: str, ocr_content: str, max_length: int = 200) -> str:
    """Extract a meaningful snippet from the text content for display purposes"""
    # Combine both text sources
    combined_text = f"{text_content} {ocr_content}".strip()
    
    if not combined_text:
        return "No content available"
    
    # Clean up the text - remove extra whitespace and newlines
    cleaned_text = ' '.join(combined_text.split())
    
    # If text is shorter than max_length, return as-is
    if len(cleaned_text) <= max_length:
        return cleaned_text
    
    # Try to cut at a word boundary
    snippet = cleaned_text[:max_length]
    last_space = snippet.rfind(' ')
    
    if last_space > max_length * 0.8:  # If we can cut at a word boundary reasonably close to the end
        snippet = snippet[:last_space]
    
    return snippet + "..."


def load_domains(path: str = 'domains.txt'):
    """
    Reads domains from a newline-separated text file.
    """
    with open(path, 'r', encoding='utf-8') as f:
        return [line.strip() for line in f if line.strip()]


def process_domain(domain: str, text_method: str = 'html', headless: bool = True, anti_detection: bool = False) -> dict:
    """
    Processes a single domain: fetch, extract, classify.
    
    Args:
        domain: Domain to process
        text_method: 'html', 'ocr', or 'both'
        headless: If True, uses headless browser. If False, shows browser window.
        anti_detection: If True, applies anti-bot detection measures
        
    Returns:
        Classification dict with snippet and full content included, or None if error occurred.
    """
    try:
        html, screenshot = fetch_site_enhanced(domain, headless=headless, anti_detection=anti_detection)
        
        if text_method == 'html':
            text_content = extract_text(html)
            ocr_content = ""
        elif text_method == 'ocr':
            text_content = ""
            ocr_content = ocr_image(screenshot)
        elif text_method == 'both':
            text_content = extract_text(html)
            ocr_content = ocr_image(screenshot)
        else:
            raise ValueError(f"Invalid text_method: {text_method}")
        
        # Extract snippet for storage
        snippet = extract_snippet(text_content, ocr_content)
            
        result = classify_site(domain, text_content, ocr_content)
        
        # Ensure confidence_level exists
        if "confidence_level" not in result:
            result["confidence_level"] = 0.0
        
        # Add snippet and full content to result
        result["snippet"] = snippet
        result["html_content"] = text_content
        result["ocr_content"] = ocr_content
        result["extraction_method"] = text_method
        result["processing_method"] = f"Enhanced fetcher ({'headless' if headless else 'headful'}{'+ anti-detection' if anti_detection else ''})"
        
        return result
    except Exception as e:
        logging.error(f"❌ Error processing {domain}: {e}")
        # Just return None - errors are logged but not stored
        return None


def main():
    parser = argparse.ArgumentParser(description='Enhanced bulk website classification pipeline with anti-bot detection')
    parser.add_argument('--method', choices=['html', 'ocr', 'both'], default='html',
                       help='Text extraction method (default: html)')
    parser.add_argument('--domains', default='domains.txt',
                       help='Path to domains file (default: domains.txt)')
    parser.add_argument('--output', default='results_enhanced.csv',
                       help='Output CSV file (default: results_enhanced.csv)')
    parser.add_argument('--headful', action='store_true',
                       help='Use headful browser (shows browser window) to bypass bot detection')
    parser.add_argument('--anti-detection', action='store_true',
                       help='Enable anti-bot detection measures (user agent spoofing, etc.)')
    parser.add_argument('--workers', type=int, default=4,
                       help='Number of worker threads (default: 4, reduce for headful mode)')
    parser.add_argument('--overwrite', action='store_true',
                       help='Overwrite existing results in the output file.')
    args = parser.parse_args()
    
    logging.basicConfig(level=logging.INFO)

    processed_domains = set()
    existing_results_data = []

    if not args.overwrite and os.path.exists(args.output):
        try:
            with open(args.output, 'r', newline='', encoding='utf-8') as f_in:
                reader = csv.DictReader(f_in)
                if reader.fieldnames is None or 'domain' not in reader.fieldnames:
                    logging.warning(f"Output file {args.output} does not contain a 'domain' header or is empty. Will process all domains.")
                else:
                    for row in reader:
                        if 'domain' in row and row['domain']:
                            processed_domains.add(row['domain'])
                            existing_results_data.append(row)
            if processed_domains:
                logging.info(f"Found {len(processed_domains)} domains in existing output file '{args.output}'. They will be skipped unless --overwrite is used.")
        except FileNotFoundError:
            logging.info(f"Output file {args.output} not found. Will process all domains.")
        except Exception as e:
            logging.warning(f"Could not read existing output file {args.output}: {e}. Will process all domains.")
            processed_domains.clear()
            existing_results_data.clear()

    # Also check database for existing domains (to prevent duplicates)
    if not args.overwrite:
        try:
            from src.database import ClassificationDatabase
            db = ClassificationDatabase()
            existing_in_db = db.get_results()
            db_domains = {result['domain'] for result in existing_in_db}
            processed_domains.update(db_domains)
            logging.info(f"Found {len(db_domains)} domains already in database. They will be skipped unless --overwrite is used.")
        except Exception as e:
            logging.warning(f"Could not check database for existing domains: {e}. Will process all domains.")
    
    # Adjust settings for headful mode
    headless = not args.headful
    if args.headful:
        # Reduce workers for headful mode to avoid too many browser windows
        args.workers = min(args.workers, 2)
        logging.info("🖥️  Using headful browser mode (browser windows will be visible)")
        if args.workers > 1:
            logging.info(f"👀 Opening {args.workers} browser windows simultaneously")
    
    if args.anti_detection:
        logging.info("🛡️  Anti-bot detection measures enabled")
    
    logging.info(f"📊 Using text extraction method: {args.method}")
    logging.info(f"👥 Using {args.workers} worker threads")
    
    all_input_domains = load_domains(args.domains)
    domains_to_process = []
    
    if args.overwrite:
        domains_to_process = all_input_domains
        existing_results_data.clear() # Clear existing data if overwriting
        logging.info("Overwrite flag set. All domains will be processed.")
    else:
        for domain in all_input_domains:
            if domain not in processed_domains:
                domains_to_process.append(domain)
            else:
                logging.info(f"Skipping already processed domain: {domain}")
    
    if not domains_to_process:
        logging.info("No new domains to process.")
        if existing_results_data: # If there were existing results and nothing new to process
             write_results(existing_results_data, args.output) # Ensure existing data is written back
             print(f'\n🎉 No new domains processed. Existing results saved to {args.output}')
        else:
            # If output file didn't exist or was empty, and no new domains, create an empty CSV with headers
            if not os.path.exists(args.output) or os.path.getsize(args.output) == 0:
                write_results([], args.output) # write_results should handle creating headers for an empty list
            print(f'\n🎉 No domains to process and no existing results found in {args.output}')
        return # Exit if no domains to process

    # Create configuration object for database storage
    config = {
        "method": args.method,
        "headless": not args.headful,
        "anti_detection": args.anti_detection,
        "workers": args.workers,
        "domains_file": args.domains,
        "output_file": args.output
    }

    results = {}
    # Initialize results with indices for all domains_to_process to maintain order later
    for i, domain in enumerate(domains_to_process):
        results[i] = None # Placeholder

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        future_to_domain_index = {
            executor.submit(process_domain, domain, args.method, headless, args.anti_detection): i
            for i, domain in enumerate(domains_to_process)
        }
        
        for future in as_completed(future_to_domain_index):
            original_index = future_to_domain_index[future]
            domain = domains_to_process[original_index]
            try:
                result = future.result()
                if result is not None:  # Successful processing
                    results[original_index] = result
                    logging.info(f"✅ Completed {result['domain']}: {result['classification_label']}")
                else:  # Error occurred (already logged)
                    logging.info(f"❌ Skipped {domain} due to error")

            except Exception as e:
                logging.error(f"❌ Exception processing {domain}: {e}")

    # Filter out None results (errors) - only successful results go to database
    successful_results = [res for res in results.values() if res is not None] 

    final_results_map = {}
    if not args.overwrite:
        for row in existing_results_data:
            final_results_map[row['domain']] = row
    
    for res in successful_results:
        final_results_map[res['domain']] = res

    # Reconstruct final_results based on the order in all_input_domains
    final_ordered_results = []
    for domain_in_input_file in all_input_domains:
        if domain_in_input_file in final_results_map:
            final_ordered_results.append(final_results_map[domain_in_input_file])
    
    # Write results to database and CSV
    batch_id = write_results(final_ordered_results, args.output, config=config)
    
    print(f'\n🎉 Pipeline completed. Results written to {args.output}')
    print(f'📦 Database batch ID: {batch_id}')
    
    # Show summary
    total_attempted = len(domains_to_process)
    successful = len(successful_results)
    errors = total_attempted - successful
    
    print(f"📊 Summary:")
    print(f"   Total domains attempted: {total_attempted}")
    print(f"   Successful: {successful}")
    print(f"   Errors (logged only): {errors}")
    
    if errors > 0:
        print(f"\n❌ {errors} domains failed processing - check logs for details")
    
    print(f"\n📈 Use 'python manage_database.py --info' to see detailed statistics")


if __name__ == '__main__':
    main()
