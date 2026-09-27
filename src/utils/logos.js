const logoMap = {
  netflix: 'netflix',
  spotify: 'spotify',
  youtube: 'youtube', 'youtube premium': 'youtube',
  'youtube music': 'youtubemusic',
  'youtube tv': 'youtubetv',
  'apple music': 'applemusic',
  'apple tv': 'appletv', 'apple tv+': 'appletv', 'apple one': 'appletv',
  icloud: 'icloud', 'icloud+': 'icloud',
  'amazon prime': 'amazonprime', prime: 'amazonprime',
  'prime video': 'primevideo', 'amazon prime video': 'primevideo',
  hbo: 'hbo', 'hbo max': 'hbo', max: 'hbo',
  'paramount+': 'paramountplus', 'paramount plus': 'paramountplus',
  crunchyroll: 'crunchyroll',
  audible: 'audible',
  duolingo: 'duolingo',
  grammarly: 'grammarly',
  nordvpn: 'nordvpn',
  expressvpn: 'expressvpn',
  linkedin: 'linkedin',
  chatgpt: 'openai', openai: 'openai', 'chatgpt plus': 'openai',
  claude: 'anthropic', anthropic: 'anthropic',
  zoom: 'zoom',
  slack: 'slack',
  figma: 'figma',
  notion: 'notion',
  canva: 'canva',
  dropbox: 'dropbox',
  'adobe creative cloud': 'adobecreativecloud', adobe: 'adobecreativecloud',
  'google drive': 'googledrive',
  '1password': '1password',
  github: 'github',
  'nintendo switch online': 'nintendoswitch', 'nintendo switch': 'nintendoswitch', nintendo: 'nintendoswitch',
  'playstation plus': 'playstation', playstation: 'playstation', 'ps plus': 'playstation', ps: 'playstation',
  steam: 'steam',
  discord: 'discord', 'discord nitro': 'discord',
  twitch: 'twitch',
}

function normalize(str) {
  return String(str || '').toLowerCase().trim()
}

export function logoFor(name, provider) {
  for (const raw of [name, provider]) {
    const c = normalize(raw)
    if (!c) continue
    if (logoMap[c]) return `/logos/${logoMap[c]}.svg`
    const key = Object.keys(logoMap).find(k => c.includes(k))
    if (key) return `/logos/${logoMap[key]}.svg`
  }
  return null
}
