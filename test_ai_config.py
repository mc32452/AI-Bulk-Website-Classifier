#!/usr/bin/env python3
"""
Test script to verify OpenAI/Azure OpenAI auto-detection and switching.
"""

import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.openai_client import get_ai_provider_info, test_ai_connection

def main():
    print("🔍 AI Provider Configuration Test")
    print("=" * 50)
    
    # Get provider info
    try:
        provider_info = get_ai_provider_info()
        print(f"✅ Provider: {provider_info['provider']}")
        print(f"✅ Model: {provider_info['model']}")
        print(f"✅ Endpoint: {provider_info['endpoint']}")
        if provider_info['api_version']:
            print(f"✅ API Version: {provider_info['api_version']}")
        
        print("\n🧪 Testing AI Connection...")
        connection_test = test_ai_connection()
        
        if connection_test['success']:
            print(f"✅ Connection successful!")
            print(f"✅ Response: {connection_test['response']}")
        else:
            print(f"❌ Connection failed: {connection_test['error']}")
            
    except Exception as e:
        print(f"❌ Configuration error: {e}")
        print("\n💡 Make sure to set either:")
        print("   - OPENAI_API_KEY for OpenAI")
        print("   - Or all Azure variables for Azure OpenAI")

if __name__ == "__main__":
    main()
