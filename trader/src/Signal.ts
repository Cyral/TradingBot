import BigNumber from "bignumber.js";

export class Signal {
    public type: "buy" | "sell";
    public iteration: number;
   
    /**
     * The percent of the account value to use.
     */
    public percent: BigNumber;
    
    constructor(type: "buy" | "sell", iteration: number, percent: BigNumber) {
        this.type = type;
        this.iteration = iteration;
        this.percent = percent;
    }
}