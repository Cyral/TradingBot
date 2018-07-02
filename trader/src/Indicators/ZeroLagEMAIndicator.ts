import {Indicator} from "./Indicator";
import {EMAIndicator} from "./EMAIndicator";

export class ZeroLagEMAIndicator extends Indicator<number> {
    constructor(source: Indicator<number>, private range: number, name?: string) {
        super(source);

        if (name)
            this.name = name;
        else
            this.name = "zlema" + range;
    }

    public calculate(source: Indicator<number>): number {
        const array = source.history;
        
        // Create the EMA
        const ema1 = EMAIndicator.ema(array, this.range);
        const ema2 = EMAIndicator.ema(ema1, this.range);
        const diff = ema1[ema1.length - 1] - ema2[ema2.length - 1];
        const zlema = ema1[ema1.length - 1] + diff;
        return zlema;
    }

    public getLeadTicks() {
        return this.range;
    }
}