let expressionDisplay = document.getElementById("expression");
let resultDisplay = document.getElementById("result");
let expression = "";
let lastAnswer = 0;

function insert(value) {
  if (value === "Ans") {
    expression += lastAnswer;
  } else {
    expression += value;
  }
  expressionDisplay.textContent = expression;
}

function clearAll() {
  expression = "";
  expressionDisplay.textContent = "";
  resultDisplay.textContent = "0";
}

function deleteLast() {
  expression = expression.slice(0, -1);
  expressionDisplay.textContent = expression;
}

function calculate() {
  try {
    let exp = expression
      .replace(/√/g, "Math.sqrt")
      .replace(/\^/g, "**")
      .replace(/sin/g, "Math.sin")
      .replace(/cos/g, "Math.cos")
      .replace(/tan/g, "Math.tan")
      .replace(/log/g, "Math.log10")
      .replace(/ln/g, "Math.log");

    // Convert degrees to radians for trig functions
    exp = exp.replace(
      /Math\.(sin|cos|tan)\(([^)]+)\)/g,
      (_, fn, angle) => `Math.${fn}(${angle} * Math.PI / 180)`
    );

    let result = Function(`"use strict"; return (${exp})`)();
    if (isNaN(result) || result === Infinity) throw new Error();

    resultDisplay.textContent = result.toPrecision(10).replace(/\.?0+$/, "");
    lastAnswer = result;
  } catch {
    resultDisplay.textContent = "Error";
  }
}
