export class CurrencyTrackerSDK {
  private baseUrl: string;

  constructor(config: { baseUrl: string }) {
    this.baseUrl = config.baseUrl;
  }

  async getRates(base: string = 'AED', symbols: string[] = []): Promise<Record<string, number>> {
    const query = new URLSearchParams();
    query.append('base', base);
    if (symbols.length > 0) {
      query.append('symbols', symbols.join(','));
    }
    
    const response = await fetch(`${this.baseUrl}/rates?${query.toString()}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch rates: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.rates;
  }

  async convert(amount: number, from: string, to: string): Promise<number> {
    const query = new URLSearchParams({
      amount: amount.toString(),
      from,
      to,
    });
    
    const response = await fetch(`${this.baseUrl}/rates/convert?${query.toString()}`);
    if (!response.ok) {
      throw new Error(`Failed to convert: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.result;
  }
}
