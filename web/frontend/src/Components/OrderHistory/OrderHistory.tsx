import {h, render, Component} from 'preact';
import './OrderHistory.styl'
import {Utils} from "../../Services/Utils";
import {WebSocket} from "../../Services/WebSocket";
import HighlightNumber from "../HighlightNumber/HighlightNumber";

declare let BigNumber;

export interface OrderHistoryProps {

}


export default class OrderHistory extends Component<OrderHistoryProps, any> {
    private ws: WebSocket = WebSocket.instance;

    constructor() {
        super();

        this.setState({
            trades: []
        });


        this.ws.on("trade-history", oldTrades => {
            if (!oldTrades) return;
            for (const trade of oldTrades) {
                trade.askingPrice = new BigNumber(trade.askingPrice);
                trade.totalSize = new BigNumber(trade.totalSize);
                
                if (Array.isArray(trade.orders)) {
                    for (const order of trade.orders) {
                        order.askingPrice = new BigNumber(order.askingPrice);
                        order.totalSize = new BigNumber(order.totalSize);
                        if (Array.isArray(order.fills)) {
                            for (const fill of order.fills) {
                                fill.price = new BigNumber(fill.price);
                                fill.size = new BigNumber(fill.size);
                            }
                        }
                    }
                }
            }
            
            this.setState({
                trades: oldTrades
            })
        });

        this.ws.on("new-trade", trade => {
            trade.askingPrice = new BigNumber(trade.askingPrice);
            trade.totalSize = new BigNumber(trade.totalSize);
            const oldTrades = this.state.trades;
            if (oldTrades.length > 200)
                oldTrades.pop();
            this.setState({
                trades: [{...trade}, ...oldTrades],
            })
        });

        this.ws.on("new-order", msg => {
            msg.order.askingPrice = new BigNumber(msg.order.askingPrice);
            msg.order.totalSize = new BigNumber(msg.order.totalSize);

            const trade = this.state.trades.find(x => x.id === msg.trade);

            if (trade) {

                if (!Array.isArray(trade.orders))
                    trade.orders = [];
                msg.order.trade = trade;
                trade.orders.push(msg.order);
                this.setState({
                    trades: [...this.state.trades],
                })
            }
        });

        this.ws.on("order-state", msg => {
            const order = findOrder(msg.order.id);

            if (order) {
                order.state = msg.order.state;
                this.setState({
                    trades: [...this.state.trades],
                })
            }
        });
        
        this.ws.on("order-fill", msg => {
            msg.fill.price = new BigNumber(msg.fill.price);
            msg.fill.size = new BigNumber(msg.fill.size);
            
            const order = findOrder(msg.order);
            
            if (order) {
                if (!Array.isArray(order.fills))
                    order.fills = [];
                order.fills.push(msg.fill);
                this.setState({
                    trades: [...this.state.trades],
                })
            }
        });

        const findOrder = (id: string) => {
            for (const trade of this.state.trades) {
                if (Array.isArray(trade.orders)) {
                    for (let j = 0; j < trade.orders.length; j++) {
                        const order = trade.orders[j];
                        if (order.id === id)
                            return order;
                    }
                }
            }
        }

        /*
        this.ws.on("order", order => {
            const oldOrders = this.state.orders;
            if (oldOrders.length > 200)
                oldOrders.pop();
            this.setState({
                orders: [order, ...oldOrders],
            })
        });

        this.ws.on("order-history", existingHistory => {
            this.setState({
                orders: existingHistory.reverse(),
            })
        });
        */

    }

    render(props: OrderHistoryProps) {
        const trades = this.state.trades.map(trade => {
            let change = Utils.roundPrice(trade.change, 100).toFixed(2);
            if (trade.change >= 0) {
                change = '+' + change;
            }

            let orders = [];

            if (trade.orders) {
                orders = trade.orders.map(order => {

                    let fills = [];
                    if (order.fills) {
                        fills = order.fills.map(fill => {
                            return (
                                <li class="order-fill" key={fill.id}>
                                    <span class="fill-title">Fill:</span>
                                    <span class="fill-time">{Utils.formatTime(fill.time)}</span>
                                   
                                    <span class="fill-size">{fill.size.div(order.totalSize).mul(100).round(2).toString()}%</span>
                                </li>
                            );
                        });
                    }

                    return (
                        <li class={"trade-order order-" + order.state} key={order.id}>
                            <div class="order-info">
                                <span class="order-title">Order:</span>
                                <span class="order-state">{order.state}</span>
                                <span class="order-size"><HighlightNumber value={order.totalSize}/></span>
                                <span class="order-at">@</span>
                                <span class="order-price">
                                ${Utils.formatPrice(order.askingPrice)}
                            </span>
                            </div>
                            <ul class="order-fills">
                                {fills}
                            </ul>
                        </li>
                    );
                });
            }

            return (
                <li class={"trade trade-" + trade.side} key={trade.id}>
                    <div class="trade-info">
                        <span class="trade-type">{trade.side}</span>
                        <span class="trade-time">{Utils.formatDate(trade.date)}</span>
                        <span class="trade-size"><HighlightNumber value={trade.totalSize}/></span>
                        <span class="trade-at">@</span>
                        <span class="trade-price">
                            ${Utils.formatPrice(trade.askingPrice)}
                        </span>
                        {/*{trade.side === 'sell' &&
                        <span class={"trade-change change-" + (trade.change >= 0 ? "pos" : "neg")}>{change}%</span>
                        }*/}
                    </div>
                    <ul class="trade-orders">
                        {orders}
                    </ul>
                </li>
            );


            /*   return (
                   <li class={"order order-" + order.side} key={order.iteration || order.id}>
                       <span class="order-time">{Utils.formatDate(order.date)}</span>
                       <span class="order-type">{order.side}</span>
                       <span class="order-size">{Utils.roundPrice(order.size, 1000)} </span>
                       <span class="order-at">@ </span>
                       <span class="order-price">${Utils.formatNumber(Utils.roundPrice(order.askingPrice, 100))} </span>
                       {order.side === 'sell' &&
                       <span class={"order-change change-" + (order.change >= 0 ? "pos" : "neg")}>{change}%</span>
                       }
                       <ul>
                           {fills}
                       </ul>
                   </li>
               )*/
        });

        return (
            <div class="trade-history section">
                <div className="section-header">
                    Trades
                </div>
                <div className="section-body">
                    <ul>
                        {trades}
                    </ul>
                </div>
            </div>
        );
    }
}

