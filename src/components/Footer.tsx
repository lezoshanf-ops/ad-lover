import { Mail } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";

export const Footer = () => {
  return (
    <footer className="bg-foreground text-primary-foreground py-12">
      <div className="container">
        <div className="grid gap-8 md:grid-cols-4">
          {/* Logo & Description */}
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2.5 mb-4">
              <img src={logo} alt="Fritze IT-Systeme Logo" className="h-10 w-auto brightness-0 invert" />
            </Link>
            <p className="text-primary-foreground/70 text-sm max-w-md">
              Fritze IT GmbH – Ihr Partner für IT-Systeme, digitale Transformation 
              und Prozessoptimierung. Remote Work ist unsere DNA.
            </p>
            <div className="mt-4 text-sm text-primary-foreground/60">
              <p>Willi-Eichler-Straße 26</p>
              <p>37079 Göttingen</p>
              <p>Deutschland</p>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold mb-4">Schnellzugriff</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/70">
              <li><a href="/#jobs" className="hover:text-primary-foreground transition-colors">Stellenangebote</a></li>
              <li><a href="/#team" className="hover:text-primary-foreground transition-colors">Unser Team</a></li>
              <li><a href="/#benefits" className="hover:text-primary-foreground transition-colors">Benefits</a></li>
              <li><a href="/#contact" className="hover:text-primary-foreground transition-colors">Kontakt</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold mb-4">Kontakt</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/70">
              <li>info@fritze-it.solutions</li>
              <li>Göttingen, Deutschland</li>
            </ul>
            <div className="flex gap-3 mt-4">
              <a 
                href="mailto:info@fritze-it.solutions" 
                className="w-9 h-9 rounded-lg bg-primary-foreground/10 flex items-center justify-center hover:bg-primary-foreground/20 transition-colors"
              >
                <Mail className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-primary-foreground/10 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-primary-foreground/50">
          <p>© {new Date().getFullYear()} Fritze IT GmbH. Alle Rechte vorbehalten.</p>
          <div className="flex gap-6">
            <Link to="/impressum" className="hover:text-primary-foreground transition-colors">Impressum</Link>
            <Link to="/datenschutz" className="hover:text-primary-foreground transition-colors">Datenschutz</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
