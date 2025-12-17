export interface Job {
  id: string;
  title: string;
  description: string;
  location: string;
  type: string;
  workModel: string;
  department: string;
  salary: string;
  fullDescription: string;
  requirements: string[];
  benefits: string[];
  tasks: string[];
}

export const jobs: Job[] = [
  {
    id: "consultant-geschaeftsoptimierung",
    title: "Consultant Geschäftsoptimierung (w/m/d)",
    description: "Unterstützung bei der Analyse und Optimierung von Geschäftsprozessen. Keine Vorkenntnisse erforderlich – wir bilden Sie aus!",
    location: "100% Remote / Homeoffice",
    type: "Festanstellung",
    workModel: "Teilzeit (25h/Woche)",
    department: "Consulting",
    salary: "25-30 €/Std.",
    fullDescription: "Als Consultant Geschäftsoptimierung unterstützen Sie unsere Kunden bei der Analyse, Bewertung und Optimierung ihrer Geschäftsprozesse. Keine Vorkenntnisse erforderlich – wir bilden Sie umfassend aus und begleiten Sie auf Ihrem Karriereweg. Quereinsteiger sind herzlich willkommen!",
    requirements: [
      "Keine formale Qualifikation erforderlich – Quereinsteiger willkommen!",
      "Interesse an Geschäftsprozessen und digitaler Transformation",
      "Lernbereitschaft und Motivation sich weiterzuentwickeln",
      "Gute Deutschkenntnisse in Wort und Schrift",
      "Kommunikationsfreude und Teamfähigkeit",
      "Selbstständige und strukturierte Arbeitsweise"
    ],
    benefits: [
      "100% Remote-Arbeit möglich",
      "Teilzeit 25 Stunden/Woche",
      "Umfassende Einarbeitung und Schulungen",
      "Moderne Arbeitsmittel werden gestellt",
      "Weiterbildungsmöglichkeiten",
      "Flache Hierarchien und offene Kommunikation"
    ],
    tasks: [
      "Analyse und Dokumentation von Geschäftsprozessen",
      "Mitarbeit an Optimierungskonzepten",
      "Unterstützung bei Digitalisierungsprojekten",
      "Kommunikation mit Kunden",
      "Erstellung von Reports und Präsentationen"
    ]
  },
  {
    id: "assistenz-geschaeftsfuehrung",
    title: "Assistenz der Geschäftsführung / Sekretariat (w/m/d)",
    description: "Administrative Unterstützung der Geschäftsführung, Terminkoordination und Büroorganisation. Quereinsteiger herzlich willkommen!",
    location: "100% Remote / Homeoffice",
    type: "Festanstellung",
    workModel: "Teilzeit (25h/Woche)",
    department: "Administration",
    salary: "18-20 €/Std.",
    fullDescription: "Als Assistenz der Geschäftsführung sind Sie die rechte Hand unseres Managements. Sie übernehmen vielfältige administrative Aufgaben, koordinieren Termine und Meetings, führen Korrespondenz und sind die erste Anlaufstelle für interne und externe Anfragen. Keine Vorkenntnisse nötig – wir arbeiten Sie ein!",
    requirements: [
      "Keine formale Qualifikation erforderlich – Quereinsteiger willkommen!",
      "Interesse an organisatorischen Aufgaben",
      "Grundlegende PC-Kenntnisse (MS Office lernen Sie bei uns)",
      "Gute Deutschkenntnisse in Wort und Schrift",
      "Zuverlässigkeit und Organisationstalent",
      "Diskretion und freundliches Auftreten"
    ],
    benefits: [
      "100% Remote-Arbeit möglich",
      "Teilzeit 25 Stunden/Woche",
      "Umfassende Einarbeitung",
      "Moderne digitale Tools werden bereitgestellt",
      "Familiäres Arbeitsumfeld",
      "Langfristige Perspektive"
    ],
    tasks: [
      "Terminplanung und -koordination",
      "E-Mail-Korrespondenz und Kommunikation",
      "Vorbereitung von Meetings und Unterlagen",
      "Allgemeine administrative Tätigkeiten",
      "Dokumentenmanagement",
      "Unterstützung des Teams bei verschiedenen Aufgaben"
    ]
  },
  {
    id: "softwareentwickler-webentwicklung",
    title: "Softwareentwickler (w/m/d) - Webentwicklung",
    description: "Entwicklung von Webapplikationen mit modernen Technologien. Quereinsteiger mit Begeisterung für Programmierung willkommen!",
    location: "100% Remote / Homeoffice",
    type: "Festanstellung",
    workModel: "Vollzeit",
    department: "IT & Entwicklung",
    salary: "25-30 €/Std.",
    fullDescription: "Als Softwareentwickler mit Fokus auf Webentwicklung gestalten Sie innovative Webapplikationen für unsere Kunden. Keine abgeschlossene Ausbildung notwendig – wenn Sie Begeisterung für Programmierung mitbringen und lernbereit sind, bringen wir Ihnen alles bei!",
    requirements: [
      "Keine formale Qualifikation erforderlich – Quereinsteiger willkommen!",
      "Interesse an Programmierung und Webentwicklung",
      "Erste Erfahrungen mit HTML/CSS/JavaScript von Vorteil, aber nicht Pflicht",
      "Lernbereitschaft und Eigeninitiative",
      "Teamfähigkeit und Kommunikationsfreude",
      "Selbstständige Arbeitsweise"
    ],
    benefits: [
      "100% Remote-Arbeit möglich",
      "Umfassende Schulung in modernen Technologien",
      "Neueste Hardware und Software werden gestellt",
      "Weiterbildungsbudget",
      "Flexible Arbeitszeiten",
      "Mentoring durch erfahrene Entwickler"
    ],
    tasks: [
      "Entwicklung von Webapplikationen unter Anleitung",
      "Lernen moderner Frameworks und Technologien",
      "Mitarbeit an spannenden Kundenprojekten",
      "Code Reviews und Qualitätssicherung",
      "Technische Dokumentation",
      "Zusammenarbeit im agilen Team"
    ]
  }
];

export const getJobById = (id: string): Job | undefined => {
  return jobs.find(job => job.id === id);
};
