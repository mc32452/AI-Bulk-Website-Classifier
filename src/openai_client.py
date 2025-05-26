import os
import json
import logging
from typing import Dict
from dotenv import load_dotenv
from openai import OpenAI, AzureOpenAI

# Load environment variables
load_dotenv()

# Check for Azure OpenAI configuration first
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")
AZURE_OPENAI_DEPLOYMENT_NAME = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")

# Regular OpenAI configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Determine which client to use and initialize
if AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_DEPLOYMENT_NAME:
    # Use Azure OpenAI
    client = AzureOpenAI(
        api_key=AZURE_OPENAI_API_KEY,
        api_version=AZURE_OPENAI_API_VERSION,
        azure_endpoint=AZURE_OPENAI_ENDPOINT
    )
    MODEL_NAME = AZURE_OPENAI_DEPLOYMENT_NAME
    CLIENT_TYPE = "Azure OpenAI"
    logging.info(f"Using Azure OpenAI with deployment: {AZURE_OPENAI_DEPLOYMENT_NAME}")
elif OPENAI_API_KEY:
    # Use regular OpenAI
    client = OpenAI(api_key=OPENAI_API_KEY)
    MODEL_NAME = "gpt-4o-mini"  # Updated to a more widely available model
    CLIENT_TYPE = "OpenAI"
    logging.info("Using OpenAI API")
else:
    error_msg = (
        "No valid API configuration found. Please set either:\n"
        "1. OPENAI_API_KEY for OpenAI, or\n"
        "2. AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, and AZURE_OPENAI_DEPLOYMENT_NAME for Azure OpenAI"
    )
    logging.error(error_msg)
    raise ValueError(error_msg)

# Define function schema for site classification
CLASSIFY_SITE_TOOL = {
    "type": "function",
    "function": {
        "name": "classify_site",
        "description": "Classify a website based on its content and provide a summary",
        "parameters": {
            "type": "object",
            "properties": {
                "domain": {"type": "string", "description": "The domain name of the website"},
                "classification_label": {"type": "string", "enum": ["Marketing", "Portal", "Other"],
                    "description": "The primary classification category: 'Marketing', 'Portal', or 'Other'"},
                "summary": {"type": "string", "description": "A very brief summary of the website's purpose and content"},
                "confidence_level": {"type": "number", "description": "A self-reported confidence level between 0.0 and 1.0"}  # Added confidence level
            },
            "required": ["domain", "classification_label", "summary", "confidence_level"]  # Require confidence_level
        }
    }
}

def classify_site(domain: str, html_text: str, ocr_text: str) -> Dict:
    """
    Calls OpenAI or Azure OpenAI with function-calling to classify a site.
    Automatically uses the configured client (Azure OpenAI or regular OpenAI).
    Implements retry logic with exponential backoff for reliability.
    Returns a dict with keys: domain, classification_label, summary, confidence_level.
    """
    # Prepare the user message with site content
    user_content = (
        f"Classify the website domain: {domain}\n\n"
        f"HTML Content: {html_text[:3000] if html_text else 'No HTML content available'}\n\n"
        f"OCR Text: {ocr_text[:1000] if ocr_text else 'No OCR content available'}\n\n"
        "Please classify this website into one of: Marketing, Portal, Other. "
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
            # Call the OpenAI or Azure OpenAI API
            response = client.chat.completions.create(
                model=MODEL_NAME,
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
            
            logging.info(f"Successfully classified {domain} as {result['classification_label']} with confidence {result['confidence_level']} using {CLIENT_TYPE}")
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
    
    # If all retries failed, raise an exception instead of returning error classification
    logging.error(f"Failed to classify site after {max_retries} attempts: {domain}")
    raise Exception(f"Failed to classify due to API errors after {max_retries} attempts")

def get_ai_provider_info() -> Dict:
    """
    Returns information about the current AI provider configuration.
    Useful for debugging and user feedback.
    """
    return {
        "provider": CLIENT_TYPE,
        "model": MODEL_NAME,
        "endpoint": AZURE_OPENAI_ENDPOINT if CLIENT_TYPE == "Azure OpenAI" else "https://api.openai.com",
        "api_version": AZURE_OPENAI_API_VERSION if CLIENT_TYPE == "Azure OpenAI" else None
    }

def test_ai_connection() -> Dict:
    """
    Test the AI connection with a simple request.
    Returns success status and provider info.
    """
    try:
        # Simple test message
        test_response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[{"role": "user", "content": "Hello, respond with 'OK' if you can process this message."}],
            max_tokens=10,
            temperature=0
        )
        
        response_text = test_response.choices[0].message.content.strip()
        
        return {
            "success": True,
            "provider_info": get_ai_provider_info(),
            "response": response_text,
            "message": f"Successfully connected to {CLIENT_TYPE}"
        }
    except Exception as e:
        return {
            "success": False,
            "provider_info": get_ai_provider_info(),
            "error": str(e),
            "message": f"Failed to connect to {CLIENT_TYPE}: {str(e)}"
        }
