#!/bin/bash

echo "Install plugin launched 🚀"
unset npm_config_prefix > /dev/null 2>&1
source ~/.zshrc > /dev/null 2>&1

echo "which node : $(which node)"
echo "which npm : $(which npm)"
echo "Installation of Puppetter/Chrome Browser v121.0.6167.85"
npx puppeteer browsers install chrome@121.0.6167.85 > /dev/null 2>&1
echo "Installation on the plugin Lighthouse-ecoindex"
npm install -g lighthouse-plugin-ecoindex > /dev/null 2>&1

echo "Install puppeteer browser and plugin done. 🎉"