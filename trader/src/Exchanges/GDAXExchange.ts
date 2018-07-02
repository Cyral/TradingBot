import {Exchange} from "./Exchange";
import {Account} from "../Account";
import {Utils} from "../Utils";
import * as chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs';
import * as uuidv4 from 'uuid/v4';
import {AuthenticatedClient, OrderbookSync, LimitOrder, FIXClient} from 'gdax';
import {BigNumber} from "bignumber.js/bignumber";
import {LiveGDAXFeed} from "../Feeds/LiveGDAXFeed";
import {Subject} from "rxjs/Subject";
import {Order, OrderRejectReason, OrderState} from "../../../common/Order";
import {Trade} from "../../../common/Trade";

export class GDAXExchange extends Exchange {
    public client: AuthenticatedClient;
    private ws: OrderbookSync;
    private fix: FIXClient;

    private config = {
        __absolutelyTradeOnLiveMarket__: true,
        key: null,
        secret: null,
        passphrase: null,
        crypto: 'BTC',
        fiat: 'USD',
        product: '',
        fixUrl: 'fix.gdax.com:4198',
        apiUrl: 'https://api.gdax.com',
        wsUrl: 'wss://ws-feed.gdax.com'
    };

    private pendingReceive: PendingOrder[];
    private pendingCancel: PendingOrder[];

    constructor(account: Account) {
        super(account);
        this.feed = new LiveGDAXFeed(this);
        this.pendingReceive = [];
        this.pendingCancel = [];

        if (this.config.__absolutelyTradeOnLiveMarket__) {
            console.log(chalk.red(`/!\\       WARNING        /!\\`));
            console.log(chalk.red(`/!\\ LIVE TRADING ENABLED /!\\\n`));
        }
    }

    public async start() {
        return new Promise(async accept => {
            try {
                this.config.product = this.config.crypto + '-' + this.config.fiat;
                await this.loadConfig(); 

                let orderbookReady = false, wsConnectionOpen = false, fixConnectionOpen = false;

                // Create authenticated client, used to get data from the REST API.
                this.client = new AuthenticatedClient([this.config.product], this.config.key, this.config.secret,
                    this.config.passphrase, this.config.apiUrl);
                await this.getAccount(); 
                this.feed.onNewCandle$.subscribe(() => {
                    this.getAccount();
                });

                const checkIfReady = () => {
                    if (!this.isReady && orderbookReady && wsConnectionOpen && fixConnectionOpen) {
                        this.ready();
                    } 
                };

                // Create FIX client.
                this.fix = new FIXClient([this.config.product], this.config.fixUrl, this.client);
                this.fix.on('message', data => this.onFixMessage(data));
                this.fix.on('error', this.onError);
                this.fix.on('open', () => {
                    console.log('GDAX: Connected to FIX API.');
                    fixConnectionOpen = true;
                    checkIfReady();
                });
                this.fix.on('close', () => {
                    console.log(chalk.red('GDAX: FIX connection closed!'));
                    this.ready(false);
                    accept();
                });
                this.fix.on('error', err => {
                    this.onError(err);
                    console.log(chalk.red('GDAX: FIX Error!'));
                    this.ready(false);
                    accept();
                });

                await this.feed.load();

                // Create orderbook client, used for the websocket feed.
                this.ws = new OrderbookSync([this.config.product], this.config.apiUrl, this.config.wsUrl, this.client);
                this.ws["channels"] = ["ticker", "full"];
                await this.feed.start();

                this.ws.on('message', data => this.onWebSocketMessage(data));
                this.ws.on('error', err => {
                    this.onError(err);
                    console.log(chalk.red('GDAX: WebSocket error!'));
                    this.ready(false);
                    accept();
                });
                this.ws.on('close', () => {
                    console.log(chalk.red('GDAX: WebSocket connection closed!'));
                    this.ready(false);
                    accept();
                });
                this.ws.on('open', () => {
                    console.log('GDAX: Connected to WebSocket API.');
                    wsConnectionOpen = true;
                    checkIfReady();
                });
                this.ws.on('orderbook-changed', () => {
                    this.orderbookChanged();
                    orderbookReady = true;
                    checkIfReady();
                });
            }
            catch (e) {
                console.log(chalk.red(e));
                accept();
            }
        });
    }

    private onFixMessage(data) {
        if (!this.isReady) return;
        switch (data.type) {
            case "received": {
                // Search for order in pending list and call the promise accept function.
                for (let i = this.pendingReceive.length - 1; i >= 0; i--) {
                    const pending = this.pendingReceive[i];
                    if (pending.order.clientOID === data.client_oid) {
                        pending.order.ID = data.order_id;
                        this.pendingReceive.splice(i, 1);
                        pending.accept(pending.order);
                        break;
                    }
                }

                this.onOrderReceived$.next({ID: data.order_id, clientOID: data.client_oid});
                break;
            }
            case "done": {
                const reason = data.done_reason;

                if (reason === "canceled") {
                    let external = true;
                    // Search for order in pending list and call the promise accept function.
                    // Order could have been canceled externally (e.g. GDAX API), in which case it won't be found here.
                    for (let i = this.pendingCancel.length - 1; i >= 0; i--) {
                        const pending = this.pendingCancel[i];
                        if (pending.order.ID === data.order_id) {
                            this.pendingCancel.splice(i, 1);
                            pending.accept(pending.order);
                            external = false;
                            break;
                        }
                    }

                    this.onOrderCanceled$.next({ID: data.order_id, external});
                } else if (reason === "filled") {
                    this.onOrderDone$.next({ID: data.order_id});
                }

                break;
            }
            case "match": {
                this.onOrderMatch$.next({
                    ID: data.order_id,
                    fillPrice: new BigNumber(data.price),
                    fillSize: new BigNumber(data.size)
                });
                break;
            }
            case "rejected": {
                // Handle order placement errors.
                for (let i = this.pendingReceive.length - 1; i >= 0; i--) {
                    const pending = this.pendingReceive[i];
                    if (pending.order.clientOID === data.client_oid) {
                        pending.order.ID = data.order_id;

                        if (data.message === "Insufficient funds")
                            pending.order.rejectReason = OrderRejectReason.InsufficientFunds;
                        else if (data.message === "post only")
                            pending.order.rejectReason = OrderRejectReason.PostOnly;
                        else if (data.message === "Order size is too small. Minimum size is 0.01")
                            pending.order.rejectReason = OrderRejectReason.TooSmall;
                        else
                            pending.order.rejectReason = data.message;

                        this.pendingReceive.splice(i, 1);
                        pending.reject(pending.order);
                        break;
                    }
                }

                this.onOrderRejected$.next({ID: data.order_id});
                break;
            }
            case "order-cancel-reject": {
                for (let i = this.pendingCancel.length - 1; i >= 0; i--) {
                    const pending = this.pendingCancel[i];
                    if (pending.order.ID === data.order_id) {
                        this.pendingCancel.splice(i, 1);
                        pending.reject(pending.order);
                        break;
                    }
                }

                this.onOrderCancelRejected$.next({ID: data.order_id, too_late: data.too_late});
                break;
            }
        }
    }

    private onWebSocketMessage(data) {
        if (!this.isReady) return;
        this.onMessage$.next(data);
    }

    private onError(error) {
        if (this.isReady)
            console.error(error);
    }


    public async getAccount() {
        const gdaxAccounts = await this.client.getAccounts();

        const cryptoAccount = gdaxAccounts.find(x => x.currency == this.config.crypto);
        const fiatAccount = gdaxAccounts.find(x => x.currency == this.config.fiat);

        if (!cryptoAccount || !fiatAccount) {
            throw new Error('Could not find accounts.');
        }

        this.account.fiatAvailable = new BigNumber(fiatAccount.available);
        this.account.fiatHold = new BigNumber(fiatAccount.hold);
        this.account.cryptoAvailable = new BigNumber(cryptoAccount.available);
        this.account.cryptoHold = new BigNumber(cryptoAccount.hold);
    }

    public getMarketPrices() {
        const best = this.ws.books[this.config.product].getBest();
        const topAsk = new BigNumber(best.ask);
        const topBid = new BigNumber(best.bid);

        if (topBid.isNaN() || topAsk.isNaN() || topBid.lt(100) || topAsk.lt(100))
            return null;

        return {
            ask: topAsk,
            bid: topBid
        }
    }

    public async sell(params: Order) {
        this.onOrder$.next(params);
        const order = this.createOrder(params);

        if (this.config.__absolutelyTradeOnLiveMarket__) {
            await new Promise<Order>((accept, reject) => {
                this.fix.sell(order);
                this.pendingReceive.push(new PendingOrder(params, accept, reject));
            });
        }
    }

    public async buy(params: Order) {
        this.onOrder$.next(params);
        const order = this.createOrder(params);

        if (this.config.__absolutelyTradeOnLiveMarket__) {
            await new Promise<Order>((accept, reject) => {
                this.fix.buy(order);
                this.pendingReceive.push(new PendingOrder(params, accept, reject));
            });

            /**
             * Error responses:
             * { message: 'Insufficient funds' }
             * { status: 'rejected', reject_reason: 'post only' }
             */
        }
    }

    public async cancel(order: Order) {
        if (this.config.__absolutelyTradeOnLiveMarket__) {
            await new Promise<Order>((accept, reject) => {
                const requestID = uuidv4(); // Not actually used by us, but required.
                this.fix.cancelOrder(requestID, order.clientOID, order.ID);
                this.pendingCancel.push(new PendingOrder(order, accept, reject));
            });
        }
    }


    public orderbookChanged() {
        const prices = this.getMarketPrices();
        this.onMarketPriceChanged$.next(prices);
    }

    private createOrder(params: Order): LimitOrder {
        // https://docs.gdax.com/#place-a-new-order
        const order = {
            client_oid: params.clientOID,
            type: <any>"limit",
            product_id: this.config.product,
            price: params.askingPrice.toString(),
            size: params.totalSize.toString(),
            post_only: true,
        };
        return order;
    }

    private async loadConfig() {
        const fileData = await Utils.wrapRequest(cb => fs.readFile(path.join('config', 'gdax.dat'), 'utf8', (err, d) => {
            if (err) {
                console.log(err);
            } else {
                cb(d);
            }
        }));

        const lines = fileData.replace(/(\r\n|\n|\r)/gm, "").split(',');
        this.config.key = lines[0];
        this.config.secret = lines[1];
        this.config.passphrase = lines[2];
    }

    public async destroy() {
        if (this.ws)
            this.ws.disconnect();
        if (this.fix)
            this.fix.logout();
        this.feed.destroy();
        this.feed = null;
    }
}

class PendingOrder {
    constructor(public order: Order, public accept: Function, public reject?: Function) {

    }
}