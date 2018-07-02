import {Indicator} from "./Indicator";
import {Candle} from "../../../common/Candle";
import {SubIndicator} from "./SubIndicator";

/**
 * Represents an Open/High/Low/Close indicator candle.
 */
export class OHLCIndicator extends Indicator<Candle> {
    public open: Indicator<number>;
    public high: Indicator<number>;
    public low: Indicator<number>;
    public close: Indicator<number>; 
    
    constructor() {
        super();
        this.name = "ohlc";
        
        this.open = this.addIndicator(new SubIndicator(this, (ohlc: OHLCIndicator) => ohlc.getCurrent().open, "open"));
        this.high = this.addIndicator(new SubIndicator(this, (ohlc: OHLCIndicator) => ohlc.getCurrent().high, "high"));
        this.low = this.addIndicator(new SubIndicator(this, (ohlc: OHLCIndicator) => ohlc.getCurrent().low, "low"));
        this.close = this.addIndicator(new SubIndicator(this, (ohlc: OHLCIndicator) => ohlc.getCurrent().close, "close"));
    }

    calculate(history: Candle[]) {
        return history[history.length - 1];
    }
}