#!/usr/bin/env python3
"""
Streamlit UI for the bulk website classification pipeline.
Provides a web interface with all the command line options from run_CLI_pipeline.py
"""
import streamlit as st
import pandas as pd
import os
import csv
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
import logging
import io

# Import our pipeline modules
from src.fetcher_enhanced import fetch_site_enhanced
from src.text_extractor import extract_text
from src.ocr_module import ocr_image
from src.openai_client import classify_site
from src.writer import write_results

# Configure logging to capture in memory
log_stream = io.StringIO()
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(log_stream)]
)

def load_domains_from_text(text_content: str):
    """Parse domains from text content (one per line)"""
    return [line.strip() for line in text_content.strip().split('\n') if line.strip()]

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

def process_domain(domain: str, text_method: str = 'html', headless: bool = True, anti_detection: bool = False) -> dict:
    """
    Processes a single domain: fetch, extract, classify.
    Same as the function in run_CLI_pipeline.py
    """
    try:
        html, screenshot = fetch_site_enhanced(domain, headless=headless, anti_detection=anti_detection)
        
        if text_method == 'HTML':
            text_content = extract_text(html)
            ocr_content = ""
        elif text_method == 'OCR':
            text_content = ""
            ocr_content = ocr_image(screenshot)
        else:
            raise ValueError(f"Invalid text_method: {text_method}")
        
        # Extract snippet for display
        snippet = extract_snippet(text_content, ocr_content)
            
        result = classify_site(domain, text_content, ocr_content)
        
        # Ensure 'confidence_level' key exists in the result from classify_site
        if "confidence_level" not in result:
            result["confidence_level"] = 0.0 # Default to 0.0 if not provided
        
        # Add snippet to result
        result["snippet"] = snippet
        return result # Result now includes confidence_level and snippet
    except Exception as e:
        logging.error(f"Error processing {domain}: {e}")
        return {
            "domain": domain, 
            "classification_label": "Error",
            "summary": str(e),
            "confidence_level": 0.0, # Default confidence for errors
            "snippet": "Error occurred during processing"
        }

def run_classification_pipeline(domains, method, headless, anti_detection, workers, progress_bar=None, status_text=None):
    """Run the classification pipeline with progress tracking"""
    results = {}
    
    with ThreadPoolExecutor(max_workers=workers) as executor:
        future_to_index = {
            executor.submit(process_domain, domain, method, headless, anti_detection): i
            for i, domain in enumerate(domains)
        }
        
        completed = 0
        total = len(domains)
        
        for future in as_completed(future_to_index):
            idx = future_to_index[future]
            try:
                result = future.result()
                results[idx] = result
                completed += 1
                
                # Update progress
                if progress_bar:
                    progress_bar.progress(completed / total)
                if status_text:
                    status_text.text(f"Completed {completed}/{total}: {result.get('domain', 'Unknown')}")
                    
            except Exception as e:
                logging.error(f"Error processing domain at index {idx}: {e}")
                results[idx] = {
                    "domain": domains[idx], 
                    "classification_label": "Error", 
                    "summary": str(e),
                    "confidence_level": 0.0, # Default confidence for errors
                    "snippet": "Error occurred during processing"
                }
                completed += 1
                
                if progress_bar:
                    progress_bar.progress(completed / total)
                if status_text:
                    status_text.text(f"Completed {completed}/{total} (with error): {domains[idx]}")
    
    # Order results by input order
    ordered_results = [results[i] for i in sorted(results)]
    return ordered_results

def main():
    st.set_page_config(
        page_title="Bulk Website Classifier",
        layout="wide"
    )
    
    st.title("Bulk Website Classification Pipeline")
    st.markdown("Classify websites as **Marketing**, **Portal**, **Other**, or **Error** using AI-powered analysis.")
    
    # Sidebar for configuration
    st.sidebar.header("Configuration")
    
    # Text extraction method
    method = st.sidebar.selectbox(
        "Text Extraction Method",
        options=['HTML', 'OCR'],
        index=0,
        help="How to extract text from websites"
    )
    
    # Browser options
    st.sidebar.subheader("Browser Options")
    headful = st.sidebar.checkbox(
        "Headful Mode", 
        value=False,
        help="Show browser window (useful for sites that block headless browsers)"
    )
    
    anti_detection = st.sidebar.checkbox(
        "Anti-Detection", 
        value=False,
        help="Enable anti-bot detection measures"
    )
    
    # Performance options
    st.sidebar.subheader("Performance")
    workers = st.sidebar.slider(
        "Worker Threads",
        min_value=1,
        max_value=8,
        value=4 if not headful else 2,
        help="Number of parallel processes (reduced automatically for headful mode)"
    )
    
    # Adjust workers for headful mode
    if headful:
        workers = min(workers, 2)
        st.sidebar.info("Worker threads limited to 2 in headful mode")
    
    # File management options
    st.sidebar.subheader("File Options")
    overwrite = st.sidebar.checkbox(
        "Overwrite Existing Results",
        value=False,
        help="Re-process all domains even if they exist in previous results"
    )
    
    # Main content area
    col1, col2 = st.columns([1, 1])
    
    with col1:
        st.subheader("Input Domains")
        
        # Domain input options
        domains = []
        
        # Default to text area input
        text_input = st.text_area(
            "Paste domains (one per line)",
            height=150,
            placeholder="example.com\ngoogle.com\nopenai.com"
        )
            
        if text_input:
            domains = load_domains_from_text(text_input)
            st.success(f"Found {len(domains)} domains")
        
    with col2:
        st.subheader("Processing")
        
        if not domains:
            st.info("Please input domains to get started")
        else:
            # Show current configuration
            st.write("**Current Settings:**")
            config_info = f"""
            - **Method:** {method.upper()}
            - **Browser:** {'Headful' if headful else 'Headless'}
            - **Anti-Detection:** {'Enabled' if anti_detection else 'Disabled'}
            - **Workers:** {workers}
            - **Overwrite:** {'Yes' if overwrite else 'No'}
            """
            st.markdown(config_info)
            
            # Process button
            if st.button("Start Classification", type="primary", use_container_width=True):
                
                # Check for existing results if not overwriting
                processed_domains = set()
                existing_results = []
                
                if not overwrite and 'results_data' in st.session_state:
                    existing_results = st.session_state.results_data
                    processed_domains = {row['domain'] for row in existing_results}
                
                # Filter domains to process
                if overwrite:
                    domains_to_process = domains
                    st.info(f"Processing all {len(domains)} domains (overwrite mode)")
                else:
                    domains_to_process = [d for d in domains if d not in processed_domains]
                    if len(domains_to_process) < len(domains):
                        skipped = len(domains) - len(domains_to_process)
                        st.info(f"Skipping {skipped} already processed domains")
                
                if not domains_to_process:
                    st.warning("No domains to process!")
                else:
                    # Progress tracking
                    progress_bar = st.progress(0)
                    status_text = st.empty()
                    
                    # Run classification
                    with st.spinner("AI is analyzing websites..."):
                        results = run_classification_pipeline(
                            domains_to_process, method, not headful, anti_detection, workers,
                            progress_bar, status_text
                        )
                    
                    # Combine results
                    if overwrite:
                        final_results = results
                    else:
                        # Create a map for easy lookup
                        results_map = {row['domain']: row for row in existing_results}
                        for result in results:
                            results_map[result['domain']] = result
                        
                        # Rebuild in original order
                        final_results = []
                        for domain in domains:
                            if domain in results_map:
                                final_results.append(results_map[domain])
                    
                    # Store results in session state
                    st.session_state.results_data = final_results
                    st.session_state.last_run = datetime.now()
                    
                    progress_bar.progress(1.0)
                    status_text.text("Classification complete!")
                    
                    st.success(f"Successfully processed {len(results)} domains!")
                    
                    # Cache results to CSV like CLI
                    write_results(final_results, 'results_enhanced.csv')
                    st.info("Results saved to results_enhanced.csv")
    
    # Results section
    if 'results_data' in st.session_state and st.session_state.results_data:
        st.markdown("---")
        st.subheader("Results")
        
        results_df = pd.DataFrame(st.session_state.results_data)
        
        # Summary metrics
        col1, col2, col3, col4, col5 = st.columns(5)
        
        total = len(results_df)
        marketing = len(results_df[results_df['classification_label'] == 'Marketing'])
        portal = len(results_df[results_df['classification_label'] == 'Portal'])
        other = len(results_df[results_df['classification_label'] == 'Other'])
        errors = len(results_df[results_df['classification_label'] == 'Error'])
        
        col1.metric("Total Domains", total)
        col2.metric("Marketing Sites", marketing)
        col3.metric("Portal Sites", portal)
        col4.metric("Other Sites", other)
        col5.metric("Errors", errors)
        
        # Results table
        st.subheader("Detailed Results")
        
        # Filter options
        
        # Search input directly, without the filter column
        search_term = st.text_input("Search domains", placeholder="Enter domain to search...")
        
        # Apply filters
        filtered_df = results_df
        
        if search_term:
            filtered_df = filtered_df[filtered_df['domain'].str.contains(search_term, case=False, na=False)]
        
        # Display table
        st.dataframe(
            filtered_df,
            use_container_width=True,
            hide_index=True,
            column_config={
                "domain": st.column_config.TextColumn("Domain", width="medium"),
                "classification_label": st.column_config.TextColumn("Classification", width="small"),
                "summary": st.column_config.TextColumn("Summary", width="large"),
                "confidence_level": st.column_config.NumberColumn("Confidence", format="%.2f", width="small"),
                "snippet": st.column_config.TextColumn("Snippet", width="large")
            }
        )
        
        # Download options
        st.subheader("Export Results")
        
        col1, col2 = st.columns(2)
        
        with col1:
            # Download as CSV
            csv_buffer = io.StringIO()
            filtered_df.to_csv(csv_buffer, index=False)
            csv_data = csv_buffer.getvalue()
            
            st.download_button(
                label="Download as CSV",
                data=csv_data,
                file_name=f"website_classification_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
                mime="text/csv",
                use_container_width=True
            )
        

        
        # Show logs if there are errors
        if errors > 0:
            with st.expander("View Processing Logs"):
                logs = log_stream.getvalue()
                if logs:
                    st.text_area("Logs", value=logs, height=200)
                else:
                    st.write("No logs available")

if __name__ == "__main__":
    main()
