import {BigNumber} from "bignumber.js/bignumber";

export class Fill {
    public id: string;
    public time: Date;
    public size: BigNumber;
    public price: BigNumber;
}