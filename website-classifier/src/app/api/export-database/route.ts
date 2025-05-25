import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';
    
    // Make request to backend to get all database records
    const response = await fetch(`${backendUrl}/export-database`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.results || !Array.isArray(data.results)) {
      throw new Error('Invalid response format from backend');
    }

    // Create CSV content
    const csvHeaders = ['Domain', 'Classification', 'Summary', 'Confidence', 'Snippet', 'Created At'];
    const csvRows = data.results.map((result: any) => [
      result.domain || '',
      result.classification_label || '',
      (result.summary || '').replace(/"/g, '""'), // Escape quotes
      result.confidence_level?.toFixed(2) || '0.00',
      (result.snippet || '').replace(/"/g, '""'), // Escape quotes
      result.created_at || ''
    ]);

    // Combine headers and rows
    const csvContent = [
      csvHeaders.map(header => `"${header}"`).join(','),
      ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Return CSV as downloadable file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="database_export_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });

  } catch (error) {
    console.error('Database export error:', error);
    return NextResponse.json(
      { error: 'Failed to export database' },
      { status: 500 }
    );
  }
}
