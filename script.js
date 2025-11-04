const result = document.getElementById("result");
const history = document.getElementById("history");

let expression = "";

document.querySelectorAll(".btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const value = btn.innerText;

    if (value === "AC") {
      expression = "";
      result.textContent = "0";
      history.textContent = "";
    } else if (value === "DEL") {
      expression = expression.slice(0, -1);
      result.textContent = expression || "0";
    } else if (value === "=") {
      try {
        history.textContent = expression;
        expression = expression
          .replace(/×/g, "*")
          .replace(/÷/g, "/")
          .replace(/−/g, "-")
          .replace(/π/g, Math.PI)
          .replace(/√/g, "Math.sqrt");
        let answer = eval(expression);
        result.textContent = answer;
        expression = answer.toString();
      } catch {
        result.textContent = "Error";
        expression = "";
      }
    } else {
      expression += value;
      result.textContent = expression;
    }
  });
});
