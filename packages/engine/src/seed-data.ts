// Hardcoded seed data for real-world confederations. No API dependencies.
// UEFA is fully available; other confederations are marked "coming soon".

export interface TeamData {
  name: string;
  strength: number;
  arraigo: number;
  stadium: string;
}

export interface DivisionData {
  name: string;
  orden: number;
  teams: TeamData[];
}

export interface LeagueData {
  name: string;
  country: string;
  flag: string;
  divisions: DivisionData[];
}

export interface ConfederationData {
  id: number;
  name: string;
  region: string;
  available: boolean;
  leagues: LeagueData[];
}

export const CONFEDERATIONS: ConfederationData[] = [
  {
    id: 1,
    name: 'UEFA',
    region: 'Europa',
    available: true,
    leagues: [
      // ─── England: Premier League ─────────────────────────────────────
      {
        name: 'Premier League',
        country: 'Inglaterra',
        flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
        divisions: [
          {
            name: 'Premier League',
            orden: 1,
            teams: [
              { name: 'Manchester City', strength: 92, arraigo: 95, stadium: 'Etihad Stadium' },
              { name: 'Liverpool FC', strength: 90, arraigo: 95, stadium: 'Anfield' },
              { name: 'Arsenal FC', strength: 88, arraigo: 95, stadium: 'Emirates Stadium' },
              { name: 'Manchester United', strength: 83, arraigo: 90, stadium: 'Old Trafford' },
              { name: 'Chelsea FC', strength: 82, arraigo: 90, stadium: 'Stamford Bridge' },
              { name: 'Tottenham Hotspur', strength: 78, arraigo: 85, stadium: 'Tottenham Hotspur Stadium' },
              { name: 'Newcastle United', strength: 75, arraigo: 80, stadium: "St James' Park" },
              { name: 'Aston Villa', strength: 70, arraigo: 80, stadium: 'Villa Park' },
              { name: 'West Ham United', strength: 65, arraigo: 75, stadium: 'London Stadium' },
              { name: 'Brighton & Hove Albion', strength: 62, arraigo: 65, stadium: 'AMEX Stadium' },
              { name: 'AFC Bournemouth', strength: 58, arraigo: 55, stadium: 'Vitality Stadium' },
              { name: 'Everton FC', strength: 58, arraigo: 75, stadium: 'Hill Dickinson Stadium' },
              { name: 'Wolverhampton Wanderers', strength: 52, arraigo: 65, stadium: 'Molineux Stadium' },
              { name: 'Fulham FC', strength: 50, arraigo: 60, stadium: 'Craven Cottage' },
              { name: 'Nottingham Forest', strength: 55, arraigo: 65, stadium: 'City Ground' },
              { name: 'Crystal Palace', strength: 52, arraigo: 60, stadium: 'Selhurst Park' },
              { name: 'Leeds United', strength: 55, arraigo: 70, stadium: 'Elland Road' },
              { name: 'Brentford FC', strength: 55, arraigo: 55, stadium: 'Gtech Community Stadium' },
              { name: 'Sunderland AFC', strength: 48, arraigo: 70, stadium: 'Stadium of Light' },
              { name: 'Burnley FC', strength: 45, arraigo: 70, stadium: 'Turf Moor' },
            ],
          },
        ],
      },
      // ─── Spain: La Liga ──────────────────────────────────────────────
      {
        name: 'La Liga',
        country: 'España',
        flag: '🇪🇸',
        divisions: [
          {
            name: 'La Liga',
            orden: 1,
            teams: [
              { name: 'Real Madrid CF', strength: 95, arraigo: 100, stadium: 'Santiago Bernabéu' },
              { name: 'FC Barcelona', strength: 90, arraigo: 95, stadium: 'Estadi Olímpic Lluís Companys' },
              { name: 'Atlético de Madrid', strength: 82, arraigo: 85, stadium: 'Cívitas Metropolitano' },
              { name: 'Athletic Club', strength: 72, arraigo: 90, stadium: 'San Mamés' },
              { name: 'Villarreal CF', strength: 68, arraigo: 75, stadium: 'Estadio de la Cerámica' },
              { name: 'Sevilla FC', strength: 68, arraigo: 80, stadium: 'Ramón Sánchez-Pizjuán' },
              { name: 'Real Betis', strength: 65, arraigo: 75, stadium: 'Estadio Benito Villamarín' },
              { name: 'Real Sociedad', strength: 65, arraigo: 80, stadium: 'Reale Arena' },
              { name: 'Valencia CF', strength: 62, arraigo: 80, stadium: 'Estadio de Mestalla' },
              { name: 'RC Celta de Vigo', strength: 52, arraigo: 65, stadium: 'Estadio de Balaídos' },
              { name: 'CA Osasuna', strength: 50, arraigo: 75, stadium: 'El Sadar' },
              { name: 'Getafe CF', strength: 48, arraigo: 65, stadium: 'Coliseum' },
              { name: 'RCD Espanyol', strength: 50, arraigo: 70, stadium: 'RCDE Stadium' },
              { name: 'Girona FC', strength: 50, arraigo: 60, stadium: 'Montilivi' },
              { name: 'RCD Mallorca', strength: 48, arraigo: 70, stadium: 'Son Moix' },
              { name: 'Rayo Vallecano', strength: 47, arraigo: 70, stadium: 'Estadio de Vallecas' },
              { name: 'Deportivo Alavés', strength: 45, arraigo: 70, stadium: 'Mendizorroza' },
              { name: 'Elche CF', strength: 42, arraigo: 60, stadium: 'Manuel Martínez Valero' },
              { name: 'Levante UD', strength: 40, arraigo: 65, stadium: 'Ciutat de València' },
              { name: 'Real Oviedo', strength: 40, arraigo: 65, stadium: 'Carlos Tartiere' },
            ],
          },
        ],
      },
      // ─── Italy: Serie A ──────────────────────────────────────────────
      {
        name: 'Serie A',
        country: 'Italia',
        flag: '🇮🇹',
        divisions: [
          {
            name: 'Serie A',
            orden: 1,
            teams: [
              { name: 'Inter Milan', strength: 88, arraigo: 90, stadium: 'Stadio Giuseppe Meazza' },
              { name: 'Juventus FC', strength: 85, arraigo: 95, stadium: 'Allianz Stadium' },
              { name: 'AC Milan', strength: 82, arraigo: 90, stadium: 'Stadio Giuseppe Meazza' },
              { name: 'SSC Napoli', strength: 82, arraigo: 85, stadium: 'Stadio Diego Armando Maradona' },
              { name: 'AS Roma', strength: 75, arraigo: 85, stadium: 'Stadio Olimpico' },
              { name: 'Atalanta BC', strength: 75, arraigo: 70, stadium: 'Gewiss Stadium' },
              { name: 'SS Lazio', strength: 72, arraigo: 80, stadium: 'Stadio Olimpico' },
              { name: 'ACF Fiorentina', strength: 68, arraigo: 80, stadium: 'Stadio Artemio Franchi' },
              { name: 'Bologna FC', strength: 65, arraigo: 75, stadium: 'Stadio Renato Dall\'Ara' },
              { name: 'Torino FC', strength: 55, arraigo: 75, stadium: 'Stadio Olimpico Grande Torino' },
              { name: 'Genoa CFC', strength: 50, arraigo: 75, stadium: 'Stadio Luigi Ferraris' },
              { name: 'Udinese Calcio', strength: 48, arraigo: 65, stadium: 'Bluenergy Stadium' },
              { name: 'Parma Calcio', strength: 48, arraigo: 70, stadium: 'Stadio Ennio Tardini' },
              { name: 'Como 1907', strength: 45, arraigo: 55, stadium: 'Stadio Giuseppe Sinigaglia' },
              { name: 'Hellas Verona', strength: 45, arraigo: 65, stadium: 'Stadio Marcantonio Bentegodi' },
              { name: 'US Lecce', strength: 45, arraigo: 65, stadium: 'Stadio Via del Mare' },
              { name: 'Cagliari Calcio', strength: 45, arraigo: 70, stadium: 'Unipol Domus' },
              { name: 'US Sassuolo', strength: 42, arraigo: 55, stadium: 'Mapei Stadium' },
              { name: 'Pisa SC', strength: 38, arraigo: 55, stadium: 'Arena Garibaldi' },
              { name: 'US Cremonese', strength: 38, arraigo: 55, stadium: 'Stadio Giovanni Zini' },
            ],
          },
        ],
      },
      // ─── Germany: Bundesliga ─────────────────────────────────────────
      {
        name: 'Bundesliga',
        country: 'Alemania',
        flag: '🇩🇪',
        divisions: [
          {
            name: 'Bundesliga',
            orden: 1,
            teams: [
              { name: 'Bayern Munich', strength: 92, arraigo: 95, stadium: 'Allianz Arena' },
              { name: 'Borussia Dortmund', strength: 82, arraigo: 85, stadium: 'Signal Iduna Park' },
              { name: 'Bayer Leverkusen', strength: 78, arraigo: 75, stadium: 'BayArena' },
              { name: 'RB Leipzig', strength: 75, arraigo: 70, stadium: 'Red Bull Arena' },
              { name: 'VfB Stuttgart', strength: 70, arraigo: 80, stadium: 'MHPArena' },
              { name: 'Eintracht Frankfurt', strength: 70, arraigo: 75, stadium: 'Deutsche Bank Park' },
              { name: 'Borussia Mönchengladbach', strength: 62, arraigo: 80, stadium: 'Borussia-Park' },
              { name: 'SC Freiburg', strength: 62, arraigo: 75, stadium: 'Europa-Park Stadion' },
              { name: 'VfL Wolfsburg', strength: 58, arraigo: 60, stadium: 'Volkswagen Arena' },
              { name: 'Hamburger SV', strength: 58, arraigo: 80, stadium: 'Volksparkstadion' },
              { name: 'Werder Bremen', strength: 55, arraigo: 80, stadium: 'Weserstadion' },
              { name: 'TSG Hoffenheim', strength: 55, arraigo: 55, stadium: 'PreZero Arena' },
              { name: '1. FC Köln', strength: 55, arraigo: 80, stadium: 'RheinEnergieStadion' },
              { name: '1. FC Union Berlin', strength: 52, arraigo: 70, stadium: 'Stadion An der Alten Försterei' },
              { name: 'Mainz 05', strength: 50, arraigo: 65, stadium: 'Mewa Arena' },
              { name: 'FC Augsburg', strength: 48, arraigo: 65, stadium: 'WWK Arena' },
              { name: 'FC St. Pauli', strength: 42, arraigo: 75, stadium: 'Millerntor-Stadion' },
              { name: '1. FC Heidenheim', strength: 38, arraigo: 60, stadium: 'Voith-Arena' },
            ],
          },
        ],
      },
      // ─── France: Ligue 1 ────────────────────────────────────────────
      {
        name: 'Ligue 1',
        country: 'Francia',
        flag: '🇫🇷',
        divisions: [
          {
            name: 'Ligue 1',
            orden: 1,
            teams: [
              { name: 'Paris Saint-Germain', strength: 90, arraigo: 95, stadium: 'Parc des Princes' },
              { name: 'Olympique de Marseille', strength: 75, arraigo: 85, stadium: 'Orange Vélodrome' },
              { name: 'Olympique Lyonnais', strength: 72, arraigo: 80, stadium: 'Groupama Stadium' },
              { name: 'AS Monaco', strength: 72, arraigo: 65, stadium: 'Stade Louis II' },
              { name: 'LOSC Lille', strength: 70, arraigo: 75, stadium: 'Stade Pierre-Mauroy' },
              { name: 'RC Lens', strength: 68, arraigo: 75, stadium: 'Stade Bollaert-Delelis' },
              { name: 'OGC Nice', strength: 62, arraigo: 70, stadium: 'Allianz Riviera' },
              { name: 'Stade Rennais', strength: 62, arraigo: 75, stadium: 'Roazhon Park' },
              { name: 'Stade Brestois', strength: 55, arraigo: 70, stadium: 'Stade Francis-Le Blé' },
              { name: 'RC Strasbourg', strength: 55, arraigo: 70, stadium: 'Stade de la Meinau' },
              { name: 'Toulouse FC', strength: 55, arraigo: 70, stadium: 'Stadium de Toulouse' },
              { name: 'FC Nantes', strength: 52, arraigo: 75, stadium: 'Stade de la Beaujoire' },
              { name: 'Le Havre AC', strength: 45, arraigo: 60, stadium: 'Stade Océane' },
              { name: 'AJ Auxerre', strength: 45, arraigo: 65, stadium: 'Stade Abbé Deschamps' },
              { name: 'Angers SCO', strength: 42, arraigo: 60, stadium: 'Stade Raymond Kopa' },
              { name: 'FC Lorient', strength: 42, arraigo: 60, stadium: 'Stade du Moustoir' },
              { name: 'Paris FC', strength: 40, arraigo: 50, stadium: 'Stade Jean-Bouin' },
              { name: 'FC Metz', strength: 38, arraigo: 60, stadium: 'Stade Saint-Symphorien' },
            ],
          },
        ],
      },
      // ─── Netherlands: Eredivisie ─────────────────────────────────────
      {
        name: 'Eredivisie',
        country: 'Países Bajos',
        flag: '🇳🇱',
        divisions: [
          {
            name: 'Eredivisie',
            orden: 1,
            teams: [
              { name: 'Ajax Amsterdam', strength: 78, arraigo: 85, stadium: 'Johan Cruijff ArenA' },
              { name: 'PSV Eindhoven', strength: 75, arraigo: 80, stadium: 'Philips Stadion' },
              { name: 'Feyenoord Rotterdam', strength: 72, arraigo: 85, stadium: 'De Kuip' },
              { name: 'FC Twente', strength: 62, arraigo: 75, stadium: 'De Grolsch Veste' },
              { name: 'AZ Alkmaar', strength: 62, arraigo: 70, stadium: 'AFAS Stadion' },
              { name: 'FC Utrecht', strength: 55, arraigo: 70, stadium: 'Stadion Galgenwaard' },
              { name: 'SC Heerenveen', strength: 50, arraigo: 70, stadium: 'Abe Lenstra Stadion' },
              { name: 'FC Groningen', strength: 48, arraigo: 70, stadium: 'Euroborg' },
              { name: 'NEC Nijmegen', strength: 48, arraigo: 65, stadium: 'Goffertstadion' },
              { name: 'Sparta Rotterdam', strength: 45, arraigo: 70, stadium: 'Het Kasteel' },
              { name: 'Go Ahead Eagles', strength: 40, arraigo: 65, stadium: 'De Adelaarshorst' },
              { name: 'PEC Zwolle', strength: 40, arraigo: 60, stadium: 'MAC³PARK Stadion' },
              { name: 'Fortuna Sittard', strength: 40, arraigo: 60, stadium: 'Fortuna Sittard Stadion' },
              { name: 'NAC Breda', strength: 38, arraigo: 60, stadium: 'Rat Verlegh Stadion' },
              { name: 'Excelsior', strength: 38, arraigo: 55, stadium: 'Van Donge & De Roo Stadion' },
              { name: 'FC Volendam', strength: 35, arraigo: 55, stadium: 'Kras Stadion' },
              { name: 'Heracles Almelo', strength: 35, arraigo: 55, stadium: 'Asito Stadion' },
              { name: 'SC Telstar', strength: 32, arraigo: 50, stadium: 'BUKO Stadion' },
            ],
          },
        ],
      },
      // ─── Portugal: Primeira Liga ─────────────────────────────────────
      {
        name: 'Primeira Liga',
        country: 'Portugal',
        flag: '🇵🇹',
        divisions: [
          {
            name: 'Primeira Liga',
            orden: 1,
            teams: [
              { name: 'SL Benfica', strength: 82, arraigo: 90, stadium: 'Estádio da Luz' },
              { name: 'FC Porto', strength: 80, arraigo: 90, stadium: 'Estádio do Dragão' },
              { name: 'Sporting CP', strength: 80, arraigo: 90, stadium: 'Estádio José Alvalade' },
              { name: 'SC Braga', strength: 65, arraigo: 75, stadium: 'Estádio Municipal de Braga' },
              { name: 'Vitória de Guimarães', strength: 52, arraigo: 75, stadium: 'Estádio Dom Afonso Henriques' },
              { name: 'FC Famalicão', strength: 48, arraigo: 60, stadium: 'Estádio Municipal 22 de Junho' },
              { name: 'Gil Vicente', strength: 45, arraigo: 65, stadium: 'Estádio Cidade de Barcelos' },
              { name: 'Estoril Praia', strength: 42, arraigo: 55, stadium: 'Estádio António Coimbra da Mota' },
              { name: 'Moreirense FC', strength: 42, arraigo: 65, stadium: 'Parque Desportivo' },
              { name: 'Rio Ave FC', strength: 42, arraigo: 65, stadium: 'Estádio do Rio Ave' },
              { name: 'FC Arouca', strength: 40, arraigo: 55, stadium: 'Estádio Municipal de Arouca' },
              { name: 'CD Nacional', strength: 40, arraigo: 70, stadium: 'Estádio da Madeira' },
              { name: 'SC Santa Clara', strength: 40, arraigo: 65, stadium: 'Estádio de São Miguel' },
              { name: 'Casa Pia AC', strength: 38, arraigo: 55, stadium: 'Estádio Pina Manique' },
              { name: 'Estrela da Amadora', strength: 38, arraigo: 55, stadium: 'Estádio José Gomes' },
              { name: 'CD Tondela', strength: 35, arraigo: 60, stadium: 'Estádio João Cardoso' },
              { name: 'Alverca', strength: 35, arraigo: 50, stadium: 'Complexo Desportivo' },
              { name: 'AVS Futebol', strength: 32, arraigo: 50, stadium: 'Estádio CD das Aves' },
            ],
          },
        ],
      },
    ],
  },
  // ─── CONMEBOL (coming soon) ───────────────────────────────────────────
  {
    id: 2,
    name: 'CONMEBOL',
    region: 'Sudamérica',
    available: false,
    leagues: [],
  },
  // ─── Other confederations (placeholder) ──────────────────────────────
  {
    id: 3,
    name: 'CONCACAF',
    region: 'Norte, Centroamérica y Caribe',
    available: false,
    leagues: [],
  },
  {
    id: 4,
    name: 'CAF',
    region: 'África',
    available: false,
    leagues: [],
  },
  {
    id: 5,
    name: 'AFC',
    region: 'Asia',
    available: false,
    leagues: [],
  },
  {
    id: 6,
    name: 'OFC',
    region: 'Oceanía',
    available: false,
    leagues: [],
  },
];

// Helper: get all available teams flat
export function getAllRivalTeams(): Array<TeamData & { league: string; country: string; flag: string }> {
  const result: Array<TeamData & { league: string; country: string; flag: string }> = [];
  for (const conf of CONFEDERATIONS) {
    if (!conf.available) continue;
    for (const league of conf.leagues) {
      for (const div of league.divisions) {
        for (const team of div.teams) {
          result.push({ ...team, league: league.name, country: league.country, flag: league.flag });
        }
      }
    }
  }
  return result;
}
