export interface RateProvider {
  fetchRates(base: string, symbols: string[]): Promise<Record<string, number>>;
  fetchHistory?(
    base: string,
    symbols: string[],
    startDate: string,
    endDate: string,
  ): Promise<Record<string, Record<string, number>>>;
}
