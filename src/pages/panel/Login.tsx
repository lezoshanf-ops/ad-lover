import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Lock, Mail, User, ArrowRight } from 'lucide-react';
import logo from '@/assets/logo.png';

export default function PanelLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: 'Fehler',
        description: 'Bitte E-Mail und Passwort eingeben.',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    const { error } = await signIn(email, password);
    setIsLoading(false);

    if (error) {
      toast({
        title: 'Anmeldung fehlgeschlagen',
        description: 'Ungültige E-Mail oder Passwort.',
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Erfolgreich angemeldet',
        description: 'Willkommen im Team-Panel!'
      });
      navigate('/panel');
    }
  };

  return (
    <div className="min-h-screen flex animate-fade-in">
      {/* Left side - Dark panel with branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-sidebar relative overflow-hidden animate-[fade-in_0.5s_ease-out]">
        <div className="absolute inset-0 bg-gradient-to-br from-sidebar via-sidebar to-sidebar/80" />
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          <div className="max-w-md">
            <h1 className="text-4xl xl:text-5xl font-bold text-sidebar-foreground leading-tight mb-6 animate-[fade-in_0.6s_ease-out_0.1s_both]">
              Willkommen zurück bei<br />
              <span className="text-primary">Fritze IT</span>
            </h1>
            <p className="text-lg text-sidebar-foreground/70 leading-relaxed mb-8 animate-[fade-in_0.6s_ease-out_0.2s_both]">
              Melden Sie sich an, um auf Ihr Mitarbeiter-Dashboard zuzugreifen und Ihre Aufgaben zu verwalten.
            </p>
            
            <div className="mt-12 p-6 bg-sidebar-accent/30 rounded-xl border border-sidebar-border animate-[fade-in_0.6s_ease-out_0.3s_both]">
              <p className="text-xl font-semibold text-sidebar-foreground mb-2">
                Einfach. Effizient. Zuverlässig.
              </p>
              <p className="text-sidebar-foreground/60">
                Unser Mitarbeiter-Portal bietet Ihnen alle Tools, die Sie für Ihre tägliche Arbeit benötigen.
              </p>
            </div>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-sidebar-accent/20 to-transparent" />
        <div className="absolute top-20 right-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl animate-[fade-in_1s_ease-out_0.5s_both]" />
        <div className="absolute bottom-40 right-20 w-48 h-48 bg-primary/5 rounded-full blur-3xl animate-[fade-in_1s_ease-out_0.7s_both]" />
      </div>
      
      {/* Right side - Login form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-card animate-[fade-in_0.5s_ease-out_0.2s_both]">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        
        <div className="w-full max-w-md animate-[fade-in_0.6s_ease-out_0.3s_both]">
          {/* Logo and title */}
          <div className="flex items-center gap-3 mb-8">
            <img 
              src={logo} 
              alt="Fritze IT" 
              className="h-10 w-auto" 
            />
            <span className="text-xl font-bold text-card-foreground">Fritze IT</span>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email field */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-card-foreground">
                E-Mail-Adresse
              </Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="test@test.de"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-12 h-12 text-base border-border bg-background text-foreground focus:border-primary"
                  autoComplete="email"
                />
              </div>
              <p className="text-xs text-muted-foreground">Passwörter verwalten</p>
            </div>
            
            {/* Password field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-card-foreground">
                Ihr Passwort
              </Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Ihr Passwort"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-12 h-12 text-base border-border bg-background text-foreground focus:border-primary"
                  autoComplete="current-password"
                />
              </div>
            </div>
            
            {/* Remember me & Forgot password */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="remember" 
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                />
                <Label htmlFor="remember" className="text-sm font-normal cursor-pointer text-card-foreground">
                  Angemeldet bleiben
                </Label>
              </div>
              <button 
                type="button"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Passwort vergessen?
              </button>
            </div>
            
            {/* Submit button */}
            <Button 
              type="submit" 
              className={`w-full h-12 text-base font-semibold gap-2 transition-all duration-300 ${
                isLoading 
                  ? 'animate-pulse scale-[0.98]' 
                  : 'hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]'
              }`}
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  <span>Anmelden...</span>
                </div>
              ) : (
                <>
                  <User className="h-5 w-5" />
                  Anmelden
                </>
              )}
            </Button>
            
            {/* Info notice */}
            <div className="bg-muted rounded-lg p-4 border border-border">
              <p className="text-sm text-muted-foreground text-center">
                <strong className="text-foreground">Hinweis:</strong> Der Zugang wird ausschließlich durch das Team per E-Mail vergeben. Bei Fragen wenden Sie sich bitte an Ihren Ansprechpartner.
              </p>
            </div>
            
            {/* Legal links */}
            <div className="pt-6 border-t border-border mt-6">
              <p className="text-xs text-muted-foreground text-center mb-2">Rechtliche Informationen</p>
              <div className="flex items-center justify-center gap-4 text-xs">
                <Link to="/impressum" className="text-muted-foreground hover:text-foreground transition-colors">
                  Impressum
                </Link>
                <Link to="/datenschutz" className="text-muted-foreground hover:text-foreground transition-colors">
                  Datenschutz
                </Link>
                <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                  AGB
                </button>
                <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                  Cookies
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
