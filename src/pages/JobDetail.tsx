import { useParams, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getJobById } from "@/data/jobs";
import { ArrowLeft, MapPin, Briefcase, Clock, Building2, Euro, Send, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";

const JobDetail = () => {
  const { id } = useParams<{ id: string }>();
  const job = id ? getJobById(id) : undefined;

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const subject = encodeURIComponent(`Bewerbung: ${job?.title || "Stelle"}`);
    const body = encodeURIComponent(
      `Name: ${formData.name}\nE-Mail: ${formData.email}\nTelefon: ${formData.phone}\n\nBewerbung für: ${job?.title}\n\nNachricht:\n${formData.message}`
    );
    
    window.location.href = `mailto:bewerbung@fritze-it.solutions?subject=${subject}&body=${body}`;
    
    toast.success("E-Mail-Programm wird geöffnet...");
    setIsSubmitting(false);
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
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Nachricht *
                      </label>
                      <textarea
                        required
                        rows={4}
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
                        placeholder="Ihre Bewerbungsnachricht..."
                      />
                    </div>

                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="flex items-start gap-2 text-muted-foreground text-xs">
                        <Upload className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <p>Bitte fügen Sie Ihren Lebenslauf als Anhang in der E-Mail hinzu.</p>
                      </div>
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Wird gesendet..." : "Bewerbung senden"}
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
