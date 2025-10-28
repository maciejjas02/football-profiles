// Centralna konfiguracja danych piłkarzy dla frontend
export const PLAYER_CATEGORIES = {
  'top-players': {
    title: '⭐ Gwiazdy Futbolu',
    description: 'Najlepsi piłkarze świata'
  },
  'new-talents': {
    title: '🚀 Młode Talenty', 
    description: 'Przyszłość piłki nożnej'
  },
  'goalkeepers': {
    title: '🥅 Bramkarze',
    description: 'Najlepsi strażnicy bramki'
  },
  'legends': {
    title: '👑 Legendy Futbolu',
    description: 'Nieśmiertelni mistrzowie'
  }
};

export const LEAGUES = {
  'premier-league': {
    name: 'Premier League',
    country: '🇬🇧 Anglia',
    teams: 20,
    logo: 'https://logos-world.net/wp-content/uploads/2020/06/Premier-League-Logo.png'
  },
  'la-liga': {
    name: 'La Liga',
    country: '🇪🇸 Hiszpania', 
    teams: 20,
    logo: 'https://logos-world.net/wp-content/uploads/2020/06/La-Liga-Logo.png'
  },
  'bundesliga': {
    name: 'Bundesliga',
    country: '🇩🇪 Niemcy',
    teams: 18, 
    logo: 'https://logos-world.net/wp-content/uploads/2020/06/Bundesliga-Logo.png'
  },
  'serie-a': {
    name: 'Serie A',
    country: '🇮🇹 Włochy',
    teams: 20,
    logo: 'https://logos-world.net/wp-content/uploads/2020/06/Serie-A-Logo.png'
  },
  'ligue-1': {
    name: 'Ligue 1', 
    country: '🇫🇷 Francja',
    teams: 20,
    logo: 'https://logos-world.net/wp-content/uploads/2020/06/Ligue-1-Logo.png'
  }
};

// Cache dla API responses
export class PlayerCache {
  constructor() {
    this.cache = new Map();
    this.maxAge = 5 * 60 * 1000; // 5 minut
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > this.maxAge) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  set(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clear() {
    this.cache.clear();
  }
}