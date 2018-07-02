import {ExchangeMatch} from "../../../common/ExchangeMatch";
import {Communicator} from "../../../common/Communicator";
import {WebSocket} from './WebSocket';
import {Candle} from "../../../common/Candle";
import * as SocketIO from 'socket.io';
import {Order} from "../../../common/Order";
import {PlotPoint} from "../../../common/PlotPoint";
import {Point} from "../../../common/Point";
import {Trade} from "../../../common/Trade";

export class State {
    private marketHistory: ExchangeMatch[];
    private plotPoints: { [type: string]: Point[] };
    private priceChart: Candle[];
    private stats: any;
    private trades;
    private account;

    constructor(private redis: Communicator, private ws: WebSocket) {
        this.marketHistory = [];
        this.priceChart = [];
        this.plotPoints = {};
        this.trades = [];
        this.account = {};
    }

    public async subscribe() {
        await this.redis.subscribe('matches', m => this.addMatch(m));
        await this.redis.subscribe('candles', c => this.addCandle(c));
        await this.redis.subscribe('status', s => this.updateStatus(s));
        await this.redis.subscribe('stats', s => this.updateStats(s));
        await this.redis.subscribe('plots', p => this.addPlotPoint(p));
        await this.redis.subscribe('account', a => this.updateAccount(a));
        await this.redis.subscribe('trades', t => this.tradeMessage(t));

        this.ws.onConnect$.subscribe((socket: SocketIO.Socket) => {
            socket.emit('price-history', this.priceChart);
            socket.emit('match-history', this.marketHistory);
            socket.emit('plot-history', this.plotPoints);
            if (this.account)
                socket.emit('account-update', this.account);
            socket.emit('trade-history', this.trades);
            if (this.stats) 
                socket.emit('stats', this.stats);

            socket.on('manual-trade', d => this.manualTrade(d));
        });

        this.redis.publish("startup-request", 'hello');
    }

    private manualTrade(data) {
        const side = data.type;
        this.redis.publish("manual-trade", {
            type: side,
        });
    }

    private addMatch(match: ExchangeMatch) {
        this.ws.broadcast("match", match);
        this.marketHistory.push(match);
        if (this.marketHistory.length > 250)
            this.marketHistory.shift();
    }

    private addCandle(candle: Candle) {
        this.ws.broadcast("candle", candle);
        this.priceChart.push(candle);
    }

    private updateStatus(status: string) {
        if (status === "reset") {
            this.marketHistory = [];
            this.priceChart = [];
            this.plotPoints = {};
            this.stats = {};
            this.trades = [];
            this.account = {};
            this.ws.broadcast('price-history', this.priceChart);
            this.ws.broadcast('match-history', this.marketHistory);
            this.ws.broadcast('trade-history', this.trades);
            this.ws.broadcast('plot-history', this.plotPoints);
            this.ws.broadcast('stats', this.stats);
            if (this.account)
                this.ws.broadcast('account-update', this.account);
        }
    }

    private updateStats(stats) {
        this.stats = stats;
        this.ws.broadcast('stats', stats);
    }

    private addPlotPoint(point: PlotPoint) {
        const name = point.name;
        if (!Array.isArray(this.plotPoints[name])) {
            this.plotPoints[name] = [];
        }
        this.plotPoints[name].push(new Point(point.date, point.value));

        //if (this.plotPoints[name].length > 200)
        //    this.plotPoints[name].shift();
        this.ws.broadcast("plot", point);
    }

    private tradeMessage(msg) {
        switch (msg.type) {
            case "new": {
                const trade = msg.trade;
                this.trades.push(trade);
                if (this.trades.length > 250)
                    this.trades.shift();

                this.ws.broadcast('new-trade', trade);

                break;
            }
            case "order": {
                msg.order.id = msg.order.oid; // Use the OID instead since it is available from the first message.
                const trade = this.findTrade(msg.trade);
                const order = msg.order;

                if (trade) {
                    if (!Array.isArray(trade.orders))
                        trade.orders = [];
                    trade.orders.push(order);
                }

                this.ws.broadcast('new-order', {trade: msg.trade, order: msg.order});

                break;
            }
            case "order-state": {
                msg.order.id = msg.order.oid;
                const order = this.findOrder(msg.order.id);

                if (order) {
                    order.state = msg.order.state;
                }

                this.ws.broadcast('order-state', {order: msg.order});

                break;
            }
            case "fill": {
                msg.order = msg.order_oid;
                const order = this.findOrder(msg.order);
                const fill = msg.fill;

                if (order) {
                    if (!Array.isArray(order.fills))
                        order.fills = [];
                    order.fills.push(fill);
                }

                this.ws.broadcast('order-fill', {order: msg.order, fill: msg.fill});

                break;
            }
        }
    }

    private updateAccount(msg) {
        this.account = msg;
        this.ws.broadcast('account-update', msg);
    }

    private findTrade(id: string) {
        for (let i = this.trades.length - 1; i >= 0; i--) {
            const trade = this.trades[i];
            if (trade.id === id) {
                return trade;
            }
        }
        return false;
    }


    private findOrder(id: string) {
        for (let i = this.trades.length - 1; i >= 0; i--) {
            const trade = this.trades[i];
            if (trade.orders) {
                for (let j = 0; j < trade.orders.length; j++) {
                    const order = trade.orders[j];
                    if (order.oid == id) {
                        return order;
                    }
                }
            }
        }
        return false;
    }
}