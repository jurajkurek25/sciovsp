// Klient pre Lulu Print API (print-on-demand fulfillment fyzických kníh).
// POZOR -- toto je integrácia s platenou tlačovou službou tretej strany,
// ktorá reálne vytláča a odosiela knihy a reálne účtuje peniaze. Všetky
// endpointy, request/response tvary a required polia nižšie sú overené
// priamo oproti skutočnému Lulu OpenAPI spec-u (nie len z trénovacích dát),
// vrátane rozdielu medzi `shipping_option` (cost-calculation) a
// `shipping_level` (print-jobs) -- ide o dve rôzne mená toho istého poľa
// na dvoch rôznych endpointoch.
//
// Pred prepnutím LULU_ENV=production VŽDY over v sandboxe
// (https://developers.sandbox.lulu.com/), že:
//   1. cost-kalkulácia vracia rozumné číslo pre tvoj pod_package_id,
//   2. vytvorenie Print-Jobu prejde a vidíš objednávku v Lulu dashboarde,
//   3. V Lulu Developer Portáli (PRODUCTION účet, nie sandbox) máš
//      nastavenú platebnú kartu (Settings → Payment Methods). BEZ TOHO
//      every Print-Job ostane v stave UNPAID navždy -- Lulu ho nikdy
//      nepošle do tlače, kým ho niekto manuálne nezaplatí v ich dashboarde.
//      Toto je nastavenie na Lulu účte, API ho nerieši a túto appka to
//      nemôže obísť.
'use strict';

const ENV = (process.env.LULU_ENV || 'sandbox').toLowerCase();
const IS_PRODUCTION = ENV === 'production';

const API_BASE = IS_PRODUCTION ? 'https://api.lulu.com' : 'https://api.sandbox.lulu.com';
const CLIENT_KEY = IS_PRODUCTION ? process.env.LULU_CLIENT_KEY : process.env.LULU_SANDBOX_CLIENT_KEY;
const CLIENT_SECRET = IS_PRODUCTION ? process.env.LULU_CLIENT_SECRET : process.env.LULU_SANDBOX_CLIENT_SECRET;

if (IS_PRODUCTION) {
  console.log('🚨 lulu.js: LULU_ENV=production -- Print-Joby sa budú posielať na SKUTOČNÚ tlač a reálne sa účtujú.');
} else {
  console.log('ℹ️  lulu.js: beží v SANDBOX režime (LULU_ENV != "production") -- žiadna skutočná tlač ani platba.');
}

let cachedToken = null; // { accessToken, expiresAt }

async function getAccessToken() {
  if (!CLIENT_KEY || !CLIENT_SECRET) {
    const which = IS_PRODUCTION ? 'LULU_CLIENT_KEY / LULU_CLIENT_SECRET' : 'LULU_SANDBOX_CLIENT_KEY / LULU_SANDBOX_CLIENT_SECRET';
    throw new Error('Chýbajú Lulu API kľúče (' + which + ') v .env.');
  }
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30000) {
    return cachedToken.accessToken;
  }
  const basic = Buffer.from(CLIENT_KEY + ':' + CLIENT_SECRET).toString('base64');
  const res = await fetch(API_BASE + '/auth/realms/glasstree/protocol/openid-connect/token', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + basic,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error('Lulu OAuth token zlyhal (' + res.status + '): ' + text.slice(0, 300));
  }
  const data = await res.json();
  cachedToken = { accessToken: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 };
  return cachedToken.accessToken;
}

async function luluRequest(method, path, body) {
  const token = await getAccessToken();
  const res = await fetch(API_BASE + path, {
    method,
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch (e) { json = { raw: text }; }
  if (!res.ok) {
    const err = new Error('Lulu API ' + method + ' ' + path + ' zlyhalo (' + res.status + '): ' + JSON.stringify(json).slice(0, 500));
    err.luluStatus = res.status;
    err.luluBody = json;
    throw err;
  }
  return json;
}

// shippingAddress: { street1, city, country_code, postcode, phone_number, name?, email?, state_code? }
// shippingOption: 'MAIL' | 'PRIORITY_MAIL' | 'GROUND_HD' | 'GROUND_BUS' | 'GROUND' | 'EXPEDITED' | 'EXPRESS'
async function calculateCost({ podPackageId, pageCount, quantity = 1, shippingAddress, shippingOption = 'MAIL' }) {
  return luluRequest('POST', '/print-job-cost-calculations/', {
    line_items: [{ pod_package_id: podPackageId, page_count: pageCount, quantity }],
    shipping_address: shippingAddress,
    shipping_option: shippingOption
  });
}

// shippingAddress (print-job tvar, POVINNÉ: name, street1, city, country_code, postcode, phone_number, email):
//   { name, street1, street2?, city, country_code, postcode, phone_number, email, state_code? }
// shippingLevel: 'MAIL' | 'PRIORITY_MAIL' | 'GROUND_HD' | 'GROUND_BUS' | 'GROUND' | 'EXPEDITED' | 'EXPRESS'
// productionDelayMinutes: 60-2880 -- okno, počas ktorého sa dá Print-Job ešte zrušiť pred tlačou.
async function createPrintJob({
  title, externalId, contactEmail, podPackageId, quantity = 1,
  coverSourceUrl, interiorSourceUrl, shippingAddress, shippingLevel = 'MAIL',
  productionDelayMinutes = 120
}) {
  return luluRequest('POST', '/print-jobs/', {
    contact_email: contactEmail,
    external_id: externalId,
    production_delay: productionDelayMinutes,
    line_items: [{
      external_id: externalId,
      title,
      quantity,
      printable_normalization: {
        pod_package_id: podPackageId,
        cover: { source_url: coverSourceUrl },
        interior: { source_url: interiorSourceUrl }
      }
    }],
    shipping_address: shippingAddress,
    shipping_level: shippingLevel
  });
}

async function getPrintJobStatus(id) {
  return luluRequest('GET', '/print-jobs/' + id + '/', null);
}

// topics: vždy ['PRINT_JOB_STATUS_CHANGED'] -- jediný topic, ktorý Lulu
// momentálne ponúka. Toto sa nevolá automaticky pri štarte appky -- spusti
// raz manuálne main-app-patches/register-lulu-webhook.js po nastavení .env.
async function registerStatusWebhook(url) {
  return luluRequest('POST', '/webhooks/', { topics: ['PRINT_JOB_STATUS_CHANGED'], url });
}

module.exports = {
  IS_PRODUCTION,
  calculateCost,
  createPrintJob,
  getPrintJobStatus,
  registerStatusWebhook
};
