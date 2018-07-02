import {h, render, Component} from 'preact';
import {WebSocket} from "../../Services/WebSocket";
import './Stats.styl'
import {Utils} from "../../Services/Utils";

declare let BigNumber;

export interface StatsProps {

}

export default class Stats extends Component<StatsProps, any> {
    private ws: WebSocket = WebSocket.instance;

    constructor() {
        super();

        this.ws.on("stats", s => {
            this.setState({
                stats: s,
            });
        });
    }

    render(props: StatsProps) {
        return (
            <div class="stats">
                {this.generateStats("Market")}
                {this.generateStats("Bot")}
            </div>
        );
    }

    private generateStats(str: string) {
        if (!this.state.stats) return;
        if (!this.state.stats.start) return;
        const type = str.toLowerCase();
        const stats = this.state.stats;
        const change = stats.change[type];
        let changeStr = Utils.roundPrice(change, 100).toFixed(2);
        if (change >= 0) {
            changeStr = '+' + changeStr;
        }

        const diff = new BigNumber(stats.now[type]).sub(new BigNumber(stats.start[type]));
        let diffStr = diff.toFixed(0);
        let isNegDiff = diffStr.charAt(0) === "-";
        if (isNegDiff)
            diffStr = "-$" + diffStr.substring(1);
        else
            diffStr = "+$" + diffStr;
 
        if (type === "bot")
            document.title = `$${Utils.formatNumber(Utils.roundPrice(stats.now.market, 1))} (${diffStr})`;

        return (
            <div class="stat-line">
                    <span class="stat-type">
                        {str}:
                    </span>
                <span class="stat-price">
                    ${Utils.formatNumber(Utils.roundPrice(stats.start[type], 100))}
                    </span>
                <span>to</span>
                <span class="stat-price">
                       ${Utils.formatNumber(Utils.roundPrice(stats.now[type], 100))}
                </span>
                <span class={"stat-change change-" + (change >= 0 ? "pos" : "neg")}>
                    <span class="stat-change-percent">{changeStr}%</span>
                    <span class="stat-change-fiat">{diffStr}</span>
                </span>
            </div>
        );
    }
}

