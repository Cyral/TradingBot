import {Exchange} from "./Exchange";
import {Account} from "../Account";
import {BigNumber} from "bignumber.js/bignumber";
import {Order, OrderState} from "../../../common/Order";
import {Utils} from "../Utils";
import {HistoricalFeed} from "../Feeds/HistoricalFeed";
import * as uuidv4 from 'uuid/v4';

/**
 * Simulates the bot with a historical feed and simulated commands with latency.
 */
export class BacktestExchange extends Exchange {
    private config = {
        initialFiat: 10000,
        emulateTime: false,
    };

    constructor(account: Account) {
        super(account);
        this.feed = new HistoricalFeed(this);
    }

    public async start() {
        await this.feed.load();
        this.getAccount();
        this.ready();
        await this.feed.start();
    }

    public getAccount() {
        this.account.fiatAvailable = new BigNumber(this.config.initialFiat);
    }

    public getMarketPrices() {
        return {
            ask: this.feed.currentPrice.add(1),
            bid: this.feed.currentPrice.sub(0.01).sub(1),
        }
    }

    public async sell(order: Order) {
        await this.placeOrder(order);
    }

    public async buy(order: Order) {
        await this.placeOrder(order);
    }

    private async placeOrder(order: Order) {
        if (this.config.emulateTime)
            await Utils.sleep(Utils.rand(10, 70));

        order.ID = uuidv4();

        const create = async () => {
            while (order.remainingSize.gt(0) && order.state === OrderState.Open) {
                if (this.config.emulateTime)
                    await Utils.sleep(Utils.rand(200, 1000));
                const price = order.askingPrice;
                const randomSize = order.totalSize.mul(new BigNumber(Math.round(Utils.rand(0.5, 3) * 1000) / 1000));
                // Keep random size in bounds (we only want it to be less than the remaining size sometimes)
                const size = BigNumber.min(order.remainingSize, randomSize);

                // Must check if the order state is still pen as it could have been canceled.
                if (order.state === OrderState.Open) {
                    this.onOrderMatch$.next({
                        ID: order.ID,
                        fillPrice: new BigNumber(price),
                        fillSize: new BigNumber(size)
                    });
                }
            }

            if (order.state === OrderState.Open) {
                this.onOrderDone$.next({ID: order.ID});
            }
        };
        
        this.onOrderReceived$.next({ID: order.ID, clientOID: order.clientOID});
        
        // Simulate the order being filled after a while.
        if (this.config.emulateTime) {
            setTimeout(async () => {
                await create();
            }, Utils.rand(200, 1000));
        } else {
            await create();
        }
    }

    public async cancel(order: Order) {
        if (this.config.emulateTime)
            await Utils.sleep(Utils.rand(3, 15));
        this.onOrderCanceled$.next({ID: order.ID, external: false});
    }

    public async destroy() {
        this.feed.destroy();
    }
}