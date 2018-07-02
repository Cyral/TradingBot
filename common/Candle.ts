import * as chalk from 'chalk';

/**
 * Represents OHLC values from a candle chart.
 */
export class Candle {
    public date: Date;
    public volume: number;
    public open: number;
    public close: number;
    public high: number;
    public low: number;
    
    constructor(date: Date, low: number, high: number, open: number, close: number, volume: number) {
        this.date = date;
        this.low = low;
        this.high = high;
        this.open = open;
        this.close = close;
        this.volume = volume;
    }
    
    public print() {
        const time = (this.date.getHours() % 12) + ":" + this.date.getMinutes() + ":" + this.date.getSeconds();
        console.log(chalk.white(time) + ' ->' + 
            chalk.gray(' O: ') + chalk.white(this.open) +
            chalk.gray(' H: ') + chalk.white(this.high) +
            chalk.gray(' L: ') + chalk.white(this.low) +
            chalk.gray(' C: ') + chalk.white(this.close) +
            chalk.gray(' V: ') + chalk.white(Math.round(this.volume))
        );
    }
}