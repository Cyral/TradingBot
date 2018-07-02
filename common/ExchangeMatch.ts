/**
 * Represents a match on an exchange seen in the trade history.
 */
export class ExchangeMatch {
    id: string;
    price: number;
    volume: number;
    side: 'buy' | 'sell';
    date: Date;
}