import React, { useEffect, useState } from 'react';
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle, 
  DrawerClose,
  DrawerDescription
} from './ui/drawer';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Alert, AlertDescription } from './ui/alert';
import { 
  Loader2, 
  X, 
  AlertTriangle, 
  CheckCircle, 
  AlertCircle, 
  ExternalLink,
  Bot,
  RefreshCw
} from 'lucide-react';
import { evaluateLocationQuality, LocationQualityReport, isOpenAIConfigured } from '../utils/openaiService';

interface LocationQualityPanelProps {
  gbifid: number | null;
  onClose: () => void;
}

export function LocationQualityPanel({ gbifid, onClose }: LocationQualityPanelProps) {
  const [report, setReport] = useState<LocationQualityReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load report when gbifid changes
  useEffect(() => {
    if (gbifid) {
      loadReport(gbifid);
    } else {
      // Reset state when gbifid is null
      setReport(null);
      setError(null);
      setIsLoading(false);
    }
  }, [gbifid]);

  const loadReport = async (id: number) => {
    setIsLoading(true);
    setError(null);
    setReport(null);

    try {
      // Check if OpenAI is configured
      if (!isOpenAIConfigured()) {
        setError('OpenAI API key is not configured. Please set VITE_OPENAI_API_KEY in your .env file.');
        setIsLoading(false);
        return;
      }

      const result = await evaluateLocationQuality(id);
      setReport(result);
    } catch (err) {
      console.error('Error loading location quality report:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    if (gbifid) {
      loadReport(gbifid);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'medium':
        return <AlertCircle className="w-5 h-5 text-orange-500" />;
      case 'low':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      default:
        return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, "destructive" | "default" | "secondary" | "outline"> = {
      high: 'destructive',
      medium: 'default',
      low: 'secondary',
      none: 'outline',
    };
    
    return (
      <Badge variant={variants[severity] || 'outline'} className="ml-2">
        {severity.toUpperCase()}
      </Badge>
    );
  };

  return (
    <Drawer open={!!gbifid} onOpenChange={(open) => !open && onClose()} direction="right">
      <DrawerContent className="data-[vaul-drawer-direction=right]:w-2/5 data-[vaul-drawer-direction=right]:max-w-2xl">
        <DrawerHeader className="border-b">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-6 h-6 text-blue-600" />
              <div>
                <DrawerTitle>AI Location Quality Check</DrawerTitle>
                <DrawerDescription>
                  GBIF Occurrence ID: {gbifid}
                </DrawerDescription>
              </div>
            </div>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon">
                <X className="w-5 h-5" />
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>

        <ScrollArea className="flex-1 p-6">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
              <p className="text-sm text-muted-foreground">
                Analyzing location quality with AI...
              </p>
              <p className="text-xs text-muted-foreground">
                This may take 10-30 seconds
              </p>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                <div className="font-medium mb-2">Error loading report</div>
                <div className="text-sm">{error}</div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleRetry}
                  className="mt-3"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {report && !isLoading && (
            <div className="space-y-4">
              {/* Status Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getSeverityIcon(report.severity)}
                      <CardTitle className="text-lg">
                        {report.suspicious ? 'Issues Detected' : 'Location Appears Valid'}
                      </CardTitle>
                      {getSeverityBadge(report.severity)}
                    </div>
                  </div>
                  <CardDescription className="mt-2">
                    {report.summary}
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* Issues */}
              {report.issues.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                      Identified Issues
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {report.issues.map((issue, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <span className="text-orange-500 mt-0.5">•</span>
                          <span>{issue}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Recommendations */}
              {report.recommendations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-500" />
                      Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {report.recommendations.map((rec, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <span className="text-blue-500 mt-0.5">•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* View on GBIF */}
              <Card>
                <CardContent className="pt-6">
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => window.open(`https://www.gbif.org/occurrence/${gbifid}`, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View Full Record on GBIF
                  </Button>
                </CardContent>
              </Card>

              {/* Disclaimer */}
              <Alert>
                <Bot className="w-4 h-4" />
                <AlertDescription className="text-xs">
                  This assessment is generated by AI and should be used as a guide only. 
                  Always verify findings with domain expertise and additional data sources.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}
