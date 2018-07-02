import {
    Exchange, OrderCanceledMessage, OrderDoneMessage, OrderMatchMessage, OrderReceivedMessage,
    OrderRejectedMessage
} from "./Exchanges/Exchange";
import {Account} from "./Account";
import {Trade, TradeState} from "../../common/Trade";
import {Order, OrderRejectReason, OrderState} from "../../common/Order";
import {BigNumber} from "bignumber.js/bignumber";
import {Subject} from 'rxjs/Subject';
import * as chalk from 'chalk';
import {Fill} from "../../common/Fill";

export type TradePlacedMessage = {trade: Trade};
export type OrderPlacedMessage = {trade: Trade, order: Order};
export type OrderFilledMessage = {order: Order, fill: Fill};
export type OrderStateMessage = {order: Order};
export type TradeStateMessage = {trade: Trade};

/**
 * Manages responding to order events and handling the state of open orders.
 * The most important function here is handling increases and decreases of the market price by canceling and retrying
 * orders in order to keep them at the current market price so they are bought/sold faster.
 */
export class OrderManager {
    public trades: Trade[];
    public oldTrades: Trade[];

    public onTradePlaced$ = new Subject<TradePlacedMessage>();
    public onOrderPlaced$ = new Subject<OrderPlacedMessage>();
    public onOrderFill$ = new Subject<OrderFilledMessage>();
    public onOrderStateChanged$ = new Subject<OrderStateMessage>();
    public onTradeStateChanged$ = new Subject<TradeStateMessage>();

    private lastPrices: { bid: BigNumber, ask: BigNumber };
    private errorRetryCount = 0;
    
    private config = {
        minSize: new BigNumber(0.01)
    };
    
    private readonly zero = new BigNumber(0);

    constructor(private exchange: Exchange, private account: Account) {
        this.trades = [];
        this.oldTrades = [];
        
        this.exchange.onOrderMatch$.subscribe(msg => this.onOrderMatch(msg));
        this.exchange.onOrderRejected$.subscribe(msg => this.onOrderRejected(msg));
        this.exchange.onOrderReceived$.subscribe(msg => this.onOrderReceived(msg));
        this.exchange.onOrderDone$.subscribe(msg => this.onOrderDone(msg));
        this.exchange.onOrderCanceled$.subscribe(msg => this.onOrderCanceled(msg));
        this.exchange.onMarketPriceChanged$.subscribe(prices => this.onMarketPriceChange(prices))
    }

    private clock(start?: any) {
        if (!start) return process.hrtime();
        const end = process.hrtime(start);
        return Math.round((end[0] * 1000) + (end[1] / 1000000));
    }

    /**
     * Creates the initial order for a trade at the current market price.
     */
    public async trade(trade: Trade) {
        await this.beginTrade(trade, true);
    }
    
    private async beginTrade(trade: Trade, initial: boolean = false) {
        if (trade.state === TradeState.Complete) {
            return console.log(chalk.red("Trade already completed, aborting."));
        }
        // Cancel any existing orders in any open trades.
        for (let i = 0; i < this.trades.length; i++) {
            await this.cancelTrade(this.trades[i]);
        }

        // Create order data.
        const order = new Order();
        order.side = trade.side;
        order.generateID();

        const price = this.getSuggestedPrice(order);

        // Calculate the size of the trade based on the percentage of the account value specified.
        // This must be recalculated each time for buy orders since the market price changes.
        if (trade.remainingSize === null || trade.side === "buy") {
            let size;
            const percent = trade.percent.div(100);
            if (trade.side === "buy") {
                size = this.account.fiatAvailable.div(price).mul(percent);
            } else if (trade.side = "sell") {
                size = this.account.cryptoAvailable.mul(percent);
            }
            trade.totalSize = trade.remainingSize = new BigNumber(size).round(8, 1); // Round down to 8 places.
        }
        
        // Check if we have enough funds.
        if (trade.totalSize.lt(0.01)) {
            this.account.print();
            return console.log(chalk.red("Trade size not large enough, aborting."));
        }
        
        order.totalSize = trade.remainingSize;
        order.remainingSize = order.totalSize;
        order.askingPrice = price;

        trade.addOrder(order);
        trade.state = TradeState.Pending;
        order.trade = trade;
        this.trades.push(trade);
        
        if (initial) {
            if (trade.askingPrice === null)
                trade.askingPrice = order.askingPrice;
            this.onTradePlaced$.next({trade});
        }

        // Make order on exchange.
        order.pendingReceive = true;

        console.log("CREATING ORDER!!");
        const timer = this.clock();

        try {
            this.onOrderPlaced$.next({trade, order});
            if (trade.side === "buy") {
                // Put fiat funds on hold
                const totalPrice = order.totalSize.mul(order.askingPrice);
                this.account.fiatAvailable = this.account.fiatAvailable.sub(totalPrice);
                this.account.fiatHold = this.account.fiatHold.add(totalPrice);
                this.account.update();
                
                await this.exchange.buy(order);
            } else if (trade.side === "sell") {
                // Put crypto funds on hold
                this.account.cryptoAvailable = this.account.cryptoAvailable.sub(order.totalSize);
                this.account.cryptoHold = this.account.cryptoHold.add(order.totalSize);
                this.account.update();

                await this.exchange.sell(order);
            }
            console.log(chalk.magenta("\tOrder Create: " + chalk.white(this.clock(timer)) + "ms"));
        } catch (e) {
            console.log(chalk.magenta("\tOrder Create: " + chalk.white(this.clock(timer)) + "ms"));
            // If the promise reject param is an order, look at the rejectReason of the order.
            if (e instanceof Order) {
                if (e.rejectReason === OrderRejectReason.InsufficientFunds) {
                    // This actually happens often if the GDAX engine doesn't give us our money back after
                    // canceling an order immediately. They seem to send the cancel successful message prematurely.
                    this.errorRetryCount++;
                    console.error(chalk.red(`Trade rejected, insufficient funds. Retrying... (${this.errorRetryCount})`));

                    if (this.errorRetryCount < 10)
                        return await this.retryTrade(trade);
                } else if (e.rejectReason === OrderRejectReason.PostOnly) {
                    console.error(chalk.red("Trade rejected, post only. Retrying..."));
                    return await this.retryTrade(trade);
                } else if (e.rejectReason === OrderRejectReason.TooSmall) {
                    console.error(chalk.red("Trade rejected, order too small."));
                } else {
                    console.error(chalk.red("Order rejection: "));
                    console.log(order.rejectReason); 
                }
            }
        }

        return order;
    }

    /**
     * Cancels a trade by cancelling the open order(s) within it.
     */
    private async cancelTrade(trade: Trade) {
        for (let i = 0; i < trade.orders.length; i++) {
            const order = trade.orders[i];

            if (order.state === OrderState.Open) {
                await this.cancelOrder(order);
            }
        }
    }

    /**
     * Cancels an order on an exchange.
     */
    private async cancelOrder(order: Order) {
        if (!order.pendingCancelation) {
            console.log("CANCELLING ORDER!!");
            order.pendingCancelation = true;
            const timer = this.clock();
            try {
                await this.exchange.cancel(order);
            } catch (e) {
                console.error(chalk.red("Error Canceling Order!"));
            }
            console.log(chalk.magenta("\tOrder Cancel: " + chalk.white(this.clock(timer)) + "ms"));
            order.pendingCancelation = false;
        }
    }

    /**
     * Re-submit an existing trade by placing a new order for the remaining amount.
     */
    private async retryTrade(trade: Trade) {
        await this.beginTrade(trade);
    }

    /**
     * Handle increases and decreases of the market price by canceling and retrying orders in order to keep them
     * at the current market price so they are bought/sold faster.
     */
    private async onMarketPriceChange(newPrices: { bid: BigNumber, ask: BigNumber }) {
        // Retry orders if the market price goes in the opposite direction.
        if (this.lastPrices) {

            // console.log(`Bid price increase ${this.lastPrices.bid.toString()}->${newPrices.bid.toString()}`);
            // console.log("Ask: " + newPrices.ask.toString());
          
            for (const trade of this.trades) {
                for (const order of trade.orders) {
                    // Only check open orders.
                    if (!order.pendingCancelation && order.state === OrderState.Open) {
                        const suggestedPrices = this.getSuggestedPrice(order);
                        /*
                         * Sell Orders: If the sell price is greater than the current best ask.
                         * Buy Orders: If the buy price is less than the current best bid.
                         */
                        if ((order.side === "sell" && order.askingPrice.gt(suggestedPrices))
                            || (order.side === "buy" && order.askingPrice.lt(suggestedPrices))) {

                            // Cancel the current order.
                            await this.cancelOrder(order);
                            
                            // Close the trade if the remaining amount is less than the minimum size (but not 0), we will just have to wait
                            // until the next order on the same side to move it.
                            if (trade.remainingSize.gt(this.zero) && 
                                trade.remainingSize.lt(this.config.minSize)) {
                                console.log("Remaining less than the minimum size, cannot re-place.");
                                order.state = OrderState.Canceled;
                                order.trade.state = TradeState.Complete;
                                this.onOrderStateChanged$.next({order});
                                this.onTradeStateChanged$.next({trade: order.trade});

                                this.moveTrade(order.trade);
                            } else {
                                // Otherwise, retry the trade as normal at the new price.
                                await this.retryTrade(trade);
                            }
                        }
                    }
                }
            }
        }

        this.lastPrices = newPrices;
    }

    /**
     * Get the suggested price to buy at, which is one cent below the current market price.
     */
    private getSuggestedPrice(order: Order) {
        const prices = this.exchange.getMarketPrices();

        if (!prices) throw new Error("Invalid prices"); // Just in case

        if (order.side === "buy") {
            return prices.ask.sub(new BigNumber(0.01));
        } else {
            return prices.bid.add(new BigNumber(0.01));
        }
    }
    
    private onOrderMatch(msg: OrderMatchMessage) {
        const order = this.getOrderByID(msg.ID);
        if (!order) return;
        
        order.trade.remainingSize =  order.trade.remainingSize.sub(msg.fillSize);
        order.remainingSize = order.remainingSize.sub(msg.fillSize);
        const fill = order.addFill(msg.fillSize, msg.fillPrice);
        console.log(chalk.green("Order Filled") + ` - ${order.trade.remainingSize.toString()} remaining`);

        this.onOrderFill$.next({order, fill});

        // Move funds from on-hold to available.
        if (order.side === "buy") {
            this.account.cryptoAvailable = this.account.cryptoAvailable.add(msg.fillSize);
            this.account.fiatHold = this.account.fiatHold.sub(msg.fillPrice.mul(msg.fillSize));
        } else if (order.side === "sell") {
            this.account.fiatAvailable = this.account.fiatAvailable.add(msg.fillPrice.mul(msg.fillSize));
            this.account.cryptoHold = this.account.cryptoHold.sub(msg.fillSize);
        }

        this.account.update();
    }

    private onOrderDone(msg: OrderDoneMessage) { 
        const order = this.getOrderByID(msg.ID); 
        if (!order) return;

        console.log(chalk.bgGreen(chalk.black("Order Done")));
        order.state = OrderState.Done;
        order.trade.state = TradeState.Complete;
        this.onOrderStateChanged$.next({order});
        this.onTradeStateChanged$.next({trade: order.trade});
        
        this.moveTrade(order.trade);
    }

    private onOrderCanceled(msg: OrderCanceledMessage) {
        const order = this.getOrderByID(msg.ID);
        if (!order) return;
        
        order.state = OrderState.Canceled;
        
        // Release on-hold funds.
        if (order.side === "buy") {
            const totalPrice = order.remainingSize.mul(order.askingPrice);
            this.account.fiatAvailable = this.account.fiatAvailable.add(totalPrice);
            this.account.fiatHold = this.account.fiatHold.sub(totalPrice);
        } else if (order.side === "sell") {
            this.account.cryptoAvailable = this.account.cryptoAvailable.add(order.remainingSize);
            this.account.cryptoHold = this.account.cryptoHold.sub(order.remainingSize); 
        }

        this.onOrderStateChanged$.next({order});
        
        if (msg.external) {
            order.trade.state = TradeState.Complete;
            this.onTradeStateChanged$.next({trade: order.trade});
            this.moveTrade(order.trade);
        }

        console.log("onOrderCanceled");
        
        this.account.update();
    }

    private onOrderReceived(msg: OrderReceivedMessage) {
        const order = this.getOrderByID(msg.ID);
        if (!order) return;

        this.errorRetryCount = 0;
        console.log(chalk.bgCyan(chalk.black("Order Open")));
        order.state = OrderState.Open;
        this.onOrderStateChanged$.next({order});
    }

    private onOrderRejected(msg: OrderRejectedMessage) {
        const order = this.getOrderByID(msg.ID);
        if (!order) return;

        console.log(chalk.bgYellow(chalk.black("Order Rejected")));
        order.state = OrderState.Rejected;

        // Release on-hold funds.
        if (order.side === "buy") {
            const totalPrice = order.remainingSize.mul(order.askingPrice);
            this.account.fiatAvailable = this.account.fiatAvailable.add(totalPrice);
            this.account.fiatHold = this.account.fiatHold.sub(totalPrice);
        } else if (order.side === "sell") {
            this.account.cryptoAvailable = this.account.cryptoAvailable.add(order.remainingSize);
            this.account.cryptoHold = this.account.cryptoHold.sub(order.remainingSize);
        }
        
        this.onOrderStateChanged$.next({order});

        this.account.update();
    }

    private moveTrade(trade: Trade) {
        const index = this.trades.indexOf(trade);
        this.trades = this.trades.slice(index, 1);
        this.oldTrades.push(trade);
    }

    private getOrderByID(orderID: string) {
        for (let i = this.trades.length - 1; i >= 0; i--) {
            const trade = this.trades[i];
            for (let j = 0; j < trade.orders.length; j++) {
                const order = trade.orders[j];
                if (order.ID === orderID) {
                    return order;
                }
            }
        }

        return false;
    }
}