export type ProvinciaInfo = {
  codigo: string;
  slug: string;
  nombre: string;
};

export const PROVINCIAS: ProvinciaInfo[] = [
  { codigo: "01", slug: "alava", nombre: "Álava" },
  { codigo: "02", slug: "albacete", nombre: "Albacete" },
  { codigo: "03", slug: "alicante", nombre: "Alicante" },
  { codigo: "04", slug: "almeria", nombre: "Almería" },
  { codigo: "05", slug: "avila", nombre: "Ávila" },
  { codigo: "06", slug: "badajoz", nombre: "Badajoz" },
  { codigo: "07", slug: "baleares", nombre: "Islas Baleares" },
  { codigo: "08", slug: "barcelona", nombre: "Barcelona" },
  { codigo: "09", slug: "burgos", nombre: "Burgos" },
  { codigo: "10", slug: "caceres", nombre: "Cáceres" },
  { codigo: "11", slug: "cadiz", nombre: "Cádiz" },
  { codigo: "12", slug: "castellon", nombre: "Castellón" },
  { codigo: "13", slug: "ciudad-real", nombre: "Ciudad Real" },
  { codigo: "14", slug: "cordoba", nombre: "Córdoba" },
  { codigo: "15", slug: "a-coruna", nombre: "A Coruña" },
  { codigo: "16", slug: "cuenca", nombre: "Cuenca" },
  { codigo: "17", slug: "girona", nombre: "Girona" },
  { codigo: "18", slug: "granada", nombre: "Granada" },
  { codigo: "19", slug: "guadalajara", nombre: "Guadalajara" },
  { codigo: "20", slug: "gipuzkoa", nombre: "Gipuzkoa" },
  { codigo: "21", slug: "huelva", nombre: "Huelva" },
  { codigo: "22", slug: "huesca", nombre: "Huesca" },
  { codigo: "23", slug: "jaen", nombre: "Jaén" },
  { codigo: "24", slug: "leon", nombre: "León" },
  { codigo: "25", slug: "lleida", nombre: "Lleida" },
  { codigo: "26", slug: "la-rioja", nombre: "La Rioja" },
  { codigo: "27", slug: "lugo", nombre: "Lugo" },
  { codigo: "28", slug: "madrid", nombre: "Madrid" },
  { codigo: "29", slug: "malaga", nombre: "Málaga" },
  { codigo: "30", slug: "murcia", nombre: "Murcia" },
  { codigo: "31", slug: "navarra", nombre: "Navarra" },
  { codigo: "32", slug: "ourense", nombre: "Ourense" },
  { codigo: "33", slug: "asturias", nombre: "Asturias" },
  { codigo: "34", slug: "palencia", nombre: "Palencia" },
  { codigo: "35", slug: "las-palmas", nombre: "Las Palmas" },
  { codigo: "36", slug: "pontevedra", nombre: "Pontevedra" },
  { codigo: "37", slug: "salamanca", nombre: "Salamanca" },
  { codigo: "38", slug: "tenerife", nombre: "Santa Cruz de Tenerife" },
  { codigo: "39", slug: "cantabria", nombre: "Cantabria" },
  { codigo: "40", slug: "segovia", nombre: "Segovia" },
  { codigo: "41", slug: "sevilla", nombre: "Sevilla" },
  { codigo: "42", slug: "soria", nombre: "Soria" },
  { codigo: "43", slug: "tarragona", nombre: "Tarragona" },
  { codigo: "44", slug: "teruel", nombre: "Teruel" },
  { codigo: "45", slug: "toledo", nombre: "Toledo" },
  { codigo: "46", slug: "valencia", nombre: "Valencia" },
  { codigo: "47", slug: "valladolid", nombre: "Valladolid" },
  { codigo: "48", slug: "bizkaia", nombre: "Bizkaia" },
  { codigo: "49", slug: "zamora", nombre: "Zamora" },
  { codigo: "50", slug: "zaragoza", nombre: "Zaragoza" },
  { codigo: "51", slug: "ceuta", nombre: "Ceuta" },
  { codigo: "52", slug: "melilla", nombre: "Melilla" },
];

export function findProvinciaBySlug(slug: string): ProvinciaInfo | undefined {
  return PROVINCIAS.find((p) => p.slug === slug);
}

export function findProvinciaByCodigo(codigo: string): ProvinciaInfo | undefined {
  return PROVINCIAS.find((p) => p.codigo === codigo);
}
