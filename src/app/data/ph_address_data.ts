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
    name: 'National Capital Region (NCR)',
    provinces: [
      {
        name: 'Metro Manila',
        cities: [
          'Caloocan',
          'Las Piñas',
          'Makati',
          'Malabon',
          'Mandaluyong',
          'Manila',
          'Marikina',
          'Muntinlupa',
          'Navotas',
          'Parañaque',
          'Pasay',
          'Pasig',
          'Pateros',
          'Quezon City',
          'San Juan',
          'Taguig',
          'Valenzuela',
        ],
      },
    ],
  },
  {
    name: 'Region I (Ilocos Region)',
    provinces: [
      {
        name: 'Ilocos Norte',
        cities: [
          'Adams', 'Bacarra', 'Badoc', 'Bangui', 'Banna', 'Batac City', 'Burgos', 'Carasi', 'Currimao', 'Dingras', 'Dumalneg', 'Laoag City', 'Marcos', 'Nueva Era', 'Pagudpud', 'Paoay', 'Pasuquin', 'Piddig', 'Pinili', 'San Nicolas', 'Sarrat', 'Solsona', 'Vintar'
        ],
      },
      {
        name: 'Ilocos Sur',
        cities: [
          'Alilem', 'Banayoyo', 'Bantay', 'Burgos', 'Cabugao', 'Candon City', 'Caoayan', 'Cervantes', 'Galimuyod', 'Gregorio del Pilar', 'Lidlidda', 'Magsingal', 'Nagbukel', 'Narvacan', 'Quirino', 'Salcedo', 'San Emilio', 'San Esteban', 'San Ildefonso', 'San Juan', 'San Vicente', 'Santa', 'Santa Catalina', 'Santa Cruz', 'Santa Lucia', 'Santa Maria', 'Santiago', 'Santo Domingo', 'Sigay', 'Sugpon', 'Suyo', 'Tagudin', 'Vigan City'
        ],
      },
      {
        name: 'La Union',
        cities: [
          'Agoo', 'Aringay', 'Bacnotan', 'Bagulin', 'Balaoan', 'Bangar', 'Bauang', 'Burgos', 'Caba', 'Luna', 'Naguilian', 'Pugo', 'Rosario', 'San Fernando City', 'San Gabriel', 'San Juan', 'Santol', 'Santo Tomas', 'Tubao'
        ],
      },
      {
        name: 'Pangasinan',
        cities: [
          'Agno', 'Aguilar', 'Alaminos City', 'Alcala', 'Anda', 'Asingan', 'Balungao', 'Bani', 'Basista', 'Bautista', 'Bayambang', 'Binalonan', 'Binmaley', 'Bolinao', 'Bugallon', 'Burgos', 'Calasiao', 'Dagupan City', 'Dasol', 'Infanta', 'Labrador', 'Laoac', 'Lingayen', 'Mabini', 'Malasiqui', 'Manaoag', 'Mangaldan', 'Mangatarem', 'Mapandan', 'Natividad', 'Pozorrubio', 'Rosales', 'San Carlos City', 'San Fabian', 'San Jacinto', 'San Manuel', 'San Nicolas', 'San Quintin', 'Santa Barbara', 'Santa Maria', 'Santo Tomas', 'Sison', 'Sual', 'Tayug', 'Umingan', 'Urbiztondo', 'Urdaneta City', 'Villasis'
        ],
      },
    ],
  },
  {
    name: 'Region II (Cagayan Valley)',
    provinces: [
      { name: 'Batanes', cities: ['Basco', 'Itbayat', 'Ivana', 'Mahatao', 'Sabtang', 'Uyugan'] },
      {
        name: 'Cagayan',
        cities: [
          'Abulug', 'Alcala', 'Allacapan', 'Amulung', 'Aparri', 'Baggao', 'Ballesteros', 'Buguey', 'Calayan', 'Camalaniugan', 'Claveria', 'Enrile', 'Gattaran', 'Gonzaga', 'Iguig', 'Lal-lo', 'Lasam', 'Pamplona', 'Peñablanca', 'Piat', 'Rizal', 'Sanchez-Mira', 'Santa Ana', 'Santa Praxedes', 'Santa Teresita', 'Santo Niño', 'Solana', 'Tuao', 'Tuguegarao City'
        ],
      },
      {
        name: 'Isabela',
        cities: [
          'Alicia', 'Angadanan', 'Aurora', 'Benito Soliven', 'Burgos', 'Cabagan', 'Cabatuan', 'Cauayan City', 'Cordon', 'Dinapigue', 'Divilacan', 'Echague', 'Gamu', 'Ilagan City', 'Jones', 'Luna', 'Maconacon', 'Mallig', 'Naguilian', 'Palanan', 'Quezon', 'Quirino', 'Ramon', 'Reina Mercedes', 'Roxas', 'San Agustin', 'San Guillermo', 'San Isidro', 'San Manuel', 'San Mariano', 'San Mateo', 'San Pablo', 'Santa Maria', 'Santiago City', 'Santo Tomas', 'Tumauini'
        ],
      },
      {
        name: 'Nueva Vizcaya',
        cities: ['Alfonso Castañeda', 'Ambaguio', 'Aritao', 'Bagabag', 'Bambang', 'Bayombong', 'Diadi', 'Dupax del Norte', 'Dupax del Sur', 'Kasibu', 'Kayapa', 'Santa Fe', 'Solano', 'Villaverde'],
      },
      { name: 'Quirino', cities: ['Aglipay', 'Cabarroguis', 'Diffun', 'Maddela', 'Nagtipunan', 'Saguday'] },
    ],
  },
  {
    name: 'Region III (Central Luzon)',
    provinces: [
      { name: 'Aurora', cities: ['Baler', 'Casiguran', 'Dilasag', 'Dinalungan', 'Dingalan', 'Dipaculao', 'Maria Aurora', 'San Luis'] },
      {
        name: 'Bataan',
        cities: ['Abucay', 'Bagac', 'Balanga City', 'Dinalupihan', 'Hermosa', 'Limay', 'Mariveles', 'Morong', 'Orani', 'Orion', 'Pilar', 'Samal'],
      },
      {
        name: 'Bulacan',
        cities: [
          'Angat', 'Balagtas', 'Baliwag', 'Bocaue', 'Bulakan', 'Bustos', 'Calumpit', 'Doña Remedios Trinidad', 'Guiguinto', 'Hagonoy', 'Malolos City', 'Marilao', 'Meycauayan City', 'Norzagaray', 'Obando', 'Pandi', 'Paombong', 'Plaridel', 'Pulilan', 'San Ildefonso', 'San Jose del Monte City', 'San Miguel', 'San Rafael', 'Santa Maria'
        ],
      },
      {
        name: 'Nueva Ecija',
        cities: [
          'Aliaga', 'Bongabon', 'Cabanatuan City', 'Cabiao', 'Carranglan', 'Cuyapo', 'Gabaldon', 'Gapan City', 'General Mamerto Natividad', 'General Tinio', 'Guimba', 'Jaen', 'Laur', 'Licab', 'Llanera', 'Lupao', 'Muñoz City', 'Nampicuan', 'Palayan City', 'Pantabangan', 'Peñaranda', 'Quezon', 'Rizal', 'San Antonio', 'San Isidro', 'San Jose City', 'San Leonardo', 'Santa Rosa', 'Santo Domingo', 'Talavera', 'Talugtug', 'Zaragoza'
        ],
      },
      {
        name: 'Pampanga',
        cities: [
          'Angeles City', 'Apalit', 'Arayat', 'Bacolor', 'Candaba', 'Floridablanca', 'Guagua', 'Lubao', 'Mabalacat City', 'Macabebe', 'Magalang', 'Masantol', 'Mexico', 'Minalin', 'Porac', 'San Fernando City', 'San Luis', 'San Simon', 'Santa Ana', 'Santa Rita', 'Santo Tomas', 'Sasmuan'
        ],
      },
      {
        name: 'Tarlac',
        cities: [
          'Anao', 'Bamban', 'Camiling', 'Capas', 'Concepcion', 'Gerona', 'La Paz', 'Mayantoc', 'Moncada', 'Paniqui', 'Pura', 'Ramos', 'San Clemente', 'San Jose', 'San Manuel', 'Santa Ignacia', 'Tarlac City', 'Victoria'
        ],
      },
      {
        name: 'Zambales',
        cities: [
          'Botolan', 'Cabangan', 'Candelaria', 'Castillejos', 'Iba', 'Masinloc', 'Olongapo City', 'Palauig', 'San Antonio', 'San Felipe', 'San Marcelino', 'San Narciso', 'Santa Cruz', 'Subic'
        ],
      },
    ],
  },
  {
    name: 'Region IV-A (CALABARZON)',
    provinces: [
      {
        name: 'Batangas',
        cities: [
          'Agoncillo', 'Alitagtag', 'Balayan', 'Balete', 'Batangas City', 'Bauan', 'Calaca City', 'Calatagan', 'Cuenca', 'Ibaan', 'Laurel', 'Lemery', 'Lian', 'Lipa City', 'Lobo', 'Mabini', 'Malvar', 'Mataasnakahoy', 'Nasugbu', 'Padre Garcia', 'Rosario', 'San Jose', 'San Juan', 'San Luis', 'San Nicolas', 'San Pascual', 'Santa Teresita', 'Santo Tomas City', 'Taal', 'Talisay', 'Tanauan City', 'Taysan', 'Tingloy', 'Tuy'
        ],
      },
      {
        name: 'Cavite',
        cities: [
          'Alfonso', 'Amadeo', 'Bacoor City', 'Carmona City', 'Cavite City', 'Dasmariñas City', 'General Emilio Aguinaldo', 'General Mariano Alvarez', 'General Trias City', 'Imus City', 'Indang', 'Kawit', 'Magallanes', 'Maragondon', 'Mendez', 'Naic', 'Noveleta', 'Rosario', 'Silang', 'Tagaytay City', 'Tanza', 'Ternate', 'Trece Martires City'
        ],
      },
      {
        name: 'Laguna',
        cities: [
          'Alaminos', 'Bay', 'Biñan City', 'Cabuyao City', 'Calamba City', 'Calauan', 'Cavinti', 'Famy', 'Kalayaan', 'Liliw', 'Los Baños', 'Luisiana', 'Lumban', 'Mabitac', 'Magdalena', 'Majayjay', 'Nagcarlan', 'Paete', 'Pagsanjan', 'Pakil', 'Pangil', 'Pila', 'Rizal', 'San Pablo City', 'San Pedro City', 'Santa Cruz', 'Santa Maria', 'Santa Rosa City', 'Siniloan', 'Victoria'
        ],
      },
      {
        name: 'Quezon',
        cities: [
          'Agdangan', 'Alabat', 'Atimonan', 'Buenavista', 'Burdeos', 'Calauag', 'Candelaria', 'Catanauan', 'Dolores', 'General Nakar', 'Guinayangan', 'Gumaca', 'Infanta', 'Jomalig', 'Lopez', 'Lucban', 'Lucena City', 'Macalelon', 'Mauban', 'Mulanay', 'Padre Burgos', 'Pagbilao', 'Panukulan', 'Patnanungan', 'Perez', 'Pitogo', 'Plaridel', 'Polillo', 'Quezon', 'Real', 'Sampaloc', 'San Andres', 'San Antonio', 'San Francisco', 'San Narciso', 'Sariaya', 'Tagkawayan', 'Tayabas City', 'Tiaong', 'Unisan'
        ],
      },
      {
        name: 'Rizal',
        cities: [
          'Angono', 'Antipolo City', 'Baras', 'Binangonan', 'Cainta', 'Cardona', 'Jalajala', 'Morong', 'Pililla', 'Rodriguez (Montalban)', 'San Mateo', 'Tanay', 'Taytay', 'Teresa'
        ],
      },
    ],
  },
  {
    name: 'Region IV-B (MIMAROPA)',
    provinces: [
      { name: 'Marinduque', cities: ['Boac', 'Buenavista', 'Gasan', 'Mogpog', 'Santa Cruz', 'Torrijos'] },
      {
        name: 'Occidental Mindoro',
        cities: ['Abra de Ilog', 'Calintaan', 'Looc', 'Lubang', 'Magsaysay', 'Mamburao', 'Paluan', 'Rizal', 'Sablayan', 'San Jose', 'Santa Cruz'],
      },
      {
        name: 'Oriental Mindoro',
        cities: ['Baco', 'Bansud', 'Bongabong', 'Bulalacao', 'Calapan City', 'Gloria', 'Mansalay', 'Naujan', 'Pinamalayan', 'Pola', 'Puerto Galera', 'Roxas', 'San Teodoro', 'Socorro', 'Victoria'],
      },
      {
        name: 'Palawan',
        cities: [
          'Aborlan', 'Agutaya', 'Araceli', 'Balabac', 'Bataraza', 'Brooke\'s Point', 'Busuanga', 'Cagayancillo', 'Coron', 'Culion', 'Cuyo', 'Dumaran', 'El Nido', 'Kalayaan', 'Linapacan', 'Magsaysay', 'Narra', 'Puerto Princesa City', 'Quezon', 'Rizal', 'Roxas', 'San Vicente', 'Sofronio Española', 'Taytay'
        ],
      },
      {
        name: 'Romblon',
        cities: ['Alcantara', 'Banton', 'Cajidiocan', 'Calatrava', 'Concepcion', 'Corcuera', 'Ferrol', 'Looc', 'Magdiwang', 'Odiongan', 'Romblon', 'San Agustin', 'San Andres', 'San Fernando', 'San Jose', 'Santa Fe', 'Santa Maria'],
      },
    ],
  },
  {
    name: 'Region V (Bicol Region)',
    provinces: [
      {
        name: 'Albay',
        cities: ['Bacacay', 'Camalig', 'Daraga', 'Guinobatan', 'Jovellar', 'Legazpi City', 'Libon', 'Ligao City', 'Malilipot', 'Malinao', 'Manito', 'Oas', 'Pio Duran', 'Polangui', 'Rapu-Rapu', 'Santo Domingo', 'Tabaco City', 'Tiwi'],
      },
      {
        name: 'Camarines Norte',
        cities: ['Basud', 'Capalonga', 'Daet', 'Jose Panganiban', 'Labo', 'Mercedes', 'Paracale', 'San Lorenzo Ruiz', 'San Vicente', 'Santa Elena', 'Talisay', 'Vinzons'],
      },
      {
        name: 'Camarines Sur',
        cities: [
          'Baao', 'Balatan', 'Bato', 'Bombon', 'Buhi', 'Bula', 'Cabusao', 'Calabanga', 'Camaligan', 'Canaman', 'Caramoan', 'Del Gallego', 'Gainza', 'Garchitorena', 'Goa', 'Iriga City', 'Lagonoy', 'Libmanan', 'Lupi', 'Magarao', 'Milaor', 'Minalabac', 'Nabua', 'Naga City', 'Ocampo', 'Pamplona', 'Pasacao', 'Pili', 'Presentacion', 'Ragay', 'Sagñay', 'San Fernando', 'San Jose', 'Sipocot', 'Siruma', 'Tigaon', 'Tinambac'
        ],
      },
      { name: 'Catanduanes', cities: ['Bagamanoc', 'Baras', 'Bato', 'Caramoran', 'Gigmoto', 'Pandan', 'Panganiban', 'San Andres', 'San Miguel', 'Viga', 'Virac'] },
      {
        name: 'Masbate',
        cities: ['Aroroy', 'Baleno', 'Balud', 'Batuan', 'Cataingan', 'Cawayan', 'Claveria', 'Dimasalang', 'Esperanza', 'Mandaon', 'Masbate City', 'Milagros', 'Mobo', 'Monreal', 'Palanas', 'Pio V. Corpuz', 'Placer', 'San Fernando', 'San Jacinto', 'San Pascual', 'Uson'],
      },
      {
        name: 'Sorsogon',
        cities: ['Barcelona', 'Bulan', 'Bulusan', 'Casiguran', 'Castilla', 'Donsol', 'Gubat', 'Irosin', 'Juban', 'Magallanes', 'Matnog', 'Pilar', 'Prieto Diaz', 'Santa Magdalena', 'Sorsogon City'],
      },
    ],
  },
  {
    name: 'Region VI (Western Visayas)',
    provinces: [
      {
        name: 'Aklan',
        cities: ['Altavas', 'Balete', 'Banga', 'Batan', 'Buruanga', 'Ibajay', 'Kalibo', 'Lezo', 'Libacao', 'Madalag', 'Makato', 'Malay', 'Malinao', 'Nabas', 'New Washington', 'Numancia', 'Tangalan'],
      },
      {
        name: 'Antique',
        cities: ['Anini-y', 'Barbaza', 'Belison', 'Bugasong', 'Caluya', 'Culasi', 'Hamtic', 'Laua-an', 'Libertad', 'Pandan', 'Patnongon', 'San Jose de Buenavista', 'San Remigio', 'Sebaste', 'Sibalom', 'Tibiao', 'Tobias Fornier', 'Valderrama'],
      },
      {
        name: 'Capiz',
        cities: ['Cuartero', 'Dao', 'Dumalag', 'Dumarao', 'Ivisan', 'Jamindan', 'Maayon', 'Mambusao', 'Panay', 'Panitan', 'Pilar', 'Pontevedra', 'President Roxas', 'Roxas City', 'Sapian', 'Sigma', 'Tapaz'],
      },
      { name: 'Guimaras', cities: ['Buenavista', 'Jordan', 'Nueva Valencia', 'San Lorenzo', 'Sibunag'] },
      {
        name: 'Iloilo',
        cities: [
          'Ajuy', 'Alimodian', 'Anilao', 'Badiangan', 'Balasan', 'Banate', 'Barotac Nuevo', 'Barotac Viejo', 'Batad', 'Bingawan', 'Cabatuan', 'Calinog', 'Carles', 'Concepcion', 'Dingle', 'Dueñas', 'Dumangas', 'Estancia', 'Guimbal', 'Igbaras', 'Iloilo City', 'Janiuay', 'Lambunao', 'Leganes', 'Lemery', 'Leon', 'Maasin', 'Miagao', 'Mina', 'New Lucena', 'Oton', 'Passi City', 'Pavia', 'Pototan', 'San Dionisio', 'San Enrique', 'San Joaquin', 'San Miguel', 'San Rafael', 'Santa Barbara', 'Sara', 'Tigbauan', 'Tubungan', 'Zarraga'
        ],
      },
      {
        name: 'Negros Occidental',
        cities: [
          'Bacolod City', 'Bago City', 'Binalbagan', 'Cadiz City', 'Calatrava', 'Candoni', 'Cauayan', 'E.B. Magalona', 'Escalante City', 'Himamaylan City', 'Hinigaran', 'Hinoba-an', 'Ilog', 'Isabela', 'Kabankalan City', 'La Carlota City', 'La Castellana', 'Manapla', 'Moises Padilla', 'Murcia', 'Pontevedra', 'Pulupandan', 'Sagay City', 'Salvador Benedicto', 'San Carlos City', 'San Enrique', 'Silay City', 'Sipalay City', 'Talisay City', 'Toboso', 'Valladolid', 'Victorias City'
        ],
      },
    ],
  },
  {
    name: 'Region VII (Central Visayas)',
    provinces: [
      {
        name: 'Bohol',
        cities: [
          'Alburquerque', 'Alicia', 'Anda', 'Antequera', 'Baclayon', 'Balilihan', 'Batuan', 'Bien Unido', 'Bilar', 'Buenavista', 'Calape', 'Candijay', 'Carmen', 'Catigbian', 'Clarin', 'Corella', 'Cortes', 'Dagohoy', 'Danao', 'Dauis', 'Dimiao', 'Duero', 'Garcia Hernandez', 'Getafe', 'Guindulman', 'Inabanga', 'Jagna', 'Lila', 'Loay', 'Loboc', 'Loon', 'Mabini', 'Maribojoc', 'Panglao', 'Pilar', 'Pres. Carlos P. Garcia', 'Sagbayan', 'San Isidro', 'San Miguel', 'Sevilla', 'Sierra Bullones', 'Sikatuna', 'Tagbilaran City', 'Talibon', 'Trinidad', 'Tubigon', 'Ubay', 'Valencia'
        ],
      },
      {
        name: 'Cebu',
        cities: [
          'Alcantara', 'Alcoy', 'Alegria', 'Aloguinsan', 'Argao', 'Asturias', 'Badian', 'Balamban', 'Bantayan', 'Barili', 'Bogo City', 'Boljoon', 'Borbon', 'Carcar City', 'Carmen', 'Catmon', 'Cebu City', 'Compostela', 'Consolacion', 'Cordoba', 'Daanbantayan', 'Dalaguete', 'Danao City', 'Dumanjug', 'Ginatilan', 'Lapu-Lapu City', 'Liloan', 'Madridejos', 'Malabuyoc', 'Mandaue City', 'Medellin', 'Minglanilla', 'Moalboal', 'Naga City', 'Oslob', 'Pilar', 'Pinamungajan', 'Poro', 'Ronda', 'Samboan', 'San Fernando', 'San Francisco', 'San Remigio', 'Santa Fe', 'Santander', 'Sibonga', 'Sogod', 'Tabogon', 'Tabuelan', 'Talisay City', 'Toledo City', 'Tuburan', 'Tudela'
        ],
      },
      {
        name: 'Negros Oriental',
        cities: [
          'Amlan', 'Ayungon', 'Bacong', 'Bais City', 'Basay', 'Bayawan City', 'Bindoy', 'Canlaon City', 'Dauin', 'Dumaguete City', 'Guihulngan City', 'Jimalalud', 'La Libertad', 'Mabinay', 'Manjuyod', 'Pamplona', 'San Jose', 'Siaton', 'Sibulan', 'Tanjay City', 'Tayasan', 'Valencia', 'Vallehermoso', 'Zamboanguita'
        ],
      },
      { name: 'Siquijor', cities: ['Enrique Villanueva', 'Larena', 'Lazi', 'Maria', 'San Juan', 'Siquijor'] },
    ],
  },
  {
    name: 'Region VIII (Eastern Visayas)',
    provinces: [
      { name: 'Biliran', cities: ['Almeria', 'Biliran', 'Cabucgayan', 'Caibiran', 'Culaba', 'Kawayan', 'Maripipi', 'Naval'] },
      {
        name: 'Eastern Samar',
        cities: [
          'Arteche', 'Balangiga', 'Balangkayan', 'Borongan City', 'Can-avid', 'Dolores', 'General MacArthur', 'Giporlos', 'Guiuan', 'Hernani', 'Jipapad', 'Lawaan', 'Llorente', 'Maslog', 'Maydolong', 'Mercedes', 'Oras', 'Quinapondan', 'Salcedo', 'San Julian', 'San Policarpo', 'Sulat', 'Taft'
        ],
      },
      {
        name: 'Leyte',
        cities: [
          'Abuyog', 'Alangalang', 'Albuera', 'Babatngon', 'Barugo', 'Bato', 'Baybay City', 'Burauen', 'Calubian', 'Capoocan', 'Carigara', 'Dagami', 'Dulag', 'Hilongos', 'Hindang', 'Inopacan', 'Isabel', 'Jaro', 'Javier', 'Julita', 'Kananga', 'La Paz', 'Leyte', 'MacArthur', 'Mahaplag', 'Matag-ob', 'Matalom', 'Mayorga', 'Merida', 'Palo', 'Palompon', 'Pastrana', 'San Isidro', 'San Miguel', 'Santa Fe', 'Tabango', 'Tabontabon', 'Tacloban City', 'Tanauan', 'Tolosa', 'Tunga', 'Villaba'
        ],
      },
      {
        name: 'Northern Samar',
        cities: [
          'Allen', 'Biri', 'Bobon', 'Capul', 'Catarman', 'Catubig', 'Gamay', 'Laoang', 'Lapinig', 'Las Navas', 'Lavezares', 'Lope de Vega', 'Mapanas', 'Mondragon', 'Palapag', 'Pambujan', 'Rosario', 'San Antonio', 'San Isidro', 'San Jose', 'San Roque', 'San Vicente', 'Silvino Lobos', 'Victoria'
        ],
      },
      {
        name: 'Samar',
        cities: [
          'Almagro', 'Basey', 'Calbayog City', 'Calbiga', 'Catbalogan City', 'Daram', 'Gandara', 'Hinabangan', 'Jiabong', 'Marabut', 'Matuguinao', 'Motiong', 'Pagsanghan', 'Paranas', 'Pinabacdao', 'San Jorge', 'San Jose de Buan', 'San Sebastian', 'Santa Margarita', 'Santa Rita', 'Santo Niño', 'Tagapul-an', 'Talalora', 'Tarangnan', 'Villareal', 'Zumarraga'
        ],
      },
      {
        name: 'Southern Leyte',
        cities: [
          'Anahawan', 'Bontoc', 'Hinunangan', 'Hinundayan', 'Libagon', 'Liloan', 'Limasawa', 'Maasin City', 'Malitbog', 'Padre Burgos', 'Pintuyan', 'San Francisco', 'San Juan', 'San Ricardo', 'Silago', 'Sogod', 'Tomas Oppus'
        ],
      },
    ],
  },
  {
    name: 'Region IX (Zamboanga Peninsula)',
    provinces: [
      {
        name: 'Zamboanga del Norte',
        cities: [
          'Bacungan', 'Baliguian', 'Dapitan City', 'Dipolog City', 'Godod', 'Gutalac', 'Jose Dalman', 'Kalawit', 'Katipunan', 'La Libertad', 'Labason', 'Leon B. Postigo', 'Liloy', 'Manukan', 'Mutia', 'Piñan', 'Polanco', 'Pres. Manuel A. Roxas', 'Salug', 'Sergio Osmeña Sr.', 'Siayan', 'Sibuco', 'Sibutad', 'Sindangan', 'Siocon', 'Sirawai', 'Tampilisan'
        ],
      },
      {
        name: 'Zamboanga del Sur',
        cities: [
          'Bayog', 'Dimataling', 'Dinas', 'Dumalinao', 'Dumingag', 'Guipos', 'Josefina', 'Kumalarang', 'Labangan', 'Lakewood', 'Lapuyan', 'Mahayag', 'Margosatubig', 'Midsalip', 'Molave', 'Pagadian City', 'Pitogo', 'Ramon Magsaysay', 'San Miguel', 'San Pablo', 'Sominot', 'Tabina', 'Tambulig', 'Tigbao', 'Tukuran', 'Vincenzo A. Sagun', 'Zamboanga City'
        ],
      },
      {
        name: 'Zamboanga Sibugay',
        cities: ['Alicia', 'Buug', 'Diplahan', 'Imelda', 'Ipil', 'Kabasalan', 'Mabuhay', 'Malangas', 'Naga', 'Olutanga', 'Payao', 'Roseller Lim', 'Siay', 'Talusan', 'Titay', 'Tungawan'],
      },
    ],
  },
  {
    name: 'Region X (Northern Mindanao)',
    provinces: [
      {
        name: 'Bukidnon',
        cities: [
          'Baungon', 'Cabanglasan', 'Damulog', 'Dangcagan', 'Don Carlos', 'Impasugong', 'Kadingilan', 'Kibawe', 'Kitaotao', 'Lantapan', 'Libona', 'Malaybalay City', 'Malitbog', 'Manolo Fortich', 'Maramag', 'Pangantucan', 'Quezon', 'San Fernando', 'Sumilao', 'Talakag', 'Valencia City'
        ],
      },
      { name: 'Camiguin', cities: ['Catarman', 'Guinsiliban', 'Mahinog', 'Mambajao', 'Sagay'] },
      {
        name: 'Lanao del Norte',
        cities: [
          'Bacolod', 'Baloi', 'Baroy', 'Iligan City', 'Kapatagan', 'Kauswagan', 'Kolambugan', 'Lala', 'Linamon', 'Magsaysay', 'Maigo', 'Matungao', 'Munai', 'Nunungan', 'Pantao Ragat', 'Pantar', 'Poona Piagapo', 'Salvador', 'Sapad', 'Sultan Naga Dimaporo', 'Tagoloan', 'Tangcal', 'Tubod'
        ],
      },
      {
        name: 'Misamis Occidental',
        cities: [
          'Aloran', 'Baliangao', 'Bonifacio', 'Calamba', 'Clarin', 'Concepcion', 'Don Victoriano Chiongbian', 'Jimenez', 'Lopez Jaena', 'Oroquieta City', 'Ozamiz City', 'Panaon', 'Plaridel', 'Sapang Dalaga', 'Sinacaban', 'Tangub City', 'Tudela'
        ],
      },
      {
        name: 'Misamis Oriental',
        cities: [
          'Alubijid', 'Balingasag', 'Balingoan', 'Binuangan', 'Cagayan de Oro City', 'Claveria', 'El Salvador City', 'Gingoog City', 'Gitagum', 'Initao', 'Jasaan', 'Kinoguitan', 'Lagonglong', 'Laguindingan', 'Libertad', 'Lugait', 'Magsaysay', 'Manticao', 'Medina', 'Naawan', 'Opol', 'Salay', 'Sugbongcogon', 'Tagoloan', 'Talisayan', 'Villanueva'
        ],
      },
    ],
  },
  {
    name: 'Region XI (Davao Region)',
    provinces: [
      {
        name: 'Davao de Oro',
        cities: ['Compostela', 'Laak', 'Mabini', 'Maco', 'Maragusan', 'Mawab', 'Monkayo', 'Montevista', 'Nabunturan', 'New Bataan', 'Pantukan'],
      },
      {
        name: 'Davao del Norte',
        cities: ['Asuncion', 'Braulio E. Dujali', 'Carmen', 'Kapalong', 'New Corella', 'Panabo City', 'Samal City', 'Santo Tomas', 'Tagum City', 'Talaingod'],
      },
      {
        name: 'Davao del Sur',
        cities: ['Bansalan', 'Davao City', 'Digos City', 'Hagonoy', 'Kiblawan', 'Magsaysay', 'Malalag', 'Matanao', 'Padada', 'Santa Cruz', 'Sulop'],
      },
      { name: 'Davao Occidental', cities: ['Don Marcelino', 'Jose Abad Santos', 'Malita', 'Santa Maria', 'Sarangani'] },
      { name: 'Davao Oriental', cities: ['Baganga', 'Banaybanay', 'Boston', 'Caraga', 'Cateel', 'Governor Generoso', 'Lupon', 'Manay', 'Mati City', 'San Isidro', 'Tarragona'] },
    ],
  },
  {
    name: 'Region XII (SOCCSKSARGEN)',
    provinces: [
      {
        name: 'Cotabato',
        cities: [
          'Alamada', 'Aleosan', 'Antipas', 'Arakan', 'Banisilan', 'Carmen', 'Kabacan', 'Kidapawan City', 'Libungan', 'M\'lang', 'Magpet', 'Makilala', 'Matalam', 'Midsayap', 'Pigcawayan', 'Pikit', 'President Roxas', 'Tulunan'
        ],
      },
      { name: 'Sarangani', cities: ['Alabel', 'Glan', 'Kiamba', 'Maasim', 'Maitum', 'Malapatan', 'Malungon'] },
      {
        name: 'South Cotabato',
        cities: ['Banga', 'General Santos City', 'Koronadal City', 'Norala', 'Polomolok', 'Santo Niño', 'Surallah', 'T\'Boli', 'Tampakan', 'Tantangan', 'Tupi'],
      },
      {
        name: 'Sultan Kudarat',
        cities: ['Bagumbayan', 'Columbio', 'Esperanza', 'Isulan', 'Kalamansig', 'Lambayong', 'Lebak', 'Lutayan', 'Palimbang', 'President Quirino', 'Sen. Ninoy Aquino', 'Tacurong City'],
      },
    ],
  },
  {
    name: 'Region XIII (Caraga)',
    provinces: [
      {
        name: 'Agusan del Norte',
        cities: ['Buenavista', 'Butuan City', 'Cabadbaran City', 'Carmen', 'Jabonga', 'Kitcharao', 'Las Nieves', 'Magallanes', 'Nasipit', 'Remedios T. Romualdez', 'Santiago', 'Tubay'],
      },
      {
        name: 'Agusan del Sur',
        cities: ['Bayugan City', 'Bunawan', 'Esperanza', 'La Paz', 'Loreto', 'Prosperidad', 'Rosario', 'San Francisco', 'San Luis', 'Santa Josefa', 'Sibagat', 'Talacogon', 'Trento', 'Veruela'],
      },
      { name: 'Dinagat Islands', cities: ['Basilisa', 'Cagdianao', 'Dinagat', 'Libjo', 'Loreto', 'San Jose', 'Tubajon'] },
      {
        name: 'Surigao del Norte',
        cities: [
          'Alegria', 'Bacuag', 'Burgos', 'Claver', 'Dapa', 'Del Carmen', 'General Luna', 'Gigaquit', 'Mainit', 'Malimono', 'Pilar', 'Placer', 'San Benito', 'San Francisco', 'San Isidro', 'Santa Monica', 'Sison', 'Socorro', 'Surigao City', 'Tagana-an', 'Tubod'
        ],
      },
      {
        name: 'Surigao del Sur',
        cities: [
          'Barobo', 'Bayabas', 'Bislig City', 'Cagwait', 'Cantilan', 'Carmen', 'Carrascal', 'Cortes', 'Hinatuan', 'Lanuza', 'Lianga', 'Lingig', 'Madrid', 'Marihatag', 'San Agustin', 'San Miguel', 'Tagbina', 'Tago', 'Tandag City'
        ],
      },
    ],
  },
  {
    name: 'BARMM',
    provinces: [
      {
        name: 'Basilan',
        cities: ['Akbar', 'Al-Barka', 'Hadji Mohammad Ajul', 'Hadji Muhtamad', 'Isabela City', 'Lamitan City', 'Lantawan', 'Maluso', 'Sumisip', 'Tabuan-Lasa', 'Tipo-Tipo', 'Tuburan', 'Ungkaya Pukan'],
      },
      {
        name: 'Lanao del Sur',
        cities: [
          'Bacolod-Kalawi', 'Balabagan', 'Balindong', 'Bayang', 'Binidayan', 'Buadiposo-Buntong', 'Bubong', 'Bumbaran', 'Butig', 'Calanogas', 'Ditsaan-Ramain', 'Ganassi', 'Kapai', 'Katai', 'Lumba-Bayabao', 'Lumbaca-Unayan', 'Lumbatan', 'Lumbayanague', 'Madalum', 'Madamba', 'Maguing', 'Malabang', 'Marantao', 'Marawi City', 'Marogong', 'Masiu', 'Mulondo', 'Pagayawan', 'Piagapo', 'Picong', 'Poona Bayabao', 'Pualas', 'Saguiaran', 'Sultan Dumalondong', 'Tagoloan II', 'Tamparan', 'Taraka', 'Tubaran', 'Tugaya', 'Wao'
        ],
      },
      {
        name: 'Maguindanao del Norte',
        cities: ['Barira', 'Buldon', 'Cotabato City', 'Datu Blah T. Sinsuat', 'Datu Odin Sinsuat', 'Kabuntalan', 'Matanog', 'Northern Kabuntalan', 'Parang', 'San Jose', 'Upi'],
      },
      {
        name: 'Maguindanao del Sur',
        cities: [
          'Ampatuan', 'Datu Abdullah Sangki', 'Datu Anggal Midtimbang', 'Datu Hoffer Ampatuan', 'Datu Paglas', 'Datu Piang', 'Datu Salibo', 'Datu Saudi-Ampatuan', 'Datu Unsay', 'Guindulungan', 'Mamasapano', 'Mangudadatu', 'Pagalungan', 'Paglat', 'Pandag', 'Rajah Buayan', 'Shariff Aguak', 'Shariff Saydona Mustapha', 'South Upi', 'Sultan sa Barongis', 'Sultan Sumagka', 'Talayan'
        ],
      },
      {
        name: 'Sulu',
        cities: [
          'Hadji Panglima Tahil', 'Indanan', 'Jolo', 'Kalingalan Caluang', 'Lugus', 'Luuk', 'Maimbung', 'Old Panamao', 'Omar', 'Pandami', 'Panglima Estino', 'Pangutaran', 'Parang', 'Pata', 'Patikul', 'Siasi', 'Talipao', 'Tapul', 'Tongkil'
        ],
      },
      {
        name: 'Tawi-Tawi',
        cities: ['Bongao', 'Languyan', 'Mapun', 'Simunul', 'Sitangkai', 'South Ubian', 'Tandubas', 'Turtle Islands'],
      },
    ],
  },
  {
    name: 'CAR',
    provinces: [
      {
        name: 'Abra',
        cities: [
          'Bangued', 'Boliney', 'Bucay', 'Bucloc', 'Daguioman', 'Danglas', 'Dolores', 'Lacub', 'Lagangilang', 'Lagayan', 'Langiden', 'La Paz', 'Licuan-Baay', 'Luba', 'Malibcong', 'Manabo', 'Peñarrubia', 'Pidigan', 'Pilar', 'Sallapadan', 'San Isidro', 'San Juan', 'San Quintin', 'Tayum', 'Tineg', 'Tubo', 'Villaviciosa'
        ],
      },
      { name: 'Apayao', cities: ['Calanasan', 'Conner', 'Flora', 'Kabugao', 'Luna', 'Pudtol', 'Santa Marcela'] },
      {
        name: 'Benguet',
        cities: ['Atok', 'Baguio City', 'Bakun', 'Bokod', 'Buguias', 'Itogon', 'Kabayan', 'Kapangan', 'Kibungan', 'La Trinidad', 'Mankayan', 'Sablan', 'Tuba', 'Tublay'],
      },
      { name: 'Ifugao', cities: ['Aguinaldo', 'Alfonso Lista', 'Asipulo', 'Banaue', 'Hingyon', 'Hungduan', 'Kiangan', 'Lagawe', 'Lamut', 'Mayoyao', 'Tinoc'] },
      { name: 'Kalinga', cities: ['Balbalan', 'Lubuagan', 'Pasil', 'Pinukpuk', 'Rizal', 'Tabuk City', 'Tanudan', 'Tinglayan'] },
      { name: 'Mountain Province', cities: ['Barlig', 'Bauko', 'Besao', 'Bontoc', 'Natonin', 'Paracelis', 'Sabangan', 'Sadanga', 'Sagada', 'Tadian'] },
    ],
  },
];

export const BARANGAY_SAMPLES: Record<string, string[]> = {
  Manila: [
    'Barangay 1', 'Barangay 2', 'Barangay 649', 'Intramuros', 'Binondo', 'Quiapo', 'Sampaloc', 'Malate', 'Ermita', 'Paco', 'Santa Mesa'
  ],
  'Quezon City': [
    'Commonwealth', 'Batasan Hills', 'Payatas', 'Holy Spirit', 'Fairview', 'Novaliches Proper', 'Pasong Tamo', 'Culiat', 'Tandang Sora', 'Socorro'
  ],
  Makati: [
    'Bel-Air', 'Dasmariñas', 'Forbes Park', 'Magallanes', 'Poblacion', 'San Lorenzo', 'Urdaneta', 'Guadalupe Nuevo', 'Guadalupe Viejo', 'Pembo', 'Comembo'
  ],
  Pasig: ['Baguong Ilog', 'Kapitolyo', 'Oranbo', 'Pineda', 'San Antonio', 'Ugong', 'Caniogan', 'Maybunga', 'Rosario'],
  Taguig: [
    'Fort Bonifacio', 'Western Bicutan', 'Upper Bicutan', 'Lower Bicutan', 'Maharlika Village', 'Signal Village', 'Bagumbayan', 'Hagonoy'
  ],
  'Bacolod City': [
    'Alangilan', 'Alicante', 'Alijis', 'Banago', 'Barangay 1', 'Barangay 2', 'Bata', 'Cabug', 'Estefania', 'Felisa', 'Granada', 'Handumanan', 'Mandalagan', 'Mansilingan', 'Montevista', 'Pahanocoy', 'Punta Taytay', 'Singcang-Airport', 'Sum-ag', 'Taculing', 'Tangub', 'Villamonte', 'Vista Alegre'
  ],
  'Talisay City': [
    'Zone 1', 'Zone 2', 'Zone 3', 'Zone 4', 'Zone 5', 'Bubog', 'Cabatangan', 'Concepcion', 'Dos Hermanas', 'Efigenio Lizares', 'Matab-ang', 'San Fernando'
  ],
  'Silay City': [
    'Barangay I', 'Barangay II', 'Barangay III', 'Barangay IV', 'Barangay V', 'Bagtic', 'Balaring', 'Guimbala-on', 'Hawaiian', 'Lantad', 'Mula-on', 'Patag', 'Rizal'
  ],
  'Bago City': [
    'Abuanan', 'Alianza', 'Atipuluan', 'Balingasag', 'Binubuhan', 'Busay', 'Calumangan', 'Caridad', 'Dulao', 'Ilijan', 'Lag-asan', 'Ma-ao', 'Mailum', 'Malingin', 'Napoles', 'Poblacion', 'Sagasa', 'Sampinit', 'Tabunan', 'Taloc'
  ],
  'Kabankalan City': [
    'Barangay 1', 'Barangay 2', 'Barangay 3', 'Barangay 4', 'Bantayan', 'Binicuil', 'Camingawan', 'Carol-an', 'Daan Banua', 'Hilamonan', 'Inapoy', 'Linao', 'Locotan', 'Magballo', 'Oringao', 'Salong', 'Tabugon', 'Tagukon', 'Talisay', 'Tan-awan', 'Tapi'
  ],
  'San Carlos City': [
    'Barangay 1', 'Barangay 2', 'Barangay 3', 'Barangay 4', 'Barangay 5', 'Barangay 6', 'Bagonbon', 'Buluangan', 'Codcod', 'Ermita', 'Guadalupe', 'Nataban', 'Palampas', 'Prosperidad', 'Punao', 'Quezon', 'Rizal', 'San Juan'
  ],
  'Cadiz City': [
    'Barangay 1', 'Barangay 2', 'Barangay 3', 'Barangay 4', 'Barangay 5', 'Barangay 6', 'Banquerohan', 'Célestino Villacin', 'Ditching', 'Luna', 'Mabini', 'Magsaysay', 'Sicaba', 'Tiglawigan', 'Tinampaan', 'V. F. Gustilo'
  ],
  'Sagay City': [
    'Barangay 1', 'Barangay 2', 'Bato', 'Baviera', 'Bulanon', 'Campo Himoga-an', 'Colonia Divina', 'Fabrica', 'General Luna', 'Lopez Jaena', 'Malabon', 'Molocaboc', 'Old Sagay', 'Paraiso', 'Poblacion 1', 'Poblacion 2', 'Rizal', 'Taba-ao', 'Vito'
  ],
  'Victorias City': [
    'Barangay I', 'Barangay II', 'Barangay III', 'Barangay IV', 'Barangay V', 'Barangay VI', 'Barangay VII', 'Barangay VIII', 'Barangay IX', 'Barangay X', 'Barangay XI', 'Barangay XII', 'Barangay XIII', 'Barangay XIV', 'Barangay XV', 'Barangay XVI', 'Barangay XVII', 'Barangay XVIII', 'Barangay XIX', 'Barangay XX', 'Barangay XXI', 'Barangay XXII', 'Barangay XXIII', 'Barangay XXIV', 'Barangay XXV', 'Barangay XXVI'
  ],
  'Himamaylan City': [
    'Aguisan', 'Alim', 'Buenavista', 'Carabalan', 'Caradio-an', 'Libacao', 'Mambagaton', 'Nabali-an', 'Poblacion 1', 'Poblacion 2', 'Poblacion 3', 'Poblacion 4', 'San Antonio', 'Sara-et', 'Su-ay', 'Talaban', 'To-oy'
  ],
  'La Carlota City': [
    'Ara-al', 'Ayungon', 'Balabag', 'Batuan', 'Cubay', 'Haguimit', 'La Granja', 'Nagasi', 'Poblacion I', 'Poblacion II', 'Poblacion III', 'San Miguel', 'Yubo'
  ],
  'Sipalay City': [
    'Barangay 1', 'Barangay 2', 'Barangay 3', 'Barangay 4', 'Barangay 5', 'Cabadiangan', 'Cambaruran', 'Cartagena', 'Cayhagan', 'Gil Montilla', 'Mabinay', 'Manuca', 'Maricalum', 'Nabulao', 'Nauhang', 'San Jose', 'Vanderbilt'
  ],
  'Escalante City': [
    'Alimango', 'Balintawak', 'Binaguiohan', 'Buenavista', 'Cervantes', 'Dian-ay', 'Hapitan', 'Japitan', 'Langub', 'Libertad', 'Mabini', 'Magsaysay', 'Old Poblacion', 'Pagsa-pin', 'Poblacion', 'Rizal', 'Tamlang', 'Udtongan', 'Washington'
  ],
  'Iloilo City': [
    'Arevalo', 'City Proper', 'Jaro', 'La Paz', 'Lapuz', 'Mandurriao', 'Molo'
  ],
  'Cebu City': [
    'Adlaon', 'Aloguinsan', 'Apas', 'Babag', 'Banilad', 'Basak San Nicolas', 'Basak Pardo', 'Binaliw', 'Bonbon', 'Budlaan', 'Buhisan', 'Busay', 'Calamba', 'Cambinocot', 'Capitol Site', 'Carreta', 'Cogon Pardo', 'Cogon Ramos', 'Day-as', 'Duljo Fatima', 'Ermita', 'Guadalupe', 'Inayawan', 'Kalunasan', 'Kamagayan', 'Kamputhaw', 'Kasambagan', 'Kinasang-an', 'Labangon', 'Lahug', 'Lorega San Miguel', 'Lusaran', 'Luz', 'Mabini', 'Mabolo', 'Malubog', 'Mambaling', 'Pahina Central', 'Pahina San Nicolas', 'Pardo', 'Pari-an', 'Pit-os', 'Poblacion Pardo', 'Pung-ol Sibugay', 'Punta Princesa', 'Quiot', 'Sambag I', 'Sambag II', 'San Antonio', 'San Jose', 'San Nicolas Proper', 'San Roque', 'Santa Cruz', 'Santo Niño', 'Sawang Calero', 'Sinsin', 'Sirao', 'Subangdaku', 'Sudlon I', 'Sudlon II', 'T. Padilla', 'Tabunan', 'Tagbao', 'Talamban', 'Tisa', 'To-ong', 'Tejero', 'Tinago', 'Zapatera'
  ],
  'Davao City': [
    'Agdao', 'Baguio', 'Buhangin', 'Bunawan', 'Calinan', 'Marilog', 'Paquibato', 'Poblacion', 'Talomo', 'Toril', 'Tugbok'
  ],
};
