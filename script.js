let expressionDisplay = document.getElementById('expression');
let resultDisplay = document.getElementById('result');
let memory = 0;

function insert(value) {
  expressionDisplay.textContent += value;
}

function clearAll() {
  expressionDisplay.textContent = '';
  resultDisplay.textContent = '0';
}

function delChar() {
  expressionDisplay.textContent = expressionDisplay.textContent.slice(0, -1);
}

function calculate() {
  try {
    const exp = expressionDisplay.textContent
      .replace(/÷/g, '/')
      .replace(/×/g, '*')
      .replace(/−/g, '-');
    let result = eval(exp);
    resultDisplay.textContent = result;
  } catch {
    resultDisplay.textContent = 'Error';
  }
}

function memoryAdd() {
  memory += Number(resultDisplay.textContent) || 0;
}
function memorySubtract() {
  memory -= Number(resultDisplay.textContent) || 0;
}
function memoryRecall() {
  expressionDisplay.textContent += memory;
}
function memoryClear() {
  memory = 0;
}
