import { type NextRequest, NextResponse } from "next/server";

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

interface ProgressData {
  processed: number;
  total: number;
  progress: number;
  message: string;
}

interface ResultData {
  result: ClassificationResult;
  processed: number;
  total: number;
  progress: number;
}

interface CompleteData {
  results: ClassificationResult[];
  total_processed: number;
  errors: number;
  message: string;
  duration_seconds?: number;
  duration_text?: string;
}

interface ErrorData {
  error: string;
}

interface StreamMessage {
  type: 'progress' | 'result' | 'complete' | 'error';
  data: ProgressData | ResultData | CompleteData | ErrorData;
}

// Helper function to format duration
function formatScanDuration(durationMs: number): string {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  } else {
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ${seconds} second${seconds !== 1 ? 's' : ''}`;
  }
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

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';

    // Create a ReadableStream for Server-Sent Events
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let isClosed = false;
        
        const sendEvent = (message: StreamMessage) => {
          if (isClosed) {
            console.warn('Attempted to send event after controller was closed:', message.type);
            return;
          }
          try {
            const data = `data: ${JSON.stringify(message)}\n\n`;
            controller.enqueue(encoder.encode(data));
          } catch (error) {
            console.error('Error sending event:', error);
            isClosed = true;
          }
        };

        try {
          // Track overall processing time
          const startTime = Date.now();
          
          // Send initial progress
          sendEvent({
            type: 'progress',
            data: { processed: 0, total: domains.length, progress: 0, message: 'Starting processing...' }
          });

          // Process domains one by one for true streaming
          const results: ClassificationResult[] = [];
          const backendInfo = {
            totalProcessed: 0,
            skipped: 0
          };
          
          for (let i = 0; i < domains.length; i++) {
            const domain = domains[i];
            
            try {
              // Call backend for this single domain
              const backendResponse = await fetch(`${backendUrl}/classify`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  domains: [domain], // Process one domain at a time
                  config: {
                    method: config.method,
                    headless: config.headless,
                    antiDetection: config.antiDetection,
                    workers: 1, // Force single worker for individual processing
                    overwrite: config.overwrite
                  }
                }),
              });

              if (!backendResponse.ok) {
                const errorData = await backendResponse.json();
                throw new Error(errorData.error || 'Backend processing failed');
              }

              const domainData = await backendResponse.json();
              const domainResults = domainData.results || [];

              // Send result immediately as it comes in
              if (domainResults.length > 0) {
                const result = domainResults[0];
                results.push(result);
                
                // Update processing stats from backend response
                backendInfo.totalProcessed += domainData.total_processed || 0;
                backendInfo.skipped += domainData.skipped || 0;
                
                sendEvent({
                  type: 'result',
                  data: {
                    result,
                    processed: results.length,
                    total: domains.length,
                    progress: Math.round((results.length / domains.length) * 100)
                  }
                });
              }

            } catch (error) {
              // Send error for failed domain
              const errorResult: ClassificationResult = {
                domain,
                classification_label: "Error",
                summary: error instanceof Error ? error.message : "Processing failed",
                confidence_level: 0.0,
                snippet: "Error occurred during processing"
              };
              
              results.push(errorResult);
              sendEvent({
                type: 'result',
                data: {
                  result: errorResult,
                  processed: results.length,
                  total: domains.length,
                  progress: Math.round((results.length / domains.length) * 100)
                }
              });
            }

            // Send progress update after each domain
            sendEvent({
              type: 'progress',
              data: {
                processed: results.length,
                total: domains.length,
                progress: Math.round((results.length / domains.length) * 100),
                message: `Processed ${results.length} of ${domains.length} domains...`
              }
            });

            // Small delay between domains to prevent overwhelming the backend
            // and make streaming effect more visible
            if (i < domains.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }

          // Send completion - ensure we don't send after errors
          if (!isClosed) {
            const endTime = Date.now();
            const duration = endTime - startTime;
            const durationText = formatScanDuration(duration);
            
            const errors = results.filter(r => r.classification_label === "Error").length;
            const totalProcessed = backendInfo.totalProcessed;
            const skipped = backendInfo.skipped;
            
            // Create detailed success message like the original
            let message = `Scan complete in ${durationText}!`;
            if (totalProcessed > 0 && skipped > 0) {
              message = `${totalProcessed} new scan${totalProcessed !== 1 ? 's' : ''}, ${skipped} already in database`;
            } else if (totalProcessed > 0) {
              message = `${totalProcessed} new scan${totalProcessed !== 1 ? 's' : ''} completed`;
            } else if (skipped > 0) {
              message = `${skipped} domain${skipped !== 1 ? 's' : ''} already in database`;
            } else {
              message = `Successfully processed ${results.length} domain${results.length !== 1 ? 's' : ''}`;
            }
            
            sendEvent({
              type: 'complete',
              data: {
                results,
                total_processed: totalProcessed,
                errors: errors,
                message: message,
                duration_seconds: duration / 1000,
                duration_text: durationText
              }
            });
          }

        } catch (error) {
          console.error('Streaming error:', error);
          if (!isClosed) {
            sendEvent({
              type: 'error',
              data: {
                error: error instanceof Error ? error.message : 'An unexpected error occurred'
              }
            });
          }
        } finally {
          if (!isClosed) {
            try {
              controller.close();
              isClosed = true;
            } catch (closeError) {
              console.warn('Controller already closed:', closeError);
            }
          }
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
