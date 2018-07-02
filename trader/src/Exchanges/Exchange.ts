import {Account} from "../Account";
import {Order} from "../../../common/Order";
import {BigNumber} from "bignumber.js/bignumber";
import {CandleFeed} from "../Feeds/CandleFeed";
import {Subject} from 'rxjs/Subject';
import {OrderManager} from "../OrderManager";
import * as chalk from 'chalk';

export abstract class Exchange {
    public isReady: boolean;
    public feed: CandleFeed;
    public orderManager: OrderManager;
    
    public onReady$ = new Subject<boolean>();
    public onMessage$ = new Subject<any>();
    public onOrder$ = new Subject<Order>();
    
    public onOrderReceived$ = new Subject<OrderReceivedMessage>();
    public onOrderOpen$ = new Subject<OrderOpenMessage>();
    public onOrderMatch$ = new Subject<OrderMatchMessage>();
    public onOrderDone$ = new Subject<OrderDoneMessage>();
    public onOrderCanceled$ = new Subject<OrderCanceledMessage>();
    public onOrderRejected$ = new Subject<OrderRejectedMessage>();
    public onOrderCancelRejected$ = new Subject<OrderCancelRejectedMessage>();
    
    public onMarketPriceChanged$ = new Subject<{bid: BigNumber, ask:BigNumber}>();
    
    constructor(protected account: Account) {
       this.orderManager = new OrderManager(this, account);
    }
    
    public abstract async start();
    public abstract async getAccount()
    public abstract getMarketPrices(): {ask: BigNumber, bid: BigNumber};
    public abstract async sell(order: Order);
    public abstract async buy(order: Order);
    public abstract async cancel(order: Order);
    public abstract async destroy();

    protected ready(isReady: boolean = true) {
        if (isReady) {
            this.isReady = true;
            this.onReady$.next(true);
            console.log(chalk.green("Exchange is ready."));
        } else {
            this.isReady = false;
            this.onReady$.next(false);
        }
    }
}

export type OrderOpenMessage = {ID: string};
export type OrderReceivedMessage = {ID: string, clientOID: string};
export type OrderMatchMessage = {ID: string, fillSize: BigNumber, fillPrice: BigNumber};
export type OrderDoneMessage = {ID: string};
export type OrderCanceledMessage = {ID: string, external: boolean};
export type OrderRejectedMessage = {ID: string};
export type OrderCancelRejectedMessage = {ID: string, too_late: boolean};