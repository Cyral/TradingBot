import {h, render, Component} from 'preact';
import "./HighlightNumber.styl";

declare type BigNumber = any;

export interface HighlightNumberProps {
    places?: number,
    value: BigNumber,
    type?: HighlightType,
}


export default class HighlightNumber extends Component<HighlightNumberProps, any> {
    constructor() {
        super();
    }

    formatSignificant(size: number, places: number) {
        const str = size.toFixed(places).toString();
        let num = "";
        let zeroes = "";

        for (let i = str.length - 1; i >= 0; i--) {
            if ((str[i] === "0" || str[i] === ".") && i > 0) {
                zeroes = str[i] + zeroes;
            } else {
                num = str.substring(0, i + 1);
                break;
            }
        }

        return (<span>{num}<span class="insig-num">{zeroes}</span></span>);
    }

    formatDecimal(size: number, places: number) {
        const str = size.toFixed(places).toString().split('.');
        let num = str[0];
        let dec = str[1];

        return (<span><span class="nondec-num">{num}.</span>{dec}</span>);
    }

    render(props: HighlightNumberProps) {
        let num;
        if (!props.type || props.type === HighlightType.Significant) {
            num = this.formatSignificant(props.value, props.places || 8);
        } else if (props.type === HighlightType.Decimal) {
            num = this.formatDecimal(props.value, props.places || 2);
        }

        return (<span>{num}</span>);
    }
}

export enum HighlightType {
    Significant = 1,
    Decimal = 2,
}