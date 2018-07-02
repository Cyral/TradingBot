import * as path from 'path';
import * as fs from 'fs';

export class GraphController {
    private  exchange = "GDAX";
    private  product = "BTC-USD";
    private  timeframe = "120d";
    private  candles = "15m";
    private data: string;
    
    constructor() {

    }

    public async loadData() {
   
        
        const filename = `${this.exchange}_historical_${this.product}_${this.timeframe}_${this.candles}.csv`.toLowerCase(); 
        console.log(`Loading historical data from ${filename}`);
        
        const data = await this.wrapRequest(cb => fs.readFile(path.join('data', filename), 'utf8', (err, d) => {
            if (err) {
                console.log(err);
            } else {
                cb(d);
            }
        }));
        
        this.data = data;
        
        return data;
    }

    public async getData() {
        return this.data;
    }
    
    public getMetaData() {
        return {
            exchange: this.exchange,
            product: this.product,
            timeframe: this.timeframe,
            candles: this.candles,
        }
    }

    private async wrapRequest(request: (cb) => any) {
        return new Promise<any>(accept => {
            request(accept);
        });
    }
}