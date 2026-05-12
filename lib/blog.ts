import type { ComponentType } from "react";

export type BlogPost = {
  slug: string;
  /** Título del artículo (también el <h1> y el <title>). */
  title: string;
  /** Meta description + texto del OG. */
  description: string;
  /** Extracto mostrado en el índice del blog. */
  excerpt: string;
  /** Fecha de publicación en formato ISO (YYYY-MM-DD). */
  date: string;
  /** Minutos de lectura aproximados. */
  readingMinutes: number;
  /** Componente con el cuerpo del artículo (sin <h1>, sin breadcrumb). */
  Body: ComponentType;
};

// Importes estáticos de los cuerpos de cada artículo. Añadir uno nuevo:
//   1. crear app/blog/_posts/<slug>.tsx con `export default function ...`
//   2. añadir la entrada aquí.
import ComoElegirMedicoMutua from "@/app/blog/_posts/como-elegir-medico-mutua";

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "como-elegir-medico-mutua",
    title: "Cómo elegir el mejor médico de tu mutua: guía rápida",
    description:
      "Antes de pedir cita con un especialista privado: cómo acertar con la subespecialidad, qué peso dar a las valoraciones reales y por qué la cercanía importa más de lo que parece.",
    excerpt:
      "Acertar con el especialista correcto de tu mutua no es cuestión de suerte. Qué mirar —especialidad exacta, cercanía real y valoraciones que no engañan— antes de coger el teléfono.",
    date: "2026-05-12",
    readingMinutes: 6,
    Body: ComoElegirMedicoMutua,
  },
];

export function getPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

/** "12 de mayo de 2026" a partir de "2026-05-12". */
export function formatBlogDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const meses = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  return `${d} de ${meses[m - 1]} de ${y}`;
}
