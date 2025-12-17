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
    description: "Unterstützung bei der Analyse und Optimierung von Geschäftsprozessen. Beratung unserer Kunden bei der digitalen Transformation und Implementierung effizienter Lösungen.",
    location: "100% Remote / Homeoffice",
    type: "Festanstellung",
    workModel: "Vollzeit",
    department: "Consulting",
    salary: "25-30 €/Std.",
    fullDescription: "Als Consultant Geschäftsoptimierung unterstützen Sie unsere Kunden bei der Analyse, Bewertung und Optimierung ihrer Geschäftsprozesse. Sie beraten bei der digitalen Transformation und helfen bei der Implementierung effizienter IT-Lösungen. Sie arbeiten eng mit verschiedenen Stakeholdern zusammen und bringen Ihre Expertise in spannende Projekte ein.",
    requirements: [
      "Abgeschlossenes Studium in Wirtschaftsinformatik, BWL oder vergleichbare Qualifikation",
      "Erfahrung in der Prozessanalyse und -optimierung",
      "Kenntnisse in ERP-Systemen und Digitalisierungsprojekten",
      "Analytisches Denkvermögen und strukturierte Arbeitsweise",
      "Sehr gute Deutsch- und Englischkenntnisse",
      "Kommunikationsstärke und Teamfähigkeit"
    ],
    benefits: [
      "100% Remote-Arbeit möglich",
      "Flexible Arbeitszeiten",
      "Moderne Arbeitsmittel",
      "Weiterbildungsmöglichkeiten",
      "Flache Hierarchien",
      "Teamevents (auch remote)"
    ],
    tasks: [
      "Analyse und Dokumentation von Geschäftsprozessen",
      "Entwicklung von Optimierungskonzepten",
      "Begleitung von Digitalisierungsprojekten",
      "Beratung und Schulung von Kunden",
      "Erstellung von Reports und Präsentationen"
    ]
  },
  {
    id: "assistenz-geschaeftsfuehrung",
    title: "Assistenz der Geschäftsführung / Sekretariat (w/m/d)",
    description: "Administrative Unterstützung der Geschäftsführung, Terminkoordination, Korrespondenz und Büroorganisation. Erste Anlaufstelle für interne und externe Anfragen.",
    location: "100% Remote / Homeoffice",
    type: "Festanstellung",
    workModel: "Vollzeit / Teilzeit",
    department: "Administration",
    salary: "25-30 €/Std.",
    fullDescription: "Als Assistenz der Geschäftsführung sind Sie die rechte Hand unseres Managements. Sie übernehmen vielfältige administrative Aufgaben, koordinieren Termine und Meetings, führen Korrespondenz und sind die erste Anlaufstelle für interne und externe Anfragen. Dank unserer modernen Remote-Infrastruktur können Sie diese Position vollständig aus dem Homeoffice ausüben.",
    requirements: [
      "Abgeschlossene kaufmännische Ausbildung oder vergleichbare Qualifikation",
      "Berufserfahrung im Assistenz- oder Sekretariatsbereich",
      "Sehr gute MS-Office-Kenntnisse",
      "Organisationstalent und Zuverlässigkeit",
      "Sehr gute Deutschkenntnisse in Wort und Schrift",
      "Diskretion und Vertrauenswürdigkeit"
    ],
    benefits: [
      "100% Remote-Arbeit möglich",
      "Flexible Arbeitszeiten",
      "Teilzeit ab 20 Stunden möglich",
      "Moderne digitale Tools",
      "Familiäres Arbeitsumfeld",
      "Langfristige Perspektive"
    ],
    tasks: [
      "Terminplanung und -koordination",
      "Korrespondenz und Kommunikation",
      "Vorbereitung von Meetings und Präsentationen",
      "Reiseplanung und -organisation",
      "Allgemeine administrative Tätigkeiten",
      "Dokumentenmanagement"
    ]
  },
  {
    id: "softwareentwickler-webentwicklung",
    title: "Softwareentwickler (w/m/d) - Webentwicklung",
    description: "Entwicklung von Webapplikationen mit modernen Technologien. Eigenverantwortliches Arbeiten nach DevOps-Prinzipien in einem agilen Team.",
    location: "100% Remote / Homeoffice",
    type: "Festanstellung",
    workModel: "Vollzeit",
    department: "IT & Entwicklung",
    salary: "25-30 €/Std.",
    fullDescription: "Als Softwareentwickler mit Fokus auf Webentwicklung gestalten Sie innovative Webapplikationen für unsere Kunden. Sie arbeiten mit modernen Technologien und Frameworks, setzen DevOps-Praktiken um und sind Teil eines agilen, remote-first Teams. Eigenverantwortliches Arbeiten und kontinuierliche Weiterentwicklung stehen bei uns im Mittelpunkt.",
    requirements: [
      "Abgeschlossenes Studium in Informatik oder vergleichbare Qualifikation",
      "Erfahrung in der Webentwicklung (Frontend und/oder Backend)",
      "Kenntnisse in modernen Frameworks (React, Vue, Angular, Node.js, etc.)",
      "Erfahrung mit Versionskontrolle (Git)",
      "Grundkenntnisse in DevOps und CI/CD",
      "Teamfähigkeit und selbstständige Arbeitsweise"
    ],
    benefits: [
      "100% Remote-Arbeit möglich",
      "Neueste Technologien und Tools",
      "Weiterbildungsbudget",
      "Flexible Arbeitszeiten",
      "Agile Arbeitsweise",
      "Hardware nach Wahl"
    ],
    tasks: [
      "Entwicklung von Webapplikationen",
      "Code Reviews und Qualitätssicherung",
      "Implementierung von APIs und Schnittstellen",
      "Wartung und Weiterentwicklung bestehender Systeme",
      "Technische Dokumentation",
      "Zusammenarbeit im agilen Team"
    ]
  }
];

export const getJobById = (id: string): Job | undefined => {
  return jobs.find(job => job.id === id);
};
