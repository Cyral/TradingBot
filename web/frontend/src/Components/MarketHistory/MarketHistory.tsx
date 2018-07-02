import {h, render, Component} from 'preact';
import './MarketHistory.styl'
import {Utils} from "../../Services/Utils";
import {WebSocket} from "../../Services/WebSocket";
import HighlightNumber, {HighlightType} from "../HighlightNumber/HighlightNumber";

export interface MarketHistoryProps {

}

export default class MarketHistory extends Component<MarketHistoryProps, any> {
    private ws: WebSocket = WebSocket.instance;

    constructor() {
        super();

        this.setState({
            matches: []
        });

        this.ws.on("match", match => {
            const oldMatches = this.state.matches;
            if (oldMatches.length > 200)
                oldMatches.pop();
            this.setState({
                matches: [match, ...oldMatches],
            })
        });

        this.ws.on("match-history", existingHistory => {
            this.setState({
                matches: existingHistory.reverse(),
            })
        });
    }

    render(props: MarketHistoryProps) {
        const matches = this.state.matches.map(match => {
            return (
                <li class={"trade-match match-" + match.side} key={match.id}>
                    <span class="match-size">
                        <HighlightNumber value={match.volume} type={HighlightType.Significant}/>
                        </span>
                    <span class="match-price">
                        <HighlightNumber value={match.price} type={HighlightType.Decimal}/>
                        <i class={"far fa-arrow-" + (match.side === "sell" ? "up" : "down")}/>
                    </span>
                    <span class="match-time">{Utils.formatTime(match.date)}</span>
                </li>
            )
        });

        return (
            <div class="trade-history section">
                <div className="section-header">
                    Market History
                </div>
                <div className="section-body">
                    <ul>
                        {matches}
                    </ul>
                </div>
            </div>
        );
    }
}

