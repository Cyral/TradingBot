import * as chalk from 'chalk';
import * as uuidv4 from 'uuid/v4';
import {BigNumber} from "bignumber.js/bignumber";
import {Trade} from "./Trade";
import {Fill} from "./Fill";

export class Order {
    public clientOID: string;
    public ID: string;
    public side: "buy" | "sell";
    public usd: BigNumber;
    public totalSize: BigNumber;
    public askingPrice: BigNumber;
    public date: Date;
    public iteration: number;
    public change: BigNumber;
    public state: OrderState;
    public remainingSize: BigNumber;
    public pendingCancelation: boolean;
    public pendingReceive: boolean;
    public trade: Trade;
    public fills: Fill[];
    public rejectReason: OrderRejectReason | string;

    constructor() {
        this.remainingSize = null;
        this.fills = [];
    }
    
    public addFill(fillSize: BigNumber, fillPrice: BigNumber) {
        const fill = new Fill();
        fill.id = uuidv4();
        fill.time = new Date();
        fill.size = fillSize;
        fill.price = fillPrice;
        this.fills.push(fill);
        return fill;
    }

    public print() {
        let output = "";

        if (this.iteration) {
            output += chalk.gray(pad(`[${this.iteration}] `, 7, true));
        }

        const displayCoin = this.totalSize.toFormat(2);
        const displayUsd = this.totalSize.toFormat(2);
        const displayPrice = this.askingPrice.toFormat(2);

        if (this.side === "sell") {
            output += chalk.red(pad('SELL ', 6));
        } else if (this.side === "buy") {
            output += chalk.green(pad('BUY ', 6));
        }

        output += `${pad(displayCoin, 6)} at $${displayPrice} for $${displayUsd}`;

        console.log(output);

        function pad(string: any, size: number, right: boolean = false) {
            string = string.toString();
            const padding = size - string.length;
            if (padding <= 0) return string;
            if (right)
                return " ".repeat(padding) + string;
            else
                return string + " ".repeat(padding);
        }
    }
    
    public generateID() {
        this.clientOID = uuidv4();
    }
}

export enum OrderState {
    Pending = "pending",
    Received = "received",
    Open = "open",
    Done = "done",
    Rejected = "rejected",
    Canceled = "canceled",
}

export enum OrderRejectReason {
    InsufficientFunds = "insufficient_funds",
    PostOnly = "post_only",
    TooSmall = "too_small",
}