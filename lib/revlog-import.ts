import crypto from 'node:crypto';
import * as cheerio from 'cheerio';
import { supabaseAdmin, RLG_GLOBAL_PAGES_TABLE } from '@/lib/supabase-admin';

const REVLOG_BASE_URL = 'https://rev-log.com';
const DEFAULT_REVLOG_PATHS = [
  '/',
  '/about-us/',
  '/vi/',
  '/en/',
  '/vi/about-us/',
  '/about-us/',
  '/rlg-by-reconomy-initiates-soft-relaunch-of-its-brand/',
];

export type RevLogImportInput = {
  urls?: string[];
};

export type RevLogPageRecord = {
  source_url: string;
  locale: string;
  title: string;
  meta_description: string | null;
  content_text: string;
  content_hash: string;
  source_kind: string;
  imported_at: string;
  updated_at: string;
};

export function getRevLogSeedUrls() {
  return DEFAULT_REVLOG_PATHS.map((path) => new URL(path, REVLOG_BASE_URL).toString());
}

export async function listRevLogPages(limit = 100) {
  const { data, error } = await supabaseAdmin
    .from(RLG_GLOBAL_PAGES_TABLE)
    .select('source_url,locale,title,meta_description,content_text,content_hash,source_kind,imported_at,updated_at')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as RevLogPageRecord[];
}

export async function importRevLogPages(input: RevLogImportInput) {
  const urls = normalizeUrls(input.urls?.length ? input.urls : getRevLogSeedUrls());
  if (urls.length === 0) {
    throw new Error('No valid URLs provided for import.');
  }

  const imported: RevLogPageRecord[] = [];

  for (const url of urls) {
    const page = await fetchAndNormalizeRevLogPage(url);
    const { data, error } = await supabaseAdmin
      .from(RLG_GLOBAL_PAGES_TABLE)
      .upsert(page, { onConflict: 'source_url' })
      .select('source_url,locale,title,meta_description,content_text,content_hash,source_kind,imported_at,updated_at')
      .single();

    if (error) {
      throw new Error(`Failed to save ${url}: ${error.message}`);
    }

    imported.push(data as RevLogPageRecord);
  }

  return imported;
}

async function fetchAndNormalizeRevLogPage(url: string): Promise<RevLogPageRecord> {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'RLG Content Workspace Bot/1.0 (+https://rev-log.com)',
      accept: 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const normalizedUrl = normalizeUrl(url);
  const title =
    pickMeta($, 'og:title') ||
    pickMeta($, 'twitter:title') ||
    $('title').first().text().trim() ||
    $('h1').first().text().trim() ||
    normalizedUrl;
  const metaDescription =
    pickMeta($, 'description') ||
    pickMeta($, 'og:description') ||
    pickMeta($, 'twitter:description') ||
    null;
  const contentText = extractReadableText($);
  const contentHash = crypto.createHash('sha256').update(`${title}\n${contentText}`).digest('hex');

  return {
    source_url: normalizedUrl,
    locale: inferLocaleFromUrl(normalizedUrl),
    title,
    meta_description: metaDescription,
    content_text: contentText,
    content_hash: contentHash,
    source_kind: 'rev-log',
    imported_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function extractReadableText($: cheerio.CheerioAPI) {
  const root = $('main').first().length ? $('main').first() : $('article').first().length ? $('article').first() : $('body').first();
  const selectors = 'h1,h2,h3,h4,h5,h6,p,li,blockquote,a';
  const parts: string[] = [];

  root.find(selectors).each((_, element) => {
    const text = $(element).text().replace(/\s+/g, ' ').trim();
    if (!text) return;

    const normalized = text.replace(/\s+/g, ' ');
    if (parts[parts.length - 1] !== normalized) {
      parts.push(normalized);
    }
  });

  if (parts.length === 0) {
    const fallback = root.text().replace(/\s+/g, ' ').trim();
    return fallback;
  }

  return parts.join('\n');
}

function pickMeta($: cheerio.CheerioAPI, name: string) {
  return (
    $(`meta[name="${name}"]`).attr('content')?.trim() ||
    $(`meta[property="${name}"]`).attr('content')?.trim() ||
    ''
  );
}

function normalizeUrls(urls: string[]) {
  return Array.from(
    new Set(
      urls
        .map((value) => value.trim())
        .filter(Boolean)
        .map(normalizeUrl)
    )
  );
}

function normalizeUrl(value: string) {
  const url = new URL(value, REVLOG_BASE_URL);
  url.hash = '';
  url.search = '';
  if (url.pathname !== '/' && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '/');
  }
  return url.toString();
}

function inferLocaleFromUrl(url: string) {
  const pathname = new URL(url).pathname.toLowerCase();
  if (pathname.startsWith('/vi')) return 'vi';
  if (pathname.startsWith('/en')) return 'en';
  if (pathname.startsWith('/de')) return 'de';
  if (pathname.startsWith('/us')) return 'en-us';
  return 'global';
}
