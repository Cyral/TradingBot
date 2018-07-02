import {h, render, Component} from 'preact';
import {WebSocket} from "../../Services/WebSocket";
import './Account.styl'
import {Utils} from "../../Services/Utils";
import HighlightNumber from "../HighlightNumber/HighlightNumber";

declare let BigNumber;

export interface AccountProps {

}

export default class Account extends Component<AccountProps, any> {
    private ws: WebSocket = WebSocket.instance;

    constructor() {
        super();

        this.ws.on("account-update", a => {
            if (isNaN(a.fiatAvailable)) return;
            this.setState({
                account: {
                    fiatAvailable: new BigNumber(a.fiatAvailable),
                    fiatHold: new BigNumber(a.fiatHold),
                    cryptoAvailable: new BigNumber(a.cryptoAvailable),
                    cryptoHold: new BigNumber(a.cryptoHold),
                }
            });
        });
    }

    render(props: AccountProps) {
        return (
            <div class="account section">
                <div className="section-header">
                    Balance
                </div>
                {this.state.account &&
               this.renderAccount()
                }
            </div>
        );
    }
    
    renderAccount() {
        const fiatHoldClass = this.state.account.fiatHold.gt(0) ? "account-hold" : "";
        const cryptoHoldClass = this.state.account.cryptoHold.gt(0) ? "account-hold" : "";
        
        return (
            <div className="section-body">
                <div class="fiat account-currency">
                    <h2>USD:</h2>
                    <div>
                        <span class="account-currency-label">Available: </span>
                        <strong>${this.state.account.fiatAvailable.toFixed(2)}</strong>
                    </div>
                    <div class={fiatHoldClass}>
                        <span class="account-currency-label">Hold: </span>
                        <strong>${this.state.account.fiatHold.toFixed(2)}</strong>
                    </div>
                </div>
                <div class="crypto account-currency">
                    <h2>BTC:</h2>
                    <div>
                        <span class="account-currency-label">Available: </span>
                        <strong><HighlightNumber value={this.state.account.cryptoAvailable}/></strong>
                    </div>
                    <div class={cryptoHoldClass}>
                        <span class="account-currency-label">Hold: </span>
                        <strong><HighlightNumber value={this.state.account.cryptoHold}/></strong>
                    </div>
                </div>
            </div>
        )
    }
}

