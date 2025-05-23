import os
import json
import logging
from typing import Dict
from dotenv import load_dotenv
from openai import OpenAI

# Load environment variables
load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    logging.error("OPENAI_API_KEY is not set in environment variables")
    raise ValueError("OPENAI_API_KEY must be set in environment variables")

# Initialize OpenAI client
client = OpenAI(api_key=OPENAI_API_KEY)

# Define function schema for site classification using the new tools format
CLASSIFY_SITE_TOOL = {
    "type": "function",
    "function": {
        "name": "classify_site",
        "description": "Classify a website based on its content and provide a summary",
        "parameters": {
            "type": "object",
            "properties": {
                "domain": {"type": "string", "description": "The domain name of the website"},
                "classification_label": {"type": "string", "enum": ["Marketing", "Portal", "Other", "Error"],
                    "description": "The primary classification category: 'Marketing', 'Portal', 'Other', or 'Error'"},
                "summary": {"type": "string", "description": "A very brief summary of the website's purpose and content"},
                "confidence_level": {"type": "number", "description": "A self-reported confidence level between 0.0 and 1.0"}  # Added confidence level
            },
            "required": ["domain", "classification_label", "summary", "confidence_level"]  # Require confidence_level
        }
    }
}

def classify_site(domain: str, html_text: str, ocr_text: str) -> Dict:
    """
    Calls OpenAI GPT-4.1 Nano with function-calling to classify a site.
    Implements retry logic with exponential backoff for reliability.
    Returns a dict with keys: domain, classification_label, summary.
    """
    # Prepare the user message with site content
    user_content = (
        f"Classify the website domain: {domain}\n\n"
        f"HTML Content: {html_text[:3000] if html_text else 'No HTML content available'}\n\n"
        f"OCR Text: {ocr_text[:1000] if ocr_text else 'No OCR content available'}\n\n"
        "Please classify this website into one of: Marketing, Portal, Other, Error. "
        "Provide a brief summary. Also return your confidence level as a number between 0 and 1."
    )
    
    messages = [
        {"role": "system", "content": (
            "You are a website classification assistant. Analyze the provided content and "
            "classify websites accurately based on their purpose and content. Use the classify_site "
            "function to provide your classification and summary. If a site is neither primarily for marketing "
            "nor a portal for users, classify it as 'Other'."
        )},
        {"role": "user", "content": user_content}
    ]
    
    attempts = 0
    max_retries = 2
    
    while attempts < max_retries:
        try:
            # Call the OpenAI API with the new client format using GPT-4.1 nano
            response = client.chat.completions.create(
                model="gpt-4.1-nano",
                messages=messages,
                tools=[CLASSIFY_SITE_TOOL],
                tool_choice={"type": "function", "function": {"name": "classify_site"}},
                temperature=0.1,  # Low temperature for consistent classification
                max_tokens=500
            )
            
            # Extract the function call from the response
            message = response.choices[0].message
            
            if not message.tool_calls or len(message.tool_calls) == 0:
                raise ValueError("No tool calls in response")
                
            tool_call = message.tool_calls[0]
            if tool_call.function.name != "classify_site":
                raise ValueError(f"Unexpected function called: {tool_call.function.name}")
            
            # Parse the function arguments
            args_str = tool_call.function.arguments
            result = json.loads(args_str)
            
            # Validate required fields
            required_fields = ["domain", "classification_label", "summary", "confidence_level"]
            for field in required_fields:
                if field not in result:
                    raise ValueError(f"Missing required field: {field}")
            
            logging.info(f"Successfully classified {domain} as {result['classification_label']} with confidence {result['confidence_level']}")
            return result
            
        except json.JSONDecodeError as e:
            logging.error(f"JSON decode error for {domain}: {e}")
            attempts += 1
        except Exception as e:
            logging.error(f"Error classifying {domain} (attempt {attempts + 1}): {e}")
            attempts += 1
            
            # Add exponential backoff for retries
            if attempts < max_retries:
                import time
                time.sleep(2 ** attempts)
    
    # If all retries failed, return an error classification
    logging.error(f"Failed to classify site after {max_retries} attempts: {domain}")
    return {
        "domain": domain,
        "classification_label": "Error",
        "summary": f"Failed to classify due to API errors after {max_retries} attempts",
        "confidence_level": 0.0  # Default confidence for errors
    }
