/**
 * Search assistance for Indian music.
 *
 * <p>Audius stores no film metadata, so searching a movie title only matches uploads that
 * happen to mention it. Expanding a recognised title into its well-known songs, and
 * correcting near-miss spellings, is what makes "search by movie" work at all here.
 */

/** A film whose songs listeners commonly look for. */
interface MovieHint {
  /** Canonical title. */
  readonly title: string;
  /** Alternative spellings and common misspellings. */
  readonly aliases: readonly string[];
  /** Songs to search for when the title is recognised. */
  readonly songs: readonly string[];
}

/**
 * Well-known films and their signature songs.
 *
 * <p>Deliberately small and hand-picked: a long list would be guesswork, whereas these
 * titles are unambiguous and their songs are widely uploaded.
 */
const MOVIES: readonly MovieHint[] = [
  {
    title: 'Aashiqui 2',
    aliases: ['aashiqui', 'ashiqui', 'aashiki', 'ashiqui 2', 'aashiqui2'],
    songs: ['Tum Hi Ho', 'Sun Raha Hai', 'Chahun Main Ya Naa'],
  },
  {
    title: 'Kabir Singh',
    aliases: ['kabir sing', 'kabeer singh', 'kabirsingh'],
    songs: ['Bekhayali', 'Tujhe Kitna Chahne Lage', 'Kaise Hua'],
  },
  {
    title: 'Arjun Reddy',
    aliases: ['arjun redy', 'arjunreddy'],
    songs: ['Telisiney Na Nuvvey', 'Emitemitemito'],
  },
  {
    title: 'Dilwale Dulhania Le Jayenge',
    aliases: ['ddlj', 'dilwale dulhania', 'dilwale'],
    songs: ['Tujhe Dekha To', 'Mehndi Laga Ke Rakhna', 'Ho Gaya Hai Tujhko'],
  },
  {
    title: 'Kuch Kuch Hota Hai',
    aliases: ['kkhh', 'kuch kuch', 'kuchkuch hota hai'],
    songs: ['Kuch Kuch Hota Hai', 'Koi Mil Gaya', 'Ladki Badi Anjani Hai'],
  },
  {
    title: 'Kabhi Khushi Kabhie Gham',
    aliases: ['k3g', 'kabhi khushi', 'kabhi kushi kabhi gham'],
    songs: ['Bole Chudiyan', 'Suraj Hua Maddham', 'You Are My Soniya'],
  },
  {
    title: 'Devdas',
    aliases: ['devdaas', 'dev das'],
    songs: ['Dola Re Dola', 'Maar Dala', 'Silsila Ye Chaahat Ka'],
  },
  {
    title: 'Bajirao Mastani',
    aliases: ['bajirao', 'bajirav mastani', 'bajirao mastani'],
    songs: ['Deewani Mastani', 'Pinga', 'Malhari', 'Aayat'],
  },
  {
    title: 'Padmaavat',
    aliases: ['padmavat', 'padmavati', 'padmaavati'],
    songs: ['Ghoomar', 'Ek Dil Ek Jaan', 'Khalibali'],
  },
  {
    title: 'Rockstar',
    aliases: ['rock star', 'rokstar'],
    songs: ['Nadaan Parindey', 'Tum Ho', 'Sadda Haq', 'Kun Faya Kun'],
  },
  {
    title: 'Yeh Jawaani Hai Deewani',
    aliases: ['yjhd', 'ye jawani hai deewani', 'yeh jawani'],
    songs: ['Balam Pichkari', 'Badtameez Dil', 'Kabira'],
  },
  {
    title: 'Jab We Met',
    aliases: ['jab we met', 'jabwemet', 'jab v met'],
    songs: ['Tum Se Hi', 'Mauja Hi Mauja', 'Yeh Ishq Hai'],
  },
  {
    title: 'Dangal',
    aliases: ['dangl', 'dangal movie'],
    songs: ['Dangal Title Track', 'Haanikaarak Bapu', 'Gilehriyaan'],
  },
  {
    title: 'Bahubali',
    aliases: ['baahubali', 'bahuballi', 'bahubali 2'],
    songs: ['Manohari', 'Pacha Bottesi', 'Saahore Baahubali'],
  },
  {
    title: 'Gully Boy',
    aliases: ['gulli boy', 'gullyboy'],
    songs: ['Apna Time Aayega', 'Mere Gully Mein', 'Doori'],
  },
  {
    title: 'Pushpa',
    aliases: ['puspa', 'pushpa the rise'],
    songs: ['Srivalli', 'Oo Antava', 'Saami Saami'],
  },
  {
    title: 'RRR',
    aliases: ['rrr movie', 'r r r'],
    songs: ['Naatu Naatu', 'Komuram Bheemudo', 'Dosti'],
  },
  {
    title: 'Animal',
    aliases: ['animal movie', 'aniaml'],
    songs: ['Arjan Vailly', 'Satranga', 'Hua Main'],
  },
  {
    title: 'Tere Naam',
    aliases: ['tere nam', 'terenaam'],
    songs: ['Tere Naam', 'Odhni', 'Lagan Lagi'],
  },
  {
    title: 'Om Shanti Om',
    aliases: ['om shanti', 'omshantiom'],
    songs: ['Main Agar Kahoon', 'Dard E Disco', 'Ajab Si'],
  },
];

/** Common misspellings for terms that are not film titles. */
const TERM_CORRECTIONS: Readonly<Record<string, string>> = {
  bollywod: 'bollywood',
  bollwood: 'bollywood',
  bolywood: 'bollywood',
  bollyood: 'bollywood',
  punjabi: 'punjabi',
  panjabi: 'punjabi',
  punjbi: 'punjabi',
  pubjabi: 'punjabi',
  bhojpri: 'bhojpuri',
  bojpuri: 'bhojpuri',
  bhojpuriya: 'bhojpuri',
  hariyanvi: 'haryanvi',
  haryanavi: 'haryanvi',
  rajputana: 'rajputana',
  rajputna: 'rajputana',
  rajpoot: 'rajputana',
  qawali: 'qawwali',
  kawwali: 'qawwali',
  gazal: 'ghazal',
  gazhal: 'ghazal',
  bhajn: 'bhajan',
  bhajans: 'bhajan',
  sufii: 'sufi',
  arijit: 'arijit singh',
  arjit: 'arijit singh',
  aririt: 'arijit singh',
  atif: 'atif aslam',
  sidhu: 'sidhu moose wala',
  diljeet: 'diljit dosanjh',
  diljit: 'diljit dosanjh',
  honeysingh: 'honey singh',
  'yo yo': 'honey singh',
};

/** What the search page should do with a query. */
export interface SearchHint {
  /** Extra queries to run alongside the raw text, e.g. a film's songs. */
  readonly expandedQueries: readonly string[];
  /** A better spelling, when the input looks like a near miss. */
  readonly correction?: string;
  /** The film that was recognised, for display. */
  readonly movie?: string;
  /** Related terms to offer as chips. */
  readonly suggestions: readonly string[];
}

/**
 * Levenshtein distance, capped for speed.
 *
 * <p>Used to decide whether a query is a plausible misspelling of a known title rather
 * than a genuinely different search.
 */
function editDistance(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  if (Math.abs(a.length - b.length) > 3) {
    return 99; // Too different in length to be a typo.
  }

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length];
}

/** Distance that still counts as a typo, scaled to the word's length. */
function typoThreshold(length: number): number {
  if (length <= 4) return 1;
  if (length <= 8) return 2;
  return 3;
}

/**
 * Interprets a raw search query.
 *
 * <p>Recognises film titles — including misspelled ones — and expands them into their
 * songs, since Audius cannot be queried by film. Otherwise looks for a near-miss spelling
 * of a known term.
 */
export function interpretQuery(raw: string): SearchHint {
  const query = raw.trim().toLowerCase();
  if (!query) {
    return { expandedQueries: [], suggestions: [] };
  }

  // Exact or alias match on a film title.
  for (const movie of MOVIES) {
    const names = [movie.title.toLowerCase(), ...movie.aliases];
    if (names.includes(query)) {
      return {
        movie: movie.title,
        expandedQueries: movie.songs.map((song) => `${song}`),
        suggestions: movie.songs.slice(0, 4),
      };
    }
  }

  // Fuzzy match, so a misspelled title still finds the film.
  let best: { movie: MovieHint; distance: number } | null = null;
  for (const movie of MOVIES) {
    for (const name of [movie.title.toLowerCase(), ...movie.aliases]) {
      const distance = editDistance(query, name);
      if (distance <= typoThreshold(name.length) && (!best || distance < best.distance)) {
        best = { movie, distance };
      }
    }
  }
  if (best) {
    return {
      movie: best.movie.title,
      correction: best.movie.title,
      expandedQueries: best.movie.songs.map((song) => `${song}`),
      suggestions: best.movie.songs.slice(0, 4),
    };
  }

  // A known misspelling of a genre or artist.
  const corrected = TERM_CORRECTIONS[query];
  if (corrected && corrected !== query) {
    return { correction: corrected, expandedQueries: [corrected], suggestions: [] };
  }

  // Fuzzy match against the correction table's target terms.
  const targets = [...new Set(Object.values(TERM_CORRECTIONS))];
  let bestTerm: { term: string; distance: number } | null = null;
  for (const term of targets) {
    const distance = editDistance(query, term);
    if (distance <= typoThreshold(term.length) && (!bestTerm || distance < bestTerm.distance)) {
      bestTerm = { term, distance };
    }
  }
  if (bestTerm && bestTerm.distance > 0) {
    return { correction: bestTerm.term, expandedQueries: [bestTerm.term], suggestions: [] };
  }

  return { expandedQueries: [], suggestions: [] };
}

/** Film titles offered as examples on an empty or fruitless search. */
export function popularMovies(count = 8): string[] {
  const shuffled = [...MOVIES];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count).map((movie) => movie.title);
}
