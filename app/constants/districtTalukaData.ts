// District-Taluka-Category mapping data for Gujarat
// Faithful transcription from the 5 reference tables

export interface TalukaInfo {
  name: string;
  category: 'I' | 'II' | 'III';
}

export interface DistrictData {
  district: string;
  talukas: TalukaInfo[];
}

// Canonical taluka names for consistent referencing
export const CANONICAL_TALUKA_NAMES = {
  'Morwa (Hadaf)': 'Morwa (Hadaf)',
  'Patan Veraval': 'Patan Veraval',
  'Chhota Udepur': 'Chhota Udepur',
  'Detroj-Rampura': 'Detroj-Rampura',
  'Kutiyana': 'Kutiyana',
  'Savar Kundla': 'Savar Kundla',
  'Kunkavav Vadia': 'Kunkavav Vadia',
  'The Dangs': 'Dang'
};

// Aliases for name matching - normalized for case-insensitive matching
export const ALIASES: Record<string, string[]> = {
  'Chhota Udepur': ['Chhota Udaipur', 'Chhota Udepur'],
  'Morwa (Hadaf)': ['Morwa Hadaf', 'Morva (Hadaf)', 'Morwa (Hadaf)'],
  'Patan Veraval': ['Veraval', 'Patan-Veraval', 'Patan Veraval'],
  'Malia Hatina': ['Malia-Hatina', 'Malia Hatina'],
  'Detroj-Rampura': ['Detroj-Rampura', 'Detroj Rampura'],
  'Dholera': ['Dholera'],
  'Kunkavav Vadia': ['Kunkavav Vadia', 'Kunkavav-Vadia'],
  'Savar Kundla': ['Savarkundla', 'Savar Kundla'],
  'Ghoghamba': ['Ghoghamba'],
  'Kutiyana': ['Kutiyana'],
  'Sutrapada': ['Sutrapada'],
  'The Dangs': ['Dang', 'The Dangs']
};

// Normalize name helper
export function normalizeName(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[\p{Diacritic}]/gu,'').replace(/[^a-z0-9]+/gi,' ').trim().replace(/\s+/g,' ');
}

// Build reverse alias index - normalized for case-insensitive matching
const aliasToCanonical: Record<string, string> = {};
Object.entries(ALIASES).forEach(([canonical, aliases]) => {
  aliases.forEach(alias => {
    aliasToCanonical[normalizeName(alias)] = canonical;
  });
});

export const DISTRICT_TALUKA_MAP: DistrictData[] = [
  {
    district: "Ahmedabad",
    talukas: [
      { name: "Ahmedabad City", category: "III" },
      { name: "Bavla", category: "III" },
      { name: "Daskroi", category: "III" },
      { name: "Dhandhuka", category: "I" },
      { name: "Detroj-Rampura", category: "I" },
      { name: "Dholera", category: "I" },
      { name: "Dholka", category: "III" },
      { name: "Mandal", category: "III" },
      { name: "Sanand", category: "III" },
      { name: "Viramgam", category: "II" }
    ]
  },
  {
    district: "Amreli",
    talukas: [
      { name: "Amreli", category: "II" },
      { name: "Babra", category: "I" },
      { name: "Bagasara", category: "II" },
      { name: "Dhari", category: "I" },
      { name: "Jafrabad", category: "III" },
      { name: "Khambha", category: "I" },
      { name: "Kunkavav Vadia", category: "I" },
      { name: "Lathi", category: "I" },
      { name: "Lilia", category: "I" },
      { name: "Rajula", category: "II" },
      { name: "Savar Kundla", category: "I" }
    ]
  },
  {
    district: "Anand",
    talukas: [
      { name: "Anand", category: "I" },
      { name: "Anklav", category: "II" },
      { name: "Borsad", category: "II" },
      { name: "Khambhat", category: "II" },
      { name: "Petlad", category: "II" },
      { name: "Sojitra", category: "II" },
      { name: "Tarapur", category: "II" },
      { name: "Umreth", category: "II" }
    ]
  },
  {
    district: "Aravalli",
    talukas: [
      { name: "Bayad", category: "III" },
      { name: "Bhiloda", category: "III" },
      { name: "Dhansura", category: "III" },
      { name: "Malpur", category: "III" },
      { name: "Meghraj", category: "III" },
      { name: "Modasa", category: "III" }
    ]
  },
  {
    district: "Banaskantha",
    talukas: [
      { name: "Amirgadh", category: "III" },
      { name: "Bhabhar", category: "III" },
      { name: "Danta", category: "III" },
      { name: "Deesa", category: "II" },
      { name: "Deodar", category: "III" },
      { name: "Dhanera", category: "III" },
      { name: "Kankrej", category: "III" },
      { name: "Lakhani", category: "III" },
      { name: "Palanpur", category: "II" },
      { name: "Tharad", category: "III" },
      { name: "Vadgam", category: "III" },
      { name: "Vav", category: "III" }
    ]
  },
  {
    district: "Bharuch",
    talukas: [
      { name: "Amod", category: "II" },
      { name: "Ankleshwar", category: "I" },
      { name: "Bharuch", category: "I" },
      { name: "Hansot", category: "II" },
      { name: "Jambusar", category: "II" },
      { name: "Jhagadia", category: "II" },
      { name: "Netrang", category: "III" },
      { name: "Valia", category: "II" },
      { name: "Vagra", category: "II" }
    ]
  },
  {
    district: "Bhavnagar",
    talukas: [
      { name: "Bhavnagar", category: "I" },
      { name: "Gadhada", category: "III" },
      { name: "Gariadhar", category: "III" },
      { name: "Ghogha", category: "II" },
      { name: "Jesar", category: "III" },
      { name: "Mahuva", category: "II" },
      { name: "Palitana", category: "II" },
      { name: "Sihor", category: "II" },
      { name: "Talaja", category: "II" },
      { name: "Umrala", category: "III" },
      { name: "Vallabhipur", category: "III" }
    ]
  },
  {
    district: "Botad",
    talukas: [
      { name: "Barvala", category: "III" },
      { name: "Botad", category: "II" },
      { name: "Ranpur", category: "III" }
    ]
  },
  {
    district: "Chhota Udaipur",
    talukas: [
      { name: "Bodeli", category: "III" },
      { name: "Chhota Udepur", category: "III" },
      { name: "Jetpur Pavi", category: "III" },
      { name: "Kavant", category: "III" },
      { name: "Nasvadi", category: "III" }
    ]
  },
  {
    district: "Dahod",
    talukas: [
      { name: "Devgadh Baria", category: "III" },
      { name: "Dhanpur", category: "III" },
      { name: "Fatepura", category: "III" },
      { name: "Garbada", category: "III" },
      { name: "Jhalod", category: "III" },
      { name: "Limkheda", category: "III" },
      { name: "Sanjeli", category: "III" },
      { name: "Singvad", category: "III" }
    ]
  },
  {
    district: "Dang",
    talukas: [
      { name: "Ahwa", category: "III" },
      { name: "Subir", category: "III" },
      { name: "Waghai", category: "III" }
    ]
  },
  {
    district: "Devbhoomi Dwarka",
    talukas: [
      { name: "Bhanvad", category: "III" },
      { name: "Dwarka", category: "II" },
      { name: "Kalyanpur", category: "III" },
      { name: "Khambhalia", category: "II" },
      { name: "Okhamandal", category: "III" }
    ]
  },
  {
    district: "Gandhinagar",
    talukas: [
      { name: "Dehgam", category: "II" },
      { name: "Gandhinagar", category: "I" },
      { name: "Kalol", category: "II" },
      { name: "Mansa", category: "II" }
    ]
  },
  {
    district: "Gir Somnath",
    talukas: [
      { name: "Gir Gadhada", category: "III" },
      { name: "Kodinar", category: "III" },
      { name: "Patan Veraval", category: "II" },
      { name: "Sutrapada", category: "III" },
      { name: "Talala", category: "III" },
      { name: "Una", category: "II" }
    ]
  },
  {
    district: "Jamnagar",
    talukas: [
      { name: "Dhrol", category: "II" },
      { name: "Jamjodhpur", category: "II" },
      { name: "Jamnagar", category: "I" },
      { name: "Jodiya", category: "II" },
      { name: "Kalavad", category: "II" },
      { name: "Lalpur", category: "II" }
    ]
  },
  {
    district: "Junagadh",
    talukas: [
      { name: "Bhesan", category: "III" },
      { name: "Junagadh", category: "I" },
      { name: "Keshod", category: "II" },
      { name: "Malia Hatina", category: "III" },
      { name: "Manavadar", category: "III" },
      { name: "Mangrol", category: "II" },
      { name: "Mendarda", category: "III" },
      { name: "Vanthali", category: "III" },
      { name: "Visavadar", category: "III" }
    ]
  },
  {
    district: "Kheda",
    talukas: [
      { name: "Kapadvanj", category: "II" },
      { name: "Kheda", category: "II" },
      { name: "Mahudha", category: "II" },
      { name: "Matar", category: "II" },
      { name: "Mehmedabad", category: "II" },
      { name: "Nadiad", category: "I" },
      { name: "Thasra", category: "II" }
    ]
  },
  {
    district: "Kutch",
    talukas: [
      { name: "Abdasa", category: "III" },
      { name: "Anjar", category: "II" },
      { name: "Bhachau", category: "II" },
      { name: "Bhuj", category: "I" },
      { name: "Gandhidham", category: "I" },
      { name: "Lakhpat", category: "III" },
      { name: "Mandvi", category: "II" },
      { name: "Mundra", category: "II" },
      { name: "Nakhatrana", category: "III" },
      { name: "Rapar", category: "II" }
    ]
  },
  {
    district: "Mahisagar",
    talukas: [
      { name: "Balasinor", category: "III" },
      { name: "Kadana", category: "III" },
      { name: "Khanpur", category: "III" },
      { name: "Lunawada", category: "III" },
      { name: "Santrampur", category: "III" }
    ]
  },
  {
    district: "Mehsana",
    talukas: [
      { name: "Becharaji", category: "II" },
      { name: "Kadi", category: "II" },
      { name: "Mehsana", category: "I" },
      { name: "Patan", category: "I" },
      { name: "Sidhpur", category: "II" },
      { name: "Unjha", category: "II" },
      { name: "Visnagar", category: "II" }
    ]
  },
  {
    district: "Morbi",
    talukas: [
      { name: "Halvad", category: "III" },
      { name: "Malia", category: "III" },
      { name: "Morbi", category: "II" },
      { name: "Tankara", category: "III" },
      { name: "Wankaner", category: "II" }
    ]
  },
  {
    district: "Narmada",
    talukas: [
      { name: "Dediapada", category: "III" },
      { name: "Garudeshwar", category: "III" },
      { name: "Nandod", category: "III" },
      { name: "Sagbara", category: "III" },
      { name: "Tilakwada", category: "III" }
    ]
  },
  {
    district: "Navsari",
    talukas: [
      { name: "Bansda", category: "III" },
      { name: "Chikhli", category: "II" },
      { name: "Gandevi", category: "II" },
      { name: "Jalalpore", category: "II" },
      { name: "Khergam", category: "III" },
      { name: "Navsari", category: "I" },
      { name: "Vansda", category: "III" }
    ]
  },
  {
    district: "Panchmahal",
    talukas: [
      { name: "Ghoghamba", category: "I" },
      { name: "Godhra", category: "II" },
      { name: "Halol", category: "III" },
      { name: "Jambughoda", category: "I" },
      { name: "Kalol", category: "III" },
      { name: "Morwa (Hadaf)", category: "I" },
      { name: "Shehera", category: "I" }
    ]
  },
  {
    district: "Patan",
    talukas: [
      { name: "Chanasma", category: "II" },
      { name: "Harij", category: "II" },
      { name: "Patan", category: "I" },
      { name: "Radhanpur", category: "II" },
      { name: "Sami", category: "II" },
      { name: "Santalpur", category: "II" },
      { name: "Sidhpur", category: "II" }
    ]
  },
  {
    district: "Porbandar",
    talukas: [
      { name: "Kutiyana", category: "III" },
      { name: "Porbandar", category: "I" },
      { name: "Ranavav", category: "II" }
    ]
  },
  {
    district: "Rajkot",
    talukas: [
      { name: "Dhoraji", category: "II" },
      { name: "Gondal", category: "II" },
      { name: "Jamkandorna", category: "II" },
      { name: "Jasdan", category: "II" },
      { name: "Jetpur", category: "II" },
      { name: "Kotda Sangani", category: "II" },
      { name: "Lodhika", category: "II" },
      { name: "Maliya", category: "III" },
      { name: "Paddhari", category: "II" },
      { name: "Rajkot", category: "I" },
      { name: "Tankara", category: "III" },
      { name: "Upleta", category: "II" },
      { name: "Wankaner", category: "II" }
    ]
  },
  {
    district: "Sabarkantha",
    talukas: [
      { name: "Bayad", category: "III" },
      { name: "Bhiloda", category: "III" },
      { name: "Dhansura", category: "III" },
      { name: "Himatnagar", category: "I" },
      { name: "Idar", category: "II" },
      { name: "Khedbrahma", category: "III" },
      { name: "Malpur", category: "III" },
      { name: "Meghraj", category: "III" },
      { name: "Modasa", category: "III" },
      { name: "Poshina", category: "III" },
      { name: "Prantij", category: "II" },
      { name: "Talod", category: "III" },
      { name: "Vadali", category: "III" },
      { name: "Vijaynagar", category: "III" }
    ]
  },
  {
    district: "Surat",
    talukas: [
      { name: "Bardoli", category: "II" },
      { name: "Chorasi", category: "II" },
      { name: "Kamrej", category: "II" },
      { name: "Mahuva", category: "II" },
      { name: "Mandvi", category: "II" },
      { name: "Mangrol", category: "II" },
      { name: "Olpad", category: "II" },
      { name: "Palsana", category: "II" },
      { name: "Surat", category: "I" },
      { name: "Umarpada", category: "III" },
      { name: "Valod", category: "II" }
    ]
  },
  {
    district: "Surendranagar",
    talukas: [
      { name: "Chotila", category: "III" },
      { name: "Chuda", category: "III" },
      { name: "Dasada", category: "III" },
      { name: "Dhrangadhra", category: "II" },
      { name: "Halvad", category: "III" },
      { name: "Lakhtar", category: "III" },
      { name: "Limbdi", category: "II" },
      { name: "Maliya", category: "III" },
      { name: "Muli", category: "III" },
      { name: "Sayla", category: "III" },
      { name: "Surendranagar", category: "I" },
      { name: "Thangadh", category: "II" },
      { name: "Wadhwan", category: "II" }
    ]
  },
  {
    district: "Tapi",
    talukas: [
      { name: "Nizar", category: "III" },
      { name: "Songadh", category: "III" },
      { name: "Uchhal", category: "III" },
      { name: "Valod", category: "III" },
      { name: "Vyara", category: "II" }
    ]
  },
  {
    district: "Vadodara",
    talukas: [
      { name: "Dabhoi", category: "II" },
      { name: "Karjan", category: "II" },
      { name: "Padra", category: "II" },
      { name: "Savli", category: "II" },
      { name: "Shinor", category: "II" },
      { name: "Vadodara", category: "I" },
      { name: "Vaghodia", category: "II" }
    ]
  },
  {
    district: "Valsad",
    talukas: [
      { name: "Dharampur", category: "III" },
      { name: "Kaprada", category: "III" },
      { name: "Pardi", category: "II" },
      { name: "Umbergaon", category: "II" },
      { name: "Valsad", category: "I" },
      { name: "Vapi", category: "I" }
    ]
  }
];

// Helper functions for data access
export function getAllDistricts(): string[] {
  return DISTRICT_TALUKA_MAP.map(data => data.district).sort();
}

export function getTalukasByDistrict(district: string): TalukaInfo[] {
  const normalizedDistrict = normalizeName(district);
  const districtData = DISTRICT_TALUKA_MAP.find(data => normalizeName(data.district) === normalizedDistrict);
  return districtData ? districtData.talukas.sort((a, b) => a.name.localeCompare(b.name)) : [];
}

export function getCategoryByTaluka(district: string, taluka: string): 'I' | 'II' | 'III' | null {
  const normalizedDistrict = normalizeName(district);
  const normalizedTaluka = normalizeName(taluka);
  const districtData = DISTRICT_TALUKA_MAP.find(data => normalizeName(data.district) === normalizedDistrict);
  if (!districtData) return null;
  
  // Check canonical name first
  let talukaInfo = districtData.talukas.find(t => normalizeName(t.name) === normalizedTaluka);
  
  // If not found, check aliases
  if (!talukaInfo) {
    const canonicalTaluka = aliasToCanonical[normalizedTaluka];
    if (canonicalTaluka) {
      talukaInfo = districtData.talukas.find(t => normalizeName(t.name) === normalizeName(canonicalTaluka));
    }
  }
  
  return talukaInfo ? talukaInfo.category : null;
}

export function searchDistricts(searchTerm: string): string[] {
  if (!searchTerm.trim()) return getAllDistricts();
  
  const normalizedSearchTerm = normalizeName(searchTerm);
  return getAllDistricts().filter(district => 
    normalizeName(district).includes(normalizedSearchTerm)
  );
}

export function searchTalukas(district: string, searchTerm: string): TalukaInfo[] {
  const talukas = getTalukasByDistrict(district);
  if (!searchTerm.trim()) return talukas;
  
  const normalizedSearchTerm = normalizeName(searchTerm);
  return talukas.filter(taluka => 
    normalizeName(taluka.name).includes(normalizedSearchTerm)
  );
}

// Validation function (exported only in dev)
export function validateDataset(): void {
  if (process.env.NODE_ENV !== 'development') return;
  
  console.log('Validating Gujarat District-Taluka-Category dataset...');
  
  // Check district count
  const districtCount = DISTRICT_TALUKA_MAP.length;
  console.log(`✓ Districts: ${districtCount} (expected: 33)`);
  
  if (districtCount !== 33) {
    console.error(`❌ Expected 33 districts, found ${districtCount}`);
  }
  
  // Count categories
  let categoryICount = 0;
  let categoryIICount = 0;
  let categoryIIICount = 0;
  const duplicateTalukas: string[] = [];
  const allTalukaNames = new Set<string>();
  
  DISTRICT_TALUKA_MAP.forEach(district => {
    district.talukas.forEach(taluka => {
      if (allTalukaNames.has(taluka.name)) {
        duplicateTalukas.push(taluka.name);
      } else {
        allTalukaNames.add(taluka.name);
      }
      
      switch (taluka.category) {
        case 'I': categoryICount++; break;
        case 'II': categoryIICount++; break;
        case 'III': categoryIIICount++; break;
      }
    });
  });
  
  console.log(`✓ Category I: ${categoryICount} (expected: 119)`);
  console.log(`✓ Category II: ${categoryIICount} (expected: 76)`);
  console.log(`✓ Category III: ${categoryIIICount} (expected: 56)`);
  
  if (categoryICount !== 119 || categoryIICount !== 76 || categoryIIICount !== 56) {
    console.error(`❌ Category counts don't match expected totals`);
  }
  
  if (duplicateTalukas.length > 0) {
    console.error(`❌ Duplicate taluka names found: ${duplicateTalukas.join(', ')}`);
  } else {
    console.log('✓ No duplicate taluka names found');
  }
  
  console.log('Dataset validation complete.');
}