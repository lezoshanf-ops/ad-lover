import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  FileText, CheckCircle2, XCircle, Clock, User, Download, 
  Eye, Calendar, AlertCircle, RefreshCw, Search, FileCheck, 
  FileX, Filter
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Input } from '@/components/ui/input';

interface KycDocument {
  id: string;
  user_id: string;
  task_id: string | null;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number | null;
  document_type: string | null;
  uploaded_at: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
  profile?: {
    first_name: string;
    last_name: string;
    email: string;
  };
  task?: {
    title: string;
    customer_name: string;
  };
}

const documentTypeLabels: Record<string, string> = {
  'documentation': 'Dokumentation',
  'id_card': 'Personalausweis',
  'passport': 'Reisepass',
  'contract': 'Vertrag',
  'certificate': 'Zertifikat',
  'task_document': 'Auftragsdokument',
  'letter': 'Brief',
  'other': 'Sonstiges',
};

export default function AdminKycView() {
  const [documents, setDocuments] = useState<KycDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDocument, setSelectedDocument] = useState<KycDocument | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('pending');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setLoading(true);
    
    // Fetch all documents with user profiles and task info
    const { data: docs, error } = await supabase
      .from('documents')
      .select('*')
      .order('uploaded_at', { ascending: false });

    if (error) {
      toast({ title: 'Fehler', description: 'Dokumente konnten nicht geladen werden.', variant: 'destructive' });
      setLoading(false);
      return;
    }

    if (docs) {
      // Fetch profiles for all users
      const userIds = [...new Set(docs.map(d => d.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .in('user_id', userIds);

      // Fetch tasks for documents with task_id
      const taskIds = docs.filter(d => d.task_id).map(d => d.task_id) as string[];
      const { data: tasks } = taskIds.length > 0 
        ? await supabase
            .from('tasks')
            .select('id, title, customer_name')
            .in('id', taskIds)
        : { data: [] };

      const enrichedDocs = docs.map(doc => ({
        ...doc,
        status: (doc.status || 'pending') as 'pending' | 'approved' | 'rejected',
        profile: profiles?.find(p => p.user_id === doc.user_id),
        task: tasks?.find(t => t.id === doc.task_id),
      }));

      setDocuments(enrichedDocs as KycDocument[]);
    }
    
    setLoading(false);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchDocuments();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handlePreview = async (doc: KycDocument) => {
    setSelectedDocument(doc);
    
    // Get signed URL for preview
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.file_path, 3600);

    if (data && !error) {
      setPreviewUrl(data.signedUrl);
    }
  };

  const handleDownload = async (doc: KycDocument) => {
    try {
      const { data, error } = await supabase.storage.from('documents').download(doc.file_path);
      if (error) throw error;
      if (data) {
        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.file_name;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      toast({ title: 'Fehler', description: 'Download fehlgeschlagen.', variant: 'destructive' });
    }
  };

  const handleApprove = async (doc: KycDocument) => {
    // Update document status in database
    const { error: updateError } = await supabase
      .from('documents')
      .update({ 
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: (await supabase.auth.getUser()).data.user?.id,
        review_notes: reviewNotes || null
      })
      .eq('id', doc.id);

    if (updateError) {
      toast({ title: 'Fehler', description: 'Genehmigung fehlgeschlagen.', variant: 'destructive' });
      return;
    }

    // Create notification for the user
    await supabase.from('notifications').insert({
      user_id: doc.user_id,
      title: 'Dokument genehmigt',
      message: `Dein Dokument "${doc.file_name}" wurde genehmigt.${reviewNotes ? ` Anmerkung: ${reviewNotes}` : ''}`,
      type: 'document_approved',
    });

    toast({ title: 'Erfolg', description: 'Dokument wurde genehmigt und Mitarbeiter benachrichtigt.' });
    setSelectedDocument(null);
    setReviewNotes('');
    setPreviewUrl(null);
    fetchDocuments();
  };

  const handleReject = async (doc: KycDocument) => {
    if (!reviewNotes.trim()) {
      toast({ title: 'Hinweis', description: 'Bitte gib einen Ablehnungsgrund an.', variant: 'destructive' });
      return;
    }

    // Update document status in database
    const { error: updateError } = await supabase
      .from('documents')
      .update({ 
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: (await supabase.auth.getUser()).data.user?.id,
        review_notes: reviewNotes
      })
      .eq('id', doc.id);

    if (updateError) {
      toast({ title: 'Fehler', description: 'Ablehnung fehlgeschlagen.', variant: 'destructive' });
      return;
    }

    // Create notification for the user
    await supabase.from('notifications').insert({
      user_id: doc.user_id,
      title: 'Dokument abgelehnt',
      message: `Dein Dokument "${doc.file_name}" wurde abgelehnt. Grund: ${reviewNotes}`,
      type: 'document_rejected',
    });

    toast({ title: 'Erfolg', description: 'Dokument wurde abgelehnt und Mitarbeiter benachrichtigt.' });
    setSelectedDocument(null);
    setReviewNotes('');
    setPreviewUrl(null);
    fetchDocuments();
  };

  // Filter documents based on status and type
  const pendingDocuments = documents.filter(d => d.status === 'pending');
  const approvedDocuments = documents.filter(d => d.status === 'approved');
  const rejectedDocuments = documents.filter(d => d.status === 'rejected');
  const kycDocuments = documents.filter(d => 
    ['id_card', 'passport', 'certificate', 'contract'].includes(d.document_type || '')
  );

  const filterBySearch = (docs: KycDocument[]) => {
    if (!searchQuery) return docs;
    const q = searchQuery.toLowerCase();
    return docs.filter(d => 
      d.file_name.toLowerCase().includes(q) ||
      d.profile?.first_name.toLowerCase().includes(q) ||
      d.profile?.last_name.toLowerCase().includes(q) ||
      d.task?.title.toLowerCase().includes(q)
    );
  };

  const getDocumentsByTab = () => {
    switch (activeTab) {
      case 'pending':
        return filterBySearch(pendingDocuments);
      case 'approved':
        return filterBySearch(approvedDocuments);
      case 'rejected':
        return filterBySearch(rejectedDocuments);
      case 'kyc':
        return filterBySearch(kycDocuments);
      default:
        return filterBySearch(documents);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30">Genehmigt</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30">Abgelehnt</Badge>;
      default:
        return <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30">Ausstehend</Badge>;
    }
  };

  const renderDocumentCard = (doc: KycDocument) => (
    <Card key={doc.id} className="overflow-hidden hover:shadow-lg transition-all group">
      <CardContent className="p-0">
        {/* Header with document type badge */}
        <div className="p-4 bg-gradient-to-r from-muted/50 to-transparent border-b">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold line-clamp-1">{doc.file_name}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {documentTypeLabels[doc.document_type || 'other']}
                  </Badge>
                  {doc.file_size && (
                    <span className="text-xs text-muted-foreground">
                      {(doc.file_size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Employee info */}
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                {doc.profile?.first_name} {doc.profile?.last_name}
              </span>
            </div>
            {statusBadge(doc.status)}
          </div>

          {doc.task && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileCheck className="h-4 w-4" />
              <span>Auftrag: {doc.task.title}</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            {format(new Date(doc.uploaded_at), 'dd.MM.yyyy HH:mm', { locale: de })}
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 pt-0 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-2"
            onClick={() => handlePreview(doc)}
          >
            <Eye className="h-4 w-4" />
            Prüfen
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => handleDownload(doc)}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">KYC-Prüfung</h2>
          <p className="text-muted-foreground">
            Eingereichte Dokumente prüfen und genehmigen
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-48"
            />
          </div>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Aktualisieren
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{documents.length}</p>
                <p className="text-xs text-muted-foreground">Gesamt</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <FileCheck className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{kycDocuments.length}</p>
                <p className="text-xs text-muted-foreground">KYC-Dokumente</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{approvedDocuments.length}</p>
                <p className="text-xs text-muted-foreground">Genehmigt</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{rejectedDocuments.length}</p>
                <p className="text-xs text-muted-foreground">Abgelehnt</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Document Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            Ausstehend ({pendingDocuments.length})
          </TabsTrigger>
          <TabsTrigger value="approved" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Genehmigt
          </TabsTrigger>
          <TabsTrigger value="rejected" className="gap-2">
            <XCircle className="h-4 w-4" />
            Abgelehnt
          </TabsTrigger>
          <TabsTrigger value="kyc" className="gap-2">
            <FileCheck className="h-4 w-4" />
            KYC
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {getDocumentsByTab().length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                  <AlertCircle className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Keine Dokumente</h3>
                <p className="text-muted-foreground">
                  Es wurden noch keine Dokumente in dieser Kategorie eingereicht.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {getDocumentsByTab().map(renderDocumentCard)}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Document Preview Dialog */}
      <Dialog open={!!selectedDocument} onOpenChange={(open) => {
        if (!open) {
          setSelectedDocument(null);
          setPreviewUrl(null);
          setReviewNotes('');
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Dokument prüfen
            </DialogTitle>
            <DialogDescription>
              {selectedDocument?.file_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Document info */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground">Mitarbeiter</p>
                <p className="font-medium">
                  {selectedDocument?.profile?.first_name} {selectedDocument?.profile?.last_name}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Dokumentenart</p>
                <p className="font-medium">
                  {documentTypeLabels[selectedDocument?.document_type || 'other']}
                </p>
              </div>
              {selectedDocument?.task && (
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Zugehöriger Auftrag</p>
                  <p className="font-medium">{selectedDocument.task.title}</p>
                </div>
              )}
            </div>

            {/* Preview */}
            {previewUrl && (
              <div className="rounded-lg border overflow-hidden bg-muted/30 h-96">
                {selectedDocument?.file_type.startsWith('image/') ? (
                  <img
                    src={previewUrl}
                    alt={selectedDocument.file_name}
                    className="w-full h-full object-contain"
                  />
                ) : selectedDocument?.file_type === 'application/pdf' ? (
                  <iframe
                    src={previewUrl}
                    className="w-full h-full"
                    title={selectedDocument.file_name}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                      <FileText className="h-12 w-12 mx-auto mb-2" />
                      <p>Vorschau nicht verfügbar</p>
                      <Button
                        variant="outline"
                        className="mt-3 gap-2"
                        onClick={() => selectedDocument && handleDownload(selectedDocument)}
                      >
                        <Download className="h-4 w-4" />
                        Herunterladen
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Review notes */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Anmerkungen (bei Ablehnung erforderlich)</label>
              <Textarea
                placeholder="Anmerkungen zur Prüfung..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                className="min-h-[80px]"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => {
                  setSelectedDocument(null);
                  setPreviewUrl(null);
                  setReviewNotes('');
                }}
              >
                Schließen
              </Button>
              <Button
                variant="destructive"
                className="gap-2"
                onClick={() => selectedDocument && handleReject(selectedDocument)}
              >
                <XCircle className="h-4 w-4" />
                Ablehnen
              </Button>
              <Button
                className="gap-2"
                onClick={() => selectedDocument && handleApprove(selectedDocument)}
              >
                <CheckCircle2 className="h-4 w-4" />
                Genehmigen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
