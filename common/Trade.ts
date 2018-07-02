import {Order} from "./Order";
import * as uuidv4 from 'uuid/v4';
import {BigNumber} from "bignumber.js/bignumber";

export class Trade {
    public ID: string;
    public date: Date;
    public orders: Order[];
    public side: "buy" | "sell";
    public askingPrice: BigNumber;
    public totalSize: BigNumber;
    public state: TradeState;
    public remainingSize: BigNumber;

    /**
     * The percent of the account value to use.
     */
    public percent: BigNumber;

    constructor() {
        this.orders = [];
        this.askingPrice = null; 
        this.remainingSize = null;
    }

    public static createTradeParams(date: Date, side: "buy" | "sell", percent?: BigNumber) {
        const trade = new Trade();
        trade.ID = uuidv4();
        trade.date = date;
        if (!percent)
            trade.percent = new BigNumber(100);
        else
            trade.percent = percent;
        trade.side = side;

        return trade;
    }

    public addOrder(order: Order) {
        this.orders.push(order);
    }
}

export enum TradeState {
    Pending = "pending",
    Open = "open",
    Complete = "complete",
    Canceled = "cancelled",
}