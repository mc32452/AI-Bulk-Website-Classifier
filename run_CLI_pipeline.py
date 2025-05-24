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
        Classification dict with snippet included.
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
        
        # Add snippet to result
        result["snippet"] = snippet
        return result
    except Exception as e:
        logging.error(f"Error processing {domain}: {e}")
        return {
            "domain": domain, 
            "classification_label": "Error", 
            "summary": str(e),
            "confidence_level": 0.0,
            "snippet": "Error occurred during processing"
        }


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
    existing_results_data = [] # To store existing data if not overwriting

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
                            existing_results_data.append(row) # Keep existing data
            if processed_domains:
                logging.info(f"Found {len(processed_domains)} domains in existing output file '{args.output}'. They will be skipped unless --overwrite is used.")
        except FileNotFoundError:
            logging.info(f"Output file {args.output} not found. Will process all domains.")
        except Exception as e:
            logging.warning(f"Could not read existing output file {args.output}: {e}. Will process all domains.")
            processed_domains.clear()
            existing_results_data.clear()
    
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
            try:
                result = future.result()
                results[original_index] = result # Store new results at their original index
                if result and result.get("domain") and result.get("classification_label"):
                    logging.info(f"✅ Completed {result['domain']}: {result['classification_label']}")
                else:
                    # This case should ideally be handled by process_domain returning an Error dict
                    logging.error(f"Received incomplete result for a domain at index {original_index}")
                    # Ensure a placeholder error is there if process_domain failed to return one
                    if results[original_index] is None or not results[original_index].get("domain"):
                         results[original_index] = {"domain": domains_to_process[original_index], "classification_label": "Error", "summary": "Processing failed internally"}

            except Exception as e:
                logging.error(f"Error processing domain {domains_to_process[original_index]}: {e}")
                results[original_index] = {"domain": domains_to_process[original_index], "classification_label": "Error", "summary": str(e)}

    # Filter out any None placeholders if some futures failed catastrophically before returning
    ordered_new_results = [res for res in results.values() if res is not None] 

    final_results_map = {}
    if not args.overwrite:
        for row in existing_results_data:
            final_results_map[row['domain']] = row
    
    for res in ordered_new_results:
        final_results_map[res['domain']] = res # New results overwrite existing ones if domains match (though they shouldn't be processed if not overwriting)
                                            # Or add new ones.

    # Reconstruct final_results based on the order in all_input_domains
    final_ordered_results = []
    for domain_in_input_file in all_input_domains:
        if domain_in_input_file in final_results_map:
            final_ordered_results.append(final_results_map[domain_in_input_file])
        
    write_results(final_ordered_results, args.output)
    
    print(f'\n🎉 Pipeline completed. Results written to {args.output}')
    
    # Show summary
    total = len(final_ordered_results)
    errors = len([r for r in final_ordered_results if r['classification_label'] == 'Error'])
    success = total - errors
    
    print(f"📊 Summary:")
    print(f"   Total domains: {total}")
    print(f"   Successful: {success}")
    print(f"   Errors: {errors}")
    
    if errors > 0:
        print(f"\n❌ Domains with errors:")
        for result in final_ordered_results:
            if result['classification_label'] == 'Error':
                print(f"   - {result['domain']}: {result['summary']}")


if __name__ == '__main__':
    main()
