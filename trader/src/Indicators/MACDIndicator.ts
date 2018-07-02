import {Indicator} from "./Indicator";
import {EMAIndicator} from "./EMAIndicator";
import {SubIndicator} from "./SubIndicator";

// https://www.investopedia.com/terms/m/macd.asp
export class MACDIndicator extends Indicator<MACDPoint> {
    public macd: Indicator<number>;
    public signal: Indicator<number>;

    private fast: EMAIndicator;
    private slow: EMAIndicator;

    private macdPoints: number[] = [];

    constructor(source: Indicator<number>, fast: number, slow: number, private signalRange: number, name?: string) {
        super(source);

        this.fast = this.addIndicator(new EMAIndicator(source, fast));
        this.slow = this.addIndicator(new EMAIndicator(source, slow));

        this.macd = this.addIndicator(new SubIndicator(this, (m: MACDIndicator) => m.getCurrent().macd, "macd"));
        this.signal = this.addIndicator(new SubIndicator(this, (m: MACDIndicator) => m.getCurrent().signal, "signal"));


        if (name)
            this.name = name;
        else
            this.name = "macd";
    }

    public calculate(): MACDPoint {
        // Create the EMA
        const macd = this.fast.getCurrent() - this.slow.getCurrent();
        if (!isNaN(macd))
            this.macdPoints.push(macd);
        const signal = EMAIndicator.ema(this.macdPoints, this.signalRange);

        return new MACDPoint((macd * 3) + 4200, (signal[signal.length - 1] * 3) + 4200);
    }

    public getLeadTicks() {
        return this.slow.getLeadTicks();
    }
}

export class MACDPoint {
    constructor(public macd: number, public signal: number) {

    }
}