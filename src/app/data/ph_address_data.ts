export interface Province {
  name: string;
  cities: string[];
}

export interface Region {
  name: string;
  provinces: Province[];
}

export const PH_ADDRESS_DATA: Region[] = [
  {
    name: "National Capital Region (NCR)",
    provinces: [
      {
        name: "Metro Manila",
        cities: ["Manila", "Quezon City", "Makati", "Pasig", "Taguig", "Pasay", "Parañaque", "Las Piñas", "Muntinlupa", "Marikina", "Valenzuela", "Malabon", "Navotas", "Caloocan", "San Juan", "Mandaluyong", "Pateros"]
      }
    ]
  },
  {
    name: "Region I (Ilocos Region)",
    provinces: [
      { name: "Ilocos Norte", cities: ["Laoag City", "Batac City"] },
      { name: "Ilocos Sur", cities: ["Vigan City", "Candon City"] },
      { name: "La Union", cities: ["San Fernando City"] },
      { name: "Pangasinan", cities: ["Dagupan City", "San Carlos City", "Urdaneta City", "Alaminos City"] }
    ]
  },
  {
    name: "Region II (Cagayan Valley)",
    provinces: [
      { name: "Batanes", cities: ["Basco"] },
      { name: "Cagayan", cities: ["Tuguegarao City"] },
      { name: "Isabela", cities: ["Ilagan City", "Cauayan City", "Santiago City"] },
      { name: "Nueva Vizcaya", cities: ["Bayombong"] },
      { name: "Quirino", cities: ["Cabarrogis"] }
    ]
  },
  {
    name: "Region III (Central Luzon)",
    provinces: [
      { name: "Aurora", cities: ["Baler"] },
      { name: "Bataan", cities: ["Balanga City"] },
      { name: "Bulacan", cities: ["Malolos City", "Meycauayan City", "San Jose del Monte City"] },
      { name: "Nueva Ecija", cities: ["Cabanatuan City", "Gapan City", "Palayan City", "San Jose City", "Muñoz City"] },
      { name: "Pampanga", cities: ["San Fernando City", "Angeles City", "Mabalacat City"] },
      { name: "Tarlac", cities: ["Tarlac City"] },
      { name: "Zambales", cities: ["Olongapo City", "Iba"] }
    ]
  },
  {
    name: "Region IV-A (CALABARZON)",
    provinces: [
      { name: "Batangas", cities: ["Batangas City", "Lipa City", "Tanauan City", "Sto. Tomas City"] },
      { name: "Cavite", cities: ["Cavite City", "Trece Martires City", "Tagaytay City", "Dasmariñas City", "Imus City", "Bacoor City", "General Trias City"] },
      { name: "Laguna", cities: ["Biñan City", "Cabuyao City", "Calamba City", "San Pablo City", "Santa Rosa City", "San Pedro City"] },
      { name: "Quezon", cities: ["Lucena City", "Tayabas City"] },
      { name: "Rizal", cities: ["Antipolo City", "Cainta", "Taytay"] }
    ]
  },
  {
    name: "Region IV-B (MIMAROPA)",
    provinces: [
      { name: "Marinduque", cities: ["Boac"] },
      { name: "Occidental Mindoro", cities: ["Mamburao"] },
      { name: "Oriental Mindoro", cities: ["Calapan City"] },
      { name: "Palawan", cities: ["Puerto Princesa City"] },
      { name: "Romblon", cities: ["Romblon"] }
    ]
  },
  {
    name: "Region V (Bicol Region)",
    provinces: [
      { name: "Albay", cities: ["Legazpi City", "Tabaco City", "Ligao City"] },
      { name: "Camarines Norte", cities: ["Daet"] },
      { name: "Camarines Sur", cities: ["Naga City", "Iriga City"] },
      { name: "Catanduanes", cities: ["Virac"] },
      { name: "Masbate", cities: ["Masbate City"] },
      { name: "Sorsogon", cities: ["Sorsogon City"] }
    ]
  },
  {
    name: "Region VI (Western Visayas)",
    provinces: [
      { name: "Aklan", cities: ["Kalibo"] },
      { name: "Antique", cities: ["San Jose de Buenavista"] },
      { name: "Capiz", cities: ["Roxas City"] },
      { name: "Guimaras", cities: ["Jordan"] },
      { name: "Iloilo", cities: ["Iloilo City", "Passi City"] },
      { name: "Negros Occidental", cities: ["Bacolod City", "Bago City", "Cadiz City", "Escalante City", "Himamaylan City", "Kabankalan City", "La Carlota City", "Sagay City", "San Carlos City", "Silay City", "Sipalay City", "Talisay City", "Victorias City"] }
    ]
  },
  {
    name: "Region VII (Central Visayas)",
    provinces: [
      { name: "Bohol", cities: ["Tagbilaran City"] },
      { name: "Cebu", cities: ["Cebu City", "Danao City", "Lapu-Lapu City", "Mandaue City", "Naga City", "Talisay City", "Toledo City", "Bogo City", "Carcar City"] },
      { name: "Negros Oriental", cities: ["Dumaguete City", "Bais City", "Bayawan City", "Canlaon City", "Guihulngan City", "Tanjay City"] },
      { name: "Siquijor", cities: ["Siquijor"] }
    ]
  },
  {
    name: "Region VIII (Eastern Visayas)",
    provinces: [
      { name: "Biliran", cities: ["Naval"] },
      { name: "Eastern Samar", cities: ["Borongan City"] },
      { name: "Leyte", cities: ["Tacloban City", "Ormoc City", "Baybay City"] },
      { name: "Northern Samar", cities: ["Catarman"] },
      { name: "Samar", cities: ["Catbalogan City", "Calbayog City"] },
      { name: "Southern Leyte", cities: ["Maasin City"] }
    ]
  },
  {
    name: "Region IX (Zamboanga Peninsula)",
    provinces: [
      { name: "Zamboanga del Norte", cities: ["Dipolog City", "Dapitan City"] },
      { name: "Zamboanga del Sur", cities: ["Pagadian City", "Zamboanga City"] },
      { name: "Zamboanga Sibugay", cities: ["Ipil"] }
    ]
  },
  {
    name: "Region X (Northern Mindanao)",
    provinces: [
      { name: "Bukidnon", cities: ["Malaybalay City", "Valencia City"] },
      { name: "Camiguin", cities: ["Mambajao"] },
      { name: "Lanao del Norte", cities: ["Iligan City"] },
      { name: "Misamis Occidental", cities: ["Oroquieta City", "Ozamiz City", "Tangub City"] },
      { name: "Misamis Oriental", cities: ["Cagayan de Oro City", "El Salvador City", "Gingoog City"] }
    ]
  },
  {
    name: "Region XI (Davao Region)",
    provinces: [
      { name: "Davao de Oro", cities: ["Nabunturan"] },
      { name: "Davao del Norte", cities: ["Tagum City", "Panabo City", "Samal City"] },
      { name: "Davao del Sur", cities: ["Davao City", "Digos City"] },
      { name: "Davao Occidental", cities: ["Malita"] },
      { name: "Davao Oriental", cities: ["Mati City"] }
    ]
  },
  {
    name: "Region XII (SOCCSKSARGEN)",
    provinces: [
      { name: "Cotabato", cities: ["Kidapawan City"] },
      { name: "Sarangani", cities: ["Alabel"] },
      { name: "South Cotabato", cities: ["General Santos City", "Koronadal City"] },
      { name: "Sultan Kudarat", cities: ["Tacurong City"] }
    ]
  },
  {
    name: "Region XIII (Caraga)",
    provinces: [
      { name: "Agusan del Norte", cities: ["Butuan City", "Cabadbaran City"] },
      { name: "Agusan del Sur", cities: ["Bayugan City"] },
      { name: "Dinagat Islands", cities: ["San Jose"] },
      { name: "Surigao del Norte", cities: ["Surigao City"] },
      { name: "Surigao del Sur", cities: ["Bislig City", "Tandag City"] }
    ]
  },
  {
    name: "BARMM",
    provinces: [
      { name: "Basilan", cities: ["Isabela City", "Lamitan City"] },
      { name: "Lanao del Sur", cities: ["Marawi City"] },
      { name: "Maguindanao", cities: ["Cotabato City"] },
      { name: "Sulu", cities: ["Jolo"] },
      { name: "Tawi-Tawi", cities: ["Bongao"] }
    ]
  },
  {
    name: "CAR",
    provinces: [
      { name: "Abra", cities: ["Bangued"] },
      { name: "Apayao", cities: ["Kabugao"] },
      { name: "Benguet", cities: ["Baguio City"] },
      { name: "Ifugao", cities: ["Lagawe"] },
      { name: "Kalinga", cities: ["Tabuk City"] },
      { name: "Mountain Province", cities: ["Bontoc"] }
    ]
  }
];

export const BARANGAY_SAMPLES: Record<string, string[]> = {
  "Manila": ["Barangay 1", "Barangay 2", "Barangay 649", "Intramuros", "Binondo", "Quiapo", "Sampaloc", "Malate", "Ermita", "Paco", "Santa Mesa"],
  "Quezon City": ["Commonwealth", "Batasan Hills", "Payatas", "Holy Spirit", "Fairview", "Novaliches Proper", "Pasong Tamo", "Culiat", "Tandang Sora", "Socorro"],
  "Makati": ["Bel-Air", "Dasmariñas", "Forbes Park", "Magallanes", "Poblacion", "San Lorenzo", "Urdaneta", "Guadalupe Nuevo", "Guadalupe Viejo", "Pembo", "Comembo"],
  "Pasig": ["Baguong Ilog", "Kapitolyo", "Oranbo", "Pineda", "San Antonio", "Ugong", "Caniogan", "Maybunga", "Rosario"],
  "Taguig": ["Fort Bonifacio", "Western Bicutan", "Upper Bicutan", "Lower Bicutan", "Maharlika Village", "Signal Village", "Bagumbayan", "Hagonoy"],
  // Add more common ones if needed, otherwise fallback to manual entry or a generic list
};
