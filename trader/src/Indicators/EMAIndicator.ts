import {Indicator} from "./Indicator";

// https://en.wikipedia.org/wiki/Moving_average#Exponential_moving_average
export class EMAIndicator extends Indicator<number> {
    constructor(source: Indicator<number>, private range: number, name?: string) {
        super(source);

        if (name)
            this.name = name;
        else
            this.name = "ema" + range;
    }

    public calculate(source: Indicator<number>): number {
        const array = source.history;
        // Create the EMA
        const ema = EMAIndicator.ema(array, this.range);

        // Use the last EMA value for the result.
        return ema[ema.length - 1];
    }

    public getLeadTicks() {
        return this.range;
    }

    public static ema(mArray, mRange) {
        const k = 2 / (mRange + 1);
        // first item is just the same as the first item in the input
        let emaArray = [mArray[0]];
        // for the rest of the items, they are computed with the previous one
        for (let i = 1; i < mArray.length; i++) {
            emaArray.push(mArray[i] * k + emaArray[i - 1] * (1 - k));
        }
        return emaArray;
    }
}