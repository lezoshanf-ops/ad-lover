import { useParams, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getJobById } from "@/data/jobs";
import { ArrowLeft, MapPin, Briefcase, Clock, Building2, Euro, Send, Upload, Calendar, Wallet, FileText, Loader2, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const JobDetail = () => {
  const { id } = useParams<{ id: string }>();
  const job = id ? getJobById(id) : undefined;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    startDate: "",
    salaryExpectation: "",
    experience: "",
    message: "",
  });
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Die Datei ist zu groß. Maximal 10 MB erlaubt.");
        return;
      }
      // Validate file type
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        toast.error("Bitte laden Sie eine PDF- oder Word-Datei hoch.");
        return;
      }
      setResumeFile(file);
      toast.success(`Lebenslauf "${file.name}" ausgewählt`);
    }
  };

  const handleRemoveFile = () => {
    setResumeFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Convert file to base64 if present
      let resumeBase64: string | undefined;
      let resumeFileName: string | undefined;
      let resumeContentType: string | undefined;

      if (resumeFile) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            // Remove data URL prefix to get pure base64
            const base64 = result.split(',')[1];
            resolve(base64);
          };
          reader.onerror = reject;
        });
        reader.readAsDataURL(resumeFile);
        resumeBase64 = await base64Promise;
        resumeFileName = resumeFile.name;
        resumeContentType = resumeFile.type;
      }

      // Send application via edge function
      const { data, error } = await supabase.functions.invoke('send-application', {
        body: {
          name: formData.name,
          email: formData.email,
          phone: formData.phone || undefined,
          startDate: formData.startDate,
          salaryExpectation: formData.salaryExpectation || undefined,
          experience: formData.experience || undefined,
          message: formData.message,
          jobTitle: job?.title || "Stelle",
          resumeBase64,
          resumeFileName,
          resumeContentType,
        },
      });

      if (error) {
        throw error;
      }

      toast.success("Bewerbung erfolgreich gesendet! Sie erhalten eine Bestätigungs-E-Mail.");
      
      // Reset form
      setFormData({
        name: "",
        email: "",
        phone: "",
        startDate: "",
        salaryExpectation: "",
        experience: "",
        message: "",
      });
      setResumeFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Error sending application:", error);
      toast.error("Fehler beim Senden der Bewerbung. Bitte versuchen Sie es erneut.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!job) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="py-20">
          <div className="container text-center">
            <h1 className="text-2xl font-bold text-foreground mb-4">Stelle nicht gefunden</h1>
            <Link to="/#jobs" className="text-primary hover:underline">
              Zurück zu allen Stellen
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="py-12 md:py-20">
        <div className="container">
          <Link 
            to="/#jobs" 
            className="inline-flex items-center gap-2 text-primary hover:underline mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Zurück zu allen Stellen
          </Link>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Job Details */}
            <div className="lg:col-span-2 space-y-8">
              <div className="bg-card rounded-2xl p-6 md:p-8 shadow-soft">
                <div className="flex flex-wrap gap-3 mb-4">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 px-3 py-1.5 rounded-full">
                    <Building2 className="w-3.5 h-3.5" />
                    {job.department}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-secondary bg-secondary/10 px-3 py-1.5 rounded-full">
                    <Euro className="w-3.5 h-3.5" />
                    {job.salary}
                  </span>
                </div>

                <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                  {job.title}
                </h1>

                <div className="flex flex-wrap gap-4 mb-6">
                  <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    {job.location}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Briefcase className="w-4 h-4" />
                    {job.type}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    {job.workModel}
                  </span>
                </div>

                <p className="text-muted-foreground leading-relaxed">
                  {job.fullDescription}
                </p>

                {/* Quereinsteiger Banner */}
                <div className="mt-6 bg-primary/10 rounded-xl p-4 border border-primary/20">
                  <p className="text-sm font-medium text-primary">
                    ✨ Quereinsteiger herzlich willkommen! Keine Vorkenntnisse erforderlich – wir bilden Sie aus.
                  </p>
                </div>
              </div>

              <div className="bg-card rounded-2xl p-6 md:p-8 shadow-soft">
                <h2 className="text-xl font-bold text-foreground mb-4">Ihre Aufgaben</h2>
                <ul className="space-y-3">
                  {job.tasks.map((task, index) => (
                    <li key={index} className="flex items-start gap-3 text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                      {task}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-card rounded-2xl p-6 md:p-8 shadow-soft">
                <h2 className="text-xl font-bold text-foreground mb-4">Ihr Profil</h2>
                <ul className="space-y-3">
                  {job.requirements.map((req, index) => (
                    <li key={index} className="flex items-start gap-3 text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                      {req}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-card rounded-2xl p-6 md:p-8 shadow-soft">
                <h2 className="text-xl font-bold text-foreground mb-4">Wir bieten</h2>
                <ul className="space-y-3">
                  {job.benefits.map((benefit, index) => (
                    <li key={index} className="flex items-start gap-3 text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary mt-2 flex-shrink-0" />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Application Form */}
            <div className="lg:col-span-1">
              <div className="sticky top-24">
                <form onSubmit={handleSubmit} className="bg-card rounded-2xl p-6 shadow-soft">
                  <h3 className="font-bold text-foreground mb-6 flex items-center gap-2">
                    <Send className="w-5 h-5 text-primary" />
                    Jetzt bewerben
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full h-11 px-4 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                        placeholder="Max Mustermann"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        E-Mail *
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full h-11 px-4 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                        placeholder="max@beispiel.de"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Telefon
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full h-11 px-4 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                        placeholder="+49 123 456789"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-primary" />
                        Gewünschter Starttermin *
                      </label>
                      <input
                        type="date"
                        required
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        className="w-full h-11 px-4 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-muted-foreground" />
                        Gehaltsvorstellung (optional)
                      </label>
                      <input
                        type="text"
                        value={formData.salaryExpectation}
                        onChange={(e) => setFormData({ ...formData, salaryExpectation: e.target.value })}
                        className="w-full h-11 px-4 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                        placeholder="z.B. 25-30 €/Std."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        Vorerfahrungen (optional)
                      </label>
                      <textarea
                        rows={2}
                        value={formData.experience}
                        onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                        className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
                        placeholder="Kurze Beschreibung Ihrer bisherigen Erfahrungen..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Nachricht *
                      </label>
                      <textarea
                        required
                        rows={3}
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
                        placeholder="Ihre Bewerbungsnachricht..."
                      />
                    </div>

                    {/* Resume Upload */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                        <Upload className="w-4 h-4 text-primary" />
                        Lebenslauf hochladen
                      </label>
                      
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={handleFileChange}
                        className="hidden"
                        id="resume-upload"
                      />
                      
                      {resumeFile ? (
                        <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
                          <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{resumeFile.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(resumeFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleRemoveFile}
                            className="p-1 hover:bg-primary/20 rounded-full transition-colors"
                          >
                            <X className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </div>
                      ) : (
                        <label
                          htmlFor="resume-upload"
                          className="flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                        >
                          <Upload className="w-8 h-8 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground text-center">
                            Klicken oder Datei hierher ziehen
                          </span>
                          <span className="text-xs text-muted-foreground">
                            PDF oder Word (max. 10 MB)
                          </span>
                        </label>
                      )}
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Wird gesendet...
                        </>
                      ) : (
                        "Bewerbung senden"
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default JobDetail;