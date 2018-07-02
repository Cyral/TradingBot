import {Indicator} from "./Indicator";
import {EMAIndicator} from "./EMAIndicator";

// https://en.wikipedia.org/wiki/Double_exponential_moving_average
export class DEMAIndicator extends Indicator<number> {
    private ema: Indicator<number>;
    
    constructor(source: Indicator<number>, private range: number, name?: string) {
        super(source);

        this.ema = this.addIndicator(new EMAIndicator(source, range));

        if (name)
            this.name = name;
        else
            this.name = "dema" + range;
    }

    public calculate(source: Indicator<number>): number {
        // Create the EMA
        const ema = EMAIndicator.ema(this.ema.history, this.range);

        // Use the last EMA value for the result.
        return 2 * this.ema.getLast() - ema[ema.length - 1];
    }

    public getLeadTicks() {
        return 2 * this.range - 1;
    }
}