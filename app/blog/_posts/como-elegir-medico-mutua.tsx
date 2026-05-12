import Link from "next/link";

/**
 * Cuerpo del artículo "Cómo elegir el mejor médico de tu mutua".
 * No incluye <h1> ni breadcrumb: eso lo pone app/blog/[slug]/page.tsx.
 */
export default function ComoElegirMedicoMutua() {
  return (
    <>
      <section className="px-4 sm:px-6 py-12 sm:py-16 border-t border-gray-100">
        <div className="w-full max-w-2xl mx-auto">
          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
            El problema
          </p>
          <h2 className="text-2xl font-light tracking-tight text-gray-900 leading-snug mb-5">
            Tienes mutua. Encontrar a quién acudir{" "}
            <span className="font-bold">cuesta más de lo que debería</span>.
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            El cuadro médico de tu aseguradora es una lista enorme, sin
            valoraciones y diseñada para cubrirse las espaldas, no para ayudarte
            a decidir. Doctoralia tiene opiniones reales, pero no sabe a qué
            mutua pertenece cada profesional. Google Maps reseña clínicas, pero
            no te dice si tu seguro las cubre. Resultado: media tarde con cinco
            pestañas abiertas y un nombre tras otro en el buscador.
          </p>
          <p className="text-sm text-gray-600 leading-relaxed">
            Elegir bien no es cuestión de suerte. Son cuatro cosas, y se miran
            en este orden.
          </p>
        </div>
      </section>

      <section className="px-4 sm:px-6 py-12 sm:py-16 border-t border-gray-100">
        <div className="w-full max-w-2xl mx-auto">
          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
            1 · La especialidad exacta
          </p>
          <h2 className="text-2xl font-light tracking-tight text-gray-900 leading-snug mb-5">
            No te quedes en <span className="font-bold">la categoría grande</span>.
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            "Cardiología" no es lo mismo que "Cardiología Infantil". "Cirugía
            General" engloba aparato digestivo, mama, pared abdominal… y un
            traumatólogo de columna no opera lo mismo que uno de rodilla. Antes
            de filtrar, ten claro qué subespecialidad necesitas —y, si tienes
            un informe o un volante, mira exactamente cómo lo nombra tu médico
            de cabecera.
          </p>
          <p className="text-sm text-gray-600 leading-relaxed">
            En este buscador la especialidad hace coincidencia parcial e
            ignora acentos: si eliges "Cardiología" salen también las
            subespecialidades. Empieza amplio para ver el panorama y afina
            después.
          </p>
        </div>
      </section>

      <section className="px-4 sm:px-6 py-12 sm:py-16 border-t border-gray-100">
        <div className="w-full max-w-2xl mx-auto">
          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
            2 · La cercanía real
          </p>
          <h2 className="text-2xl font-light tracking-tight text-gray-900 leading-snug mb-5">
            La distancia importa <span className="font-bold">más de lo que crees</span>.
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            Para una consulta puntual da igual cruzar la ciudad. Pero un
            tratamiento de fisioterapia son diez sesiones; un seguimiento de
            embarazo, una visita al mes; una rehabilitación, semanas. Lo que a
            la primera parece "un poco lejos" se convierte en el motivo por el
            que abandonas el tratamiento a medias.
          </p>
          <p className="text-sm text-gray-600 leading-relaxed">
            Introduce tu código postal y, si quieres, un radio entre 2 y 100
            km. El listado se ordena por valoración y, a igualdad, por cercanía
            —así lo mejor que tienes a mano sube arriba. Si no acotas el radio,
            se busca en toda tu provincia.
          </p>
        </div>
      </section>

      <section className="px-4 sm:px-6 py-12 sm:py-16 border-t border-gray-100">
        <div className="w-full max-w-2xl mx-auto">
          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
            3 · Las valoraciones que no engañan
          </p>
          <h2 className="text-2xl font-light tracking-tight text-gray-900 leading-snug mb-5">
            Un 5,0 con dos opiniones <span className="font-bold">no es un 5,0</span>.
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            La nota media sin contexto miente. Dos pacientes contentos dan un
            cinco perfecto; mil pacientes y un 4,7 es una garantía mucho más
            sólida. Mira siempre <strong>cuántas reseñas</strong> hay detrás de
            la puntuación antes de fiarte de ella.
          </p>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            Aquí las valoraciones de profesionales individuales vienen de
            Doctoralia y las de clínicas, hospitales y centros, de Google Maps.
            Cuando un centro tiene nota en ambas fuentes, mostramos la media
            ponderada por número de reseñas. Y el orden del listado no usa la
            nota cruda: usa una puntuación que penaliza el poco volumen —por eso
            un 4,9 con miles de opiniones aparece por delante de un 5,0 con
            tres. El número de reseñas siempre está visible debajo para que
            juzgues por ti mismo.
          </p>
          <p className="text-sm text-gray-600 leading-relaxed">
            Cuando no hay opiniones, lo decimos: "Sin valoraciones". Mejor eso
            que inventarse una.
          </p>
        </div>
      </section>

      <section className="px-4 sm:px-6 py-12 sm:py-16 border-t border-gray-100">
        <div className="w-full max-w-2xl mx-auto">
          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
            4 · El teléfono directo
          </p>
          <h2 className="text-2xl font-light tracking-tight text-gray-900 leading-snug mb-5">
            La cita la concretas <span className="font-bold">tú, llamando</span>.
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Este buscador no reserva citas: te da la especialidad, la
            dirección, el rating y el teléfono del centro. Cuando tengas dos o
            tres candidatos que te encajan por especialidad, cercanía y
            valoración, llamas, confirmas que siguen dando cita por tu mutua
            —los cuadros médicos cambian— y cierras. Una llamada, no cinco
            pestañas.
          </p>
        </div>
      </section>

      <section className="px-4 sm:px-6 py-12 sm:py-16 border-t border-gray-100">
        <div className="w-full max-w-2xl mx-auto">
          <p className="text-[10px] tracking-widest text-gray-400 uppercase mb-4">
            Errores comunes
          </p>
          <h2 className="text-2xl font-light tracking-tight text-gray-900 leading-snug mb-5">
            Lo que más <span className="font-bold">hace perder el tiempo</span>.
          </h2>
          <ul className="text-sm text-gray-600 leading-relaxed space-y-2 list-disc pl-5">
            <li>
              Quedarse con el primer nombre del cuadro médico oficial porque
              "ya está cubierto", sin mirar valoración ni distancia.
            </li>
            <li>
              Fiarse de una nota altísima sin mirar cuántas reseñas la
              sostienen.
            </li>
            <li>
              Elegir por el nombre de la clínica y descubrir luego que el
              profesional concreto no es de tu especialidad exacta.
            </li>
            <li>
              No volver a confirmar por teléfono que sigue atendiendo por tu
              mutua: las altas y bajas en los cuadros médicos son constantes.
            </li>
            <li>
              Ignorar la distancia en tratamientos largos y abandonarlos a
              mitad.
            </li>
          </ul>
        </div>
      </section>

      <section className="px-4 sm:px-6 py-12 sm:py-16 border-t border-gray-100">
        <div className="w-full max-w-2xl mx-auto">
          <h2 className="text-2xl font-light tracking-tight text-gray-900 leading-snug mb-5">
            En una caja, no en cinco pestañas.
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-6">
            Elige tu mutua, la especialidad y el código postal. Recibes una
            lista ordenada por valoración real y cercanía, con el teléfono
            directo de cada centro. Gratis, sin registro y sin recogida de
            datos personales.
          </p>
          <Link
            href="/"
            className="inline-block text-sm font-medium text-blue-600 hover:underline"
          >
            Buscar mi médico →
          </Link>
        </div>
      </section>
    </>
  );
}
