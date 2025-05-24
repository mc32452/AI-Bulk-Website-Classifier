"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { 
  Play, 
  Download, 
  Settings, 
  Globe, 
  Activity, 
  BarChart3,
  Search,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  Eye,
  Moon,
  Sun
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
      variant="outline"
      size="icon"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
    >
      {theme === "light" ? (
        <Moon className="h-4 w-4" />
      ) : (
        <Sun className="h-4 w-4" />
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

      toast({
        title: "Processing complete",
        description: `Successfully processed ${domainList.length} domains.`
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

  const stats = {
    total: results.length,
    marketing: results.filter(r => r.classification_label === "Marketing").length,
    portal: results.filter(r => r.classification_label === "Portal").length,
    other: results.filter(r => r.classification_label === "Other").length,
    errors: results.filter(r => r.classification_label === "Error").length
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Add status bar with theme toggle */}
      <div className="bg-muted/50 p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Bulk Website Classifier</h1>
          <div className="flex items-center space-x-4">
            <ThemeToggle />
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${healthStatus.backend ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm text-muted-foreground">
                Backend: {healthStatus.backend ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            {healthStatus.lastChecked && (
              <span className="text-xs text-muted-foreground">
                Last checked: {healthStatus.lastChecked.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
        <p className="text-muted-foreground mt-2">
          Classify websites as Marketing, Portal, or Other using AI-powered analysis
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Input & Configuration */}
        <div className="lg:col-span-1 space-y-6">
          {/* Domain Input */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Input Domains
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="domains">Domains (one per line)</Label>
                <Textarea
                  id="domains"
                  placeholder="example.com&#10;google.com&#10;openai.com"
                  value={domains}
                  onChange={(e) => setDomains(e.target.value)}
                  className="min-h-[150px] font-mono text-sm"
                />
              </div>
              {domains && (
                <div className="text-sm text-muted-foreground">
                  {parseDomains(domains).length} domains ready to process
                </div>
              )}
            </CardContent>
          </Card>

          {/* Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Text Extraction Method</Label>
                <Select 
                  value={config.method} 
                  onValueChange={(value: "HTML" | "OCR") => 
                    setConfig(prev => ({ ...prev, method: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HTML">HTML Parsing</SelectItem>
                    <SelectItem value="OCR">OCR (Screenshots)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="headless"
                  checked={config.headless}
                  onCheckedChange={(checked) => 
                    setConfig(prev => ({ ...prev, headless: !!checked }))
                  }
                />
                <Label htmlFor="headless">Headless Mode</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="antiDetection"
                  checked={config.antiDetection}
                  onCheckedChange={(checked) => 
                    setConfig(prev => ({ ...prev, antiDetection: !!checked }))
                  }
                />
                <Label htmlFor="antiDetection">Anti-Detection</Label>
              </div>

              <div className="space-y-2">
                <Label>Worker Threads: {config.workers}</Label>
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

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="overwrite"
                  checked={config.overwrite}
                  onCheckedChange={(checked) => 
                    setConfig(prev => ({ ...prev, overwrite: !!checked }))
                  }
                />
                <Label htmlFor="overwrite">Overwrite Existing Results</Label>
              </div>
            </CardContent>
          </Card>

          {/* Process Button */}
          <Button 
            onClick={handleProcess}
            disabled={!domains.trim() || isProcessing}
            className="w-full"
            size="lg"
          >
            {isProcessing ? (
              <>
                <Activity className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Start Classification
              </>
            )}
          </Button>

          {isProcessing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}
        </div>

        {/* Right Column - Results */}
        <div className="lg:col-span-2 space-y-6">
          {results.length > 0 && (
            <>
              {/* Statistics */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{stats.total}</div>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-blue-600">{stats.marketing}</div>
                    <p className="text-xs text-muted-foreground">Marketing</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-green-600">{stats.portal}</div>
                    <p className="text-xs text-muted-foreground">Portal</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-gray-600">{stats.other}</div>
                    <p className="text-xs text-muted-foreground">Other</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-red-600">{stats.errors}</div>
                    <p className="text-xs text-muted-foreground">Errors</p>
                  </CardContent>
                </Card>
              </div>

              {/* Results Table */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      Results
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search domains..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-8 w-64"
                        />
                      </div>
                      <Button onClick={handleExport} variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-2" />
                        Export CSV
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Domain</TableHead>
                          <TableHead>Classification</TableHead>
                          <TableHead>Summary</TableHead>
                          <TableHead>Confidence</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredResults.map((result) => (
                          <TableRow key={result.domain}>
                            <TableCell className="font-medium">
                              {result.domain}
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={
                                  result.classification_label === "Marketing" ? "default" :
                                  result.classification_label === "Portal" ? "secondary" :
                                  result.classification_label === "Error" ? "destructive" :
                                  "outline"
                                }
                              >
                                {result.classification_label}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              {result.summary}
                            </TableCell>
                            <TableCell>
                              {(result.confidence_level * 100).toFixed(1)}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {results.length === 0 && !isProcessing && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No results yet. Enter domains and start classification to see results here.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
