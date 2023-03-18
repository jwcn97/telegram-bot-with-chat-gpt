pm2 stop index && pm2 delete index
git pull origin main
npm run build
pm2 start dist/index.js --max-memory-restart 300M
