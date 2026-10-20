import {defineConfig} from '@playwright/test';

export default defineConfig({
 testDir:'./tests/pages',timeout:60000,workers:1,reporter:'list',
 use:{baseURL:'http://127.0.0.1:4280/RhineLab-frontend/',viewport:{width:1920,height:1080}},
 webServer:{command:'npm run preview -- --base=/RhineLab-frontend/ --port 4280 --strictPort',url:'http://127.0.0.1:4280/RhineLab-frontend/',reuseExistingServer:false}
});
