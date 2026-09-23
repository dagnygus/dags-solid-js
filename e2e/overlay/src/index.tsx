/* @refresh reload */
import { render } from 'solid-js/web'
import './index.css'
import App from './App.tsx'
import { Router } from '@solidjs/router';
import { routers } from './routes.ts';

const root = document.getElementById('root')

render(() => <Router root={App}>{routers}</Router>, root!)
