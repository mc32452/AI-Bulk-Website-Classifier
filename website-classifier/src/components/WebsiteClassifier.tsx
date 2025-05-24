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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { 
  Play, 
  Download, 
  Activity, 
  Search,
  FileText,
  Moon,
  Sun,
  Settings,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Globe,
  AlertCircle,
  HelpCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye
} from "lucide-react";
import { useTheme } from "next-themes";

interface ClassificationResult {
  domain: string;
  classification_label: string;
  summary: string;
  confidence_level: number;
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
  const [domains, setDomains] = useState("google.com\namazon.com\ngithub.com\nopenai.com\nstackoverflow.com");
  const [results, setResults] = useState<ClassificationResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState<ProcessingConfig>({
    method: "HTML",
    headless: true,
    antiDetection: false,
    workers: 4,
    overwrite: false
  });
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

  // Auto-collapse configuration when results are shown
  useEffect(() => {
    if (results.length > 0 && showConfig) {
      setShowConfig(false);
    }
  }, [results.length]); // Remove showConfig from dependency array

  const parseDomains = (text: string): string[] => {
    return text.trim().split('\n').filter(line => line.trim()).map(line => line.trim());
  };

  const handleProcess = async () => {
    const domainList = parseDomains(domains);
    
    if (domainList.length === 0) {
      toast({
        title: "No domains provided",
        description: "Please enter at least one domain to process.",
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

    setIsProcessing(true);
    setProgress(0);
    setResults([]); // Clear previous results
    
    try {
      const response = await fetch('/api/process', {
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
        const errorData = await response.json();
        throw new Error(errorData.error || 'Processing failed');
      }

      const data = await response.json();
      setResults(data.results);
      setProgress(100);

      // Use detailed statistics from backend response
      const totalProcessed = data.total_processed || 0;
      const skipped = data.skipped || 0;
      
      // Create detailed success message
      let title = "Scan complete!";
      let description = "";
      
      if (totalProcessed > 0 && skipped > 0) {
        description = `${totalProcessed} new scan${totalProcessed !== 1 ? 's' : ''}, ${skipped} already in database`;
      } else if (totalProcessed > 0) {
        description = `${totalProcessed} new scan${totalProcessed !== 1 ? 's' : ''} completed`;
      } else if (skipped > 0) {
        description = `${skipped} domain${skipped !== 1 ? 's' : ''} already in database`;
      } else {
        description = `Successfully processed ${domainList.length} domain${domainList.length !== 1 ? 's' : ''}`;
      }

      toast({
        title: title,
        description: description
      });
    } catch (error) {
      console.error('Processing error:', error);
      toast({
        title: "Processing failed", 
        description: error instanceof Error ? error.message : "An error occurred while processing domains.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = () => {
    const csv = [
      ["Domain", "Classification", "Summary", "Confidence"],
      ...results.map(r => [r.domain, r.classification_label, r.summary, r.confidence_level.toFixed(2)])
    ].map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `website_classification_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
    <div className="min-h-screen bg-background">
      {/* Simplified Status Bar */}
      <div className="border-b border-border/40 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-1.5 h-1.5 rounded-full ${healthStatus.backend ? 'bg-accent' : 'bg-destructive'}`} />
              <span className="text-xs text-muted-foreground">
                Backend: {healthStatus.backend ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Main Content Area with compact spacing */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-3">
        {/* Compact Header */}
        <div className="mb-4">
          <h1 className="text-xl md:text-2xl font-semibold text-foreground mb-1">
            Website Classifier
          </h1>
        </div>

        {/* Main Grid Layout: Fixed height to prevent scrolling */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 h-[calc(100vh-10rem)]">
          {/* Input Section - Compact spacing */}
          <div className="lg:col-span-3 flex flex-col space-y-3 order-2 lg:order-1">
            
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
                placeholder="example.com&#10;google.com&#10;openai.com"
                value={domains}
                onChange={(e) => setDomains(e.target.value)}
                className="min-h-[70px] font-mono text-sm resize-none border-border/50 focus:border-accent focus:ring-1 focus:ring-accent rounded-md transition-colors hover:border-border"
              />
              {domains && (
                <p className="text-xs text-neutral-500 ml-0">
                  {parseDomains(domains).length} domain{parseDomains(domains).length !== 1 ? 's' : ''} {results.length > 0 ? 'configured' : 'ready to process'}
                </p>
              )}
            </div>

            {/* Collapsible Configuration Section */}
            <div className="space-y-2">
              <Button
                variant="outline"
                onClick={() => setShowConfig(!showConfig)}
                className="w-full justify-between h-8 px-3 text-xs border-border/50 hover:bg-secondary/60 hover:border-border transition-colors rounded-md"
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
                <div className="space-y-2 p-3 bg-muted/40 rounded-md border border-border/40">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-foreground">Text Extraction Method</Label>
                    <Select
                      value={config.method} 
                      onValueChange={(value: "HTML" | "OCR") => 
                        setConfig(prev => ({ ...prev, method: value }))
                      }
                    >
                      <SelectTrigger className="h-7 text-xs border-border/50 focus:border-accent focus:ring-1 focus:ring-accent hover:border-border transition-colors rounded-md">
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
                        checked={config.headless}
                        onCheckedChange={(checked) => 
                          setConfig(prev => ({ ...prev, headless: !!checked }))
                        }
                        className="border-border/50 data-[state=checked]:bg-accent data-[state=checked]:border-accent rounded-sm transition-colors hover:border-border"
                      />
                      <Label htmlFor="headless" className="text-xs text-foreground cursor-pointer">
                        Headless Mode
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="antiDetection"
                        checked={config.antiDetection}
                        onCheckedChange={(checked) => 
                          setConfig(prev => ({ ...prev, antiDetection: !!checked }))
                        }
                        className="border-border/50 data-[state=checked]:bg-accent data-[state=checked]:border-accent rounded-sm transition-colors hover:border-border"
                      />
                      <Label htmlFor="antiDetection" className="text-xs text-foreground cursor-pointer">
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
                        className="border-border/50 data-[state=checked]:bg-accent data-[state=checked]:border-accent rounded-sm transition-colors hover:border-border"
                      />
                      <Label htmlFor="overwrite" className="text-xs text-foreground cursor-pointer">
                        Overwrite Existing Results
                      </Label>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium text-foreground">Worker Threads</Label>
                      <span className="text-xs font-mono text-foreground bg-muted px-1.5 py-0.5 rounded">{config.workers}</span>
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
              <Button 
                onClick={handleProcess}
                disabled={!domains.trim() || isProcessing}
                className="w-full max-w-xs mx-auto bg-green-600 hover:bg-green-700 text-white font-medium transition-all duration-200 hover:scale-[1.02] disabled:hover:scale-100 rounded-md"
                size="default"
              >
                {isProcessing ? (
                  <>
                    <Activity className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : results.length > 0 ? (
                  <>
                    <Activity className="w-4 h-4 mr-2" />
                    Re-classify Domains
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Start Classification
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Results Section - Compact design */}
          <div className="lg:col-span-9 flex flex-col min-h-0 order-1 lg:order-2">
            <div className="bg-muted/20 rounded-lg border border-border/30 p-1 h-full flex flex-col">
              {isProcessing ? (
                /* Loading State with Skeleton */
                <div className="flex flex-col h-full space-y-3 p-3">
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">Processing...</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {['total', 'marketing', 'portal', 'other', 'errors'].map((stat) => (
                        <div key={stat} className="bg-card p-4 rounded-md border border-border/40">
                          <div className="h-8 bg-muted/50 rounded skeleton mb-2"></div>
                          <div className="h-3 bg-muted/30 rounded skeleton w-16"></div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col flex-1 min-h-0 space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-border/20">
                      <h3 className="text-sm font-semibold text-foreground">Processing Domains...</h3>
                    </div>
                    <div className="flex-1 border border-border/40 rounded-md overflow-hidden bg-background min-h-0 p-4">
                      <div className="space-y-3">
                        {parseDomains(domains).slice(0, 6).map((domain) => (
                          <div key={domain} className="flex items-center space-x-4">
                            <div className="h-4 bg-muted/50 rounded skeleton w-32"></div>
                            <div className="h-6 bg-muted/50 rounded skeleton w-20"></div>
                            <div className="h-4 bg-muted/30 rounded skeleton flex-1"></div>
                            <div className="h-4 bg-muted/30 rounded skeleton w-12"></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : results.length > 0 ? (
                <div className="flex flex-col h-full space-y-2 p-3 results-section">
                  {/* Enhanced Statistics Summary */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">Summary</h3>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                      <div className="bg-card p-4 rounded-md border border-border/40 hover:bg-muted/50 transition-colors">
                        <div className="text-2xl font-bold text-foreground">{stats.total}</div>
                        <p className="text-xs text-muted-foreground">Total</p>
                      </div>
                      <div className="bg-card p-4 rounded-md border border-border/40 hover:bg-muted/50 transition-colors">
                        <div className="text-2xl font-bold text-foreground">{stats.marketing}</div>
                        <p className="text-xs text-muted-foreground">Marketing</p>
                      </div>
                      <div className="bg-card p-4 rounded-md border border-border/40 hover:bg-muted/50 transition-colors">
                        <div className="text-2xl font-bold text-foreground">{stats.portal}</div>
                        <p className="text-xs text-muted-foreground">Portal</p>
                      </div>
                      <div className="bg-card p-4 rounded-md border border-border/40 hover:bg-muted/50 transition-colors">
                        <div className={`text-2xl font-bold ${stats.other > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>{stats.other}</div>
                        <p className="text-xs text-muted-foreground">Other</p>
                      </div>
                      <div className="bg-card p-4 rounded-md border border-border/40 hover:bg-muted/50 transition-colors">
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
                      </div>
                    </div>

                    <div className="flex-1 border border-border/40 rounded-md overflow-hidden bg-background min-h-0">
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
                                key={result.domain} 
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
                                        classification: result.classification_label
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
              ) : (
                /* Enhanced Empty State */
                <div className="flex items-center justify-center h-full">
                  <div className="text-center space-y-4 max-w-md">
                    <div className="space-y-2">
                      <div className="mx-auto w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center">
                        <FileText className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <p className="text-lg font-medium text-foreground">No results yet</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Add domains and start classification to see detailed results.
                      </p>
                    </div>
                    {domains.trim() && (
                      <div className="text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded-md">
                        Ready to process {parseDomains(domains).length} domain{parseDomains(domains).length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Summary Dialog */}
      <Dialog open={!!selectedSummary} onOpenChange={() => setSelectedSummary(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <span>Summary for {selectedSummary?.domain}</span>
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
            <DialogDescription className="text-left leading-relaxed whitespace-pre-wrap">
              {selectedSummary?.summary}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
      
      <Toaster />
    </div>
  );
}
