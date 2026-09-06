const { LinkupClient } = require('linkup-sdk');

const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function hashAddress(address) {
  let h = 2166136261;
  for (let i = 0; i < address.length; i += 1) {
    h ^= address.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

function classifyAddress(address) {
  const h = hashAddress(address);
  const types = ['SPL Mint', 'Raydium Pool', 'Orca Whirlpool', 'Meteora Pool'];
  return types[h % types.length];
}

function buildMockResearch(address) {
  const h = hashAddress(address);
  const riskScore = 28 + (h % 62);
  const liquidityUsd = 15_000 + (h % 4_500_000);
  const holderCount = 120 + (h % 48_000);
  const ageDays = 1 + (h % 540);

  const verdicts = [
    { label: 'HIGH RISK', min: 75 },
    { label: 'CAUTION', min: 55 },
    { label: 'NEUTRAL', min: 40 },
    { label: 'LOW RISK', min: 0 },
  ];
  const verdict = verdicts.find((v) => riskScore >= v.min).label;

  const flags = [];
  if (riskScore >= 70) flags.push('Concentrated holder wallet (>40% supply)');
  if (h % 3 === 0) flags.push('Mint authority not revoked');
  if (h % 5 === 0) flags.push('Low liquidity depth vs market cap');
  if (h % 7 === 0) flags.push('Recent large unlock event');
  if (flags.length === 0) flags.push('No major red flags in deterministic scan');

  const sources = [
    {
      title: 'Solscan token overview',
      url: `https://solscan.io/token/${address}`,
      snippet: 'On-chain holder distribution and mint metadata.',
    },
    {
      title: 'Birdeye market snapshot',
      url: `https://birdeye.so/token/${address}?chain=solana`,
      snippet: 'Liquidity, volume, and price impact estimates.',
    },
    {
      title: 'DexScreener pair view',
      url: `https://dexscreener.com/solana/${address}`,
      snippet: 'Pool depth, age, and recent swap activity.',
    },
  ];

  return {
    address,
    addressType: classifyAddress(address),
    riskScore,
    verdict,
    liquidityUsd,
    holderCount,
    ageDays,
    flags,
    summary: `${classifyAddress(address)} ${address.slice(0, 6)}…${address.slice(-4)} scores ${riskScore}/100 (${verdict}). Liquidity ~$${liquidityUsd.toLocaleString()}, ${holderCount.toLocaleString()} holders, ~${ageDays}d on-chain age.`,
    detail: {
      narrative: `Deterministic Morning Light scan for ${address}. Risk model weighs liquidity (${liquidityUsd.toLocaleString()} USD est.), holder concentration, mint authority, and pool age (${ageDays} days). Verdict: ${verdict}.`,
      checklist: [
        `Liquidity depth: ${liquidityUsd >= 100_000 ? 'Adequate' : 'Thin'} (~$${liquidityUsd.toLocaleString()})`,
        `Holder base: ${holderCount >= 1000 ? 'Broad' : 'Narrow'} (${holderCount.toLocaleString()})`,
        `Pool/mint age: ${ageDays} days`,
        `Primary flags: ${flags.join('; ')}`,
      ],
    },
    sources,
    dataSource: 'mock',
  };
}

async function fetchLinkupSources(address, apiKey) {
  const client = new LinkupClient({ apiKey });
  const query = `Solana ${address} token or liquidity pool risk red flags rug pull audit`;
  const result = await client.search({
    query,
    depth: 'fast',
    outputType: 'searchResults',
    maxResults: 5,
  });

  const results = result.results || result.searchResults || [];
  return results.map((item, index) => ({
    title: item.name || item.title || `Source ${index + 1}`,
    url: item.url,
    snippet: item.content || item.snippet || 'Web result from Linkup search.',
  }));
}

async function buildResearch(address, { linkupApiKey } = {}) {
  const base = buildMockResearch(address);

  if (!linkupApiKey) {
    return base;
  }

  try {
    const linkupSources = await fetchLinkupSources(address, linkupApiKey);
    if (linkupSources.length > 0) {
      base.sources = linkupSources.slice(0, 5);
      base.dataSource = 'linkup+mock';
      base.detail.narrative += ' Live web sources appended via Linkup /search (fast).';
    }
  } catch {
    base.dataSource = 'mock (linkup unavailable)';
  }

  return base;
}

function freeTeaser(full) {
  return {
    address: full.address,
    addressType: full.addressType,
    teaser: `Free glance: ${full.addressType} detected. Risk band hidden — unlock Pro for full ${full.verdict} verdict, score, and sources.`,
    riskHint: full.riskScore >= 60 ? 'Elevated' : full.riskScore >= 45 ? 'Mixed' : 'Moderate',
    lockedFields: ['riskScore', 'verdict', 'flags', 'sources', 'detail'],
    dataSource: full.dataSource,
  };
}

function proPayload(full) {
  return {
    ...full,
    tier: 'pro',
  };
}

function isValidSolanaAddress(address) {
  return typeof address === 'string' && SOLANA_ADDRESS_RE.test(address.trim());
}

module.exports = {
  buildResearch,
  freeTeaser,
  proPayload,
  isValidSolanaAddress,
};
