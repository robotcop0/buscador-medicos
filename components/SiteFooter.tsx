import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  breadcrumb?: ReactNode;
};

export default function SiteFooter({ breadcrumb }: Props) {
  return (
    <footer className="px-4 sm:px-6 py-10 border-t border-gray-100">
      <div className="w-full max-w-2xl mx-auto flex flex-col gap-4">
        <p className="text-[11px] text-gray-400 leading-relaxed">
          {breadcrumb ?? (
            <>
              Buscador de Médicos · datos de los cuadros médicos públicos de
              cada mutua.
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-gray-400">
          <Link href="/" className="hover:text-gray-700">
            Inicio
          </Link>
          <Link href="/sobre" className="hover:text-gray-700">
            Sobre
          </Link>
          <Link href="/aviso-legal" className="hover:text-gray-700">
            Aviso legal
          </Link>
          <Link href="/privacidad" className="hover:text-gray-700">
            Privacidad
          </Link>
          <Link href="/cookies" className="hover:text-gray-700">
            Cookies
          </Link>
          <span className="ml-auto">Hecho en España.</span>
        </div>
      </div>
    </footer>
  );
}
