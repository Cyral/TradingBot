import * as chalk from 'chalk';
import {CandleFeed} from "./Feeds/CandleFeed";
import {HistoricalFeed} from "./Feeds/HistoricalFeed";
import {Strategy} from "./Strategies/Strategy";
import {EMAStrategy} from "./Strategies/EMAStrategy";
import {Signal} from "./Signal";
import {LiveGDAXFeed} from "./Feeds/LiveGDAXFeed";
import {Communicator} from "../../common/Communicator";
import {ExchangeMatch} from "../../common/ExchangeMatch";
import {Candle} from "../../common/Candle";
import {Order, OrderState} from "../../common/Order";
import {PlotPoint} from "../../common/PlotPoint";
import {ManualStrategy} from "./Strategies/ManualStrategy";
import {Account} from "./Account";
import {BigNumber} from "bignumber.js/bignumber";
import {Exchange} from "./Exchanges/Exchange";
import {GDAXExchange} from "./Exchanges/GDAXExchange";
import {BacktestExchange} from "./Exchanges/BacktestExchange";
import {Trade} from "../../common/Trade";
import {OrderPlacedMessage, TradePlacedMessage, OrderStateMessage, OrderFilledMessage} from "./OrderManager";
import {Utils} from "./Utils"; 
import {DB} from "./DB";

/**
 * The main trading class.
 */
export class Trader {
    private strategy: Strategy;
    private trades: Trade[];
    private exchange: Exchange;
    private startInvestment = 5000;

    private account: Account;
    private redis: Communicator;
    private db: DB;
    private stats: {
        start?: {
            market: BigNumber,
            bot: BigNumber,
        },
        now?: {
            market: BigNumber,
            bot: BigNumber,
        }, change?: { 
            market: BigNumber,
            bot: BigNumber,
        }
    };

    constructor() {
        console.log(chalk.cyan("\n*** Trader ***\n"));
        this.start();
    }

    public async start() {
        this.stats = {};
        
        // TODO: This is a temporary fix to restart if anything goes wrong (e.g. disconnected)
        while (true) { 
            await this.setup();
            await this.destroy();
            console.log(chalk.cyan("\n*** Resetting ***\n"));
            await Utils.sleep(10 * 1000); 
        }
    }

    public async setup() {
        try {
            this.account = new Account();
            //this.exchange = new GDAXExchange(this.account);
            this.exchange = new BacktestExchange(this.account);
            this.redis = new Communicator();
            this.db = new DB();
            this.strategy = new EMAStrategy();
            //this.strategy = new ManualStrategy();
            this.trades = [];

            await this.redis.connect();
            console.log('Connected to redis.');
            
            await this.db.connect();
            this.trades = await this.db.getTrades(); 
            console.log('Connected to mongodb.'); 
            
            this.redis.publish("status", "reset");

            this.strategy.subscribe(this.exchange.feed);

            this.exchange.onReady$.subscribe(async (ready) => {
                if (ready) {
                    this.account.update();
                    this.account.print();
                }
            });

            // Subscribe to order manager events, which are displayed in the web UI.
            this.exchange.orderManager.onOrderFill$.subscribe(m => this.onOrderFill(m));
            this.exchange.orderManager.onTradePlaced$.subscribe(m => this.onTradePlaced(m));
            this.exchange.orderManager.onOrderPlaced$.subscribe(m => this.onOrderPlaced(m));
            this.exchange.orderManager.onOrderStateChanged$.subscribe(m => this.onOrderStatusChanged(m));

            this.account.onChange$.subscribe(m => this.onAccountChange(m));

            this.exchange.feed.onMatch$.subscribe(m => this.exchangeMatch(m));
            this.exchange.feed.onNewCandle$.subscribe(c => this.newCandle(c));
            this.strategy.onSignal$.subscribe(s => this.signal(s));
            this.strategy.onPlot$.subscribe(p => this.plot(p));
            this.strategy.onTick$.subscribe(() => this.tick());

            await this.redis.subscribe('manual-trade', d => this.manualTrade(d));
            await this.redis.subscribe('startup-request', () => this.sendData());
            
            // Send initial data to state.
            await this.sendData();
        } catch (e) {
            console.error(e);
            return;
        }

        await this.exchange.start();
    }

    private async manualTrade(data) {
        if (!this.exchange.isReady) {
            throw new Error('Exchange not ready!');
        }

        const side = data.type;
        if (side !== 'sell' && side !== 'buy') return;

        if (side === 'buy') {
            try {
                console.log(chalk.cyan("Executing manual trade to ") + chalk.green('BUY'));
                const trade = Trade.createTradeParams(this.strategy.now, "buy");
                await this.exchange.orderManager.trade(trade);
            }
            catch (e) {
                console.error(chalk.red(e));
            }
        } else {
            try {
                console.log(chalk.cyan("Executing manual trade to ") + chalk.red('SELL'));
                const trade = Trade.createTradeParams(this.strategy.now, "sell");
                await this.exchange.orderManager.trade(trade);
            }
            catch (e) {
                console.error(chalk.red(e));
            }
        }
    }

    private async signal(signal: Signal) {
        if (!this.exchange.isReady) return;
        const prices = this.exchange.getMarketPrices();
        if (!prices) return console.error("Invalid prices");

        console.log(chalk.green(`[${this.strategy.now.toISOString().slice(0, 16).replace("T", " ")}] Signal to ${signal.type.toUpperCase()}`));

        if (signal.type === "sell") {
            const trade = Trade.createTradeParams(this.strategy.now,
                "sell", signal.percent);

            await this.exchange.orderManager.trade(trade);
        } else {
            const trade = Trade.createTradeParams(this.strategy.now,
                "buy", signal.percent);

            await this.exchange.orderManager.trade(trade);
        }
    }

    private plot(plot: PlotPoint) {
        this.redis.publish("plots", plot)
    }

    private tick() {
        if (!this.exchange.isReady) return;
       
        this.updateStats();
    }

    private exchangeMatch(match: ExchangeMatch) {
        this.redis.publish("matches", match);
        this.updateStats();
    }

    private newCandle(candle: Candle) {
        this.redis.publish("candles", candle);
    }

    private updateStats() {
        try {
            if (!this.stats.start) {
                this.stats.start = { 
                    market: new BigNumber(this.startInvestment),
                    bot: new BigNumber(this.startInvestment),   
                };
            }

            this.stats.now = {
                market: this.exchange.feed.currentPrice,
                bot: this.account.getFiatValue(this.exchange.feed.currentPrice),
            };

            if (this.stats.start) {
                this.stats.change = {
                    market: (this.stats.now.market.sub(this.stats.start.market)).div(this.stats.start.market).mul(100),
                    bot: (this.stats.now.bot.sub(this.stats.start.bot)).div(this.stats.start.bot).mul(100),
                };
            }
        } catch (e) {
            console.error(e);
        }

        this.redis.publish("stats", this.stats);   
    }

    private onTradePlaced(msg: TradePlacedMessage) {
        this.trades.push(msg.trade);

        // Send message of new trade.
        this.redis.publish("trades", {
            type: "new",
            trade: {
                id: msg.trade.ID,
                date: msg.trade.date, 
                side: msg.trade.side,
                askingPrice: msg.trade.askingPrice,
                totalSize: msg.trade.totalSize,
            }
        });

        this.db.saveTrade(msg.trade);
    }

    private onOrderPlaced(msg: OrderPlacedMessage) {
        // Send message of new order.
        this.redis.publish("trades", {
            type: "order",
            trade: msg.trade.ID,
            order: {
                id: msg.order.ID,
                oid: msg.order.clientOID,
                date: msg.order.date,
                state: msg.order.state,
                askingPrice: msg.order.askingPrice,
                totalSize: msg.order.totalSize,
            }
        });
    }

    private onOrderStatusChanged(msg: OrderStateMessage) {
        // Send message of new order.
        this.redis.publish("trades", {
            type: "order-state",
            order: {
                id: msg.order.ID,
                oid: msg.order.clientOID,
                state: msg.order.state
            }
        });
        
        if (msg.order.state === OrderState.Done) {
            console.log(`Market: $${this.stats.start.market.toFixed(0)} -> $${this.stats.now.market.toFixed(0)} (${this.stats.change.market.toFixed(2)}%)`);
            console.log(`   Bot: $${this.stats.start.bot.toFixed(0)} -> $${this.stats.now.bot.toFixed(0)} (${this.stats.change.bot.toFixed(2)}%)`);
        }
    }

    private onOrderFill(msg: OrderFilledMessage) {
        // Send message of new order.
        this.redis.publish("trades", {
            type: "fill",
            order: msg.order.ID,
            order_oid: msg.order.clientOID,
            fill: msg.fill
        });
    }

    private onAccountChange(acc: Account) {
        this.redis.publish("account", {
            fiatAvailable: acc.fiatAvailable,
            fiatHold: acc.fiatHold,
            cryptoAvailable: acc.cryptoAvailable,
            cryptoHold: acc.cryptoHold
        });
    }
    
    private sendData() {
        for (const trade of this.trades) {
            this.redis.publish("trades", {
                type: "new",
                trade: {
                    id: trade.ID,
                    date: trade.date,
                    side: trade.side,
                    askingPrice: trade.askingPrice,
                    totalSize: trade.totalSize,
                }
            });
        }

        this.redis.publish("account", {
            fiatAvailable: this.account.fiatAvailable,
            fiatHold: this.account.fiatHold,
            cryptoAvailable: this.account.cryptoAvailable,
            cryptoHold: this.account.cryptoHold
        });
    }

    private async destroy() {
        if (this.exchange)
            await this.exchange.destroy();
        if (this.redis)
            this.redis.quit();
    }
}