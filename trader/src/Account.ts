import {BigNumber} from 'bignumber.js';
import * as chalk from 'chalk';
import {Subject} from 'rxjs/Subject';

/**
 * Account value manager.
 */
export class Account {
    // "Hold" values represent funds that are currently on hold, such as orders that have been placed but not filled.
    public cryptoAvailable: BigNumber = new BigNumber(0);
    public cryptoHold: BigNumber = new BigNumber(0);
    public fiatAvailable: BigNumber = new BigNumber(0);
    public fiatHold: BigNumber = new BigNumber(0);
    
    public onChange$ = new Subject<Account>();
    
    constructor() {

    }
    
    public getTotalCrypto() {
        return this.cryptoAvailable.add(this.cryptoHold);
    }

    public getTotalFiat() {
        return this.fiatAvailable.add(this.fiatHold);
    }
    
    public getFiatValue(cryptoValue: BigNumber) {
        return this.getTotalCrypto().mul(cryptoValue).add(this.getTotalFiat());
    }

    public print() {
        console.log('Fiat: ');
        console.log('\tAvailable: ' + chalk.green(this.fiatAvailable.toString()));
        console.log('\tHold: ' + chalk.red(this.fiatHold.toString()));
        console.log('Crypto: ');
        console.log('\tAvailable: ' + chalk.green(this.cryptoAvailable.toString()));
        console.log('\tHold: ' + chalk.red(this.cryptoHold.toString()));
    }
    
    public update() {
        this.onChange$.next(this);
    }
}