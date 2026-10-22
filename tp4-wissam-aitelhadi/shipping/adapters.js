// Adapter : deux API aux formats différents -> UN contrat commun :
//   getQuote({ weightKg, zip }) -> Promise<{ carrier, price (euros), days }>
// Les API (carrierApis.js) ne sont pas modifiées : on les importe.
import { ColissimoApi, DhlClient } from '../../tp4/carrierApis.js';

export class ColissimoAdapter {
  constructor(api = new ColissimoApi()) {
    this.api = api;
  }

  async getQuote({ weightKg, zip }) {
    // grammes / centimes / synchrone  ->  kilos / euros / asynchrone
    const r = this.api.tarif({ poidsGrammes: Math.round(weightKg * 1000), codePostal: zip });
    return { carrier: 'Colissimo', price: r.prixCentimes / 100, days: r.delaiJours };
  }
}

export class DhlAdapter {
  constructor(client = new DhlClient()) {
    this.client = client;
  }

  async getQuote({ weightKg, zip }) {
    const r = await this.client.getRate(weightKg, zip);
    return { carrier: 'DHL', price: Number(r.amount), days: r.transitDays }; // "11.00" -> 11
  }
}
