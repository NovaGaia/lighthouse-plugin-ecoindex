echo "updateContentCommand STARTING ⏳"
echo "install lhci"
npm install -g @lhci/cli@0.12.0
echo "install lighthouse"
npm install -g lighthouse
echo "install puppeteer browsers"
npx puppeteer browsers install chrome@121.0.6167.85
echo "install puppeteer"
npm install -g puppeteer
echo "chmod 666 /var/run/docker.sock"
sudo chmod 666 /var/run/docker.sock
cd /workspace/lighthouse-plugin-ecoindex && npm link
echo "updateContentCommand ENDED 🎉"

echo "Chrome installation STARTING ⏳"
apt-get update --fix-missing && apt-get -y upgrade && apt-get install -y git wget gnupg && apt-get clean

wget --quiet --output-document=- https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor > /etc/apt/trusted.gpg.d/google-archive.gpg
sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list'
apt-get update
apt-get install google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 -y --no-install-recommends
rm -rf /var/lib/apt/lists/*
echo "Chrome installation ENDED 🎉"