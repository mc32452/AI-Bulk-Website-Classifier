"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { 
  Play, 
  Download, 
  Activity, 
  Search,
  Moon,
  Sun,
  Settings,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  Database
} from "lucide-react";
import { useTheme } from "next-themes";
import { FlickeringGrid } from "./magicui/flickering-grid";
import { StarBorder } from "./magicui/star-border";

interface ClassificationResult {
  domain: string;
  classification_label: string;
  summary: string;
  confidence_level: number;
  snippet: string;
}

interface ProcessingConfig {
  method: "HTML" | "OCR";
  headless: boolean;
  antiDetection: boolean;
  workers: number;
  overwrite: boolean;
}

// Add interface for health check
interface HealthStatus {
  backend: boolean;
  lastChecked: Date | null;
}

// Add interface for domain validation
interface DomainValidation {
  domain: string;
  isValid: boolean;
  error?: string;
}

// Add domain validation function
const validateDomain = (domain: string): { isValid: boolean; error?: string } => {
  const trimmedDomain = domain.trim();
  
  if (!trimmedDomain) {
    return { isValid: false, error: "Empty domain" };
  }

  // Remove protocol if present
  const cleanDomain = trimmedDomain.replace(/^https?:\/\//, '').replace(/^www\./, '');
  
  // Basic domain validation regex
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.([a-zA-Z]{2,}|[a-zA-Z]{2,}\.[a-zA-Z]{2,})$/;
  
  if (!domainRegex.test(cleanDomain)) {
    return { isValid: false, error: "Invalid domain format" };
  }

  // Check for invalid characters
  if (cleanDomain.includes('..') || cleanDomain.startsWith('-') || cleanDomain.endsWith('-')) {
    return { isValid: false, error: "Invalid domain format" };
  }

  // Check minimum length
  if (cleanDomain.length < 4) {
    return { isValid: false, error: "Domain too short" };
  }

  // Check maximum length (253 chars for full domain)
  if (cleanDomain.length > 253) {
    return { isValid: false, error: "Domain too long" };
  }

  return { isValid: true };
};

// Add function to format scan duration
const formatScanDuration = (durationMs: number): string => {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }
  
  return `${minutes} minute${minutes !== 1 ? 's' : ''} ${seconds} second${seconds !== 1 ? 's' : ''}`;
};

// Add theme toggle component
function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className="h-8 w-8 p-0 hover:bg-secondary/60 border border-border/40"
    >
      {theme === "light" ? (
        <Moon className="h-3 w-3" />
      ) : (
        <Sun className="h-3 w-3" />
      )}
    </Button>
  );
}

export function WebsiteClassifier() {
  const [domains, setDomains] = useState("");
  const [results, setResults] = useState<ClassificationResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [streamingResults, setStreamingResults] = useState<ClassificationResult[]>([]);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [streamingMode, setStreamingMode] = useState(false);
  const [showConfig, setShowConfig] = useState(true); // Show config by default in initial state
  const [config, setConfig] = useState<ProcessingConfig>({
    method: "HTML",
    headless: true,
    antiDetection: false,
    workers: 4,
    overwrite: false
  });
  
  // Add UI mode state to track initial vs processing/results layout
  const [uiMode, setUiMode] = useState<'initial' | 'processing' | 'results'>('initial');
  
  // Add domain validation state
  const [domainValidations, setDomainValidations] = useState<DomainValidation[]>([]);
  
  // Add scan timing state
  const [scanStartTime, setScanStartTime] = useState<number | null>(null);
  const [scanDuration, setScanDuration] = useState<number | null>(null);
  
  const [healthStatus, setHealthStatus] = useState<HealthStatus>({
    backend: false,
    lastChecked: null,
  });
  
  // Add sorting state
  const [sortConfig, setSortConfig] = useState<{
    key: keyof ClassificationResult | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });
  
  // Add popup state
  const [selectedSummary, setSelectedSummary] = useState<{
    domain: string;
    summary: string;
    classification: string;
    snippet: string;
  } | null>(null);

  const { toast } = useToast();

  // Add health check function
  const checkBackendHealth = useCallback(async () => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';
      const response = await fetch(`${backendUrl}/health`);
      const isHealthy = response.ok;
      setHealthStatus({
        backend: isHealthy,
        lastChecked: new Date(),
      });
      return isHealthy;
    } catch (error) {
      console.error('Health check failed:', error);
      setHealthStatus({
        backend: false,
        lastChecked: new Date(),
      });
      return false;
    }
  }, []);

  // Check health on component mount and periodically
  useEffect(() => {
    checkBackendHealth();
    const interval = setInterval(checkBackendHealth, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [checkBackendHealth]);

  // Auto-collapse configuration when results are shown, but not in initial mode
  useEffect(() => {
    if (results.length > 0 && uiMode !== 'initial') {
      setShowConfig(false);
    }
  }, [results.length, uiMode]);
  
  // Update UI mode based on processing state and results
  useEffect(() => {
    if (isProcessing) {
      setUiMode('processing');
    } else if (results.length > 0) {
      setUiMode('results');
    } else {
      setUiMode('initial');
    }
  }, [isProcessing, results.length]);

  // Real-time domain validation
  useEffect(() => {
    if (!domains.trim()) {
      setDomainValidations([]);
      return;
    }

    const domainList = domains.trim().split('\n').filter(line => line.trim()).map(line => line.trim());
    const validations = domainList.map(domain => {
      const validation = validateDomain(domain);
      return {
        domain,
        isValid: validation.isValid,
        error: validation.error
      };
    });
    
    setDomainValidations(validations);
  }, [domains]);

  const parseDomains = (text: string): string[] => {
    return text.trim().split('\n').filter(line => line.trim()).map(line => line.trim());
  };

  // Get valid domains only for processing
  const getValidDomains = (): string[] => {
    const validDomains = domainValidations.filter(v => v.isValid).map(v => v.domain);
    // Remove duplicates using Set
    return [...new Set(validDomains)];
  };

  const handleProcess = async () => {
    const validDomains = getValidDomains();
    
    if (validDomains.length === 0) {
      toast({
        title: "No valid domains",
        description: "Please enter at least one valid domain to process.",
        variant: "destructive"
      });
      return;
    }

    // Check backend health
    const isHealthy = await checkBackendHealth();
    if (!isHealthy) {
      toast({
        title: "Backend Unavailable",
        description: "The backend service is not responding. Please check if it's running on port 5001.",
        variant: "destructive",
      });
      return;
    }

    // Use streaming for real-time updates
    await handleStreamingProcess(validDomains);
  };

  const handleStreamingProcess = async (domainList: string[]) => {
    const startTime = Date.now();
    setScanStartTime(startTime);
    setScanDuration(null); // Reset previous duration
    
    setIsProcessing(true);
    setProgress(0);
    setResults([]); // Clear previous results
    setStreamingResults([]); // Clear streaming results
    setProcessedCount(0);
    setTotalCount(domainList.length);
    setStreamingMode(true);
    
    // Trigger UI transition to processing mode
    setUiMode('processing');
    
    try {
      const response = await fetch('/api/process-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          domains: domainList,
          config: {
            method: config.method,
            headless: config.headless,
            antiDetection: config.antiDetection,
            workers: config.workers,
            overwrite: config.overwrite
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start streaming process');
      }

      if (!response.body) {
        throw new Error('No response body available');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                switch (data.type) {
                  case 'progress': {
                    setProgress(data.data.progress || 0);
                    setProcessedCount(data.data.processed || 0);
                    break;
                  }
                    
                  case 'result': {
                    const newResult = data.data.result;
                    setStreamingResults(prev => [...prev, newResult]);
                    setResults(prev => [...prev, newResult]);
                    setProgress(data.data.progress || 0);
                    setProcessedCount(data.data.processed || 0);
                    
                    // Optional: Show toast for each result
                    // toast({
                    //   title: `${newResult.domain}`,
                    //   description: `Classified as ${newResult.classification_label}`,
                    //   duration: 1000,
                    // });
                    break;
                  }
                    
                  case 'complete': {
                    // Use backend duration if available, otherwise fall back to frontend calculation
                    const backendDuration = data.data.duration_seconds ? data.data.duration_seconds * 1000 : 0;
                    const frontendDuration = scanStartTime ? Date.now() - scanStartTime : 0;
                    const duration = backendDuration > 0 ? backendDuration : frontendDuration;
                    setScanDuration(duration);
                    
                    // Store scan duration for potential future use (analytics, display, etc.)
                    if (scanDuration !== null) {
                      // Duration is now stored and available for future features
                    }
                    
                    const errors = data.data.errors || 0;
                    const message = data.data.message || "Scan complete!";
                    
                    // Use backend duration text if available, otherwise format frontend duration
                    let durationText = '';
                    if (data.data.duration_text) {
                      durationText = ` in ${data.data.duration_text}`;
                    } else if (duration > 0) {
                      durationText = ` in ${formatScanDuration(duration)}`;
                    }
                    
                    const errorText = errors === 1 ? "1 error" : `${errors} errors`;
                    
                    toast({
                      title: `Scan complete${durationText}!`,
                      description: errors > 0 ? `${message}, ${errorText}` : message,
                    });
                    break;
                  }
                    
                  case 'error': {
                    throw new Error(data.data.error || 'Streaming error occurred');
                  }
                }
              } catch (parseError) {
                console.warn('Failed to parse SSE data:', parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

    } catch (error) {
      console.error('Streaming error:', error);
      toast({
        title: "Processing failed", 
        description: error instanceof Error ? error.message : "An error occurred while processing domains.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
      setStreamingMode(false);
      setProgress(100);
    }
  };

  const handleExport = () => {
    const csv = [
      ["Domain", "Classification", "Summary", "Confidence", "Snippet"],
      ...results.map(r => [r.domain, r.classification_label, r.summary, r.confidence_level.toFixed(2), r.snippet || ''])
    ].map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `website_classification_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportDatabase = async () => {
    try {
      const response = await fetch('/api/export-database');
      
      if (!response.ok) {
        throw new Error('Failed to export database');
      }

      // Get the CSV content from the response
      const csvContent = await response.text();
      
      // Create and download the file
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `database_export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Database exported",
        description: "Full database has been exported to CSV file.",
      });

    } catch (error) {
      console.error('Database export error:', error);
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Failed to export database.",
        variant: "destructive"
      });
    }
  };

  const filteredResults = results.filter(result => 
    result.domain.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Add sorting function
  const handleSort = (key: keyof ClassificationResult) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Sort filtered results
  const sortedResults = React.useMemo(() => {
    if (!sortConfig.key) return filteredResults;
    
    return [...filteredResults].sort((a, b) => {
      const aValue = a[sortConfig.key as keyof ClassificationResult];
      const bValue = b[sortConfig.key as keyof ClassificationResult];
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue);
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        const comparison = aValue - bValue;
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      }
      
      return 0;
    });
  }, [filteredResults, sortConfig]);

  // Get sort icon for column headers
  const getSortIcon = (columnKey: keyof ClassificationResult) => {
    if (sortConfig.key !== columnKey) {
      return <ArrowUpDown className="w-3 h-3 ml-1" />;
    }
    return sortConfig.direction === 'asc' ? 
      <ArrowUp className="w-3 h-3 ml-1" /> : 
      <ArrowDown className="w-3 h-3 ml-1" />;
  };

  const stats = {
    total: results.length,
    marketing: results.filter(r => r.classification_label === "Marketing").length,
    portal: results.filter(r => r.classification_label === "Portal").length,
    other: results.filter(r => r.classification_label === "Other").length,
    errors: results.filter(r => r.classification_label === "Error").length
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="relative h-screen bg-background overflow-hidden">
        {/* Flickering Grid Background - Covers entire viewport */}
        {uiMode === 'initial' && (
          <FlickeringGrid
            className="absolute inset-0 z-0 [mask-image:radial-gradient(1000px_circle_at_center,transparent_350px,white_700px,white)]"
            squareSize={4}
            gridGap={6}
            flickerChance={0.1}
            color="#6B7280"
            maxOpacity={0.3}
          />
        )}
        
        {/* Subtle Glassmorphism Overlay - Only for initial mode */}
        {uiMode === 'initial' && (
          <div className="absolute inset-0 z-5 bg-gradient-to-br from-white/1 via-transparent to-white/1" />
        )}

      {/* Simplified Status Bar - More Transparent */}
      <div className="relative z-10 border-b border-border/20 bg-background/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-8 px-3 border border-border/40 rounded-md flex items-center space-x-2 bg-background/50">
                <div className={`w-2.5 h-2.5 rounded-full ${healthStatus.backend ? 'bg-green-600' : 'bg-red-600'}`} />
                <span className="text-xs text-muted-foreground/80">
                  Backend: {healthStatus.backend ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleExportDatabase}
                    className="h-8 px-3 hover:bg-secondary/60 border border-border/40 text-xs"
                  >
                    <Database className="h-3 w-3 mr-1" />
                    Export DB
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Export all database results to CSV</p>
                </TooltipContent>
              </Tooltip>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>

      {uiMode === 'initial' ? (
        /* Initial Centered Layout */
        <div className="relative h-full w-full overflow-hidden">
          {/* Content Overlay */}
          <div className="relative z-10 max-w-3xl mx-auto px-4 md:px-8 py-6">
            {/* Centered Header */}
            <div className="mb-8 text-center">
              <h1 className="text-3xl md:text-4xl font-bold text-foreground/90 mb-3">
                Bulk Domain Analyzer
              </h1>
              <p className="text-base text-muted-foreground/80 max-w-2xl mx-auto">
                Enter a list of domains to classify and analyze their content using AI-powered analysis.
              </p>
            </div>

          {/* Centered Input Section */}
          <div className="space-y-5">
            {/* Large Domain Input */}
            <div className="space-y-3">
              <div className="relative">
                <Textarea
                  id="domains-initial"
                  placeholder="example.com"
                  value={domains}
                  onChange={(e) => setDomains(e.target.value)}
                  className="min-h-[200px] text-sm font-mono resize-none border-2 border-border/30 focus:border-border/60 focus:outline-none rounded-xl transition-all duration-200 hover:border-border/50 bg-white/5 backdrop-blur-sm p-4 shadow-sm hover:shadow-md placeholder:text-muted-foreground/60"
                />
                {/* Domain validation feedback */}
                {domains && domainValidations.length > 0 && (
                  <div className="absolute bottom-4 right-4 flex items-center space-x-4 text-sm">
                    <span className="text-green-600 dark:text-green-400 font-medium">
                      ✓ {domainValidations.filter(v => v.isValid).length} valid domains
                    </span>
                    {domainValidations.filter(v => !v.isValid).length > 0 && (
                      <span className="text-orange-600 dark:text-orange-400 font-medium">
                        ⚠ {domainValidations.filter(v => !v.isValid).length} invalid
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Configuration Section - Always Visible */}
            <div className="max-w-2xl mx-auto">
              <div className="bg-muted/40 rounded-xl border border-border/40 p-6 space-y-4 shadow-sm hover:shadow-md transition-all duration-300">
                <div>
                  <h3 className="text-base font-semibold text-foreground mb-1">Configuration</h3>
                  <p className="text-sm text-muted-foreground">Customize how your domains are analyzed</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Label className="text-sm font-medium text-foreground cursor-help">Text Extraction Method</Label>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Choose how text is extracted from websites: HTML parsing is faster, OCR is more accurate for complex layouts</p>
                      </TooltipContent>
                    </Tooltip>
                    <Select
                      value={config.method} 
                      onValueChange={(value: "HTML" | "OCR") => 
                        setConfig(prev => ({ ...prev, method: value }))
                      }
                    >
                      <SelectTrigger className="h-10 border-border/50 focus:border-border focus:outline-none hover:border-border transition-colors rounded-lg shadow-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HTML">HTML Parsing (Faster)</SelectItem>
                        <SelectItem value="OCR">OCR Screenshots (More Accurate)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Label className="text-sm font-medium text-foreground cursor-help">Worker Threads</Label>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Number of domains processed simultaneously - higher values are faster but use more resources</p>
                      </TooltipContent>
                    </Tooltip>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-sm text-muted-foreground cursor-help">Concurrent processing</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>How many domains will be processed at the same time</p>
                          </TooltipContent>
                        </Tooltip>
                        <span className="text-sm font-mono text-foreground bg-muted px-1.5 py-0.5 rounded">{config.workers}</span>
                      </div>
                      <Slider
                        value={[config.workers]}
                        onValueChange={([value]) => 
                          setConfig(prev => ({ ...prev, workers: value }))
                        }
                        max={8}
                        min={1}
                        step={1}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="headless-initial"
                      checked={!config.headless}
                      onCheckedChange={(checked) => 
                        setConfig(prev => ({ ...prev, headless: !checked }))
                      }
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Label htmlFor="headless-initial" className="text-sm text-foreground cursor-help font-medium">
                          Headfull Mode
                        </Label>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Show browser window during analysis (useful for debugging and visual confirmation)</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="antiDetection-initial"
                      checked={config.antiDetection}
                      onCheckedChange={(checked) => 
                        setConfig(prev => ({ ...prev, antiDetection: !!checked }))
                      }
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Label htmlFor="antiDetection-initial" className="text-sm text-foreground cursor-help font-medium">
                          Anti-Detection
                        </Label>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Use techniques to avoid being detected as a bot by websites (slower but more reliable)</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="overwrite-initial"
                      checked={config.overwrite}
                      onCheckedChange={(checked) => 
                        setConfig(prev => ({ ...prev, overwrite: !!checked }))
                      }
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Label htmlFor="overwrite-initial" className="text-sm text-foreground cursor-help font-medium">
                          Overwrite Existing
                        </Label>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Re-analyze domains that have already been processed and replace previous results</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>
            </div>

            {/* Large Action Button */}
            <div className="text-center">
              <StarBorder 
                onClick={handleProcess}
                disabled={!domains.trim() || isProcessing || getValidDomains().length === 0}
                className="font-semibold text-lg transition-all duration-200 hover:scale-[1.02] disabled:hover:scale-100 disabled:opacity-50"
                color="white"
                speed="4s"
              >
                {isProcessing ? (
                  <>
                    Processing...
                  </>
                ) : getValidDomains().length === 0 && domains.trim() ? (
                  <>
                    No Valid Domains
                  </>
                ) : (
                  <>
                    Start Analysis
                  </>
                )}
              </StarBorder>
            </div>
          </div>
          </div>
        </div>
      ) : (
        /* Processing/Results Layout with Animation */
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 transition-all duration-700 ease-in-out animate-fade-scale-in">
          {/* Compact Header */}
          <div className="mb-4">
            <h1 className="text-xl md:text-2xl font-semibold text-foreground mb-1">
              Bulk Domain Analyzer
            </h1>
            <p className="text-sm text-muted-foreground">
              Enter a list of domains to classify and analyze their content.
            </p>
          </div>

          {/* Animated Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 h-[calc(100vh-10rem)]">
            {/* Input Section - Fades in from left */}
            <div className="lg:col-span-3 flex flex-col space-y-3 order-2 lg:order-1 transition-all duration-700 ease-in-out animate-fade-scale-in-left">
              
              {/* Domain Input Section */}
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label htmlFor="domains" className="text-sm font-medium text-foreground">
                    Domains
                  </Label>
                  <p className="text-xs text-neutral-500">
                    Enter one domain per line
                  </p>
                </div>
                <Textarea
                  id="domains"
                  placeholder="example.com"
                  value={domains}
                  onChange={(e) => setDomains(e.target.value)}
                  className="min-h-[140px] font-mono text-sm resize-none border-border/50 focus:border-border focus:outline-none rounded-lg transition-colors hover:border-border shadow-sm"
                />
                
                {/* Domain validation feedback */}
                {domains && domainValidations.length > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-green-600 dark:text-green-400">
                      ✓ {domainValidations.filter(v => v.isValid).length} valid
                    </span>
                    {domainValidations.filter(v => !v.isValid).length > 0 && (
                      <span className="text-orange-600 dark:text-orange-400">
                        ⚠ {domainValidations.filter(v => !v.isValid).length} invalid
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Collapsible Configuration Section */}
              <div className="space-y-2">
                <Button
                  variant="outline"
                  onClick={() => setShowConfig(prev => !prev)}
                  className="w-full justify-between h-8 px-3 text-xs border-border/50 hover:bg-secondary/60 hover:border-border transition-colors rounded-lg shadow-sm hover:shadow-md"
                >
                  <div className="flex items-center space-x-2">
                    <Settings className="w-3 h-3" />
                    <span>Configuration</span>
                    <span className="text-muted-foreground">({config.method}, {config.workers} workers)</span>
                  </div>
                  {showConfig ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </Button>
                
                {showConfig && (
                  <div className="space-y-2 p-3 bg-muted/40 rounded-lg border border-border/40 shadow-sm">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-foreground">Text Extraction Method</Label>
                      <Select
                        value={config.method} 
                        onValueChange={(value: "HTML" | "OCR") => 
                          setConfig(prev => ({ ...prev, method: value }))
                        }
                      >
                        <SelectTrigger className="h-7 text-xs border-border/50 focus:border-border focus:outline-none hover:border-border transition-colors rounded-lg shadow-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="HTML">HTML Parsing</SelectItem>
                          <SelectItem value="OCR">OCR (Screenshots)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="headless"
                          checked={!config.headless}
                          onCheckedChange={(checked) => 
                            setConfig(prev => ({ ...prev, headless: !checked }))
                          }
                        />
                        <Label htmlFor="headless" className="text-xs text-foreground cursor-pointer font-medium">
                          Headfull Mode
                        </Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="antiDetection"
                          checked={config.antiDetection}
                          onCheckedChange={(checked) => 
                            setConfig(prev => ({ ...prev, antiDetection: !!checked }))
                          }
                        />
                        <Label htmlFor="antiDetection" className="text-xs text-foreground cursor-pointer font-medium">
                          Anti-Detection
                        </Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="overwrite"
                          checked={config.overwrite}
                          onCheckedChange={(checked) => 
                            setConfig(prev => ({ ...prev, overwrite: !!checked }))
                          }
                        />
                        <Label htmlFor="overwrite" className="text-xs text-foreground cursor-pointer font-medium">
                          Overwrite Existing Results
                        </Label>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium text-foreground">Worker Threads</Label>
                        <span className="text-xs font-mono text-foreground bg-muted px-1.5 py-0.5 rounded-md shadow-sm">{config.workers}</span>
                      </div>
                      <Slider
                        value={[config.workers]}
                        onValueChange={([value]) => 
                          setConfig(prev => ({ ...prev, workers: value }))
                        }
                        max={8}
                        min={1}
                        step={1}
                        className="w-full slider-enhanced"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Action Button - Compact */}
              <div className="mt-auto">
                {isProcessing ? (
                  <div className="w-full max-w-xs mx-auto relative inline-block py-[1px] overflow-hidden rounded-[20px]">
                    <div className="relative z-1 border text-foreground text-center text-base py-3 px-6 rounded-[20px] bg-gradient-to-b from-background/90 to-muted/90 border-border/40 dark:from-background dark:to-muted dark:border-border font-medium">
                      <span className="animate-shimmer bg-gradient-to-r from-foreground via-foreground/50 to-foreground bg-[length:200%_100%] bg-clip-text text-transparent">
                        Processing...
                      </span>
                    </div>
                  </div>
                ) : (
                  <StarBorder 
                    onClick={handleProcess}
                    disabled={!domains.trim() || getValidDomains().length === 0}
                    className="w-full max-w-xs mx-auto font-medium transition-all duration-200 hover:scale-[1.02] disabled:hover:scale-100 disabled:opacity-50"
                    color="white"
                    speed="5s"
                    disableBorderAnimation={true}
                    size="compact"
                  >
                    {getValidDomains().length === 0 && domains.trim() ? (
                      <>
                        No Valid Domains
                      </>
                    ) : results.length > 0 ? (
                      <>
                        New Scan
                      </>
                    ) : (
                      <>
                        Start Scan
                      </>
                    )}
                  </StarBorder>
                )}
              </div>
            </div>

            {/* Results Section - Fades in from right */}
            <div className="lg:col-span-9 flex flex-col min-h-0 order-1 lg:order-2 transition-all duration-700 ease-in-out animate-fade-scale-in-right">
              <div className="bg-muted/20 rounded-xl border border-border/30 p-1 h-full flex flex-col shadow-sm">
                {isProcessing ? (
                  /* Loading State with Skeleton and Live Updates */
                  <div className="flex flex-col h-full space-y-3 p-3">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">
                          {streamingMode ? 'Processing Live...' : 'Processing...'}
                        </h3>
                        {streamingMode && (
                          <span className="text-xs text-muted-foreground">
                            {processedCount} of {totalCount} domains
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        {streamingMode ? (
                          <>
                            <div className="bg-card p-4 rounded-lg border border-border/40 shadow-sm hover:shadow-md transition-all duration-200">
                              <div className="text-2xl font-bold text-foreground">{streamingResults.length}</div>
                              <p className="text-xs text-muted-foreground">Total</p>
                            </div>
                            <div className="bg-card p-4 rounded-lg border border-border/40 shadow-sm hover:shadow-md transition-all duration-200">
                              <div className="text-2xl font-bold text-foreground">
                                {streamingResults.filter(r => r.classification_label === "Marketing").length}
                              </div>
                              <p className="text-xs text-muted-foreground">Marketing</p>
                            </div>
                            <div className="bg-card p-4 rounded-lg border border-border/40 shadow-sm hover:shadow-md transition-all duration-200">
                              <div className="text-2xl font-bold text-foreground">
                                {streamingResults.filter(r => r.classification_label === "Portal").length}
                              </div>
                              <p className="text-xs text-muted-foreground">Portal</p>
                            </div>
                            <div className="bg-card p-4 rounded-lg border border-border/40 shadow-sm hover:shadow-md transition-all duration-200">
                              <div className="text-2xl font-bold text-foreground">
                                {streamingResults.filter(r => r.classification_label === "Other").length}
                              </div>
                              <p className="text-xs text-muted-foreground">Other</p>
                            </div>
                            <div className="bg-card p-4 rounded-lg border border-border/40 shadow-sm hover:shadow-md transition-all duration-200">
                              <div className="text-2xl font-bold text-red-500">
                                {streamingResults.filter(r => r.classification_label === "Error").length}
                              </div>
                              <p className="text-xs text-muted-foreground">Errors</p>
                            </div>
                          </>
                        ) : (
                          <>
                            {['total', 'marketing', 'portal', 'other', 'errors'].map((stat) => (
                              <div key={stat} className="bg-card p-4 rounded-lg border border-border/40 shadow-sm">
                                <div className="h-8 bg-muted/50 rounded skeleton mb-2" />
                                <div className="h-3 bg-muted/30 rounded skeleton w-16" />
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col flex-1 min-h-0 space-y-3">
                      <div className="flex items-center justify-between py-2 border-b border-border/20">
                        <h3 className="text-sm font-semibold text-foreground">
                          {streamingMode ? 'Live Results' : 'Processing Domains...'}
                        </h3>
                        {streamingMode && (
                          <div className="text-xs text-muted-foreground">
                            Progress: {progress}%
                          </div>
                        )}
                      </div>
                      <div className="flex-1 border border-border/40 rounded-lg overflow-hidden bg-background min-h-0 shadow-sm">
                        {streamingMode && streamingResults.length > 0 ? (
                          /* Live Results Table */
                          <div className="h-full overflow-auto">
                            <Table>
                              <TableHeader>
                                <TableRow className="border-border/40 bg-muted/30 hover:bg-muted/30">
                                  <TableHead className="text-xs font-medium text-foreground h-7">
                                    Domain
                                  </TableHead>
                                  <TableHead className="text-xs font-medium text-foreground h-7">
                                    Classification
                                  </TableHead>
                                  <TableHead className="text-xs font-medium text-foreground h-7">
                                    Summary
                                  </TableHead>
                                  <TableHead className="text-xs font-medium text-foreground h-7 text-right">
                                    Confidence
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {streamingResults.map((result, index) => (
                                  <TableRow 
                                    key={`${result.domain}-${index}`}
                                    className="border-border/40 hover:bg-muted/20 transition-colors animate-fade-scale-in-up duration-300"
                                  >
                                    <TableCell className="font-mono text-xs text-foreground py-1.5">
                                      {result.domain}
                                    </TableCell>
                                    <TableCell className="py-1.5">
                                      <Badge 
                                        variant={
                                          result.classification_label === "Marketing" ? "outline" :
                                          result.classification_label === "Portal" ? "outline" :
                                          result.classification_label === "Error" ? "destructive" :
                                          "outline"
                                        }
                                        className="text-xs rounded-md"
                                      >
                                        {result.classification_label}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground py-1.5 max-w-xs truncate">
                                      {result.summary}
                                    </TableCell>
                                    <TableCell className="text-xs font-mono text-foreground py-1.5 text-right">
                                      {(result.confidence_level * 100).toFixed(1)}%
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ) : (
                          /* Skeleton Loading */
                          <div className="p-4">
                            <div className="space-y-3">
                              {parseDomains(domains).slice(0, 6).map((domain, index) => (
                                <div key={`skeleton-${domain}-${index}`} className="flex items-center space-x-4">
                                  <div className="h-4 bg-muted/50 rounded skeleton w-32" />
                                  <div className="h-6 bg-muted/50 rounded skeleton w-20" />
                                  <div className="h-4 bg-muted/30 rounded skeleton flex-1" />
                                  <div className="h-4 bg-muted/30 rounded skeleton w-12" />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : results.length > 0 ? (
                  <div className="flex flex-col h-full space-y-2 p-3 results-section">
                    {/* Enhanced Statistics Summary */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-foreground">Summary</h3>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                        <div className="bg-card p-4 rounded-lg border border-border/40 hover:bg-muted/50 transition-colors shadow-sm hover:shadow-md">
                          <div className="text-2xl font-bold text-foreground">{stats.total}</div>
                          <p className="text-xs text-muted-foreground">Total</p>
                        </div>
                        <div className="bg-card p-4 rounded-lg border border-border/40 hover:bg-muted/50 transition-colors shadow-sm hover:shadow-md">
                          <div className="text-2xl font-bold text-foreground">{stats.marketing}</div>
                          <p className="text-xs text-muted-foreground">Marketing</p>
                        </div>
                        <div className="bg-card p-4 rounded-lg border border-border/40 hover:bg-muted/50 transition-colors shadow-sm hover:shadow-md">
                          <div className="text-2xl font-bold text-foreground">{stats.portal}</div>
                          <p className="text-xs text-muted-foreground">Portal</p>
                        </div>
                        <div className="bg-card p-4 rounded-lg border border-border/40 hover:bg-muted/50 transition-colors shadow-sm hover:shadow-md">
                          <div className={`text-2xl font-bold ${stats.other > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>{stats.other}</div>
                          <p className="text-xs text-muted-foreground">Other</p>
                        </div>
                        <div className="bg-card p-4 rounded-lg border border-border/40 hover:bg-muted/50 transition-colors shadow-sm hover:shadow-md">
                          <div className={`text-2xl font-bold ${stats.errors > 0 ? 'text-red-500' : 'text-muted-foreground'}`}>{stats.errors}</div>
                          <p className="text-xs text-muted-foreground">Errors</p>
                        </div>
                      </div>
                    </div>

                    {/* Enhanced Results Table */}
                    <div className="flex flex-col flex-1 min-h-0 space-y-3">
                      {/* Enhanced Search & Export Header */}
                      <div className="flex items-center justify-between py-2 border-b border-border/20">
                        <h3 className="text-sm font-semibold text-foreground">Detailed Results</h3>
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                              placeholder="Search domains..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="pl-8 w-48 h-8 text-sm border-border/50 focus:border-accent focus:ring-1 focus:ring-accent bg-background rounded-md transition-colors hover:border-border"
                            />
                          </div>
                          <Button 
                            onClick={handleExport} 
                            variant="outline" 
                            size="sm"
                            className="h-8 text-sm px-3 border-border/50 hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors rounded-md"
                          >
                            <Download className="w-3.5 h-3.5 mr-1.5" />
                            Export CSV
                          </Button>
                        </div>                        </div>

                      <div className="flex-1 border border-border/40 rounded-lg overflow-hidden bg-background min-h-0 shadow-sm">
                        <div className="h-full overflow-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="border-border/40 bg-muted/30 hover:bg-muted/30">
                                <TableHead 
                                  className="text-xs font-medium text-foreground h-7 cursor-pointer hover:bg-muted/50 transition-colors"
                                  onClick={() => handleSort('domain')}
                                >
                                  <div className="flex items-center">
                                    Domain
                                    {getSortIcon('domain')}
                                  </div>
                                </TableHead>
                                <TableHead 
                                  className="text-xs font-medium text-foreground h-7 cursor-pointer hover:bg-muted/50 transition-colors"
                                  onClick={() => handleSort('classification_label')}
                                >
                                  <div className="flex items-center">
                                    Classification
                                    {getSortIcon('classification_label')}
                                  </div>
                                </TableHead>
                                <TableHead className="text-xs font-medium text-foreground h-7">
                                  Summary
                                </TableHead>
                                <TableHead 
                                  className="text-xs font-medium text-foreground h-7 text-right cursor-pointer hover:bg-muted/50 transition-colors"
                                  onClick={() => handleSort('confidence_level')}
                                >
                                  <div className="flex items-center justify-end">
                                    Confidence
                                    {getSortIcon('confidence_level')}
                                  </div>
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sortedResults.map((result, index) => (
                                <TableRow 
                                  key={`result-${result.domain}-${index}`} 
                                  className="border-border/40 hover:bg-muted/20 transition-colors"
                                >
                                  <TableCell className="font-mono text-xs text-foreground py-1.5">
                                    {result.domain}
                                  </TableCell>
                                  <TableCell className="py-1.5">
                                    <Badge 
                                      variant={
                                        result.classification_label === "Marketing" ? "outline" :
                                        result.classification_label === "Portal" ? "outline" :
                                        result.classification_label === "Error" ? "destructive" :
                                        "outline"
                                      }
                                      className="text-xs rounded-md"
                                    >
                                      {result.classification_label}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground py-1.5 max-w-xs">
                                    <div className="flex items-center space-x-2">
                                      <div className="truncate flex-1">
                                        {result.summary}
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 shrink-0 hover:bg-muted"
                                        onClick={() => setSelectedSummary({
                                          domain: result.domain,
                                          summary: result.summary,
                                          classification: result.classification_label,
                                          snippet: result.snippet || ''
                                        })}
                                      >
                                        <Eye className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs font-mono text-foreground py-1.5 text-right">
                                    {(result.confidence_level * 100).toFixed(1)}%
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Summary Dialog */}
      <Dialog open={!!selectedSummary} onOpenChange={() => setSelectedSummary(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <span>Details for {selectedSummary?.domain}</span>
              <Badge 
                variant={
                  selectedSummary?.classification === "Marketing" ? "outline" :
                  selectedSummary?.classification === "Portal" ? "outline" :
                  selectedSummary?.classification === "Error" ? "destructive" :
                  "outline"
                }
                className="text-xs"
              >
                {selectedSummary?.classification}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <h4 className="text-sm font-semibold mb-2">Summary</h4>
              <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap bg-muted/30 rounded-lg p-3">
                {selectedSummary?.summary}
              </div>
            </div>
            {selectedSummary?.snippet && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Content Snippet</h4>
                <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap bg-muted/30 rounded-lg p-3 font-mono">
                  {selectedSummary.snippet}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      <Toaster />
      </div>
    </TooltipProvider>
  );
}
