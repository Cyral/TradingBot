import {Indicator} from "./Indicator";

/**
 * An indicator based on another indicator. Useful for "reducing" indicators, e.g.
 * new SubIndicator(this, (ohlc: OHLCIndicator) => ohlc.getCurrent().open, "open")
 * will take an OHLC and create an indicator from the open price.
 */
export class SubIndicator extends Indicator<number> {
    public calcFunction: (indicator: Indicator<any>) => number;
    
    constructor(source?: Indicator<any>, calcFunction?: (indicator: Indicator<any>) => number, name?: string) {
        super(source);
        this.name = name;
        this.history = [];
        this.source = source;
        this.calcFunction = calcFunction;
    }

    calculate(indicator: Indicator<any>): number {
        return this.calcFunction(indicator);
    }
}