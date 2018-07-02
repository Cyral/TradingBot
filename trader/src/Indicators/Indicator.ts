import {Candle} from "../../../common/Candle";

/**
 * A base class for classes that utilize an indicator list.
 */
export class HasIndicators {
    public name: string;
    protected indicators: Indicator<any>[];
    
    constructor() {
        this.indicators = [];
    }
    
    protected updateIndicators(source: Candle[] | Indicator<number>) {
        for (const indicator of this.indicators) {
            const value = indicator.calculate(indicator.source || source);
            indicator.history.push(value);
            indicator.updateIndicators(indicator);
        }
    }

    protected addIndicator<I extends Indicator<any>>(indicator: I): I {
        this.indicators.push(indicator);
        return indicator;
    }
}

/**
 * An indicator that represents a value based on exchange data candles.
 */
export abstract class Indicator<T> extends HasIndicators {
    public source: Indicator<any>;
    public history: T[];
    
    constructor(source?: Indicator<any>) {
        super();
        this.history = [];
        this.source = source;
    }
    
    public abstract calculate(source: Candle[] | Indicator<any>): T
    
    public getLeadTicks() {
        return 0;
    }
    
    public getCurrent(): T {
        return this.getAt(0);
    }
    
    public getLast(): T  {
        return this.getAt(1);
    }
    
    public getAt(indexFromNow: number): T  {
        return this.history[this.history.length - indexFromNow - 1];
    }
}