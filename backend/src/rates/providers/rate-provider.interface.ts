export interface RateProvider {
  fetchRates(base: string, symbols: string[]): Promise<Record<string, number>>;
}
