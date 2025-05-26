import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action; // 'clear', 'reset', or 'vacuum'

    if (!action || !['clear', 'reset', 'vacuum'].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'clear', 'reset', or 'vacuum'" },
        { status: 400 }
      );
    }

    // Call the Flask backend service
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';
    const endpoint = action === 'vacuum' ? '/database/vacuum' : `/database/${action}`;
    
    const backendResponse = await fetch(`${backendUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json();
      throw new Error(errorData.error || `Database ${action} operation failed`);
    }

    const data = await backendResponse.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Database management error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Database operation failed"
      },
      { status: 500 }
    );
  }
}
