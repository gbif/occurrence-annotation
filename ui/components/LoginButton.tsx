import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { LogIn, LogOut, User } from 'lucide-react';
import { toast } from 'sonner';

interface GBIFUser {
  userName: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export function LoginButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<GBIFUser | null>(null);

  // Load user from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('gbifUser');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        console.error('Error loading user:', error);
        localStorage.removeItem('gbifUser');
      }
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password) {
      toast.error('Please enter both username and password');
      return;
    }

    setIsLoading(true);

    try {
      // GBIF login endpoint expects Basic Auth
      const credentials = btoa(`${username}:${password}`);
      
      const response = await fetch('https://api.gbif.org/v1/user/login', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Invalid username or password');
        } else {
          toast.error('Login failed. Please try again.');
        }
        return;
      }

      const userData = await response.json();
      
      const userInfo: GBIFUser = {
        userName: userData.userName || username,
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
      };

      setUser(userInfo);
      localStorage.setItem('gbifUser', JSON.stringify(userInfo));
      localStorage.setItem('gbifAuth', credentials);
      
      toast.success(`Welcome, ${userInfo.firstName || userInfo.userName}!`);
      setIsOpen(false);
      setUsername('');
      setPassword('');
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Network error. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('gbifUser');
    localStorage.removeItem('gbifAuth');
    toast.success('Logged out successfully');
  };

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <Link to={`/user/${user.userName}`} className="no-underline">
          <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors cursor-pointer">
            <User className="w-4 h-4 text-green-700" />
            <div className="text-sm">
              <p className="text-green-900">
                {user.firstName && user.lastName 
                  ? `${user.firstName} ${user.lastName}` 
                  : user.userName}
              </p>
            </div>
          </div>
        </Link>
        <Button onClick={handleLogout} variant="outline" size="sm">
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <LogIn className="w-4 h-4 mr-2" />
          Login to GBIF
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Login to GBIF</DialogTitle>
          <DialogDescription>
            Enter your GBIF credentials to access your account
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              placeholder="Enter your GBIF username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              autoComplete="current-password"
            />
          </div>
          <div className="text-sm text-gray-600">
            <p>Don't have a GBIF account?</p>
            <a 
              href="https://www.gbif.org/user/profile" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-green-700 hover:underline"
            >
              Create one here →
            </a>
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

