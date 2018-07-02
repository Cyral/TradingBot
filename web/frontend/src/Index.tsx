import {h, render, Component} from 'preact';
import "./Style.styl";
import App from './App';

const root = document.getElementById('app');

// HMR
declare let module: any;
if (module.hot)
    module.hot.accept();
root.innerHTML = '';

render(<App/>, root);