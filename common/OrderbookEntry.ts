export class OrderbookEntry {
    public id?: string;
    public price: number;
    public remainingSize?: number;
    public side?: 'buy' | 'sell';
    public size?: number;
    public orders?: OrderbookEntry[];
}