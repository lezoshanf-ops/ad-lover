import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { LogOut, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import logo from '@/assets/logo.png';

interface PanelLayoutProps {
  children: ReactNode;
  title: string;
}

export default function PanelLayout({ children, title }: PanelLayoutProps) {
  const { profile, role, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/panel/login');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={logo} alt="Fritze IT" className="h-10" />
            <div className="hidden sm:block">
              <h1 className="text-lg font-semibold">{title}</h1>
              <p className="text-xs text-muted-foreground capitalize">{role === 'admin' ? 'Administrator' : 'Mitarbeiter'}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>{profile?.first_name} {profile?.last_name}</span>
            </div>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={handleSignOut} title="Abmelden">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      
      <main className="container py-6">
        {children}
      </main>
    </div>
  );
}
