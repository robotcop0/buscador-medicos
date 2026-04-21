import SearchForm from "@/components/SearchForm";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col justify-center px-6 py-24">
      <div className="w-full max-w-2xl mx-auto">

        {/* Branding */}
        <p className="text-xs tracking-widest text-gray-400 uppercase mb-12">
          Buscador de Médicos
        </p>

        {/* Hero */}
        <header className="mb-10">
          <h1 className="text-4xl sm:text-5xl leading-tight tracking-tight text-gray-900">
            <span className="font-light">Encuentra </span>
            <span className="font-bold">tu mejor médico.</span>
          </h1>
          <p className="mt-3 text-sm text-gray-400 font-light">
            Búsqueda en tiempo real en toda España.
          </p>
        </header>

        <SearchForm />
      </div>
    </main>
  );
}
