import {h, render, Component} from 'preact';
import './Controls.styl'
import {WebSocket} from "../../Services/WebSocket";

export interface ControlsProps {

}

export default class Controls extends Component<ControlsProps, any> {
    private ws: WebSocket = WebSocket.instance;
    constructor() {
        super();
    }

    render(props: ControlsProps) {

        return (
            <div class="controls">
                <div class="button button-sell" onClick={() => this.sell()}>
                    Sell
                </div>
                <div class="button button-buy" onClick={() => this.buy()}>
                    Buy
                </div>
            </div>
        );
    }
    
    private sell() {
        this.ws.emit("manual-trade", {
            type: "sell",
        });
        console.log("Manually selling!");
    }
    
    private buy() {
        this.ws.emit("manual-trade", {
            type: "buy",
        });
        console.log("Manually buying!");
    }
}

