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

// Mock function to simulate processing
function generateMockResult(domain: string): ClassificationResult {
  const labels = ["Marketing", "Portal", "Other"];
  const randomLabel = labels[Math.floor(Math.random() * labels.length)];
  
  const summaries = {
    Marketing: `${domain} appears to be a marketing-focused website with promotional content, product showcases, and conversion-oriented design elements.`,
    Portal: `${domain} functions as a portal or gateway site, providing access to various services, resources, or information with user authentication features.`,
    Other: `${domain} serves a specialized purpose that doesn't clearly fit into marketing or portal categories, possibly educational, informational, or community-focused.`
  };

  const snippets = {
    Marketing: `Welcome to ${domain}! Discover our amazing products and services. Get started today with our special offers...`,
    Portal: `Login to ${domain} to access your dashboard, manage your account, and explore available services and resources...`,
    Other: `${domain} provides comprehensive information and resources. Browse our content library and explore various topics...`
  };

  return {
    domain,
    classification_label: randomLabel,
    summary: summaries[randomLabel as keyof typeof summaries],
    confidence_level: Math.random() * 0.3 + 0.7, // 0.7 to 1.0
    snippet: snippets[randomLabel as keyof typeof snippets]
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: ProcessRequest = await request.json();
    const { domains } = body;

    if (!domains || domains.length === 0) {
      return NextResponse.json(
        { error: "No domains provided" },
        { status: 400 }
      );
    }

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    // Generate mock results
    const results: ClassificationResult[] = domains.map(domain => 
      generateMockResult(domain)
    );

    return NextResponse.json({ results });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
