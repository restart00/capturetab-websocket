export default defineBackground(() => {
  type ScreenshotOptions = {
    url: string;
    withScroll?: boolean;
    scrollFactor?: number;
    scrollTimeout?: number;
    removeFixedElements?: boolean;
  };

  // Test using popup
  browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    getScreenshot(msg as ScreenshotOptions)
      .then(async screenshot => {
        const screenshotUrl = URL.createObjectURL(await fetch(screenshot as string).then(res => res.blob()));
        await browser.tabs.create({ url: screenshotUrl });
      })
  });

  // Test using WebSocket
  const MAX_CONCURRENT_TASKS = 5;
  const taskQueue: any = [];
  let activeTasks = 0;

  const ws = new WebSocket('ws://localhost:8080');

  ws.onmessage = async (event) => {
    const msg = JSON.parse(event.data);
    console.log('received msg:', msg);

    if (msg.type === 'screenshot') {
      taskQueue.push(msg.options);

      if (activeTasks < MAX_CONCURRENT_TASKS) {
        startTask(taskQueue.shift());
      }
    }
  };

  const startTask = async (options: ScreenshotOptions) => {
    activeTasks++;
    const screenshot = await getScreenshot(options);
    ws.send(JSON.stringify({ type: 'screenshot', screenshot }));

    activeTasks--;

    if (taskQueue.length > 0) {
      startTask(taskQueue.shift());
    }
  };

  const getScreenshot = async ({ url, withScroll = false, scrollFactor = 1, scrollTimeout = 500, removeFixedElements = false }: ScreenshotOptions) => {
    const tab = await browser.tabs.create({ url });
    // wait for the tab to finish loading
    await new Promise<void>(resolve => {
      browser.tabs.onUpdated.addListener(function listener(tabId, changeInfo, tab) {
        if (tabId === tab.id && changeInfo.status === 'complete') {
          browser.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      });
    });
    // get full page width and height
    const dimensions = await browser.tabs.executeScript(tab.id, {
      code: '({ width: document.body.scrollWidth, height: document.body.scrollHeight, innerHeight: window.innerHeight });',
    });

    const { width, height, innerHeight } = dimensions[0];

    let fullScreenshot = null;
    let screenshots = [];

    if (withScroll) {
      let removedFixedElements = false;
      // scroll and capture
      let screenshotHeight = Math.floor(innerHeight * scrollFactor);
      for (let y = 0; y < height; y += screenshotHeight) {
        await browser.tabs.executeScript(tab.id, { code: `window.scrollTo(0, ${y})` });
        // remove fixed elements from the second screenshot onwards
        if (y > 0 && removeFixedElements && !removedFixedElements) {
          // wait for the page to show fixed header
          await sleep(500);
          await browser.tabs.executeScript(tab.id, {
            code: `
              const fixedElements = Array.from(document.querySelectorAll('*')).filter(el => {
                const style = window.getComputedStyle(el);
                return style.position === 'fixed' || style.position === 'sticky';
              });
          
              // Remove all fixedElements
              for (const element of fixedElements) {
                element.remove();
              }
            `,
          });
          removedFixedElements = true;
        }
        // wait for content to load
        await sleep(scrollTimeout);
        // Last screeshot: adjust height to avoid capturing empty space
        if (y + screenshotHeight > height) {
          screenshotHeight = height - y;
        }
        const screenshot = await browser.tabs.captureTab(tab.id, { format: 'jpeg', quality: 75, rect: { x: 0, y, width, height: screenshotHeight } });
        screenshots.push(screenshot);
      }
    }
    else {
      fullScreenshot = await browser.tabs.captureTab(tab.id, { format: 'jpeg', quality: 75, rect: { x: 0, y: 0, width, height } });
    }

    if (screenshots.length > 0) {
      fullScreenshot = await stitchAllImages(screenshots);
    }

    console.log(fullScreenshot);

    // close tab
    await browser.tabs.remove(tab.id as number);

    return fullScreenshot;
  };

  const stitchAllImages = async (images: string[]) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

    let totalHeight = 0;
    const loadedImages = [];

    for (const image of images) {
      const img = new Image();
      img.src = image;
      await new Promise(resolve => img.onload = resolve);
      totalHeight += img.height;
      loadedImages.push(img);
    }

    canvas.width = loadedImages[0].width;
    canvas.height = totalHeight;

    let currentHeight = 0;
    for (const img of loadedImages) {
      ctx.drawImage(img, 0, currentHeight);
      currentHeight += img.height;
    }

    // determine image format
    const imageType = images[0].split(';')[0].split('/')[1];

    return canvas.toDataURL(`image/${imageType}`);
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
});