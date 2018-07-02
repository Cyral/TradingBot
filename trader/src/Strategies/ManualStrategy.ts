import {Strategy} from "./Strategy";
import {EMAIndicator} from "../Indicators/EMAIndicator";
import {OHLCIndicator} from "../Indicators/OHLCIndicator";

export class ManualStrategy extends Strategy {
    private fast: EMAIndicator;
    private slow: EMAIndicator;
    private price: OHLCIndicator;

    constructor() {
        super();

        this.price = this.addIndicator(new OHLCIndicator());
        this.fast = this.addIndicator(new EMAIndicator(this.price.close, 6));
        this.slow = this.addIndicator(new EMAIndicator(this.price.close, 12));
    }

    tick() {
        this.plot(this.fast);
        this.plot(this.slow);
    }
}