import { WebSocketServer } from 'ws';
import fs from 'fs';

const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', async (ws) => {
  ws.on('message', (message) => {
    const data = JSON.parse(message);
    if (data.type === 'screenshot') {
      const base64Data = data.screenshot.replace(/^data:image\/jpeg;base64,/, '');
      const filename = `screenshot-${Date.now()}.jpeg`;
      fs.writeFile(`screenshots/${filename}`, base64Data, 'base64', (err) => {
        if (err) {
          console.error(err);
        } else {
          console.log(`Screenshot saved to ${filename}`);
        }
      });
    }
  });

  const options = {
    url: 'https://stackoverflow.com/questions/11715646/scroll-automatically-to-the-bottom-of-the-page',
    withScroll: true,
    scrollFactor: 1,
    scrollTimeout: 500,
    removeFixedElements: true,
  };

  // simulate sending 10 urls to take screenshots
  for (let i = 0; i < 10; i++) {
    ws.send(JSON.stringify({ type: 'screenshot', options }));
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
});

console.log('WebSocket server is running on port 8080');