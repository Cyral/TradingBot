import {h, render, Component} from 'preact';
import Header from "./Components/Header/Header";
import MarketHistory from "./Components/MarketHistory/MarketHistory";
import PriceChart from "./Components/PriceChart/PriceChart";
import {WebSocket} from "./Services/WebSocket";
import OrderHistory from "./Components/OrderHistory/OrderHistory";
import Account from "./Components/Account/Account";

export interface AppProps {

}

export default class App extends Component<AppProps, any> {
    constructor() {
        super();
        const ws = new WebSocket();
        ws.connect();
    }

    render(props: AppProps) {

        return (
            <div class="container">
                <div class="header">
                    <Header/>
                </div>
                <div class="sidebar-left">
                    <Account/>
                    <MarketHistory/>
                </div>
                <div class="content">
                    <PriceChart/>
                </div>
                <div class="sidebar-right">
                    <OrderHistory/>
                </div>
                {/*<Graph/>*/}
            </div>
        );
    }
}
