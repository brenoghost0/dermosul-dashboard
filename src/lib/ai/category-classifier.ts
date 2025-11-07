import { getOpenAIClient } from './openai';

const CATEGORY_TAXONOMY = [
  {
    name: 'Tratamento',
    description: 'Protocolos dermatológicos para manchas, envelhecimento, acne, controle de oleosidade e sensibilidade.',
    keywords: ['tratamento', 'antissinais', 'serum', 'ampola', 'retinol', 'antirrugas', 'peeling', 'pigment'],
  },
  {
    name: 'Limpeza',
    description: 'Géis, espumas, sabonetes, águas micelares e demaquilantes.',
    keywords: ['limpeza', 'cleanser', 'gel de limpeza', 'sabonete', 'esfoliante', 'demaquilante', 'micelar'],
  },
  {
    name: 'Hidratação',
    description: 'Loções, cremes e máscaras focadas em barreira, conforto e reposição de água/lipídios.',
    keywords: ['hidrata', 'hidratante', 'creme', 'loção', 'umectante', 'barreira', 'ceramida'],
  },
  {
    name: 'Proteção',
    description: 'Protetores solares, antioxidantes diurnos, reforço contra poluição/luz.',
    keywords: ['protetor', 'fps', 'solar', 'fotoprotecao', 'defesa diária', 'shield'],
  },
  {
    name: 'Prevenção',
    description: 'Ativos que evitam agravamento futuro: antioxidantes, uniformizadores, boosters preventivos.',
    keywords: ['prevenir', 'prevenção', 'antioxidante', 'vitamina c', 'booster', 'uniformiza', 'luminosidade'],
  },
  {
    name: 'Correção',
    description: 'Produtos corretivos com cor ou efeito ótico imediato (bases, BB, CC, stick calmante).',
    keywords: ['corretivo', 'bb', 'cc', 'tint', 'pigmentado', 'cor', 'camufla'],
  },
  {
    name: 'Reparação',
    description: 'Pós-procedimento, cicatrizantes, calmantes intensos para barreira comprometida.',
    keywords: ['reparador', 'cicaplast', 'cicatrizante', 'repara', 'calmante', 'pós-procedimento', 'dermatite'],
  },
] as const;

const CATEGORY_SET = new Set(CATEGORY_TAXONOMY.map((item) => item.name));

const DEFAULT_MODEL = process.env.PRODUCT_CATEGORY_MODEL || 'gpt-4.1-mini';

export interface CategoryClassificationInput {
  id?: string;
  title: string;
  brand?: string | null;
  shortDescription?: string | null;
  longDescriptionHtml?: string | null;
  detailUrl?: string | null;
}

export async function classifyProductCategories(input: CategoryClassificationInput): Promise<string[]> {
  const textBundle = [
    input.title,
    input.brand,
    input.shortDescription,
    stripHtml(input.longDescriptionHtml ?? ''),
  ]
    .filter(Boolean)
    .join('\n')
    .replace(/\s+/g, ' ')
    .slice(0, 2800);

  const fallback = heuristicCategories(textBundle);
  try {
    const client = await getOpenAIClient();
    const systemMessage = [
      'Você é uma especialista em dermocosméticos e precisa decidir em quais categorias o produto se encaixa.',
      'Categorias disponíveis (pode escolher várias):',
      ...CATEGORY_TAXONOMY.map((item) => `- ${item.name}: ${item.description}`),
      'Responda sempre em JSON com o formato {"categories":["Categoria"]}.',
      'Nunca invente categorias que não estejam na lista.',
    ].join('\n');

    const completion = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemMessage },
        {
          role: 'user',
          content: `Produto:\n${textBundle || input.title}\n\nURL: ${input.detailUrl ?? 'n/d'}`,
        },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content;
    if (typeof raw === 'string') {
      const parsed = JSON.parse(raw);
      const categories = Array.isArray(parsed?.categories) ? parsed.categories : [];
      const selected = normalizeCategories(categories);
      if (selected.length > 0) {
        return selected;
      }
    }
  } catch (error) {
    console.warn('[category-classifier] falha na chamada ao LLM', error);
  }
  return fallback;
}

export async function classifyProductCategoriesBatch(
  items: (CategoryClassificationInput & { id: string })[]
): Promise<Record<string, string[]>> {
  if (items.length === 0) {
    return {};
  }

  const fallbackMap: Record<string, string[]> = {};
  for (const item of items) {
    fallbackMap[item.id] = heuristicCategories(
      [
        item.title,
        item.brand,
        item.shortDescription,
        stripHtml(item.longDescriptionHtml ?? ''),
      ]
        .filter(Boolean)
        .join(' ')
    );
  }

  try {
    const client = await getOpenAIClient();
    const systemMessage = [
      'Você é especialista em dermocosméticos.',
      'Receberá uma lista de produtos com seus campos. Para cada item, selecione uma ou mais categorias da taxonomia abaixo:',
      ...CATEGORY_TAXONOMY.map((item) => `- ${item.name}: ${item.description}`),
      'Responda APENAS em JSON, no formato {"produtos":{"id":["Categoria"]}}.',
      'Use apenas os nomes listados. Se não identificar categoria, devolva array vazio.',
    ].join('\n');

    const payload = items.map((item) => ({
      id: item.id,
      title: item.title,
      brand: item.brand ?? '',
      shortDescription: item.shortDescription ?? '',
      longDescription: stripHtml(item.longDescriptionHtml ?? ''),
      detailUrl: item.detailUrl ?? '',
    }));

    const completion = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemMessage },
        {
          role: 'user',
          content: JSON.stringify({ produtos: payload }),
        },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content;
    if (typeof raw === 'string') {
      const parsed = JSON.parse(raw);
      const products = parsed?.produtos;
      if (products && typeof products === 'object') {
        for (const item of items) {
          const categories = Array.isArray(products[item.id]) ? products[item.id] : [];
          const normalized = normalizeCategories(categories);
          if (normalized.length > 0) {
            fallbackMap[item.id] = normalized;
          }
        }
      }
    }
  } catch (error) {
    console.warn('[category-classifier] falha na classificação em lote', error);
  }

  return fallbackMap;
}

function normalizeCategories(names: unknown[]): string[] {
  const normalized = new Set<string>();
  for (const name of names) {
    if (typeof name !== 'string') continue;
    const cleaned = name.trim();
    if (!cleaned) continue;
    const match = Array.from(CATEGORY_SET).find((candidate) => candidate.toLowerCase() === cleaned.toLowerCase());
    if (match) normalized.add(match);
  }
  return Array.from(normalized);
}

function heuristicCategories(text: string): string[] {
  const normalized = text.toLowerCase();
  const hits = new Set<string>();
  for (const category of CATEGORY_TAXONOMY) {
    if (category.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))) {
      hits.add(category.name);
    }
  }
  if (hits.size === 0 && normalized.includes('pele')) {
    hits.add('Tratamento');
  }
  return Array.from(hits);
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, ' ');
}

export { CATEGORY_TAXONOMY };
