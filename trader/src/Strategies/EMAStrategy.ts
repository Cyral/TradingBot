import {Strategy} from "./Strategy";
import {EMAIndicator} from "../Indicators/EMAIndicator";
import {OHLCIndicator} from "../Indicators/OHLCIndicator";
import {DEMAIndicator} from "../Indicators/DEMAIndicator";
import {ZeroLagEMAIndicator} from "../Indicators/ZeroLagEMAIndicator";
import {MACDIndicator} from "../Indicators/MACDIndicator";

export class EMAStrategy extends Strategy {
  private fast: EMAIndicator;
  private slow: EMAIndicator;
  private price: OHLCIndicator;

  constructor() {
    super();

    this.price = this.addIndicator(new OHLCIndicator());

    this.fast = this.addIndicator(new EMAIndicator(this.price.close, 20));
    this.slow = this.addIndicator(new EMAIndicator(this.price.close, 50));
  }

  tick() {
    const currentPrice = this.price.getCurrent().open;
    const date = this.price.getCurrent().date;

    if (this.crossover(this.fast, this.slow)) {
      this.buy();
    } else if (this.crossunder(this.fast, this.slow)) {

      this.sell();
    }
    
    this.plot(this.fast);
    this.plot(this.slow);
  }
}