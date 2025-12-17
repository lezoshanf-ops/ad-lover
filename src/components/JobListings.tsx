import { JobCard } from "@/components/JobCard";
import { Search } from "lucide-react";
import { jobs } from "@/data/jobs";

export const JobListings = () => {
  return (
    <section id="jobs" className="py-20 bg-muted/30">
      <div className="container">
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-4 animate-fade-up">
          <span className="inline-block text-sm font-semibold text-primary bg-primary/10 px-4 py-1.5 rounded-full">
            Offene Stellen
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            Finde deinen Traumjob
          </h2>
          <p className="text-muted-foreground">
            Arbeite flexibel von zu Hause oder im Büro – entdecke unsere aktuellen Stellenangebote
          </p>
        </div>

        {/* Remote Work Banner */}
        <div className="max-w-3xl mx-auto mb-10 p-6 rounded-2xl bg-gradient-to-r from-secondary/10 to-accent/10 border border-secondary/20 animate-fade-up">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">🏠</span>
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Remote-First Unternehmen</h3>
              <p className="text-sm text-muted-foreground">Die meisten unserer Positionen sind zu 100% im Homeoffice möglich – wir bieten maximale Flexibilität.</p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="max-w-xl mx-auto mb-12 animate-fade-up" style={{ animationDelay: "100ms" }}>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Suche nach Position, Standort..."
              className="w-full h-12 pl-12 pr-4 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* Job Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job, index) => (
            <JobCard
              key={job.id}
              id={job.id}
              title={job.title}
              description={job.description}
              location={job.location}
              type={job.type}
              workModel={job.workModel}
              department={job.department}
              salary={job.salary}
              delay={200 + index * 100}
            />
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-12 animate-fade-up" style={{ animationDelay: "500ms" }}>
          <p className="text-muted-foreground mb-4">
            Keine passende Stelle gefunden?
          </p>
          <a
            href="#contact"
            className="text-primary font-semibold hover:underline"
          >
            Initiativbewerbung senden →
          </a>
        </div>
      </div>
    </section>
  );
};
