import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { 
  Settings, 
  Key, 
  ExternalLink, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  AlertCircle,
  Info
} from 'lucide-react';
import { Badge } from './ui/badge';
import {
  getUserOpenAIApiKey,
  setUserOpenAIApiKey,
  clearUserOpenAIApiKey,
  isUsingUserProvidedKey,
  hasSharedOpenAIKey,
} from '../utils/apiConfig';

interface OpenAISettingsProps {
  trigger?: React.ReactNode;
}

export function OpenAISettings({ trigger }: OpenAISettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [usingUserKey, setUsingUserKey] = useState(false);
  const [hasSharedKey, setHasSharedKey] = useState(false);

  useEffect(() => {
    // Load existing key when dialog opens
    if (isOpen) {
      const existingKey = getUserOpenAIApiKey();
      setApiKey(existingKey || '');
      setUsingUserKey(isUsingUserProvidedKey());
      setHasSharedKey(hasSharedOpenAIKey());
      setIsSaved(false);
    }
  }, [isOpen]);

  const handleSave = () => {
    setUserOpenAIApiKey(apiKey);
    setIsSaved(true);
    setUsingUserKey(isUsingUserProvidedKey());
    
    // Auto-close after short delay
    setTimeout(() => {
      setIsOpen(false);
    }, 1500);
  };

  const handleClear = () => {
    clearUserOpenAIApiKey();
    setApiKey('');
    setIsSaved(true);
    setUsingUserKey(false);
    
    // Auto-close after short delay
    setTimeout(() => {
      setIsOpen(false);
    }, 1500);
  };

  const isValidKey = apiKey.trim().startsWith('sk-');

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Settings className="w-4 h-4" />
            OpenAI Settings
            {usingUserKey && (
              <Badge variant="secondary" className="ml-1">
                Your Key
              </Badge>
            )}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            OpenAI API Configuration
          </DialogTitle>
          <DialogDescription>
            Configure your OpenAI API key for AI-powered location quality analysis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* API Key Status */}
          <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
            {usingUserKey ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium">Using your personal API key</span>
              </>
            ) : hasSharedKey ? (
              <>
                <Info className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium">Using shared API key</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-medium">No API key configured</span>
              </>
            )}
          </div>

          {/* API Key Input */}
          <div className="space-y-2">
            <Label htmlFor="apiKey">Your OpenAI API Key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="apiKey"
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showKey ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
            {apiKey && !isValidKey && (
              <p className="text-xs text-orange-600">
                API keys should start with "sk-"
              </p>
            )}
          </div>

          {/* Help Text */}
          <Alert>
            <Info className="w-4 h-4" />
            <AlertDescription className="text-sm">
              <div className="space-y-2">
                <p>
                  <strong>Why provide your own key?</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
                  <li>You control your OpenAI usage and billing</li>
                  <li>Your key stays in your browser (localStorage)</li>
                  <li>Fall back to shared key if not provided</li>
                </ul>
                <div className="pt-2">
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
                  >
                    Get your OpenAI API key
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </AlertDescription>
          </Alert>

          {/* Pricing Info */}
          <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950 p-3 rounded-md">
            <p className="font-medium mb-1">Expected Costs:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>GPT-4o: ~$0.01-0.02 per location analysis</li>
              <li>Most users spend less than $5/month</li>
            </ul>
          </div>

          {/* Success Message */}
          {isSaved && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Settings saved successfully!
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          {apiKey && (
            <Button
              variant="outline"
              onClick={handleClear}
              disabled={isSaved}
            >
              Clear Key
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={!apiKey || !isValidKey || isSaved}
          >
            {isSaved ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Saved
              </>
            ) : (
              'Save Key'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
