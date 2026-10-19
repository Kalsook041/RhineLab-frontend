import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',timeout:20000,fullyParallel:false,workers:1,reporter:'list',
 use:{baseURL:'http://127.0.0.1:4173',viewport:{width:1280,height:800},trace:'retain-on-failure'},
 webServer:{command:'npm run dev -- --port 4173 --strictPort',url:'http://127.0.0.1:4173',reuseExistingServer:!process.env.CI}
});
