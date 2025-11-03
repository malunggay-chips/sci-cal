// SciCal — fx-82MS style (click-only)
// Full logic: function parser (shunting-yard) + evaluation + SHIFT + memory + ANS + DRG (DEG/RAD)
// IMPORTANT: All interactions via clickable buttons only.

(() => {
  // DOM refs
  const exprEl = document.getElementById('expr');
  const resultEl = document.getElementById('result');
  const calc = document.getElementById('calculator');

  // State
  let expression = '';
  let ans = 0;
  let memory = 0;
  let shift = false;
  let alpha = false;
  let drg = 'DEG'; // or RAD
  const degreeIndicator = document.getElementById('drg-ind');

  // update DRG indicator
  function updateDrg() { degreeIndicator.textContent = drg; }

  updateDrg();

  // Utility helpers
  function setExpr(s) { expression = s; exprEl.textContent = expression; }
  function appendExpr(s) { expression += s; exprEl.textContent = expression; }
  function setResult(s) { resultEl.textContent = s; }

  // Clear / delete
  function allClear() { expression=''; setExpr(''); setResult('0'); }
  function deleteLast(){ expression = expression.slice(0,-1); setExpr(expression); }

  // Scientific toggle: SHIFT behavior mapping
  const shiftMap = new Map([
    ['sin(', 'asin('],
    ['cos(', 'acos('],
    ['tan(', 'atan('],
    ['log(', '10^('],
    ['ln(', 'e^('],
    ['√(', '^2'],
    // add others as needed
  ]);

  // Tokenizer & Parser (shunting-yard) - supports:
  // numbers (including exponent notation like 1.23E-4),
  // functions (sin, cos, tan, asin, acos, atan, ln, log, sqrt, 10^, e^, etc),
  // operators + - * / ^, percent (%) unary minus, parentheses
  function tokenize(input) {
    // Normalize input: remove spaces
    let s = input.replace(/\s+/g,'');
    const tokens = [];
    const reNumber = /^(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?/;
    while (s.length) {
      // number
      const m = s.match(reNumber);
      if (m) {
        tokens.push({type:'number', value: m[0]});
        s = s.slice(m[0].length);
        continue;
      }
      // functions or names (letters)
      const fn = s.match(/^[a-zA-Z]+(\()?/);
      if (fn) {
        const name = fn[0];
        // if followed by '(' include '(' as separate token sometimes, but simpler: take name optionally with '('
        if (name.endsWith('(')) {
          tokens.push({type:'func', value: name.slice(0,-1)});
          tokens.push({type:'paren', value:'('});
          s = s.slice(name.length);
        } else {
          tokens.push({type:'name', value:name});
          s = s.slice(name.length);
        }
        continue;
      }
      // single char tokens
      const ch = s[0];
      if (ch === '(' || ch === ')') { tokens.push({type:'paren', value:ch}); s = s.slice(1); continue; }
      if ('+-*/^,'.includes(ch)) { tokens.push({type:'op', value:ch}); s = s.slice(1); continue; }
      if (ch === '%'){ tokens.push({type:'percent'}); s = s.slice(1); continue; }
      // unknown token — attempt to parse sqrt symbol or special strings
      if (s.startsWith('√')) { tokens.push({type:'func', value:'sqrt'}); s = s.slice(1); continue; }
      // fallback single char
      tokens.push({type:'op', value:ch});
      s = s.slice(1);
    }
    return tokens;
  }

  function shuntingYard(tokens){
    const out = [];
    const ops = [];
    const prec = {'+':2,'-':2,'*':3,'/':3,'^':4};
    const rightAssoc = {'^':true};
    for (let i=0;i<tokens.length;i++){
      const t = tokens[i];
      if (t.type === 'number') out.push(t);
      else if (t.type === 'name'){
        // treat 'Ans' or 'EXP' or variable names as numbers resolved later
        out.push({type:'var', value:t.value});
      }
      else if (t.type === 'func') {
        ops.push(t);
      }
      else if (t.type === 'op') {
        while (ops.length) {
          const top = ops[ops.length-1];
          if (top.type === 'op' && ((rightAssoc[t.value] ? (prec[t.value] < prec[top.value]) : (prec[t.value] <= prec[top.value])))) {
            out.push(ops.pop());
          } else break;
        }
        ops.push(t);
      }
      else if (t.type === 'paren') {
        if (t.value === '(') ops.push(t);
        else { // ')'
          while (ops.length && ops[ops.length-1].value !== '(') out.push(ops.pop());
          if (ops.length && ops[ops.length-1].value === '(') ops.pop();
          if (ops.length && ops[ops.length-1].type === 'func') out.push(ops.pop());
        }
      }
      else if (t.type === 'percent') {
        // percent is a postfix operator: represent as op '%'
        out.push({type:'percent'});
      }
    }
    while (ops.length) {
      const o = ops.pop();
      out.push(o);
    }
    return out;
  }

  function toNumber(tok) {
    // tok is string possibly with E or e
    const n = Number(tok);
    if (isNaN(n)) throw new Error('Invalid number');
    return n;
  }

  function evalPostfix(post) {
    const stack = [];
    for (let i=0;i<post.length;i++){
      const t = post[i];
      if (t.type === 'number') stack.push(toNumber(t.value));
      else if (t.type === 'var') {
        const v = t.value;
        if (v.toUpperCase() === 'ANS') stack.push(ans);
        else if (v.toUpperCase() === 'PI' || v.toUpperCase() === 'π') stack.push(Math.PI);
        else if (v.toUpperCase() === 'E') stack.push(Math.E);
        else stack.push(0); // unknown var fallback
      }
      else if (t.type === 'percent') {
        let a = stack.pop();
        stack.push(a/100);
      }
      else if (t.type === 'op') {
        if (t.value === ',') { // ignore for now (function arg separators)
          continue;
        }
        if (t.value === '+') {
          const b = stack.pop(); const a = stack.pop(); stack.push(a+b);
        } else if (t.value === '-') {
          const b = stack.pop(); const a = stack.pop(); stack.push(a-b);
        } else if (t.value === '*') {
          const b = stack.pop(); const a = stack.pop(); stack.push(a*b);
        } else if (t.value === '/') {
          const b = stack.pop(); const a = stack.pop(); stack.push(a/b);
        } else if (t.value === '^') {
          const b = stack.pop(); const a = stack.pop(); stack.push(Math.pow(a,b));
        } else {
          throw new Error('Unknown operator ' + t.value);
        }
      }
      else if (t.type === 'func') {
        // function name is in t.value
        // but our shunting yard pushes function nodes as {type:'func', value: 'sin'} only when initially present, sometimes functions appear as op nodes? We ensured functions get pushed
        const fname = t.value.toLowerCase();
        if (fname === 'sin' || fname === 'cos' || fname === 'tan' || fname === 'asin' || fname === 'acos' || fname === 'atan') {
          let a = stack.pop();
          // DRG handling: input for sin/cos/tan is in degrees if DRG==='DEG'
          if (['sin','cos','tan'].includes(fname)) {
            if (drg === 'DEG') a = a * Math.PI / 180;
            // if GRAD, not implemented — would convert differently
          }
          let res;
          if (fname === 'sin') res = Math.sin(a);
          if (fname === 'cos') res = Math.cos(a);
          if (fname === 'tan') res = Math.tan(a);
          if (fname === 'asin') {
            res = Math.asin(a);
            if (drg === 'DEG') res = res * 180 / Math.PI;
          }
          if (fname === 'acos') {
            res = Math.acos(a);
            if (drg === 'DEG') res = res * 180 / Math.PI;
          }
          if (fname === 'atan') {
            res = Math.atan(a);
            if (drg === 'DEG') res = res * 180 / Math.PI;
          }
          stack.push(res);
        }
        else if (fname === 'ln') {
          const a = stack.pop(); stack.push(Math.log(a));
        }
        else if (fname === 'log') {
          const a = stack.pop(); stack.push(Math.log10 ? Math.log10(a) : Math.log(a)/Math.LN10);
        }
        else if (fname === 'sqrt') {
          const a = stack.pop(); stack.push(Math.sqrt(a));
        }
        else if (fname === '10^' || fname === '10^(' || fname === '10^x') {
          const a = stack.pop(); stack.push(Math.pow(10,a));
        }
        else if (fname === 'e^' || fname === 'e^(') {
          const a = stack.pop(); stack.push(Math.exp(a));
        }
        else if (fname === 'pow10') {
          const a = stack.pop(); stack.push(Math.pow(10,a));
        }
        else if (fname === 'abs') {
          const a = stack.pop(); stack.push(Math.abs(a));
        }
        else {
          throw new Error('Unknown function: '+fname);
        }
      } else {
        // node probably produced by our parser (ops as objects)
        if (t.value && typeof t.value === 'string') {
          // e.g. sentinel for function saved earlier: handle common names
          const n = t.value.toLowerCase();
          if (n==='sin' || n==='cos' || n==='tan' || n==='asin' || n==='acos' || n==='atan' || n==='ln' || n==='log' || n==='sqrt' || n==='10^' || n==='e^') {
            // call same logic by pushing back onto stream as func
            const node = {type:'func', value:t.value};
            // recursively evaluate one node to let above branch handle
            postInsertEval(node, stack);
          } else {
            throw new Error('Unhandled node ' + JSON.stringify(t));
          }
        } else {
          throw new Error('Unhandled token during evaluation: ' + JSON.stringify(t));
        }
      }
    }
    if (stack.length !== 1) throw new Error('Bad expression');
    return stack[0];
  }

  // Helper used above to evaluate embedded nodes (rare)
  function postInsertEval(node, stack) {
    const fname = node.value.toLowerCase();
    if (fname === 'sin' || fname === 'cos' || fname === 'tan' || fname === 'asin' || fname === 'acos' || fname === 'atan') {
      let a = stack.pop();
      if (['sin','cos','tan'].includes(fname)) {
        if (drg === 'DEG') a = a * Math.PI / 180;
      }
      let res;
      if (fname === 'sin') res = Math.sin(a);
      if (fname === 'cos') res = Math.cos(a);
      if (fname === 'tan') res = Math.tan(a);
      if (fname === 'asin') { res = Math.asin(a); if (drg === 'DEG') res = res * 180 / Math.PI; }
      if (fname === 'acos') { res = Math.acos(a); if (drg === 'DEG') res = res * 180 / Math.PI; }
      if (fname === 'atan') { res = Math.atan(a); if (drg === 'DEG') res = res * 180 / Math.PI; }
      stack.push(res);
    } else if (fname === 'ln') { stack.push(Math.log(stack.pop())); }
    else if (fname === 'log') { const a = stack.pop(); stack.push(Math.log10 ? Math.log10(a) : Math.log(a)/Math.LN10); }
    else if (fname === 'sqrt') { stack.push(Math.sqrt(stack.pop())); }
    else if (fname === '10^' || fname==='10^(') { const a = stack.pop(); stack.push(Math.pow(10,a)); }
    else if (fname==='e^' || fname==='e^(') { const a = stack.pop(); stack.push(Math.exp(a)); }
    else throw new Error('Unknown func '+fname);
  }

  // High level calculate
  function calculateExpression(raw) {
    if (!raw || raw.trim()==='') return 0;
    // replace some visual tokens users might have inserted
    let input = raw.replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-').replace(/π/g,'PI');
    // Convert '^2' which may have been created by SHIFT on sqrt
    // We'll also ensure 10^ and e^ remain functions when building tokens: user might have created '10^(' inserted by shift.
    // Tokenize then shuntingYard then evaluate
    try {
      const tokens = tokenize(input);
      const postfix = shuntingYard(tokens);
      const value = evalPostfix(postfix);
      if (!isFinite(value)) throw new Error('Non-finite');
      return value;
    } catch (e) {
      throw e;
    }
  }

  // Dispatch handlers for keys
  function handleAction(action) {
    switch(action) {
      case 'shift': shift = !shift; alpha = false; highlightShift(); break;
      case 'alpha': alpha = !alpha; shift = false; highlightAlpha(); break;
      case 'mode': /* mode behaviour not implemented fully */ alert('MODE not implemented (COMP/STAT/TBL)'); break;
      case 'on': allClear(); break;
      case 'del': deleteLast(); break;
      case 'ac': allClear(); break;
      case 'ans': appendExpr(String(ans)); break;
      case 'exp': appendExpr('E'); break;
      case 'rcl': appendExpr(String(memory)); break;
      case 'mplus': memory += Number(safeEvalResult()); break;
      case 'mminus': memory -= Number(safeEvalResult()); break;
      case 'mr': appendExpr(String(memory)); break;
      case 'drg': drg = drg==='DEG'?'RAD':'DEG'; updateDrg(); break;
      case 'rnd': appendExpr(String((Math.random()).toFixed(8))); break;
      case 'calc': performCalc(); break;
      default: console.log('unknown action', action);
    }
  }

  function safeEvalResult(){
    try {
      const r = calculateExpression(expression);
      return r;
    } catch {
      return 0;
    }
  }

  function performCalc(){
    try {
      const r = calculateExpression(expression);
      // Format result similar to calculator: show up to 10 significant digits, remove trailing zeros
      let out = String(r);
      // choose fixed or exponential depending
      if (Math.abs(r) !== 0 && (Math.abs(r) < 1e-9 || Math.abs(r) >= 1e10)) {
        out = r.toExponential(9).replace(/\.?0+e/,'e');
      } else {
        out = Number(r.toPrecision(12)).toString();
      }
      setResult(out);
      ans = r;
    } catch (e) {
      setResult('Error');
    }
  }

  // Visual helpers for SHIFT / ALPHA
  function highlightShift(){
    // Toggle CSS on SHIFT key; also switch visible labels where applicable
    const shiftBtn = document.querySelector('[data-action="shift"]');
    if (shift) shiftBtn.style.boxShadow='inset 0 -3px 0 rgba(0,0,0,0.5)';
    else shiftBtn.style.boxShadow='';
    // swap labels for keys that contain data-shift attributes
    document.querySelectorAll('[data-shift]').forEach(el=>{
      if (shift) {
        el.dataset.orig = el.textContent;
        el.textContent = el.getAttribute('data-shift');
      } else {
        if (el.dataset.orig) el.textContent = el.dataset.orig;
      }
    });
  }
  function highlightAlpha(){
    const alphaBtn = document.querySelector('[data-action="alpha"]');
    if (alpha) alphaBtn.style.boxShadow='inset 0 -3px 0 rgba(0,0,0,0.5)';
    else alphaBtn.style.boxShadow='';
  }

  // map button token to actual insertion (respect SHIFT)
  function handleToken(token, el) {
    // if SHIFT active and element has data-shift then insert that instead
    if (shift && el && el.dataset && el.dataset.shift) {
      const s = el.dataset.shift;
      // If the shift token is something like '^2', we append '^2'
      appendExpr(s);
      shift = false; highlightShift();
      return;
    }
    if (token === '%') {
      // percent applies to previous number: append % and let parser treat it as postfix
      appendExpr('%');
      return;
    }
    if (token === 'E') {
      appendExpr('E');
      return;
    }
    // default: append token
    appendExpr(token);
  }

  // attach handlers
  document.querySelectorAll('.key').forEach(k=>{
    k.addEventListener('click', (ev)=>{
      ev.preventDefault();
      const action = k.dataset.action;
      const token = k.dataset.token;
      if (action) handleAction(action);
      else if (token) handleToken(token,k);
    });
  });

  // ensure clicking display does nothing
  exprEl.addEventListener('click', ()=>{ /* no keyboard */ });

  // initialize
  allClear();

  // Expose for debugging
  window.SciCal = {
    appendExpr, allClear, performCalc, setResult
  };

})();
