import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Profile, UserRole, AppRole } from '@/types/panel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, User, Mail, Shield, Trash2 } from 'lucide-react';

interface UserWithRole extends Profile {
  role: AppRole;
}

export default function AdminUsersView() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'employee' as AppRole
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data: profiles } = await supabase.from('profiles').select('*');
    const { data: roles } = await supabase.from('user_roles').select('*');

    if (profiles && roles) {
      const usersWithRoles = profiles.map(profile => {
        const userRole = roles.find(r => r.user_id === profile.user_id);
        return {
          ...profile,
          role: (userRole?.role || 'employee') as AppRole
        } as UserWithRole;
      });
      setUsers(usersWithRoles);
    }
  };

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.password || !newUser.first_name || !newUser.last_name) {
      toast({ title: 'Fehler', description: 'Alle Felder sind Pflichtfelder.', variant: 'destructive' });
      return;
    }

    if (newUser.password.length < 6) {
      toast({ title: 'Fehler', description: 'Passwort muss mindestens 6 Zeichen lang sein.', variant: 'destructive' });
      return;
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: newUser.email,
      password: newUser.password,
      options: {
        emailRedirectTo: `${window.location.origin}/panel`,
        data: {
          first_name: newUser.first_name,
          last_name: newUser.last_name
        }
      }
    });

    if (authError || !authData.user) {
      toast({ title: 'Fehler', description: authError?.message || 'Benutzer konnte nicht erstellt werden.', variant: 'destructive' });
      return;
    }

    // Create profile
    const { error: profileError } = await supabase.from('profiles').insert({
      user_id: authData.user.id,
      email: newUser.email,
      first_name: newUser.first_name,
      last_name: newUser.last_name
    });

    if (profileError) {
      toast({ title: 'Warnung', description: 'Profil konnte nicht erstellt werden.', variant: 'destructive' });
    }

    // Create role
    const { error: roleError } = await supabase.from('user_roles').insert({
      user_id: authData.user.id,
      role: newUser.role
    });

    if (roleError) {
      toast({ title: 'Warnung', description: 'Rolle konnte nicht zugewiesen werden.', variant: 'destructive' });
    }

    toast({ title: 'Erfolg', description: 'Benutzer wurde erstellt.' });
    setIsDialogOpen(false);
    setNewUser({ email: '', password: '', first_name: '', last_name: '', role: 'employee' });
    fetchUsers();
  };

  const handleDeleteUser = async (userId: string) => {
    // Note: Deleting auth users requires admin privileges or edge function
    const { error } = await supabase.from('profiles').delete().eq('user_id', userId);
    
    if (error) {
      toast({ title: 'Fehler', description: 'Benutzer konnte nicht gelöscht werden.', variant: 'destructive' });
    } else {
      toast({ title: 'Erfolg', description: 'Benutzer wurde gelöscht.' });
      fetchUsers();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Benutzerverwaltung</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Neuer Benutzer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Neuen Benutzer erstellen</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Vorname *</Label>
                  <Input value={newUser.first_name} onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })} placeholder="Max" />
                </div>
                <div className="space-y-2">
                  <Label>Nachname *</Label>
                  <Input value={newUser.last_name} onChange={(e) => setNewUser({ ...newUser, last_name: e.target.value })} placeholder="Mustermann" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>E-Mail *</Label>
                <Input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="email@beispiel.de" />
              </div>
              <div className="space-y-2">
                <Label>Passwort *</Label>
                <Input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="Mindestens 6 Zeichen" />
              </div>
              <div className="space-y-2">
                <Label>Rolle</Label>
                <Select value={newUser.role} onValueChange={(v) => setNewUser({ ...newUser, role: v as AppRole })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Mitarbeiter</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreateUser} className="w-full">Benutzer erstellen</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {users.map((user) => (
          <Card key={user.id} className="shadow-card">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5" />
                  {user.first_name} {user.last_name}
                </CardTitle>
                <Badge className={user.role === 'admin' ? 'bg-primary/20 text-primary' : 'bg-blue-500/20 text-blue-700 dark:text-blue-400'}>
                  <Shield className="h-3 w-3 mr-1" />
                  {user.role === 'admin' ? 'Admin' : 'Mitarbeiter'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                {user.email}
              </div>
              <div className="mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDeleteUser(user.user_id)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Löschen
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
