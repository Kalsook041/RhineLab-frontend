import './styles.css';
import {sceneMarkup} from './scenes/sceneElements';
import {createSceneController} from './interaction/sceneController';

const app=document.getElementById('app');
if(!app)throw new Error('Missing application root');
app.innerHTML=sceneMarkup();
const controller=createSceneController();
if(import.meta.hot)import.meta.hot.dispose(()=>controller.destroy());
