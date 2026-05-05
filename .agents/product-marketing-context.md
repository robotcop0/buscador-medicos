# Product Marketing Context

*Last updated: 2026-05-05 — V1.1 (validado por owner, pre-launch)*

## Product Overview
**One-liner:** Buscador unificado de médicos por mutua, especialidad y código postal — todas las aseguradoras españolas en un solo sitio.
**What it does:** Cruza los cuadros médicos públicos de 15 mutuas españolas (Adeslas, Sanitas, DKV, Asisa, Mapfre, Cigna, Allianz, AXA, Caser, Divina Pastora, Fiatc, Generali, IMQ, MUFACE, Occidente) en una única búsqueda. Enriquece cada resultado con ratings y reseñas reales de Doctoralia y Google Maps, y permite filtrar por radio geográfico (2–100 km) desde un código postal. ~446k+ profesionales indexados de forma offline + queries live para mutuas con datos volátiles.
**Product category:** Buscador / comparador de profesionales sanitarios privados (alternativa a Doctoralia y a los buscadores propios de cada mutua).
**Product type:** Web app B2C, frontend público, sin login.
**Business model:** Sin monetizar todavía (pre-launch). Vía planteada a futuro: perfil destacado de pago para profesionales/clínicas (no implementado).

## Target Audience
**Target users:** Asegurados de mutuas privadas españolas (B2C) que necesitan un especialista cubierto por su póliza y no se fían (o no encuentran rápido lo que buscan) en el buscador propio de su aseguradora.
**Decision-makers:** El propio paciente o un familiar que busca por él.
**Primary use case:** "Tengo Adeslas, vivo en el 28015, necesito un cardiólogo bien valorado a menos de 10 km de casa."
**Jobs to be done:**
- Encontrar un médico cubierto por mi mutua sin abrir 5 webs distintas.
- Saber si ese médico es bueno antes de pedir cita (ratings + reseñas reales).
- Filtrar por cercanía real (radio en km), no por provincia entera.
**Use cases:**
- Cambio de mutua y necesito ver si "mis" médicos siguen estando dentro.
- Tengo MUFACE/ISFAS y quiero ver simultáneamente Adeslas + Asisa (régimen funcionarial cubierto por dos).
- Soy nuevo en una ciudad y no tengo referencias de nadie.
- Mi mutua me ha dado una lista de 80 nombres sin ningún criterio para elegir.

## Personas
*Producto B2C de baja fricción — un solo perfil principal:*

| Persona | Cares about | Challenge | Value we promise |
|---------|-------------|-----------|------------------|
| Asegurado pragmático (25–55, urbano) | Resolver rápido y bien sin perder tarde leyendo foros | El buscador de su mutua devuelve nombres sin contexto y sin ratings | Una lista ya ordenada por calidad y cercanía, con reseñas reales debajo |
| Cuidador familiar (40–65) | Encontrar especialista para padre/madre con confianza | No conoce el sistema, los buscadores de mutua son confusos | Resultado claro, con teléfono y rating, en 3 clics |

## Problems & Pain Points
**Core problem:** Los buscadores oficiales de las mutuas (a) son lentos y feos, (b) muestran cuadros médicos sin ratings ni reseñas, (c) no permiten radio en km real, (d) cada uno tiene su propia lógica e idioma. Resultado: el asegurado abre Google, busca el nombre del médico para ver reseñas y termina perdiendo 30+ minutos por cada cita.
**Why alternatives fall short:**
- **Buscadores propios de cada mutua:** sin ratings, UX dispar, 1 mutua = 1 web. Si dudas entre cambiar de mutua, no puedes comparar.
- **Doctoralia:** muestra médicos privados independientemente de tu mutua → puedes acabar agendando con alguien que NO te cubre la póliza.
- **Top Doctors:** curaduría con paywall, base pequeña y sesgada hacia "premium".
- **Google directamente:** rating sin contexto de mutua, sin filtro de especialidad clínica fina.
**What it costs them:** 20–60 min de búsqueda por cita + ansiedad de elegir a ciegas + riesgo de pagar privado por error.
**Emotional tension:** "¿Y si elijo mal? ¿Y si este médico es de los que despachan en 5 minutos? Pago la mutua para esto, y aun así me toca a mí investigar."

## Competitive Landscape
**Direct (mismo problema, misma solución):** Doctoralia España — base más grande pero NO filtra por mutua, mezcla privado y concertado. Top Doctors — curaduría sesgada a élite y de pago.
**Secondary (mismo problema, otra solución):** Buscadores propios de cada mutua (Adeslas, Sanitas, etc.) — datos oficiales pero UX pobre y sin ratings; obligan a saltar de web en web.
**Indirect (otra forma de resolverlo):** Pedir recomendación al médico de cabecera, foros (Forocoches, Reddit /r/spain), grupos de Facebook locales, recomendación familiar.

## Differentiation
**Key differentiators:**
- Cobertura cruzada: 15 mutuas en un solo formulario (nadie más lo hace).
- Ratings reales merge ponderado Doctoralia + Google Maps (no inventados, no mock).
- Filtro por radio km auténtico (no por provincia).
- Régimen MUFACE resuelto correctamente (Adeslas + Asisa simultáneo).
- Sin login, sin registro, sin paywall.
**How we do it differently:** Indexamos los cuadros médicos públicos legalmente expuestos (APIs públicas, scraping respetuoso) y los enriquecemos con ratings de fuentes públicas. Backend Next.js con merge inteligente offline + live por mutua según volatilidad.
**Why that's better:** El asegurado tarda 30 segundos en lugar de 30 minutos y elige con datos.
**Why customers choose us:** Es la única forma de comparar médicos cubiertos por TU mutua con ratings reales sin abrir 4 pestañas.

## Objections
| Objection | Response |
|-----------|----------|
| "¿Estos datos son oficiales?" | Sí, vienen directamente de los cuadros médicos públicos de cada aseguradora; los actualizamos con frecuencia. |
| "¿Y los ratings? ¿Son reales?" | Sí — Doctoralia (verificado) + Google Maps (centros). Mostramos número de reseñas para que veas la muestra. |
| "¿Cobráis por aparecer arriba?" | Hoy no — el orden es 100% por rating real (Doctoralia + Google) y cercanía. A futuro habrá perfiles destacados de pago, pero se mostrarán claramente etiquetados. |
| "¿Por qué no aparece mi médico?" | Mostramos lo que la mutua publica. Si tu mutua no lo lista, nosotros tampoco. |
| "¿Mis datos están seguros?" | No pedimos login, email ni datos personales. Solo CP. Nada se guarda. |

**Anti-persona:** Quien busca un médico privado pagando de su bolsillo (mejor Doctoralia). Quien busca mutua pública SS (no aplica). Quien quiere agendar cita en la app — no agendamos ni está en roadmap; nuestro CTA es el teléfono del centro.

## Switching Dynamics
**Push:** Frustración con el buscador de su mutua, 5 pestañas abiertas, ratings inventados o ausentes.
**Pull:** "Una sola caja con CP + mutua + especialidad y ya lo tengo ordenado por rating."
**Habit:** Llamar a la mutua por teléfono o usar siempre Doctoralia por inercia.
**Anxiety:** "¿Y si los datos están desactualizados y voy y no me atienden?" → mitigar con timestamp visible y teléfono directo.

## Customer Language
**How they describe the problem (verbatim):** Pendiente — owner no tiene transcripts/reseñas propias. Próximo paso: review-mining con `customer-research` sobre App Store de apps de mutuas, hilos Forocoches/Reddit r/spain, comentarios Trustpilot de cada aseguradora.
- Hipótesis a validar con review-mining: *"el buscador de Adeslas es una basura"*, *"no sé qué cardiólogo elegir"*, *"me han dado una lista enorme y ninguna referencia"*.
**How they describe us (verbatim):** Aún no aplicable — pre-launch sin tráfico. Capturar en cuanto haya primeros usuarios.
**Words to use:** mutua, cuadro médico, especialista, código postal, cerca de mí, mejor valorado, opiniones reales, reseñas, rating.
**Words to avoid:** "leads", "afiliados", "partners", "engine", "scraping", "API" — terminología técnica/marketing en una web orientada a paciente.
**Glossary:**
| Term | Meaning |
|------|---------|
| Mutua | Aseguradora privada de salud (Adeslas, Sanitas...) |
| Cuadro médico | Lista oficial de profesionales cubiertos por una mutua |
| MUFACE/ISFAS | Régimen funcionarial — el asegurado elige aseguradora privada cada año |
| Centro | Clínica, hospital, policlínico o ambulatorio (vs profesional individual) |

## Brand Voice
**Tone:** Sereno, directo, sin postureo médico ni adorno corporativo. La home actual ("Encuentra tu mejor médico" / "Búsqueda en tiempo real en toda España") ya marca la pauta.
**Style:** Frases cortas, lenguaje de paciente, no de informático ni de comercial.
**Personality:** Útil, calmado, fiable, transparente, sin urgencia comercial.

## Proof Points
**Metrics (verificables):**
- 15 mutuas integradas (más del doble que cualquier comparador competidor).
- ~446k profesionales indexados (Adeslas) + miles más en live de Sanitas/Cigna/DKV/Mapfre/etc.
- 33 especialidades.
- Ratings cruzados Doctoralia + Google Maps para centros.
- Filtro por radio real desde 2 a 100 km.
**Customers:** Pre-launch — sin clientes ni tráfico todavía.
**Testimonials:** Pre-launch — ninguno.
**Value themes:**
| Theme | Proof |
|-------|-------|
| Cobertura total | Las 15 grandes mutuas españolas en un formulario |
| Ratings reales | Doctoralia + Google Maps, no inventados |
| Búsqueda hiperlocal | Radio km exacto desde tu CP |
| Sin fricción | Sin login, sin email, sin paywall |

## Goals
**Business goal:** Pre-launch — objetivo de fase 1 es **conseguir tráfico orgánico SEO** que valide el producto antes de pensar monetización. Fase 2 (cuando haya tráfico): perfiles destacados de pago para profesionales/clínicas.
**Conversion action:** **Clic-a-teléfono** del médico/centro. Único KPI de éxito por sesión hoy.
**Current metrics:** 0 — pre-launch. Setup inicial recomendado: GA4 + tracking de evento `click_telefono` (ver `analytics-tracking` skill).
