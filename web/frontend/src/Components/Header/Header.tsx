import {h, render, Component} from 'preact';
import './Header.styl';
import Controls from '../Controls/Controls';
import Stats from '../Stats/Stats';

export interface HeaderProps {

}

export default class Header extends Component<HeaderProps, any> {
    constructor() {
        super();
    }
    
    render(props: HeaderProps) {
        return (
            <header id="top-header" class="clearfix">
                <nav class="navbar">
                    <a class="navbar-brand">Trader</a>
                </nav>
                <Controls/>
                <Stats/> 
            </header>
        );
    }
}

