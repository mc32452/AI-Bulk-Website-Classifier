import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Call the Flask backend health endpoint
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';
    const backendResponse = await fetch(`${backendUrl}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!backendResponse.ok) {
      throw new Error('Backend health check failed');
    }

    const healthData = await backendResponse.json();
    
    // Add frontend status
    const fullHealthData = {
      ...healthData,
      frontend: {
        status: "healthy",
        timestamp: new Date().toISOString()
      }
    };

    return NextResponse.json(fullHealthData);
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      {
        status: "unhealthy",
        frontend: {
          status: "healthy",
          timestamp: new Date().toISOString()
        },
        backend: {
          status: "unhealthy",
          error: error instanceof Error ? error.message : "Unknown error"
        }
      },
      { status: 503 }
    );
  }
}
