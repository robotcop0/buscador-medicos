export type MutuaInfo = {
  slug: string;
  nombre: string;
  intro: string;
  hasOfflineData: boolean;
  cobertura?: string;
};

export const MUTUAS: MutuaInfo[] = [
  {
    slug: "adeslas",
    nombre: "Adeslas",
    intro:
      "SegurCaixa Adeslas dispone de cuadro médico privado de cobertura nacional, con red propia y centros concertados en toda España. Es una de las mayores redes de medicina privada del país.",
    hasOfflineData: true,
  },
  {
    slug: "allianz",
    nombre: "Allianz",
    intro:
      "Allianz Salud opera a través de la red Asisa con cuadro médico propio. Cubre las principales especialidades en todas las comunidades autónomas.",
    hasOfflineData: false,
  },
  {
    slug: "asisa",
    nombre: "Asisa",
    intro:
      "Asisa cuenta con cuadro médico propio compuesto por miles de profesionales y centros concertados, con presencia en toda España.",
    hasOfflineData: false,
  },
  {
    slug: "axa-salud",
    nombre: "AXA Salud",
    intro:
      "AXA Salud ofrece cuadro médico privado nacional con acceso directo a especialistas y a una red propia de hospitales y clínicas concertadas.",
    hasOfflineData: false,
  },
  {
    slug: "caser-salud",
    nombre: "Caser Salud",
    intro:
      "Caser Salud dispone de cuadro médico privado con cobertura en todas las provincias españolas y red de hospitales concertados.",
    hasOfflineData: false,
  },
  {
    slug: "cigna",
    nombre: "Cigna",
    intro:
      "Cigna España gestiona un cuadro médico privado con presencia en las principales ciudades, con énfasis en colectivos corporativos y atención internacional.",
    hasOfflineData: false,
  },
  {
    slug: "dkv",
    nombre: "DKV",
    intro:
      "DKV Seguros tiene cuadro médico privado en toda España, con red propia de hospitales (Hospital DKV) además de centros concertados.",
    hasOfflineData: false,
  },
  {
    slug: "divina-pastora",
    nombre: "Divina Pastora",
    intro:
      "Divina Seguros (Divina Pastora) ofrece cuadro médico privado con cobertura nacional, especialmente fuerte en la Comunidad Valenciana.",
    hasOfflineData: false,
  },
  {
    slug: "fiatc",
    nombre: "Fiatc",
    intro:
      "Fiatc dispone de cuadro médico privado con red propia y concertada, con mayor densidad de profesionales en Cataluña.",
    hasOfflineData: false,
  },
  {
    slug: "generali",
    nombre: "Generali",
    intro:
      "Generali Salud Premium opera con la red de cuadro médico de Sanitas en régimen co-branded, ofreciendo el mismo acceso a profesionales y centros.",
    hasOfflineData: false,
  },
  {
    slug: "imq",
    nombre: "IMQ",
    intro:
      "Igualatorio Médico Quirúrgico (IMQ) es la mutua histórica del País Vasco. Su cuadro médico cubre Bizkaia, Gipuzkoa, Araba, Cantabria y Burgos.",
    hasOfflineData: false,
    cobertura: "Bizkaia, Gipuzkoa, Araba, Cantabria y Burgos",
  },
  {
    slug: "mapfre",
    nombre: "Mapfre",
    intro:
      "Mapfre Salud cuenta con cuadro médico privado nacional con miles de profesionales y centros concertados en todas las comunidades.",
    hasOfflineData: false,
  },
  {
    slug: "muface",
    nombre: "MUFACE",
    intro:
      "MUFACE es el régimen mutual de los funcionarios civiles del Estado. El asegurado elige cada año entre Adeslas y Asisa para acceder a su cuadro médico privado.",
    hasOfflineData: false,
  },
  {
    slug: "occidente",
    nombre: "Occidente",
    intro:
      "Occidente Salud dispone de cuadro médico privado de cobertura nacional, con red de profesionales y centros concertados.",
    hasOfflineData: false,
  },
  {
    slug: "sanitas",
    nombre: "Sanitas",
    intro:
      "Sanitas mantiene una de las redes de medicina privada más grandes de España: cuadro médico propio, hospitales Sanitas y miles de profesionales concertados.",
    hasOfflineData: false,
  },
];

export type EspecialidadInfo = {
  slug: string;
  nombre: string;
  intro: string;
};

export const ESPECIALIDADES: EspecialidadInfo[] = [
  { slug: "alergologia", nombre: "Alergología", intro: "Diagnóstico y tratamiento de reacciones alérgicas: rinitis, asma alérgico, urticaria, alergias alimentarias y dermatitis atópica." },
  { slug: "andrologia", nombre: "Andrología", intro: "Salud sexual y reproductiva masculina: disfunción eréctil, infertilidad, andropausia y patología del aparato genital masculino." },
  { slug: "aparato-digestivo", nombre: "Aparato digestivo", intro: "Diagnóstico y tratamiento de enfermedades del aparato digestivo: estómago, hígado, intestino, páncreas y vía biliar. Incluye endoscopias y colonoscopias." },
  { slug: "cardiologia", nombre: "Cardiología", intro: "Especialidad médica del corazón y del aparato circulatorio. Incluye electrocardiogramas, ecocardiografías, pruebas de esfuerzo y seguimiento de patología cardiaca crónica." },
  { slug: "cirugia-general", nombre: "Cirugía general", intro: "Cirugía del aparato digestivo y de la pared abdominal: hernias, vesícula, apendicitis, tiroides, mama y cirugía oncológica básica." },
  { slug: "cirugia-plastica", nombre: "Cirugía plástica", intro: "Cirugía reconstructiva y estética: cirugía mamaria, rinoplastia, blefaroplastia, cirugía post-bariátrica y reconstrucción tras traumatismo o cáncer." },
  { slug: "dermatologia", nombre: "Dermatología", intro: "Diagnóstico y tratamiento de enfermedades de la piel, pelo y uñas: lunares, acné, psoriasis, dermatitis y lesiones cutáneas. Revisión de melanoma." },
  { slug: "endocrinologia", nombre: "Endocrinología", intro: "Especialidad de las glándulas y hormonas: diabetes, tiroides, obesidad, trastornos del crecimiento y enfermedades metabólicas." },
  { slug: "fisioterapia", nombre: "Fisioterapia", intro: "Tratamiento de lesiones musculoesqueléticas, rehabilitación tras cirugía, fisioterapia respiratoria, suelo pélvico y deportiva." },
  { slug: "ginecologia", nombre: "Ginecología", intro: "Salud de la mujer: revisión ginecológica, citología, ecografía pélvica, control de embarazo, anticoncepción y menopausia." },
  { slug: "hematologia", nombre: "Hematología", intro: "Diagnóstico y tratamiento de enfermedades de la sangre: anemias, alteraciones de la coagulación, leucemias y linfomas." },
  { slug: "logopedia", nombre: "Logopedia", intro: "Trastornos del lenguaje, habla, voz, deglución y comunicación: retrasos del habla en niños, afasia, disfagia y rehabilitación tras ictus." },
  { slug: "medicina-de-urgencias", nombre: "Medicina de urgencias", intro: "Atención de patología aguda en consulta: cuadros febriles, traumatismos leves, dolor abdominal, infecciones y atención médica sin cita previa." },
  { slug: "medicina-estetica", nombre: "Medicina estética", intro: "Tratamientos no quirúrgicos: toxina botulínica, ácido hialurónico, peelings, mesoterapia, láser y rejuvenecimiento facial." },
  { slug: "medicina-general", nombre: "Medicina general", intro: "Médico de cabecera privado: revisión general, primera valoración, prescripción de pruebas y derivación a especialistas." },
  { slug: "medicina-interna", nombre: "Medicina interna", intro: "Medicina del adulto en su conjunto: diagnóstico de cuadros complejos, segunda opinión, paciente pluripatológico y chequeos completos." },
  { slug: "nefrologia", nombre: "Nefrología", intro: "Especialidad del riñón: insuficiencia renal, hipertensión, alteraciones del equilibrio hidroelectrolítico y seguimiento de paciente trasplantado." },
  { slug: "neumologia", nombre: "Neumología", intro: "Enfermedades respiratorias: asma, EPOC, apnea del sueño, neumonía, tabaquismo y pruebas funcionales respiratorias." },
  { slug: "neurocirugia", nombre: "Neurocirugía", intro: "Cirugía del sistema nervioso central y periférico: hernia discal, tumores cerebrales, cirugía de columna y nervios periféricos." },
  { slug: "neurologia", nombre: "Neurología", intro: "Enfermedades del sistema nervioso: cefalea, migraña, ictus, epilepsia, esclerosis múltiple, párkinson y deterioro cognitivo." },
  { slug: "nutricion-y-dietetica", nombre: "Nutrición y dietética", intro: "Planes nutricionales personalizados, sobrepeso, trastornos de conducta alimentaria, intolerancias y nutrición deportiva." },
  { slug: "odontologia", nombre: "Odontología", intro: "Salud bucodental: revisión, limpieza, ortodoncia, endodoncia, implantes y odontopediatría." },
  { slug: "oftalmologia", nombre: "Oftalmología", intro: "Salud visual: revisión ocular, glaucoma, cataratas, cirugía refractiva, retina y revisiones pediátricas." },
  { slug: "oncologia", nombre: "Oncología", intro: "Diagnóstico y tratamiento del cáncer: oncología médica, seguimiento oncológico y tratamiento sistémico." },
  { slug: "otorrinolaringologia", nombre: "Otorrinolaringología", intro: "Patología de oído, nariz y garganta: hipoacusia, sinusitis, vértigo, ronquido, amigdalitis y revisión auditiva." },
  { slug: "pediatria", nombre: "Pediatría", intro: "Salud infantil de 0 a 14 años: control del niño sano, vacunación, fiebre, dermatología pediátrica y desarrollo." },
  { slug: "podologia", nombre: "Podología", intro: "Patología del pie: callosidades, uña encarnada, juanete, pie diabético, plantillas personalizadas y biomecánica." },
  { slug: "psicologia", nombre: "Psicología", intro: "Apoyo psicológico para ansiedad, depresión, trauma, terapia de pareja, dificultades infantojuveniles y crecimiento personal." },
  { slug: "psiquiatria", nombre: "Psiquiatría", intro: "Diagnóstico y tratamiento médico de trastornos mentales: depresión, trastornos de ansiedad, bipolar, TDAH adulto y trastornos psicóticos." },
  { slug: "rehabilitacion", nombre: "Rehabilitación", intro: "Recuperación funcional tras cirugía, ictus, fracturas o patología crónica: terapia física, ocupacional y manejo del dolor." },
  { slug: "reumatologia", nombre: "Reumatología", intro: "Enfermedades del aparato locomotor: artritis, artrosis, fibromialgia, lupus, osteoporosis y enfermedades autoinmunes." },
  { slug: "traumatologia", nombre: "Traumatología", intro: "Cirugía ortopédica y traumatología: fracturas, lesiones deportivas, prótesis de cadera y rodilla, cirugía de mano y de columna." },
  { slug: "urologia", nombre: "Urología", intro: "Aparato urinario y genital masculino: próstata, cálculos, infecciones urinarias, vasectomía y cáncer urológico." },
];

export function findMutuaBySlug(slug: string): MutuaInfo | undefined {
  return MUTUAS.find((m) => m.slug === slug);
}

export function findEspecialidadBySlug(slug: string): EspecialidadInfo | undefined {
  return ESPECIALIDADES.find((e) => e.slug === slug);
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
