import * as path from 'path';
import * as fs from 'fs';
import {CandleFeed} from "./CandleFeed";
import {Utils} from "../Utils";
import {Candle} from "../../../common/Candle";

export class HistoricalFeed extends CandleFeed {
    public sell(params: any) {
        throw new Error("Method not implemented.");
    }

    public buy(params: any) {
        throw new Error("Method not implemented.");
    }

    public getMarketPrices(): { sell: number; buy: number; } {
        throw new Error("Method not implemented.");
    }

    private config = {
        exchange: "GDAX",
        product: "BTC-USD",
        timeframe: "120d",
        candles: "15m"
    };
    
    private historicalCandles: Candle[];
    private data: string;
    private Utils: any;
    
    public async load() {
        await this.loadData();
    }

    public async start() {
        await this.startTicker();
    }

    private async loadData() {
        
        // Read file
        const filename = `${this.config.exchange}_historical_${this.config.product}_${this.config.timeframe}_${this.config.candles}.csv`.toLowerCase();
        console.log(`Loading historical data from ${filename}`);

        const fileData = await Utils.wrapRequest(cb => fs.readFile(path.join('data', filename), 'utf8', (err, d) => {
            if (err) {
                console.log(err);
            } else {
                cb(d);
            }
        }));
        
        const lines = fileData.split('\n');

        // Parse lines
        this.historicalCandles = [];
        for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(',');
            
            const candle = new Candle(Utils.dateFromUnix(+parts[0]), +parts[1], +parts[2], +parts[3], +parts[4], +parts[5]);
            
            this.historicalCandles.push(candle);
        }
        
        console.log(`Loaded ${this.historicalCandles.length} historical candles.`);

        this.data = fileData;
    }
    
    private async startTicker() {
      
        return new Promise(async accept => {
            for (let i = 0; i < this.historicalCandles.length - 1; i++) {
                const candle = this.historicalCandles[i];

                //if (candle.date >= new Date('10-28-2017') && candle.date <= new Date('10-30-2017')) {
                    this.emit(candle);
                    await this.nextTick();
                    await Utils.sleep(25);
                //}
            }
        });
    }
    
    private async nextTick() {
        return new Promise(accept => {
            process.nextTick(accept);
        });
    }
    
    public async destroy() {
        
    }
}