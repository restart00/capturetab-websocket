const urlInput = document.querySelector('#url') as HTMLInputElement;
const withScrollInput = document.querySelector('#withScroll') as HTMLInputElement;
const scrollFactorInput = document.querySelector('#scrollFactor') as HTMLInputElement;
const scrollTimeoutInput = document.querySelector('#scrollTimeout') as HTMLInputElement;
const removeFixedElementsInput = document.querySelector('#removeFixedElements') as HTMLInputElement;
const submitButton = document.querySelector('#submit') as HTMLButtonElement;

submitButton.onclick = async () => {
  const url = urlInput.value;
  const withScroll = withScrollInput.checked;
  const scrollFactor = parseFloat(scrollFactorInput.value);
  const scrollTimeout = parseInt(scrollTimeoutInput.value);
  const removeFixedElements = removeFixedElementsInput.checked;

  browser.runtime.sendMessage({ url, withScroll, scrollFactor, scrollTimeout, removeFixedElements });
};