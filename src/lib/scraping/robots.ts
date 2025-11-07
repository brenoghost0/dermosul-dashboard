interface RobotsRuleSet {
  allow: string[];
  disallow: string[];
  crawlDelay?: number;
}

interface RobotsCacheEntry {
  rules: RobotsRuleSet;
  fetchedAt: number;
}

const ROBOTS_CACHE = new Map<string, RobotsCacheEntry>();
const ROBOTS_TTL_MS = 60 * 60 * 1000; // 1 hour

function parseRobotsTxt(content: string): RobotsRuleSet {
  const lines = content.split(/\r?\n/);
  const agents: Record<string, RobotsRuleSet> = {};
  let currentAgents: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(':', 2);
    if (parts.length < 2) continue;
    const directive = parts[0].trim().toLowerCase();
    const value = parts[1].trim();

    switch (directive) {
      case 'user-agent': {
        const agent = value.toLowerCase();
        if (!agents[agent]) {
          agents[agent] = { allow: [], disallow: [] };
        }
        currentAgents = [agent];
        break;
      }
      case 'allow': {
        const rule = value || '/';
        currentAgents.forEach((agent) => {
          if (!agents[agent]) agents[agent] = { allow: [], disallow: [] };
          agents[agent].allow.push(rule);
        });
        break;
      }
      case 'disallow': {
        const rule = value || '/';
        currentAgents.forEach((agent) => {
          if (!agents[agent]) agents[agent] = { allow: [], disallow: [] };
          agents[agent].disallow.push(rule);
        });
        break;
      }
      case 'crawl-delay': {
        const delay = Number(value);
        if (Number.isFinite(delay)) {
          currentAgents.forEach((agent) => {
            if (!agents[agent]) agents[agent] = { allow: [], disallow: [] };
            agents[agent].crawlDelay = delay;
          });
        }
        break;
      }
      default:
        break;
    }
  }

  const wildcard = agents['*'] || { allow: [], disallow: [] };
  return wildcard;
}

async function fetchRobots(hostUrl: URL): Promise<RobotsRuleSet | null> {
  const robotsUrl = new URL(hostUrl.origin + '/robots.txt');
  try {
    const response = await fetch(robotsUrl.toString(), {
      headers: {
        'user-agent': 'DermosulScraper/1.0',
      },
    });
    if (!response.ok) return null;
    const text = await response.text();
    if (!text) return null;
    return parseRobotsTxt(text);
  } catch (error) {
    return null;
  }
}

function isPathAllowed(path: string, rules: RobotsRuleSet): boolean {
  const normalizedPath = path || '/';
  let longestDisallow = '';
  let longestAllow = '';

  for (const rule of rules.disallow) {
    if (rule === '') continue;
    if (normalizedPath.startsWith(rule) && rule.length > longestDisallow.length) {
      longestDisallow = rule;
    }
  }

  for (const rule of rules.allow) {
    if (normalizedPath.startsWith(rule) && rule.length > longestAllow.length) {
      longestAllow = rule;
    }
  }

  if (longestAllow.length >= longestDisallow.length) {
    return true;
  }

  return longestDisallow.length === 0;
}

export interface RobotsEvaluation {
  allowed: boolean;
  crawlDelayMs?: number;
}

export async function evaluateRobots(url: URL): Promise<RobotsEvaluation> {
  const cacheKey = url.origin;
  const cached = ROBOTS_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < ROBOTS_TTL_MS) {
    return {
      allowed: isPathAllowed(url.pathname, cached.rules),
      crawlDelayMs: cached.rules.crawlDelay ? cached.rules.crawlDelay * 1000 : undefined,
    };
  }

  const rules = await fetchRobots(url);
  if (!rules) {
    return { allowed: true };
  }

  ROBOTS_CACHE.set(cacheKey, { rules, fetchedAt: Date.now() });
  return {
    allowed: isPathAllowed(url.pathname, rules),
    crawlDelayMs: rules.crawlDelay ? rules.crawlDelay * 1000 : undefined,
  };
}
