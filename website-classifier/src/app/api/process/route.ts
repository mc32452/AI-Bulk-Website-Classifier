import { NextRequest, NextResponse } from "next/server";

interface ProcessRequest {
  domains: string[];
  config: {
    method: "HTML" | "OCR";
    headless: boolean;
    antiDetection: boolean;
    workers: number;
    overwrite: boolean;
  };
}

interface ClassificationResult {
  domain: string;
  classification_label: string;
  summary: string;
  confidence_level: number;
  snippet: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ProcessRequest = await request.json();
    const { domains, config } = body;

    if (!domains || domains.length === 0) {
      return NextResponse.json(
        { error: "No domains provided" },
        { status: 400 }
      );
    }

    // Call the Flask backend service
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';
    const backendResponse = await fetch(`${backendUrl}/classify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        domains,
        config: {
          method: config.method,
          headless: config.headless,
          antiDetection: config.antiDetection,
          workers: config.workers,
          overwrite: config.overwrite
        }
      }),
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json();
      throw new Error(errorData.error || 'Backend processing failed');
    }

    const data = await backendResponse.json();
    return NextResponse.json({ results: data.results });

  } catch (error) {
    console.error('API Error:', error);
    
    // If backend is not available, provide helpful error message
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        { error: 'Backend service is not available. Please start the Flask backend server.' },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
