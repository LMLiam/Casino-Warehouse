import { GameApp } from './app/shell/GameApp';
import './styles/main.css';

const app = document.querySelector<HTMLElement>('#app');
if (!app) {
  throw new Error('Missing #app root.');
}

await new GameApp(app).start();
