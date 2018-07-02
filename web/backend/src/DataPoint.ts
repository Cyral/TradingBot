export class DataPoint {
    public date: number;
    public price: number; // Close price
    public volume: number;
    
    constructor(date: number, price: number, volume: number) {
        this.date = date;
        this.price = price;
        this.volume = volume;
    }
}