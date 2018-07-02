export class DataPoint {
    public date: number;
    public volume: number;
    public open: number;
    public close: number;
    public high: number;
    public low: number;
    
    constructor(date: number, low: number, high: number, open: number, close: number, volume: number) {
        this.date = date;
        this.low = low;
        this.high = high;
        this.open = open;
        this.close = close;
        this.volume = volume;
    }
}